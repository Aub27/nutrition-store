from typing import Generator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.net import client_ip
from app.core.rate_limit import limiter
from app.core.security import constant_time_equals, decode_session_token
from app.database import SessionLocal
from app.models.admin_user import AdminUser

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-csrf-token"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_origin(request: Request) -> None:
    """Defence in depth for cookie auth: reject cross-origin state-changing requests."""
    if request.method in SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in settings.cors_origin_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin not allowed")


def get_current_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    token = request.cookies.get(settings.cookie_name)
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not token:
        raise unauthorized
    payload = decode_session_token(token)
    if payload is None:
        raise unauthorized

    if request.method not in SAFE_METHODS:
        verify_origin(request)
        header = request.headers.get(CSRF_HEADER, "")
        if not header or not constant_time_equals(header, str(payload["csrf"])):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing or invalid")

    try:
        admin_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise unauthorized
    admin = db.get(AdminUser, admin_id)
    if admin is None or not admin.is_active or admin.token_version != payload["tv"]:
        raise unauthorized
    request.state.csrf_token = payload["csrf"]
    return admin


def rate_limit(bucket: str, limit: int, window_seconds: int):
    """Dependency factory: at most `limit` calls per client IP within the window."""

    def dependency(request: Request) -> None:
        key = f"{bucket}:{client_ip(request)}"
        if not limiter.allow(key, limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes, veuillez réessayer plus tard.",
                headers={"Retry-After": str(limiter.retry_after(key, window_seconds))},
            )

    return dependency
