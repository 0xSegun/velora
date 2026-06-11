"""
Exchange rate API Pydantic schemas.
"""

import re
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ExchangeRateConfigUpdate(BaseModel):
    provider_name: str | None = Field(None, max_length=100)
    api_key: str | None = Field(None, max_length=500)
    base_url: str | None = Field(None, max_length=500)
    base_currency: str | None = Field(None, max_length=10)
    refresh_interval: Literal["hourly", "daily", "weekly"] | None = None

    @field_validator("api_key", "provider_name", "base_url", "base_currency", mode="before")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("base_currency")
    @classmethod
    def validate_base_currency(cls, v: str | None) -> str | None:
        if v is not None and not re.fullmatch(r"[A-Za-z]{3}", v):
            raise ValueError("base_currency must be a 3-letter ISO code")
        return v.upper() if v else v


class ExchangeRateTestRequest(BaseModel):
    api_key: str | None = Field(None, max_length=500)

    @field_validator("api_key", mode="before")
    @classmethod
    def strip_api_key(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v


class ExchangeRateConfigResponse(BaseModel):
    id: UUID
    provider_name: str
    api_key_masked: str
    api_key_set: bool
    base_url: str
    base_currency: str
    refresh_interval: str
    is_active: bool
    last_sync: datetime | None
    next_sync: datetime | None
    sync_status: str
    error_count: int
    success_count: int
    created_at: datetime
    updated_at: datetime


class ExchangeRateTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: float | None = None
    status_code: int | None = None
    diagnostics: dict = Field(default_factory=dict)


class ExchangeRateHealthResponse(BaseModel):
    provider: str
    status: str
    is_active: bool
    response_time_ms: float | None
    last_sync: datetime | None
    next_sync: datetime | None
    error_count: int
    success_count: int
    success_rate: float | None
    sync_status: str


class ExchangeRateLogResponse(BaseModel):
    id: UUID
    endpoint: str
    request_timestamp: datetime
    response_time_ms: float | None
    success: bool
    error_message: str | None
    rate_limit_remaining: int | None
    status_code: int | None
    created_at: datetime


class ExchangeRateItem(BaseModel):
    id: UUID
    base_currency: str
    target_currency: str
    exchange_rate: float
    retrieved_at: datetime
    source: str
    country_code: str | None = None


class ExchangeRateCountryResponse(BaseModel):
    country_code: str
    country_name: str
    currency_code: str
    currency_name: str | None = None
    currency_symbol: str | None = None
    exchange_rate: float | None
    change_24h: float | None = None
    change_7d: float | None = None
    change_24h_pct: float | None = None
    change_7d_pct: float | None = None
    trend: str = "stable"
    last_updated: datetime | None = None
    is_stale: bool = False
    stale_message: str | None = None


class ExchangeRateAnalyticsResponse(BaseModel):
    strongest: list[dict]
    weakest: list[dict]
    most_volatile: list[dict]
    trends: list[dict]
    summary: dict


class ExchangeRateAuditLogResponse(BaseModel):
    id: UUID
    action: str
    changed_fields: dict
    admin_user_id: UUID | None
    admin_email: str | None = None
    created_at: datetime


class ExchangeRatePairRequest(BaseModel):
    base_currency: str = Field(..., min_length=3, max_length=3)
    target_currency: str = Field(..., min_length=3, max_length=3)
    amount: float | None = Field(None, gt=0)

    @field_validator("base_currency", "target_currency", mode="before")
    @classmethod
    def normalize_codes(cls, v: str) -> str:
        return v.strip().upper()


class ExchangeRateHistoricalRequest(BaseModel):
    base_currency: str = Field(..., min_length=3, max_length=3)
    year: int = Field(..., ge=1990, le=2100)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)
    amount: float | None = Field(None, gt=0)

    @field_validator("base_currency", mode="before")
    @classmethod
    def normalize_base(cls, v: str) -> str:
        return v.strip().upper()


class ExchangeRateEnrichedRequest(BaseModel):
    base_currency: str = Field(..., min_length=3, max_length=3)
    target_currency: str = Field(..., min_length=3, max_length=3)

    @field_validator("base_currency", "target_currency", mode="before")
    @classmethod
    def normalize_codes(cls, v: str) -> str:
        return v.strip().upper()