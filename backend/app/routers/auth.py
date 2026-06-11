"""
Authentication endpoints — register, login, refresh, password reset, Google OAuth.
"""

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    DefaultAdminCredentials,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.user import UserResponse
from app.services import auth_config_service, auth_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account."""
    return await auth_service.register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and receive JWT tokens."""
    return await auth_service.login_user(db, payload, request=request)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh an expired access token."""
    return await auth_service.refresh_tokens(db, payload.refresh_token)


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a password-reset email."""
    return await auth_service.forgot_password(db, payload)


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a valid reset token."""
    return await auth_service.reset_password(db, payload)


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify a user's email address."""
    return await auth_service.verify_email(db, payload)


@router.get("/default-admin", response_model=DefaultAdminCredentials | None)
async def default_admin_credentials():
    """Expose default admin login for local/demo environments."""
    return auth_service.get_default_admin_credentials()


@router.get("/google-config")
async def google_public_config(db: AsyncSession = Depends(get_db)):
    """Public Google OAuth config for the sign-in UI."""
    return await auth_config_service.get_public_google_config(db)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_auth(
    request: Request,
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via Google OAuth ID token."""
    return await auth_service.google_oauth_login(db, payload, request=request)


@router.post("/logout")
async def logout(
    payload: LogoutRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logout and revoke the refresh token session."""
    refresh_token = payload.refresh_token if payload else None
    return await auth_service.logout_user(db, refresh_token)
