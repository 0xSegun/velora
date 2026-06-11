"""
External API configuration ORM model.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from app.models.base_types import pg_enum
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ApiType(str, enum.Enum):
    ECONOMIC = "economic"
    REPORT = "report"
    NEWS = "news"
    FORECAST = "forecast"


class ApiHealthStatus(str, enum.Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


class ApiConfiguration(Base):
    __tablename__ = "api_configurations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    api_type: Mapped[ApiType] = mapped_column(pg_enum(ApiType), nullable=False)
    endpoint_url: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    credentials: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    custom_headers: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    refresh_frequency_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    source_priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    country_filters: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    report_categories: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    health_status: Mapped[ApiHealthStatus] = mapped_column(
        pg_enum(ApiHealthStatus), nullable=False, default=ApiHealthStatus.UNKNOWN
    )
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    usage_stats: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    logs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )