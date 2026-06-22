"""
News API configuration schemas.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class NewsSourceConfig(BaseModel):
    """Preset outlets and query topics for economic news sync."""
    sources: list[str] = Field(
        default_factory=lambda: [
            "reuters", "bloomberg", "financial-times", "cnbc",
            "the-wall-street-journal", "business-insider",
        ],
        description="NewsAPI source identifiers",
    )
    queries: list[str] = Field(
        default_factory=lambda: [
            "inflation", "interest rates", "GDP", "exchange rate",
            "central bank", "oil prices", "monetary policy",
        ],
    )
    country_codes: list[str] = Field(default_factory=lambda: ["NG", "US", "GB", "GH"])


class NewsConfigResponse(BaseModel):
    id: str
    provider: str
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
    articles_retrieved: int
    error_count: int
    success_count: int


class NewsConfigUpdate(BaseModel):
    provider: Literal["newsapi", "gnews", "generic"] | None = None
    provider_name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    refresh_interval: Literal["hourly", "daily", "weekly"] | None = None
    sync_enabled: bool | None = None
    is_active: bool | None = None
    source_config: NewsSourceConfig | dict | None = None


class NewsTestRequest(BaseModel):
    api_key: str | None = None


class NewsTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: int | None = None
    sample_articles: int = 0


class NewsHealthResponse(BaseModel):
    status: str
    provider: str
    is_active: bool
    sync_status: str
    last_sync: datetime | None
    next_sync: datetime | None
    articles_retrieved: int
    success_rate: float | None
    using_cached_data: bool