"""
Exchange rate API ORM models.
"""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from app.models.base_types import pg_enum
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RefreshInterval(str, enum.Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


class SyncStatus(str, enum.Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class PeriodType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ExchangeRateApiConfig(Base):
    __tablename__ = "exchange_rate_api_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_name: Mapped[str] = mapped_column(String(100), nullable=False, default="ExchangeRate-API")
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str] = mapped_column(
        Text, nullable=False, default="https://v6.exchangerate-api.com"
    )
    base_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    refresh_interval: Mapped[RefreshInterval] = mapped_column(
        pg_enum(RefreshInterval), nullable=False, default=RefreshInterval.HOURLY
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[SyncStatus] = mapped_column(
        pg_enum(SyncStatus), nullable=False, default=SyncStatus.IDLE
    )
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


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint("base_currency", "target_currency", name="uq_exchange_rates_base_target"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    base_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    target_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    exchange_rate: Mapped[float] = mapped_column(Float, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False, default="ExchangeRate-API")


class ExchangeRateHistory(Base):
    __tablename__ = "exchange_rate_history"
    __table_args__ = (
        UniqueConstraint(
            "base_currency",
            "target_currency",
            "period_type",
            "period_date",
            name="uq_exchange_rate_history_period",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    base_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    target_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    exchange_rate: Mapped[float] = mapped_column(Float, nullable=False)
    period_type: Mapped[PeriodType] = mapped_column(pg_enum(PeriodType), nullable=False)
    period_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False, default="ExchangeRate-API")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ExchangeRateApiLog(Base):
    __tablename__ = "exchange_rate_api_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    request_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    response_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    rate_limit_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ExchangeRateAuditLog(Base):
    __tablename__ = "exchange_rate_audit_logs"

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