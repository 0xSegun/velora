"""
Record genuine platform analytics events.
"""

from __future__ import annotations

import uuid

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_event import AnalyticsEvent
from app.services.analytics_ws import analytics_ws_manager


async def track_event(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: uuid.UUID | None = None,
    country_code: str | None = None,
    metadata: dict | None = None,
    request: Request | None = None,
    broadcast: bool = True,
) -> None:
    ip_address = None
    user_agent = None
    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    event = AnalyticsEvent(
        event_type=event_type,
        user_id=user_id,
        country_code=country_code,
        event_metadata=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(event)
    await db.flush()

    if broadcast:
        await analytics_ws_manager.broadcast(
            {
                "type": "analytics_event",
                "event_type": event_type,
                "country_code": country_code,
                "metadata": metadata or {},
                "created_at": event.created_at.isoformat(),
            }
        )