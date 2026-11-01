from fastapi import Request

from app.config import settings


def client_ip(request: Request) -> str:
    """Best-effort client IP. Forwarded headers are only trusted behind your own proxy."""
    if settings.trust_proxy:
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()[:64]
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # The rightmost entry is the one appended by our trusted proxy.
            return forwarded.split(",")[-1].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]
