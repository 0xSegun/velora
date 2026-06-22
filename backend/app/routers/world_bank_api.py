"""
World Bank Open Data API admin endpoints — configuration, test, sync, health.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.world_bank_api import WorldBankApiLog
from app.schemas.world_bank_api import (
    WorldBankConfigResponse,
    WorldBankConfigUpdate,
    WorldBankHealthResponse,
    WorldBankTestRequest,
    WorldBankTestResponse,
)
from app.models.world_bank_api import WorldBankSyncStatus
from app.services import world_bank_service
from app.services.api_sync_tasks import schedule_api_sync
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/world-bank-api",
    tags=["World Bank API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=WorldBankConfigResponse)
async def get_world_bank_config(db: AsyncSession = Depends(get_db)):
    return await world_bank_service.get_full_config(db)


@admin_router.put("", response_model=WorldBankConfigResponse)
async def update_world_bank_config(
    payload: WorldBankConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await world_bank_service.update_config(db, admin=admin, payload=payload)
    await db.commit()
    return result


@admin_router.post("/test", response_model=WorldBankTestResponse)
async def test_world_bank_connection(
    payload: WorldBankTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    body = payload or WorldBankTestRequest()
    result = await world_bank_service.test_connection(
        db,
        api_key_override=body.api_key,
        country_code=body.country_code,
        admin_id=admin.id,
    )
    await db.commit()
    return result


@admin_router.post("/sync")
async def manual_world_bank_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    config = await world_bank_service.get_config(db)
    if config.sync_status == WorldBankSyncStatus.SYNCING:
        return await schedule_api_sync(
            "world_bank",
            world_bank_service.sync_world_bank_data,
            admin_id=admin.id,
            force=True,
            already_syncing=True,
        )
    config.sync_status = WorldBankSyncStatus.SYNCING
    await db.commit()
    return await schedule_api_sync(
        "world_bank",
        world_bank_service.sync_world_bank_data,
        admin_id=admin.id,
        force=True,
    )


@admin_router.post("/enable", response_model=WorldBankConfigResponse)
async def enable_world_bank_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await world_bank_service.enable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.post("/disable", response_model=WorldBankConfigResponse)
async def disable_world_bank_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await world_bank_service.disable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.get("/health", response_model=WorldBankHealthResponse)
async def world_bank_health(db: AsyncSession = Depends(get_db)):
    return await world_bank_service.get_health(db)


@admin_router.get("/logs")
async def world_bank_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorldBankApiLog).order_by(desc(WorldBankApiLog.request_timestamp)).limit(limit)
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
            "countries_synced": log.countries_synced,
            "error_message": log.error_message,
        }
        for log in logs
    ]