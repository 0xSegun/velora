"""
Authentication service — registration, login, token management, password reset, Google OAuth.
"""

import asyncio
import logging
import uuid
from datetime import timedelta

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import AuthProvider, User, UserRole
from app.services.analytics_tracker import track_event
from app.services.auth_config_service import get_google_oauth_config
from app.services.country_service import serialize_country
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.security import MfaChallengeResponse
from app.schemas.user import UserResponse
from app.services import email_service, session_service
from app.utils.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]

logger = logging.getLogger(__name__)
settings = get_settings()
_refresh_lock = asyncio.Lock()


# ── Helpers ───────────────────────────────────────────────────────────────────


def _user_response(user: User) -> UserResponse:
    meta = serialize_country(user.country)
    base = UserResponse.model_validate(user)
    return base.model_copy(
        update={
            "country_name": meta["name"],
            "country_flag": meta["flag"],
            "auth_provider": user.auth_provider,
        }
    )


def _client_meta(request=None) -> tuple[str | None, str | None]:
    if not request:
        return None, None
    ip = request.client.host if getattr(request, "client", None) else None
    ua = request.headers.get("user-agent") if hasattr(request, "headers") else None
    return ip, ua


async def issue_tokens_for_user(
    db: AsyncSession, user: User, *, request=None
) -> TokenResponse:
    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})
    ip, ua = _client_meta(request)
    await session_service.create_session(
        db, user, refresh, ip_address=ip, user_agent=ua
    )
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=_user_response(user),
    )


async def _build_tokens(db: AsyncSession, user: User, *, request=None) -> TokenResponse:
    return await issue_tokens_for_user(db, user, request=request)


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _send_registration_emails(user: User) -> None:
    token = create_access_token(
        {"sub": str(user.id), "purpose": "verify"},
        expires_delta=timedelta(hours=24),
    )
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    name = user.full_name or user.first_name or user.email

    await email_service.send_welcome_email(
        to=user.email,
        name=name,
        verify_url=verify_url,
    )
    await email_service.send_admin_new_user_email(
        admin_email=settings.ADMIN_EMAIL,
        user_email=user.email,
        user_name=name,
    )


# ── Public API ────────────────────────────────────────────────────────────────


async def register_user(db: AsyncSession, payload: RegisterRequest) -> TokenResponse:
    """Register a new user and return JWT tokens."""
    existing = await _get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    first_name, last_name = _split_name(payload.full_name)
    signup_role = UserRole.ANALYST if payload.role == "analyst" else UserRole.USER
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=first_name,
        last_name=last_name,
        full_name=payload.full_name,
        phone=payload.phone,
        institution=payload.institution,
        country=payload.country,
        role=signup_role,
        is_verified=False,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    try:
        await _send_registration_emails(user)
    except Exception:
        logger.warning("Failed to send registration emails to %s", user.email)

    await track_event(
        db,
        event_type="register",
        user_id=user.id,
        country_code=user.country,
    )
    return await _build_tokens(db, user)


async def login_user(
    db: AsyncSession,
    payload: LoginRequest,
    request=None,
) -> TokenResponse | MfaChallengeResponse:
    """Authenticate a user with email and password."""
    user = await _get_user_by_email(db, payload.email)
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not verify_password(payload.password, user.password_hash):
        if user:
            await track_event(db, event_type="login_failed", user_id=user.id, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    if user.mfa_enabled:
        from app.services.security_service import create_mfa_challenge

        return MfaChallengeResponse(challenge_token=create_mfa_challenge(user))
    await track_event(db, event_type="login", user_id=user.id, request=request)
    return await _build_tokens(db, user, request=request)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    """Issue new access + refresh tokens given a valid refresh token."""
    async with _refresh_lock:
        payload = verify_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        session = await session_service.get_valid_session(db, refresh_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated",
            )

        await session_service.revoke_session(db, refresh_token)
        await db.flush()
        tokens = await _build_tokens(db, user)
        await db.commit()
        return tokens


async def forgot_password(db: AsyncSession, payload: ForgotPasswordRequest) -> dict:
    """Send a password-reset email. Always returns success to avoid user enumeration."""
    user = await _get_user_by_email(db, payload.email)
    if user:
        token = create_password_reset_token(user.email)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        try:
            await email_service.send_password_reset_email(
                to=user.email,
                reset_url=reset_url,
            )
        except Exception:
            logger.warning("Failed to send reset email to %s", user.email)

    return {"message": "If the email exists, a reset link has been sent."}


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> dict:
    """Reset a user's password with a valid reset token."""
    token_data = verify_token(payload.token, expected_type="reset")
    email = token_data.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token",
        )

    user = await _get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.password_hash = hash_password(payload.new_password)
    await db.flush()

    try:
        await email_service.send_password_changed_email(
            to=user.email,
            name=user.full_name or user.first_name or user.email,
        )
    except Exception:
        logger.warning("Failed to send password-changed email to %s", user.email)

    return {"message": "Password has been reset successfully."}


async def verify_email(db: AsyncSession, payload: VerifyEmailRequest) -> dict:
    """Mark a user's email as verified using a verification token."""
    token_data = verify_token(payload.token, expected_type="access")
    if token_data.get("purpose") != "verify":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    user_id = token_data.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    user = await _get_user_by_id(db, uuid.UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_verified = True
    await db.flush()
    return {"message": "Email verified successfully."}


async def google_oauth_login(
    db: AsyncSession,
    payload: GoogleAuthRequest,
    request=None,
) -> TokenResponse:
    """Verify a Google ID token and create/login/link the user."""
    oauth_cfg = await get_google_oauth_config(db)
    if not oauth_cfg["enabled"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google Sign-In is disabled",
        )

    google_user = await _verify_google_token(db, payload.credential)
    google_sub = google_user.get("sub", "")
    g_email = google_user["email"]
    g_name = google_user.get("name", g_email.split("@")[0])
    g_first, g_last = _split_name(g_name)
    g_picture = google_user.get("picture")

    user = None
    if google_sub:
        result = await db.execute(select(User).where(User.google_id == google_sub))
        user = result.scalar_one_or_none()

    if not user:
        user = await _get_user_by_email(db, g_email)

    is_new = False
    if not user:
        is_new = True
        user = User(
            email=g_email,
            first_name=g_first,
            last_name=g_last,
            full_name=g_name,
            avatar_url=g_picture,
            google_id=google_sub or None,
            auth_provider=AuthProvider.GOOGLE.value,
            is_verified=True,
            is_active=True,
            role=UserRole.USER,
            country="NG",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if google_sub and not user.google_id:
            user.google_id = google_sub
            user.auth_provider = (
                AuthProvider.LINKED.value
                if user.password_hash
                else AuthProvider.GOOGLE.value
            )
        if g_picture:
            user.avatar_url = g_picture
        if not user.first_name:
            user.first_name = g_first
            user.last_name = g_last
            user.full_name = g_name
        user.is_verified = True
        await db.flush()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    await track_event(
        db,
        event_type="google_register" if is_new else "google_login",
        user_id=user.id,
        request=request,
        metadata={"provider": user.auth_provider},
    )
    return await _build_tokens(db, user)


async def logout_user(db: AsyncSession, refresh_token: str | None) -> dict:
    if refresh_token:
        await session_service.revoke_session(db, refresh_token)
    return {"message": "Successfully logged out."}


def get_default_admin_credentials() -> dict | None:
    """Return default admin credentials for demo login (non-production only)."""
    if settings.is_production or not settings.SHOW_DEFAULT_ADMIN_CREDENTIALS:
        return None
    return {
        "email": settings.ADMIN_EMAIL,
        "password": settings.ADMIN_PASSWORD,
        "name": f"{settings.ADMIN_FIRST_NAME} {settings.ADMIN_LAST_NAME}".strip(),
    }


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _verify_google_token(db: AsyncSession, credential: str) -> dict:
    """Verify the Google ID token via Google's tokeninfo endpoint."""
    oauth_cfg = await get_google_oauth_config(db)
    expected_client_id = oauth_cfg["client_id"]
    if not expected_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )
    data = resp.json()
    if data.get("aud") != expected_client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience mismatch",
        )
    return data