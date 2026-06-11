"""
Notification endpoints and WebSocket stream.
"""

import uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory, get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import (
    create_notification,
    delete_notification,
    list_notifications,
    mark_all_read,
    mark_read,
    unread_count,
)
from app.services.notification_ws import notification_ws_manager
from app.utils.security import get_current_user, require_admin, verify_token

router = APIRouter(tags=["Notifications"])


@router.get("/api/notifications", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False,
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notifications for the authenticated user."""
    notifications = await list_notifications(
        db,
        user=current_user,
        limit=limit,
        unread_only=unread_only,
        type=type,
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        unread_count=await unread_count(db, user=current_user),
    )


@router.get("/api/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's unread notification count."""
    return UnreadCountResponse(unread_count=await unread_count(db, user=current_user))


@router.patch("/api/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark one notification as read."""
    notification = await mark_read(db, user=current_user, notification_id=notification_id)
    return NotificationResponse.model_validate(notification)


@router.patch("/api/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all current-user notifications as read."""
    updated = await mark_all_read(db, user=current_user)
    return {"updated": updated}


@router.delete("/api/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a current-user notification."""
    await delete_notification(db, user=current_user, notification_id=notification_id)


@router.post("/api/admin/notifications", response_model=NotificationResponse, dependencies=[Depends(require_admin)])
async def send_admin_notification(
    payload: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    """Create a notification for a target user. Defaults to the admin account."""
    notification = await create_notification(
        db,
        user_id=payload.user_id or admin.id,
        title=payload.title,
        message=payload.message,
        type=payload.type,
    )
    return NotificationResponse.model_validate(notification)


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket, token: str | None = None):
    """Authenticated current-user notification stream."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = verify_token(token, expected_type="access")
        user_id = uuid.UUID(str(payload.get("sub")))
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await notification_ws_manager.connect(user_id, websocket)
    try:
        await websocket.send_json({"event": "notifications.connected"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_ws_manager.disconnect(user_id, websocket)
    except Exception:
        notification_ws_manager.disconnect(user_id, websocket)
