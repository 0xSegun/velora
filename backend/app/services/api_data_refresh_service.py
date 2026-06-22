"""
On-demand API refresh — keep country data current before indicator selection.

Schedulers handle background sync; this service refreshes a single country's
API data when it is stale or missing, so selections prefer live API values.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate
from app.models.imf_api import ImfCountryData, ImfSyncStatus
from app.models.trading_economics_api import (
    TradingEconomicsCountryData,
    TradingEconomicsSyncStatus,
)
from app.models.world_bank_api import WorldBankCountryData, WorldBankSyncStatus
from app.services.country_service import COUNTRY_REFERENCE

logger = logging.getLogger(__name__)

DEFAULT_MAX_AGE_HOURS = 24


async def _row_age_hours(retrieved_at: datetime | None) -> float | None:
    if not retrieved_at:
        return None
    ts = retrieved_at if retrieved_at.tzinfo else retrieved_at.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0


async def _needs_refresh(
    db: AsyncSession,
    model,
    country_code: str,
    *,
    max_age_hours: int = DEFAULT_MAX_AGE_HOURS,
) -> bool:
    code = country_code.upper()
    result = await db.execute(
        select(model)
        .where(model.country_code == code)
        .order_by(desc(model.data_year), desc(model.retrieved_at))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        return True
    age = await _row_age_hours(row.retrieved_at)
    if age is None or age > max_age_hours:
        return True
    current_year = date.today().year
    if getattr(row, "data_year", current_year) < current_year - 1:
        return True
    return False


async def _refresh_imf_country(db: AsyncSession, country_code: str) -> str:
    from app.services.imf_service import (
        _upsert_country_data,
        fetch_country_indicators,
        get_config,
    )

    config = await get_config(db)
    if not config.is_active:
        return "skipped_inactive"
    if config.sync_status == ImfSyncStatus.SYNCING:
        return "skipped_syncing"
    if not await _needs_refresh(db, ImfCountryData, country_code):
        return "fresh"

    record = await fetch_country_indicators(config, country_code=country_code)
    await _upsert_country_data(db, record)
    return "refreshed"


async def _refresh_world_bank_country(db: AsyncSession, country_code: str) -> str:
    from app.services.world_bank_service import (
        _upsert_country_data,
        fetch_country_indicators,
        get_config,
    )

    config = await get_config(db)
    if not config.is_active:
        return "skipped_inactive"
    if config.sync_status == WorldBankSyncStatus.SYNCING:
        return "skipped_syncing"
    if not await _needs_refresh(db, WorldBankCountryData, country_code):
        return "fresh"

    record = await fetch_country_indicators(config, country_code=country_code)
    await _upsert_country_data(db, record)
    return "refreshed"


async def _refresh_trading_economics_country(db: AsyncSession, country_code: str) -> str:
    from app.services.trading_economics_service import (
        _upsert_country_data,
        fetch_country_indicators,
        get_config,
    )

    config = await get_config(db)
    if not config.is_active:
        return "skipped_inactive"
    if config.sync_status == TradingEconomicsSyncStatus.SYNCING:
        return "skipped_syncing"
    if not await _needs_refresh(db, TradingEconomicsCountryData, country_code):
        return "fresh"

    record = await fetch_country_indicators(config, country_code=country_code)
    await _upsert_country_data(db, record)
    return "refreshed"


async def _refresh_exchange_rate_country(db: AsyncSession, country_code: str) -> str:
    from app.services.exchange_rate_service import get_config, sync_rates

    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    currency = ref.get("currency")
    if not currency or currency == "USD":
        return "skipped_usd"

    fx_result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.target_currency == currency)
        .order_by(desc(ExchangeRate.retrieved_at))
        .limit(1)
    )
    fx_row = fx_result.scalar_one_or_none()
    age = await _row_age_hours(fx_row.retrieved_at if fx_row else None)
    if age is not None and age <= 1:
        return "fresh"

    config = await get_config(db)
    if not config.is_active:
        return "skipped_inactive"

    result = await sync_rates(db, force=False)
    return "refreshed" if result.get("success") else "failed"


async def _refresh_fred_if_us(db: AsyncSession, country_code: str) -> str:
    if country_code.upper() != "US":
        return "skipped"
    from app.models.fred import FredSyncStatus
    from app.services.fred_service import get_config, sync_data

    config = await get_config(db)
    if not config.is_active or config.sync_status == FredSyncStatus.SYNCING:
        return "skipped"
    age = await _row_age_hours(config.last_sync)
    if age is not None and age <= 12:
        return "fresh"

    result = await sync_data(db, force=False)
    return "refreshed" if result.get("success") else "failed"


async def refresh_country_from_apis(
    db: AsyncSession,
    country_code: str,
    *,
    max_age_hours: int = DEFAULT_MAX_AGE_HOURS,
) -> dict:
    """
    Refresh stale or missing API data for one country before indicator selection.
    """
    code = country_code.upper()
    status: dict[str, str] = {}

    for name, fn in (
        ("imf", _refresh_imf_country),
        ("world_bank", _refresh_world_bank_country),
        ("trading_economics", _refresh_trading_economics_country),
        ("exchange_rate", _refresh_exchange_rate_country),
        ("fred", _refresh_fred_if_us),
    ):
        try:
            status[name] = await fn(db, code)
        except Exception as exc:
            logger.debug("API refresh %s for %s failed: %s", name, code, exc)
            status[name] = f"error:{type(exc).__name__}"

    refreshed = [k for k, v in status.items() if v == "refreshed"]
    return {
        "country_code": code,
        "refreshed_apis": refreshed,
        "status": status,
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


async def ensure_fresh_api_data(
    db: AsyncSession,
    country_code: str,
    *,
    max_age_hours: int = DEFAULT_MAX_AGE_HOURS,
) -> dict:
    """Alias used by indicator selection before resolving values."""
    return await refresh_country_from_apis(db, country_code, max_age_hours=max_age_hours)