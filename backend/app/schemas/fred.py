"""
FRED API Pydantic schemas.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FredFeatureConfig(BaseModel):
    include_lag_variables: bool = True
    include_rolling_means: bool = True
    include_moving_averages: bool = True
    include_percentage_changes: bool = True
    include_growth_rates: bool = True
    input_sequence_length: int = Field(24, ge=6, le=120)
    forecast_horizon: int = Field(6, ge=1, le=36)
    normalization_method: Literal["minmax", "zscore", "robust"] = "minmax"


class FredIndicatorUpdate(BaseModel):
    indicator_code: str
    enabled: bool


class FredConfigUpdate(BaseModel):
    provider_name: str | None = Field(None, max_length=100)
    api_key: str | None = Field(None, max_length=500)
    base_url: str | None = Field(None, max_length=500)
    refresh_interval: Literal["hourly", "daily", "weekly", "monthly"] | None = None
    date_range: Literal["1y", "3y", "5y", "10y", "max"] | None = None
    data_frequency: Literal["daily", "weekly", "monthly", "quarterly"] | None = None
    prediction_enabled: bool | None = None
    sync_enabled: bool | None = None
    historical_storage_enabled: bool | None = None
    feature_config: FredFeatureConfig | None = None
    indicators: list[FredIndicatorUpdate] | None = None

    @field_validator("api_key", "provider_name", "base_url", mode="before")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v


class FredTestRequest(BaseModel):
    api_key: str | None = Field(None, max_length=500)

    @field_validator("api_key", mode="before")
    @classmethod
    def strip_api_key(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v


class FredIndicatorResponse(BaseModel):
    id: UUID
    indicator_code: str
    indicator_name: str
    category: str
    description: str
    frequency: str
    field_mapping: str
    enabled: bool
    last_updated: datetime | None

    model_config = {"from_attributes": True}


class FredConfigResponse(BaseModel):
    id: UUID
    provider_name: str
    api_key_masked: str
    api_key_set: bool
    base_url: str
    refresh_interval: str
    date_range: str
    data_frequency: str
    prediction_enabled: bool
    sync_enabled: bool
    historical_storage_enabled: bool
    is_active: bool
    last_sync: datetime | None
    last_failed_sync: datetime | None
    next_sync: datetime | None
    sync_status: str
    records_retrieved: int
    error_count: int
    success_count: int
    feature_config: dict
    indicators: list[FredIndicatorResponse]
    created_at: datetime
    updated_at: datetime


class FredTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: float | None = None
    status_code: int | None = None
    diagnostics: dict = Field(default_factory=dict)


class FredHealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    provider: str
    status: str
    is_active: bool
    response_time_ms: float | None
    last_sync: datetime | None
    last_failed_sync: datetime | None
    next_sync: datetime | None
    error_count: int
    success_count: int
    success_rate: float | None
    sync_status: str
    records_retrieved: int
    indicators_enabled: int
    data_quality_score: float | None
    model_feature_count: int
    using_cached_data: bool = False
    failover_warning: str | None = None


class FredLogResponse(BaseModel):
    id: UUID
    endpoint: str
    request_timestamp: datetime
    response_time_ms: float | None
    status_code: int | None
    success: bool
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FredAuditLogResponse(BaseModel):
    id: UUID
    action: str
    changed_fields: dict
    admin_user_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FredDataPointResponse(BaseModel):
    indicator_code: str
    indicator_name: str
    value: float
    observation_date: date
    frequency: str
    source: str
    retrieved_at: datetime

    model_config = {"from_attributes": True}


class FredAnalyticsResponse(BaseModel):
    trends: dict[str, list[dict]]
    summary: dict
    heatmap: list[dict]
    country_comparison: list[dict]