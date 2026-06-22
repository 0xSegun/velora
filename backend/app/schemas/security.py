"""
Security and MFA schemas.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class MfaSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    backup_codes: list[str]


class MfaEnableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


class MfaDisableRequest(BaseModel):
    password: str
    code: str = Field(..., min_length=6, max_length=12)


class MfaVerifyRequest(BaseModel):
    challenge_token: str
    code: str = Field(..., min_length=6, max_length=12)


class MfaChallengeResponse(BaseModel):
    mfa_required: bool = True
    challenge_token: str
    message: str = "Two-factor authentication code required"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class SessionResponse(BaseModel):
    id: str
    device_label: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_active_at: datetime | None
    expires_at: datetime
    is_current: bool


class SecurityOverviewResponse(BaseModel):
    mfa_enabled: bool
    password_changed_at: datetime | None
    active_sessions: int
    failed_logins_24h: int
    successful_logins_24h: int
    security_alerts: list[dict]
    recent_audit: list[dict]


class LoginHistoryEntry(BaseModel):
    id: str
    event_type: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    status: str
    device_label: str | None = None