import logging
import secrets
from functools import cached_property
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("app.config")

_WEAK_SECRETS = {"", "change-me", "change-me-to-a-random-secret", "secret", "changeme"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    database_url: str = "sqlite:///./nutrition.db"
    secret_key: str = ""
    access_token_expire_minutes: int = 60
    jwt_algorithm: str = "HS256"

    cookie_name: str = "ns_admin_session"
    cookie_samesite: Literal["strict", "lax", "none"] = "strict"
    cookie_secure: bool = False

    cors_origins: str = "http://localhost:4200"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    trust_proxy: bool = False

    upload_dir: str = "./uploads"
    max_upload_mb: int = 5

    order_prefix: str = "NS"
    max_qty_per_line: int = 20

    admin_email: str = ""
    admin_password: str = ""

    @model_validator(mode="after")
    def _harden(self) -> "Settings":
        if self.environment == "production":
            if self.secret_key in _WEAK_SECRETS or len(self.secret_key) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to a random value of at least 32 characters in production."
                )
            if self.database_url.startswith("sqlite"):
                logger.warning("SQLite is not recommended in production; use PostgreSQL.")
            self.cookie_secure = True
            if self.allowed_hosts.strip() in {"", "*"}:
                raise ValueError("ALLOWED_HOSTS must list your real domain(s) in production.")
        elif self.secret_key in _WEAK_SECRETS:
            # Ephemeral key: sessions reset at every restart, which is fine for local work.
            self.secret_key = secrets.token_urlsafe(48)
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true (HTTPS).")
        return self

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @cached_property
    def allowed_host_list(self) -> list[str]:
        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
