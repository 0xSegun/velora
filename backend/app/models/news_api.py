"""
External news API ORM models.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base_types import pg_enum


class NewsProvider(str, enum.Enum):
    NEWSAPI = "newsapi"
    GNEWS = "gnews"
    GENERIC = "generic"


class NewsSyncStatus(str, enum.Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class NewsApiConfig(Base):
    __tablename__ = "news_api_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider: Mapped[NewsProvider] = mapped_column(
        pg_enum(NewsProvider), nullable=False, default=NewsProvider.NEWSAPI
    )
    provider_name: Mapped[str] = mapped_column(
        String(120), nullable=False, default="NewsAPI.org"
    )
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str] = mapped_column(
        Text, nullable=False, default="https://newsapi.org/v2"
    )
    refresh_interval: Mapped[str] = mapped_column(String(20), nullable=False, default="hourly")
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[NewsSyncStatus] = mapped_column(
        pg_enum(NewsSyncStatus), nullable=False, default=NewsSyncStatus.IDLE
    )
    articles_retrieved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class NewsApiLog(Base):
    __tablename__ = "news_api_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("news_api_config.id", ondelete="SET NULL"), nullable=True
    )
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    request_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    articles_fetched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)