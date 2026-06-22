"""
Wikipedia REST API admin endpoints — configuration, test, sync, health.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.wikipedia_api import (
    WikipediaConfigResponse,
    WikipediaConfigUpdate,
    WikipediaHealthResponse,
    WikipediaTestRequest,
    WikipediaTestResponse,
)
from app.models.wikipedia_api import WikipediaSyncStatus
from app.services import wikipedia_service
from app.services.api_sync_tasks import schedule_api_sync
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/wikipedia-api",
    tags=["Wikipedia API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=WikipediaConfigResponse)
async def get_wikipedia_config(db: AsyncSession = Depends(get_db)):
    return await wikipedia_service.get_full_config(db)


@admin_router.put("", response_model=WikipediaConfigResponse)
async def update_wikipedia_config(
    payload: WikipediaConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await wikipedia_service.update_config(db, admin=admin, payload=payload)
    await db.commit()
    return result


@admin_router.post("/test", response_model=WikipediaTestResponse)
async def test_wikipedia_connection(
    payload: WikipediaTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    body = payload or WikipediaTestRequest()
    result = await wikipedia_service.test_connection(
        db, country_code=body.country_code, admin_id=admin.id
    )
    return result


@admin_router.post("/sync")
async def manual_wikipedia_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    config = await wikipedia_service.get_config(db)
    if config.sync_status == WikipediaSyncStatus.SYNCING:
        return await schedule_api_sync(
            "wikipedia",
            wikipedia_service.sync_wikipedia_data,
            admin_id=admin.id,
            force=True,
            already_syncing=True,
        )
    config.sync_status = WikipediaSyncStatus.SYNCING
    await db.commit()
    return await schedule_api_sync(
        "wikipedia",
        wikipedia_service.sync_wikipedia_data,
        admin_id=admin.id,
        force=True,
    )


@admin_router.post("/enable", response_model=WikipediaConfigResponse)
async def enable_wikipedia_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await wikipedia_service.enable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.post("/disable", response_model=WikipediaConfigResponse)
async def disable_wikipedia_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await wikipedia_service.disable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.get("/health", response_model=WikipediaHealthResponse)
async def wikipedia_health(db: AsyncSession = Depends(get_db)):
    return await wikipedia_service.get_health(db)