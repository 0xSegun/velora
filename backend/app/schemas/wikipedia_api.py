"""
Wikipedia REST API configuration schemas.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.imf_api import CountryContextImf
from app.schemas.trading_economics_api import CountryContextTradingEconomics
from app.schemas.world_bank_api import CountryContextWorldBank


class WikipediaSourceConfig(BaseModel):
    """Countries and page title overrides for Wikipedia context sync."""
    country_codes: list[str] = Field(default_factory=lambda: ["NG", "US", "GB", "GH"])
    economy_title_template: str = Field(
        default="Economy_of_{wikipedia_name}",
        description="Wikipedia page title template for economy articles",
    )
    central_bank_title_template: str = Field(
        default="Central_Bank_of_{wikipedia_name}",
        description="Wikipedia page title template for central bank articles",
    )
    title_overrides: dict[str, dict[str, str]] = Field(
        default_factory=lambda: {
            "US": {
                "economy": "Economy_of_the_United_States",
                "central_bank": "Federal_Reserve",
            },
            "GB": {
                "economy": "Economy_of_the_United_Kingdom",
                "central_bank": "Bank_of_England",
            },
        },
        description="Per-country Wikipedia title overrides (ISO2 keys)",
    )


class WikipediaConfigResponse(BaseModel):
    id: str
    provider_name: str
    base_url: str
    user_agent: str
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


class WikipediaConfigUpdate(BaseModel):
    provider_name: str | None = None
    base_url: str | None = None
    user_agent: str | None = None
    refresh_interval: Literal["daily", "weekly", "monthly"] | None = None
    sync_enabled: bool | None = None
    is_active: bool | None = None
    source_config: WikipediaSourceConfig | dict | None = None


class WikipediaTestRequest(BaseModel):
    country_code: str = "NG"


class WikipediaTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: int | None = None
    economy_title: str | None = None
    central_bank_title: str | None = None


class WikipediaHealthResponse(BaseModel):
    status: str
    provider: str
    is_active: bool
    sync_status: str
    last_sync: datetime | None
    next_sync: datetime | None
    countries_synced: int
    success_rate: float | None
    using_cached_data: bool


class CountryContextWikipedia(BaseModel):
    country_code: str
    country_name: str
    economy_title: str | None = None
    economy_summary: str | None = None
    economy_url: str | None = None
    central_bank_title: str | None = None
    central_bank_summary: str | None = None
    central_bank_url: str | None = None
    source: str = "wikipedia"
    cached: bool = True
    fetched_at: datetime | None = None


class CountryContextResponse(BaseModel):
    country_code: str
    country_name: str
    imf: CountryContextImf | None = None
    world_bank: CountryContextWorldBank | None = None
    trading_economics: CountryContextTradingEconomics | None = None
    wikipedia: CountryContextWikipedia | None = None