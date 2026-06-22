"""
World Bank Open Data API ORM models.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base_types import pg_enum


class WorldBankSyncStatus(str, enum.Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class WorldBankApiConfig(Base):
    __tablename__ = "world_bank_api_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_name: Mapped[str] = mapped_column(
        String(120), nullable=False, default="World Bank Open Data"
    )
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str] = mapped_column(
        Text, nullable=False, default="https://api.worldbank.org/v2"
    )
    refresh_interval: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failed_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[WorldBankSyncStatus] = mapped_column(
        pg_enum(WorldBankSyncStatus), nullable=False, default=WorldBankSyncStatus.IDLE
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


class WorldBankApiLog(Base):
    __tablename__ = "world_bank_api_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("world_bank_api_config.id", ondelete="SET NULL"),
        nullable=True,
    )
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    request_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    countries_synced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class WorldBankCountryData(Base):
    __tablename__ = "world_bank_country_data"
    __table_args__ = (
        UniqueConstraint("country_code", "data_year", name="uq_world_bank_country_data_code_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    wb_country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    country_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    data_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    inflation_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    gdp_growth_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    gdp_usd_billions: Mapped[float | None] = mapped_column(Float, nullable=True)
    government_debt_pct_gdp: Mapped[float | None] = mapped_column(Float, nullable=True)
    unemployment_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_account_pct_gdp: Mapped[float | None] = mapped_column(Float, nullable=True)
    indicators_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )