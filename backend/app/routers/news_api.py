"""
News API admin endpoints — configuration, test, sync, health.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.news_api import NewsApiLog
from app.models.user import User
from app.schemas.news_api import (
    NewsConfigResponse,
    NewsConfigUpdate,
    NewsHealthResponse,
    NewsTestRequest,
    NewsTestResponse,
)
from app.services import news_service
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/news-api",
    tags=["News API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=NewsConfigResponse)
async def get_news_config(db: AsyncSession = Depends(get_db)):
    return await news_service.get_full_config(db)


@admin_router.put("", response_model=NewsConfigResponse)
async def update_news_config(
    payload: NewsConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await news_service.update_config(db, admin=admin, payload=payload)
    await db.commit()
    return result


@admin_router.post("/test", response_model=NewsTestResponse)
async def test_news_connection(
    payload: NewsTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await news_service.test_connection(
        db, api_key_override=payload.api_key if payload else None, admin_id=admin.id
    )
    await db.commit()
    return result


@admin_router.post("/sync")
async def manual_news_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await news_service.sync_news(db, force=True, admin_id=admin.id)
    await db.commit()
    return result


@admin_router.post("/enable", response_model=NewsConfigResponse)
async def enable_news_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await news_service.enable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.post("/disable", response_model=NewsConfigResponse)
async def disable_news_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await news_service.disable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.get("/health", response_model=NewsHealthResponse)
async def news_health(db: AsyncSession = Depends(get_db)):
    return await news_service.get_health(db)


@admin_router.get("/logs")
async def news_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NewsApiLog).order_by(desc(NewsApiLog.request_timestamp)).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "endpoint": log.endpoint,
            "request_timestamp": log.request_timestamp.isoformat(),
            "response_time_ms": log.response_time_ms,
            "success": log.success,
            "status_code": log.status_code,
            "articles_fetched": log.articles_fetched,
            "error_message": log.error_message,
        }
        for log in logs
    ]