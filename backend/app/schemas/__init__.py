"""
Pydantic v2 schemas for Velora API.
"""

from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import AdminUserUpdate, UserResponse, UserUpdate
from app.schemas.prediction import (
    PredictionCompareRequest,
    PredictionHistory,
    PredictionRequest,
    PredictionResponse,
)
from app.schemas.economic_data import (
    CountryDataResponse,
    EconomicDataCreate,
    EconomicDataResponse,
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "GoogleAuthRequest",
    "UserResponse",
    "UserUpdate",
    "AdminUserUpdate",
    "PredictionRequest",
    "PredictionResponse",
    "PredictionHistory",
    "PredictionCompareRequest",
    "EconomicDataResponse",
    "EconomicDataCreate",
    "CountryDataResponse",
    "NotificationCreate",
    "NotificationResponse",
    "NotificationListResponse",
    "UnreadCountResponse",
]
