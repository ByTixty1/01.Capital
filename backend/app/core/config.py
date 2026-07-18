"""Application configuration — Pydantic settings sourced from environment."""

from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT = "change-me-in-every-environment"
_DEV_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"


class Settings(BaseSettings):
    """All runtime configuration. Defaults are dev-only; production must set explicitly."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    log_level: str = "INFO"

    # API
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://01capital:01capital@localhost:5432/01capital"

    # Email — Gmail SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = "zeroone.techcompany@gmail.com"
    smtp_password: str = ""  # Gmail App Password — set in Render env vars
    email_from: str = "01 Capital <zeroone.techcompany@gmail.com>"

    # Qareen hackathon prototype (see ADR-0009) — narrow/optional, no DB access.
    anthropic_api_key: str = ""

    # Dev auth bypass — disables email verification + MFA on /auth/dev/* endpoints.
    # Set to True locally and on Render while testing; flip to False before real customers.
    dev_auth_bypass: bool = False

    # Rate limiting — disable only for local e2e runs where one IP registers
    # many users in quick succession; never disable in deployed environments.
    rate_limit_enabled: bool = True

    # Auth
    jwt_secret_key: str = _INSECURE_JWT
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24h

    # Field-level encryption for PII (national IDs, MFA secrets) — 32-byte hex = 64 chars
    field_encryption_key: str = _DEV_ENCRYPTION_KEY

    @field_validator("debug", mode="before")
    @classmethod
    def _coerce_debug(cls, v: object) -> bool:
        """Tolerate non-bool env strings like 'release', '0', 'false' without crashing."""
        if isinstance(v, bool):
            return v
        return str(v).strip().lower() in ("1", "true", "yes", "on")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _fix_database_url(self) -> "Settings":
        """Transform postgres(ql):// to postgresql+asyncpg:// for SQLAlchemy compat."""
        if self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if self.environment != "production":
            return self
        errors: list[str] = []
        if self.jwt_secret_key == _INSECURE_JWT:
            errors.append("JWT_SECRET_KEY must be changed from the insecure default")
        if self.debug:
            errors.append("DEBUG must be False in production")
        if "localhost" in self.database_url or "01capital:01capital" in self.database_url:
            errors.append("DATABASE_URL must not use local/default credentials in production")
        if self.field_encryption_key == _DEV_ENCRYPTION_KEY:
            errors.append("FIELD_ENCRYPTION_KEY must be changed from the dev default in production")
        if len(self.field_encryption_key) != 64:
            errors.append("FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)")
        if errors:
            raise ValueError(
                "Refusing to start in production with insecure configuration:\n"
                + "\n".join(f"  - {e}" for e in errors)
            )
        return self


settings = Settings()
