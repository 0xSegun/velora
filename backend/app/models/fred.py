"""
FRED API ORM models.
"""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base_types import pg_enum


class FredSyncStatus(str, enum.Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class FredApiConfig(Base):
    __tablename__ = "fred_api_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Federal Reserve Economic Data (FRED)"
    )
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str] = mapped_column(
        Text, nullable=False, default="https://api.stlouisfed.org/fred"
    )
    refresh_interval: Mapped[str] = mapped_column(
        String(20), nullable=False, default="daily"
    )
    date_range: Mapped[str] = mapped_column(String(20), nullable=False, default="5y")
    data_frequency: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    prediction_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    historical_storage_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[FredSyncStatus] = mapped_column(
        pg_enum(FredSyncStatus), nullable=False, default=FredSyncStatus.IDLE
    )
    records_retrieved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feature_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class FredIndicator(Base):
    __tablename__ = "fred_indicators"
    __table_args__ = (UniqueConstraint("indicator_code", name="uq_fred_indicators_code"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    indicator_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    indicator_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    frequency: Mapped[str] = mapped_column(String(30), nullable=False, default="Monthly")
    field_mapping: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class FredEconomicData(Base):
    __tablename__ = "fred_economic_data"
    __table_args__ = (
        UniqueConstraint(
            "indicator_code",
            "observation_date",
            name="uq_fred_economic_data_code_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    indicator_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    indicator_name: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    observation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    frequency: Mapped[str] = mapped_column(String(30), nullable=False, default="Monthly")
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="FRED")
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class FredApiLog(Base):
    __tablename__ = "fred_api_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    request_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    response_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class FredAuditLog(Base):
    __tablename__ = "fred_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    changed_fields: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )