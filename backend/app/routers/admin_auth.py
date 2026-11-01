from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.net import client_ip
from app.core.rate_limit import limiter
from app.core.security import (
    create_session_token,
    hash_password,
    new_csrf_token,
    validate_password_strength,
    verify_password,
)
from app.dependencies import get_current_admin, get_db, verify_origin
from app.models.admin_user import AdminUser
from app.schemas.auth import LoginRequest, PasswordChange, SessionInfo
from app.services.audit_service import audit

router = APIRouter(prefix="/api/v1/admin/auth", tags=["Admin Auth"])

LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW = 15 * 60


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


@router.post("/login", response_model=SessionInfo, dependencies=[Depends(verify_origin)])
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    ip_key, email_key = f"login-ip:{ip}", f"login-email:{data.email}"
    # Lock out brute force per IP and per account (failures only count).
    for key in (ip_key, email_key):
        if limiter.count(key, LOGIN_WINDOW) >= LOGIN_MAX_FAILURES * (2 if key == ip_key else 1):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de tentatives. Réessayez dans quelques minutes.",
                headers={"Retry-After": str(limiter.retry_after(key, LOGIN_WINDOW))},
            )

    admin = db.query(AdminUser).filter(AdminUser.email == data.email).first()
    valid = verify_password(data.password, admin.password_hash if admin else None)
    if not admin or not valid or not admin.is_active:
        limiter.hit(ip_key, LOGIN_WINDOW)
        limiter.hit(email_key, LOGIN_WINDOW)
        audit(db, "login_failed", admin_email=data.email[:255], request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides")

    limiter.clear(email_key)
    admin.last_login_at = datetime.now(timezone.utc)
    audit(db, "login", admin=admin, request=request)
    db.commit()

    csrf = new_csrf_token()
    _set_cookie(response, create_session_token(admin.id, admin.token_version, csrf))
    return SessionInfo(admin_name=admin.full_name, email=admin.email, csrf_token=csrf)


@router.get("/me", response_model=SessionInfo)
def me(request: Request, admin: AdminUser = Depends(get_current_admin)):
    """Lets the SPA restore its session (and CSRF token) after a page reload."""
    return SessionInfo(admin_name=admin.full_name, email=admin.email, csrf_token=request.state.csrf_token)


@router.post("/logout", status_code=204)
def logout(response: Response):
    _clear_cookie(response)


@router.post("/logout-all", status_code=204)
def logout_all(
    request: Request,
    response: Response,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    admin.token_version += 1
    audit(db, "logout_all", admin=admin, request=request)
    db.commit()
    _clear_cookie(response)


@router.post("/change-password", status_code=204)
def change_password(
    data: PasswordChange,
    request: Request,
    response: Response,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
    error = validate_password_strength(data.new_password)
    if error:
        raise HTTPException(status_code=422, detail=error)
    admin.password_hash = hash_password(data.new_password)
    admin.token_version += 1
    audit(db, "password_changed", admin=admin, request=request)
    db.commit()
    _clear_cookie(response)
