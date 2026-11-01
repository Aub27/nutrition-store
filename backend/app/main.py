import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.routers import admin_auth, admin_catalog, admin_misc, public
from app.services.upload_service import upload_root

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    upload_root()
    yield


app = FastAPI(
    title="Nutrition Store API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Middleware order: the last one added is the outermost.
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
    max_age=600,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)

app.include_router(public.router)
app.include_router(admin_auth.router)
app.include_router(admin_catalog.router)
app.include_router(admin_misc.router)

app.mount("/media", StaticFiles(directory=str(upload_root())), name="media")


@app.exception_handler(Exception)
async def unhandled_exception(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Erreur interne du serveur."})


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}
