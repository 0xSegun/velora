"""
Public endpoints — site settings, page analytics, maintenance status.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import analytics_service, site_settings_service
from app.services.analytics_tracker import track_event

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/settings")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    """Public site settings for landing page, SEO, and dashboard copy."""
    return await site_settings_service.get_public_settings(db)


@router.get("/maintenance")
async def maintenance_status(db: AsyncSession = Depends(get_db)):
    settings = await site_settings_service.get_public_settings(db)
    general = settings.get("general", {})
    return {
        "maintenance": bool(general.get("maintenance", False)),
        "message": general.get(
            "maintenanceMessage",
            "We are performing scheduled maintenance. Please check back shortly.",
        ),
    }


@router.post("/track/page-view")
async def track_page_view(
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record a page view for analytics (public, no auth required)."""
    config = await analytics_service.get_analytics_config(db)
    if not config.get("tracking_enabled", True):
        return {"tracked": False}

    path = str(payload.get("path", "/"))
    referrer = str(payload.get("referrer", ""))[:500]
    title = str(payload.get("title", ""))[:200]

    await track_event(
        db,
        event_type="page_view",
        metadata={"path": path, "referrer": referrer, "title": title},
        request=request,
        broadcast=True,
    )
    await db.commit()
    return {"tracked": True}