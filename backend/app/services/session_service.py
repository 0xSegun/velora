"""
User session management — refresh token storage and revocation.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.user_session import UserSession

settings = get_settings()


def _device_label(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    browser = "Browser"
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "edg" in ua:
        browser = "Edge"
    os = "Unknown OS"
    if "windows" in ua:
        os = "Windows"
    elif "mac" in ua:
        os = "macOS"
    elif "iphone" in ua or "ipad" in ua:
        os = "iOS"
    elif "android" in ua:
        os = "Android"
    elif "linux" in ua:
        os = "Linux"
    return f"{browser} on {os}"


async def create_session(
    db: AsyncSession,
    user: User,
    refresh_token: str,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> UserSession:
    # Remove any stale row for this token (e.g. concurrent refresh race).
    await db.execute(delete(UserSession).where(UserSession.token == refresh_token))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE)
    session = UserSession(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent,
        device_label=_device_label(user_agent),
        last_active_at=now,
    )
    db.add(session)
    await db.flush()
    return session


async def get_valid_session(db: AsyncSession, refresh_token: str) -> UserSession | None:
    result = await db.execute(
        select(UserSession).where(
            UserSession.token == refresh_token,
            UserSession.expires_at > datetime.now(timezone.utc),
            UserSession.revoked_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    await db.execute(delete(UserSession).where(UserSession.token == refresh_token))


async def revoke_all_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(UserSession).where(UserSession.user_id == user_id))