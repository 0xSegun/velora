"""
Wikipedia REST API ORM models.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base_types import pg_enum


class WikipediaSyncStatus(str, enum.Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class WikipediaApiConfig(Base):
    __tablename__ = "wikipedia_api_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_name: Mapped[str] = mapped_column(
        String(120), nullable=False, default="Wikipedia REST API"
    )
    base_url: Mapped[str] = mapped_column(
        Text, nullable=False, default="https://en.wikipedia.org/api/rest_v1"
    )
    user_agent: Mapped[str] = mapped_column(
        Text, nullable=False, default="Velora/1.0 (economic-intelligence; contact@velora.app)"
    )
    refresh_interval: Mapped[str] = mapped_column(String(20), nullable=False, default="weekly")
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[WikipediaSyncStatus] = mapped_column(
        pg_enum(WikipediaSyncStatus), nullable=False, default=WikipediaSyncStatus.IDLE
    )
    countries_synced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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


class WikipediaCountryCache(Base):
    __tablename__ = "wikipedia_country_cache"
    __table_args__ = (UniqueConstraint("country_code", name="uq_wikipedia_country_cache_code"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    country_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    economy_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    economy_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    economy_thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)
    economy_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    central_bank_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    central_bank_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    central_bank_thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)
    central_bank_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )