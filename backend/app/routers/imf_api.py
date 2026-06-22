"""
IMF DataMapper API admin endpoints — configuration, test, sync, health.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.imf_api import ImfApiLog
from app.models.user import User
from app.schemas.imf_api import (
    ImfConfigResponse,
    ImfConfigUpdate,
    ImfHealthResponse,
    ImfTestRequest,
    ImfTestResponse,
)
from app.models.imf_api import ImfSyncStatus
from app.services import imf_service
from app.services.api_sync_tasks import schedule_api_sync
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/imf-api",
    tags=["IMF API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=ImfConfigResponse)
async def get_imf_config(db: AsyncSession = Depends(get_db)):
    return await imf_service.get_full_config(db)


@admin_router.put("", response_model=ImfConfigResponse)
async def update_imf_config(
    payload: ImfConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await imf_service.update_config(db, admin=admin, payload=payload)
    await db.commit()
    return result


@admin_router.post("/test", response_model=ImfTestResponse)
async def test_imf_connection(
    payload: ImfTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    body = payload or ImfTestRequest()
    result = await imf_service.test_connection(
        db,
        api_key_override=body.api_key,
        country_code=body.country_code,
        admin_id=admin.id,
    )
    await db.commit()
    return result


@admin_router.post("/sync")
async def manual_imf_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    config = await imf_service.get_config(db)
    if config.sync_status == ImfSyncStatus.SYNCING:
        return await schedule_api_sync(
            "imf",
            imf_service.sync_imf_data,
            admin_id=admin.id,
            force=True,
            already_syncing=True,
        )
    config.sync_status = ImfSyncStatus.SYNCING
    await db.commit()
    return await schedule_api_sync(
        "imf",
        imf_service.sync_imf_data,
        admin_id=admin.id,
        force=True,
    )


@admin_router.post("/enable", response_model=ImfConfigResponse)
async def enable_imf_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await imf_service.enable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.post("/disable", response_model=ImfConfigResponse)
async def disable_imf_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await imf_service.disable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.get("/health", response_model=ImfHealthResponse)
async def imf_health(db: AsyncSession = Depends(get_db)):
    return await imf_service.get_health(db)


@admin_router.get("/logs")
async def imf_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImfApiLog).order_by(desc(ImfApiLog.request_timestamp)).limit(limit)
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