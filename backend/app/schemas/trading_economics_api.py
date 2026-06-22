"""
Trading Economics API configuration schemas.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TradingEconomicsSourceConfig(BaseModel):
    """Countries and indicators to sync from Trading Economics."""
    country_codes: list[str] = Field(default_factory=lambda: ["NG", "US", "GB", "GH"])
    indicators: list[str] = Field(
        default_factory=lambda: [
            "Inflation Rate",
            "GDP Growth Rate",
            "GDP",
            "Government Debt to GDP",
            "Unemployment Rate",
            "Current Account to GDP",
        ],
    )
    preferred_year: int | None = Field(
        default=None,
        description="Year to store; defaults to latest available from snapshot",
    )


class TradingEconomicsConfigResponse(BaseModel):
    id: str
    provider_name: str
    base_url: str
    api_key_set: bool
    refresh_interval: str
    sync_enabled: bool
    is_active: bool
    source_config: dict
    last_sync: datetime | None
    last_failed_sync: datetime | None
    next_sync: datetime | None
    sync_status: str
    countries_synced: int
    error_count: int
    success_count: int


class TradingEconomicsConfigUpdate(BaseModel):
    provider_name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    refresh_interval: Literal["hourly", "daily", "weekly"] | None = None
    sync_enabled: bool | None = None
    is_active: bool | None = None
    source_config: TradingEconomicsSourceConfig | dict | None = None


class TradingEconomicsTestRequest(BaseModel):
    api_key: str | None = None
    country_code: str = "NG"


class TradingEconomicsTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: int | None = None
    sample_country: str | None = None
    indicators_found: int = 0


class TradingEconomicsHealthResponse(BaseModel):
    status: str
    provider: str
    is_active: bool
    sync_status: str
    last_sync: datetime | None
    next_sync: datetime | None
    countries_synced: int
    success_rate: float | None
    using_cached_data: bool


class CountryContextTradingEconomics(BaseModel):
    country_code: str
    country_name: str
    data_year: int | None = None
    inflation_pct: float | None = None
    gdp_growth_pct: float | None = None
    gdp_usd_billions: float | None = None
    government_debt_pct_gdp: float | None = None
    unemployment_pct: float | None = None
    current_account_pct_gdp: float | None = None
    source: str = "trading_economics"
    cached: bool = True
    retrieved_at: datetime | None = None