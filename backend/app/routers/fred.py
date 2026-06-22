"""
FRED API endpoints — admin configuration, sync, health, analytics, export.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.fred import (
    FredAuditLogResponse,
    FredConfigResponse,
    FredConfigUpdate,
    FredHealthResponse,
    FredLogResponse,
    FredTestRequest,
    FredTestResponse,
)
from app.services import fred_service
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/fred-config",
    tags=["FRED API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=FredConfigResponse)
async def get_fred_config(db: AsyncSession = Depends(get_db)):
    return await fred_service.get_full_config(db)


@admin_router.put("", response_model=FredConfigResponse)
async def update_fred_config(
    payload: FredConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await fred_service.update_config(db, admin=admin, payload=payload)


@admin_router.post("/test", response_model=FredTestResponse)
async def test_fred_connection(
    payload: FredTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    api_key = payload.api_key if payload else None
    return await fred_service.test_connection(
        db, api_key_override=api_key, admin_id=admin.id
    )


@admin_router.post("/sync")
async def manual_fred_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await fred_service.sync_data(db, force=True, admin_id=admin.id)


@admin_router.post("/enable", response_model=FredConfigResponse)
async def enable_fred_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await fred_service.enable_api(db, admin=admin)


@admin_router.post("/disable", response_model=FredConfigResponse)
async def disable_fred_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await fred_service.disable_api(db, admin=admin)


@admin_router.post("/reset", response_model=FredConfigResponse)
async def reset_fred_config(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await fred_service.reset_config(db, admin=admin)


@admin_router.get("/health", response_model=FredHealthResponse)
async def fred_health(db: AsyncSession = Depends(get_db)):
    return await fred_service.get_health(db)


@admin_router.get("/logs", response_model=list[FredLogResponse])
async def fred_logs(
    status: str | None = Query(None),
    endpoint: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    logs = await fred_service.get_logs(
        db,
        status_filter=status,
        endpoint=endpoint,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    return logs


@admin_router.get("/audit-logs", response_model=list[FredAuditLogResponse])
async def fred_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await fred_service.get_audit_logs(db, limit=limit)


@admin_router.get("/analytics")
async def fred_analytics(db: AsyncSession = Depends(get_db)):
    return await fred_service.get_analytics(db)


@admin_router.get("/export")
async def export_fred_data(
    format: str = Query("csv", alias="format"),
    indicator_code: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    fmt = format.lower()
    if fmt not in ("csv", "xlsx", "pdf"):
        fmt = "csv"
    return await fred_service.export_data(db, fmt=fmt, indicator_code=indicator_code)