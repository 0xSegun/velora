"""
API configuration schemas.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApiCredentials(BaseModel):
    api_key: str | None = None
    secret_key: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    bearer_token: str | None = None
    oauth_credentials: dict | None = None


class ApiConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(..., min_length=1, max_length=100)
    api_type: str = "economic"
    endpoint_url: str
    base_url: str | None = None
    api_key: str | None = None
    credentials: dict = Field(default_factory=dict)
    custom_headers: dict = Field(default_factory=dict)
    refresh_frequency_hours: int = Field(default=24, ge=1, le=168)
    source_priority: int = Field(default=1, ge=1, le=100)
    country_filters: list[str] = Field(default_factory=list)
    report_categories: list[str] = Field(default_factory=list)
    is_active: bool = True


class ApiConfigUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    api_type: str | None = None
    endpoint_url: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    credentials: dict | None = None
    custom_headers: dict | None = None
    refresh_frequency_hours: int | None = Field(default=None, ge=1, le=168)
    source_priority: int | None = Field(default=None, ge=1, le=100)
    country_filters: list[str] | None = None
    report_categories: list[str] | None = None
    is_active: bool | None = None


class ApiConfigResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider: str
    api_type: str
    endpoint_url: str
    base_url: str | None
    api_key_set: bool
    credentials_set: dict
    custom_headers: dict
    refresh_frequency_hours: int
    source_priority: int
    country_filters: list
    report_categories: list
    is_active: bool
    health_status: str
    last_tested_at: datetime | None
    last_sync_at: datetime | None
    last_failed_sync_at: datetime | None
    usage_stats: dict
    health_metrics: dict
    logs: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiTestResponse(BaseModel):
    success: bool
    message: str
    health_status: str
    tested_at: datetime
    response_time_ms: float | None = None
    status_code: int | None = None
    diagnostics: dict = Field(default_factory=dict)


class ApiHealthOverview(BaseModel):
    total: int
    active: int
    healthy: int
    warning: int
    offline: int
    apis: list[dict]


class ApiLogsFilter(BaseModel):
    api_id: uuid.UUID | None = None
    status: str | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    limit: int = Field(default=100, ge=1, le=500)