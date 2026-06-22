"""
Trading Economics API admin endpoints — configuration, test, sync, health.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trading_economics_api import TradingEconomicsApiLog
from app.models.user import User
from app.schemas.trading_economics_api import (
    TradingEconomicsConfigResponse,
    TradingEconomicsConfigUpdate,
    TradingEconomicsHealthResponse,
    TradingEconomicsTestRequest,
    TradingEconomicsTestResponse,
)
from app.models.trading_economics_api import TradingEconomicsSyncStatus
from app.services import trading_economics_service
from app.services.api_sync_tasks import schedule_api_sync
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/trading-economics-api",
    tags=["Trading Economics API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=TradingEconomicsConfigResponse)
async def get_trading_economics_config(db: AsyncSession = Depends(get_db)):
    return await trading_economics_service.get_full_config(db)


@admin_router.put("", response_model=TradingEconomicsConfigResponse)
async def update_trading_economics_config(
    payload: TradingEconomicsConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await trading_economics_service.update_config(db, admin=admin, payload=payload)
    await db.commit()
    return result


@admin_router.post("/test", response_model=TradingEconomicsTestResponse)
async def test_trading_economics_connection(
    payload: TradingEconomicsTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    body = payload or TradingEconomicsTestRequest()
    result = await trading_economics_service.test_connection(
        db,
        api_key_override=body.api_key,
        country_code=body.country_code,
        admin_id=admin.id,
    )
    await db.commit()
    return result


@admin_router.post("/sync")
async def manual_trading_economics_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    config = await trading_economics_service.get_config(db)
    if config.sync_status == TradingEconomicsSyncStatus.SYNCING:
        return await schedule_api_sync(
            "trading_economics",
            trading_economics_service.sync_trading_economics_data,
            admin_id=admin.id,
            force=True,
            already_syncing=True,
        )
    config.sync_status = TradingEconomicsSyncStatus.SYNCING
    await db.commit()
    return await schedule_api_sync(
        "trading_economics",
        trading_economics_service.sync_trading_economics_data,
        admin_id=admin.id,
        force=True,
    )


@admin_router.post("/enable", response_model=TradingEconomicsConfigResponse)
async def enable_trading_economics_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await trading_economics_service.enable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.post("/disable", response_model=TradingEconomicsConfigResponse)
async def disable_trading_economics_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await trading_economics_service.disable_api(db, admin=admin)
    await db.commit()
    return result


@admin_router.get("/health", response_model=TradingEconomicsHealthResponse)
async def trading_economics_health(db: AsyncSession = Depends(get_db)):
    return await trading_economics_service.get_health(db)


@admin_router.get("/logs")
async def trading_economics_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TradingEconomicsApiLog)
        .order_by(desc(TradingEconomicsApiLog.request_timestamp))
        .limit(limit)
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