"""Password hashing, JWT session tokens and CSRF helpers."""
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

MIN_PASSWORD_LENGTH = 12
_MAX_BCRYPT_BYTES = 72

# Hash compared against when the account does not exist, so response time does not leak
# which e-mail addresses are registered.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-timing", bcrypt.gensalt(rounds=12)).decode()


def validate_password_strength(password: str) -> str | None:
    """Return an error message when the password is not acceptable, else None."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caractères."
    if len(password.encode("utf-8")) > _MAX_BCRYPT_BYTES:
        return "Le mot de passe est trop long (72 octets maximum)."
    classes = [
        any(c.islower() for c in password),
        any(c.isupper() for c in password),
        any(c.isdigit() for c in password),
        any(not c.isalnum() for c in password),
    ]
    if sum(classes) < 3:
        return "Utilisez au moins 3 types de caractères (minuscules, majuscules, chiffres, symboles)."
    return None


def hash_password(password: str) -> str:
    error = validate_password_strength(password)
    if error:
        raise ValueError(error)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    candidate = plain_password.encode("utf-8")
    if len(candidate) > _MAX_BCRYPT_BYTES:
        bcrypt.checkpw(b"x", _DUMMY_HASH.encode())
        return False
    target = (hashed_password or _DUMMY_HASH).encode("utf-8")
    ok = bcrypt.checkpw(candidate, target)
    return ok and hashed_password is not None


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def create_session_token(admin_id: int, token_version: int, csrf: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(admin_id),
        "tv": token_version,
        "csrf": csrf,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "csrf", "tv"]},
        )
    except jwt.PyJWTError:
        return None


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
