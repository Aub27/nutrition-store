"""Security headers and request-size guard."""
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                extra = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"referrer-policy": b"strict-origin-when-cross-origin",
                    b"permissions-policy": b"camera=(), microphone=(), geolocation=(), payment=()",
                    b"cross-origin-resource-policy": b"same-site",
                    b"content-security-policy": _API_CSP.encode(),
                }
                if settings.is_production:
                    extra[b"strict-transport-security"] = b"max-age=63072000; includeSubDomains"
                # Never let browsers/proxies cache personal data or admin responses.
                if path.startswith("/api/v1/admin") or path.startswith("/api/v1/orders"):
                    extra[b"cache-control"] = b"no-store"
                if path.startswith("/media/"):
                    extra.pop(b"content-security-policy")
                    extra[b"cross-origin-resource-policy"] = b"cross-origin"
                new_headers = [(k, v) for k, v in message.get("headers", []) if k.lower() not in extra]
                new_headers.extend(extra.items())
                message["headers"] = new_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


class BodySizeLimitMiddleware:
    """Reject requests whose declared body is too large before they reach the app."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.default_limit = 256 * 1024
        self.upload_limit = (settings.max_upload_mb + 1) * 1024 * 1024

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path: str = scope.get("path", "")
            limit = self.upload_limit if path.startswith("/api/v1/admin/uploads") else self.default_limit
            for name, value in scope.get("headers", []):
                if name == b"content-length":
                    try:
                        too_big = int(value) > limit
                    except ValueError:
                        too_big = True
                    if too_big:
                        await _reject(send, 413, b'{"detail":"Request body too large"}')
                        return
        await self.app(scope, receive, send)


async def _reject(send: Send, status: int, body: bytes) -> None:
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": body})
