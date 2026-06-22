"""
Velora Application Configuration.

Loads all environment variables using pydantic-settings BaseSettings.
"""

from functools import lru_cache

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Velora"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api"

    # PostgreSQL
    POSTGRES_USER: str = "inflation_app"
    POSTGRES_PASSWORD: str = "InflationDb2026!"
    POSTGRES_DB: str = "inflation_prediction_db"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = ""

    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ENCRYPTION_KEY: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_SECRET: str = "change-me-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ACCESS_TOKEN_EXPIRE: int = 30
    REFRESH_TOKEN_EXPIRE: int = 7

    # Redis (optional — session cache / rate limiting)
    REDIS_URL: str = ""

    # Email (console | smtp | resend | auto)
    EMAIL_MODE: str = "auto"
    EMAIL_FROM: str = ""
    EMAIL_HOST: str = ""
    EMAIL_PORT: int = 587
    EMAIL_USERNAME: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_USE_TLS: bool = True
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # External APIs
    FRED_API_KEY: str = ""
    NEWS_API_KEY: str = ""
    IMF_API_KEY: str = ""
    TRADING_ECONOMICS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Admin seed (change in production)
    ADMIN_EMAIL: str = "admin@inflationplatform.com"
    ADMIN_PASSWORD: str = "Admin123!"
    ADMIN_FIRST_NAME: str = "Platform"
    ADMIN_LAST_NAME: str = "Admin"
    SHOW_DEFAULT_ADMIN_CREDENTIALS: bool = True

    # Storage
    UPLOAD_DIR: str = "uploads"
    PDF_DIR: str = "generated_pdfs"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET_KEY or self.JWT_SECRET

    @staticmethod
    def _normalize_async_database_url(url: str) -> str:
        """Convert Render/Heroku postgres URLs to asyncpg SQLAlchemy format."""
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @computed_field  # type: ignore[prop-decorator]
    @property
    def effective_database_url(self) -> str:
        if self.DATABASE_URL:
            return self._normalize_async_database_url(self.DATABASE_URL)
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic migrations (psycopg2)."""
        from urllib.parse import quote_plus

        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        password = quote_plus(self.POSTGRES_PASSWORD)
        user = quote_plus(self.POSTGRES_USER)
        return (
            f"postgresql://{user}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.is_production:
            return [self.FRONTEND_URL]
        return ["*"]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — call this instead of constructing Settings directly."""
    return Settings()