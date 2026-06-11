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


async def create_session(
    db: AsyncSession,
    user: User,
    refresh_token: str,
) -> UserSession:
    # Remove any stale row for this token (e.g. concurrent refresh race).
    await db.execute(delete(UserSession).where(UserSession.token == refresh_token))
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE)
    session = UserSession(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    return session


async def get_valid_session(db: AsyncSession, refresh_token: str) -> UserSession | None:
    result = await db.execute(
        select(UserSession).where(
            UserSession.token == refresh_token,
            UserSession.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    await db.execute(delete(UserSession).where(UserSession.token == refresh_token))


async def revoke_all_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(UserSession).where(UserSession.user_id == user_id))