"""
Notification service functions.
"""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_settings import Notification, NotificationType
from app.models.user import User
from app.services.notification_ws import notification_ws_manager


def _coerce_type(value: str) -> NotificationType:
    try:
        return NotificationType(value)
    except ValueError:
        return NotificationType.INFO


def serialize_notification(notification: Notification) -> dict[str, Any]:
    return {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "title": notification.title,
        "message": notification.message,
        "type": notification.type.value,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    message: str,
    type: str = "info",
    emit: bool = True,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=_coerce_type(type),
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)

    if emit:
        await notification_ws_manager.send_to_user(
            user_id,
            {"event": "notification.created", "notification": serialize_notification(notification)},
        )

    return notification


async def list_notifications(
    db: AsyncSession,
    *,
    user: User,
    limit: int = 50,
    unread_only: bool = False,
    type: str | None = None,
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    if type:
        query = query.where(Notification.type == _coerce_type(type))

    result = await db.execute(query.order_by(Notification.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def unread_count(db: AsyncSession, *, user: User) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
        )
    )
    return int(result.scalar() or 0)


async def mark_read(db: AsyncSession, *, user: User, notification_id: uuid.UUID) -> Notification:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, *, user: User) -> int:
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    return int(result.rowcount or 0)





async def delete_notification(db: AsyncSession, *, user: User, notification_id: uuid.UUID) -> None:
    result = await db.execute(
        delete(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    if not result.rowcount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
