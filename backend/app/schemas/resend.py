"""
Resend email API Pydantic schemas.
"""

import re
from datetime import datetime
from email.utils import parseaddr
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# Resend accepts plain emails or "Display Name <email@domain.com>"
_EMAIL_IN_BRACKETS_RE = re.compile(r"<\s*([^<>]+?)\s*>")
_EMAIL_CORE_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _extract_email_address(value: str) -> str:
    bracket = _EMAIL_IN_BRACKETS_RE.search(value)
    if bracket:
        return bracket.group(1).strip()
    _name, addr = parseaddr(value)
    return (addr or value).strip()


def _is_valid_email(value: str) -> bool:
    if not _EMAIL_CORE_RE.fullmatch(value):
        return False
    local, _, domain = value.partition("@")
    return bool(local and domain and "." in domain)


def _validate_sender_address(value: str | None, *, plain_only: bool = False) -> str | None:
    if value is None:
        return value
    candidate = value.strip()
    if not candidate:
        return None

    email_part = _extract_email_address(candidate)
    if not _is_valid_email(email_part):
        if plain_only:
            raise ValueError("Invalid email address")
        raise ValueError(
            "Invalid sender address. Use email@domain.com or Display Name <email@domain.com>"
        )

    if plain_only:
        return email_part

    if "<" in candidate and ">" in candidate:
        if not _EMAIL_IN_BRACKETS_RE.search(candidate):
            raise ValueError(
                "Invalid sender address. Use email@domain.com or Display Name <email@domain.com>"
            )
        return candidate

    return email_part


class ResendConfigUpdate(BaseModel):
    provider_name: str | None = Field(None, max_length=100)
    api_key: str | None = Field(None, max_length=500)
    from_email: str | None = Field(None, max_length=255)
    reply_to: str | None = Field(None, max_length=255)
    open_tracking: bool | None = None
    click_tracking: bool | None = None

    @field_validator("api_key", "provider_name", "from_email", "reply_to", mode="before")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("from_email")
    @classmethod
    def validate_from_email(cls, v: str | None) -> str | None:
        return _validate_sender_address(v, plain_only=False)

    @field_validator("reply_to")
    @classmethod
    def validate_reply_to(cls, v: str | None) -> str | None:
        return _validate_sender_address(v, plain_only=True)


class ResendTestRequest(BaseModel):
    api_key: str | None = Field(None, max_length=500)

    @field_validator("api_key", mode="before")
    @classmethod
    def strip_api_key(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v


class ResendSendTestRequest(BaseModel):
    to: str = Field(..., max_length=255)
    api_key: str | None = Field(None, max_length=500)

    @field_validator("to", "api_key", mode="before")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("to")
    @classmethod
    def validate_to(cls, v: str | None) -> str | None:
        if v is not None and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("Invalid recipient email")
        return v


class ResendConfigResponse(BaseModel):
    id: UUID
    provider_name: str
    api_key_masked: str
    api_key_set: bool
    base_url: str
    from_email: str | None
    reply_to: str | None
    open_tracking: bool
    click_tracking: bool
    is_active: bool
    last_sync: datetime | None
    error_count: int
    success_count: int
    created_at: datetime
    updated_at: datetime


class ResendTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: float | None = None
    status_code: int | None = None
    diagnostics: dict = Field(default_factory=dict)


class ResendHealthResponse(BaseModel):
    provider: str
    status: str
    is_active: bool
    response_time_ms: float | None
    last_sync: datetime | None
    error_count: int
    success_count: int
    success_rate: float | None
    from_email: str | None
    domains_verified: int | None = None
    domains_total: int | None = None


class ResendLogResponse(BaseModel):
    id: UUID
    endpoint: str
    request_timestamp: datetime
    response_time_ms: float | None
    success: bool
    error_message: str | None
    status_code: int | None
    created_at: datetime


class ResendAuditLogResponse(BaseModel):
    id: UUID
    action: str
    changed_fields: dict
    admin_user_id: UUID | None
    admin_email: str | None = None
    created_at: datetime


class ResendStatisticsResponse(BaseModel):
    summary: dict
    event_breakdown: list[dict]
    domains: list[dict]
    recent_emails: list[dict]
    contacts_sample: list[dict]
    broadcasts: list[dict]
    api_usage: list[dict]