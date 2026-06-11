"""
Exchange rate API endpoints — admin config and public rate access.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.exchange_rate import (
    ExchangeRateAuditLogResponse,
    ExchangeRateConfigResponse,
    ExchangeRateConfigUpdate,
    ExchangeRateEnrichedRequest,
    ExchangeRateHistoricalRequest,
    ExchangeRatePairRequest,
    ExchangeRateTestRequest,
    ExchangeRateTestResponse,
)
from app.services import exchange_rate_service
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/exchange-rate-config",
    tags=["Exchange Rate API"],
    dependencies=[Depends(require_admin)],
)

public_router = APIRouter(prefix="/api/exchange-rates", tags=["Exchange Rates"])


@admin_router.get("", response_model=ExchangeRateConfigResponse)
async def get_exchange_rate_config(db: AsyncSession = Depends(get_db)):
    config = await exchange_rate_service.get_config(db)
    return exchange_rate_service._to_config_response(config)


@admin_router.put("", response_model=ExchangeRateConfigResponse)
async def update_exchange_rate_config(
    payload: ExchangeRateConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await exchange_rate_service.update_config(db, admin=admin, payload=payload)


@admin_router.post("/test", response_model=ExchangeRateTestResponse)
async def test_exchange_rate_connection(
    payload: ExchangeRateTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    api_key = payload.api_key if payload else None
    return await exchange_rate_service.test_connection(
        db, api_key_override=api_key, admin_id=admin.id
    )


@admin_router.post("/sync")
async def manual_exchange_rate_sync(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await exchange_rate_service.sync_rates(db, force=True, admin_id=admin.id)


@admin_router.post("/enable", response_model=ExchangeRateConfigResponse)
async def enable_exchange_rate_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await exchange_rate_service.enable_api(db, admin=admin)


@admin_router.post("/disable", response_model=ExchangeRateConfigResponse)
async def disable_exchange_rate_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await exchange_rate_service.disable_api(db, admin=admin)


@admin_router.get("/health")
async def exchange_rate_health(db: AsyncSession = Depends(get_db)):
    return await exchange_rate_service.get_health(db)


@admin_router.get("/audit-logs", response_model=list[ExchangeRateAuditLogResponse])
async def exchange_rate_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.get_audit_logs(db, limit=limit)


@admin_router.get("/logs")
async def exchange_rate_logs(
    status: str | None = Query(None),
    endpoint: str | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.get_logs(
        db,
        status_filter=status,
        endpoint=endpoint,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )


rates_admin_router = APIRouter(
    prefix="/api/admin/exchange-rates",
    tags=["Exchange Rate API"],
    dependencies=[Depends(require_admin)],
)


@rates_admin_router.get("")
async def list_admin_exchange_rates(db: AsyncSession = Depends(get_db)):
    return await exchange_rate_service.list_current_rates(db)


@rates_admin_router.get("/analytics")
async def admin_exchange_rate_analytics(db: AsyncSession = Depends(get_db)):
    return await exchange_rate_service.get_analytics(db)


@rates_admin_router.get("/history")
async def admin_exchange_rate_history(
    target_currency: str | None = Query(None),
    period_type: str | None = Query(None),
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.get_history(
        db,
        target_currency=target_currency,
        period_type=period_type,
        months=months,
    )


@rates_admin_router.get("/currencies")
async def admin_supported_currencies(db: AsyncSession = Depends(get_db)):
    return await exchange_rate_service.list_supported_currencies(db)


@rates_admin_router.post("/pair")
async def admin_pair_conversion(
    payload: ExchangeRatePairRequest,
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.fetch_pair_conversion(
        db,
        base_currency=payload.base_currency,
        target_currency=payload.target_currency,
        amount=payload.amount,
    )


@rates_admin_router.post("/historical")
async def admin_provider_historical(
    payload: ExchangeRateHistoricalRequest,
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.fetch_provider_historical(
        db,
        base_currency=payload.base_currency,
        year=payload.year,
        month=payload.month,
        day=payload.day,
        amount=payload.amount,
    )


@rates_admin_router.post("/enriched")
async def admin_enriched_data(
    payload: ExchangeRateEnrichedRequest,
    db: AsyncSession = Depends(get_db),
):
    return await exchange_rate_service.fetch_enriched_data(
        db,
        base_currency=payload.base_currency,
        target_currency=payload.target_currency,
    )


@public_router.get("/analytics")
async def public_exchange_rate_analytics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await exchange_rate_service.get_analytics(db)


@public_router.get("/currencies")
async def public_supported_currencies(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await exchange_rate_service.list_supported_currencies(db)


@public_router.get("/currency/{currency_code}")
async def get_currency_exchange_rate(
    currency_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await exchange_rate_service.get_rate_for_currency(db, currency_code)


@public_router.get("/{country_code}")
async def get_country_exchange_rate(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await exchange_rate_service.get_rate_for_country(db, country_code)