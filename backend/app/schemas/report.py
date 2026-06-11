"""
Report schemas.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    summary: str = ""
    content: dict = Field(default_factory=dict)
    report_type: str = "custom"
    country_code: str | None = None
    source: str = "Velora"
    source_url: str | None = None
    published_at: datetime | None = None
    metadata_extra: dict = Field(default_factory=dict)


class ReportResponse(BaseModel):
    id: uuid.UUID
    title: str
    summary: str
    content: dict
    report_type: str
    country_code: str | None
    source: str
    source_url: str | None
    published_at: datetime
    created_at: datetime
    metadata_extra: dict = {}

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    reports: list[ReportResponse]
    total: int
    page: int
    per_page: int