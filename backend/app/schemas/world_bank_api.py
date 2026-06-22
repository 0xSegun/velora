"""
World Bank Open Data API configuration schemas.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class WorldBankSourceConfig(BaseModel):
    """Countries and indicators to sync from World Bank Open Data."""
    country_codes: list[str] = Field(default_factory=lambda: ["NG", "US", "GB", "GH"])
    indicators: list[str] = Field(
        default_factory=lambda: [
            "FP.CPI.TOTL.ZG",
            "NY.GDP.MKTP.KD.ZG",
            "NY.GDP.MKTP.CD",
            "GC.DOD.TOTL.GD.ZS",
            "SL.UEM.TOTL.ZS",
            "BN.CAB.XOKA.GD.ZS",
        ],
    )
    date_range: str = Field(
        default="2015:2025",
        description="Year range for World Bank API date parameter",
    )
    preferred_year: int | None = Field(
        default=None,
        description="Year to store; defaults to latest available",
    )


class WorldBankConfigResponse(BaseModel):
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


class WorldBankConfigUpdate(BaseModel):
    provider_name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    refresh_interval: Literal["hourly", "daily", "weekly"] | None = None
    sync_enabled: bool | None = None
    is_active: bool | None = None
    source_config: WorldBankSourceConfig | dict | None = None


class WorldBankTestRequest(BaseModel):
    api_key: str | None = None
    country_code: str = "NG"


class WorldBankTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: int | None = None
    sample_country: str | None = None
    indicators_found: int = 0


class WorldBankHealthResponse(BaseModel):
    status: str
    provider: str
    is_active: bool
    sync_status: str
    last_sync: datetime | None
    next_sync: datetime | None
    countries_synced: int
    success_rate: float | None
    using_cached_data: bool


class CountryContextWorldBank(BaseModel):
    country_code: str
    country_name: str
    data_year: int | None = None
    inflation_pct: float | None = None
    gdp_growth_pct: float | None = None
    gdp_usd_billions: float | None = None
    government_debt_pct_gdp: float | None = None
    unemployment_pct: float | None = None
    current_account_pct_gdp: float | None = None
    source: str = "world_bank_open_data"
    cached: bool = True
    retrieved_at: datetime | None = None