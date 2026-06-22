"""
User profile schemas.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    full_name: str
    phone: str | None = None
    institution: str | None = None
    country: str
    country_name: str | None = None
    country_flag: str | None = None
    tracked_countries: list[str] = []
    timezone: str | None = None
    role: str
    auth_provider: str | None = None
    avatar_url: str | None = None
    is_verified: bool
    is_active: bool = True
    mfa_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    institution: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=10)
    timezone: str | None = Field(default=None, max_length=64)
    avatar_url: str | None = None


class AdminUserUpdate(UserUpdate):
    role: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    per_page: int
