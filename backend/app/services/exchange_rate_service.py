"""
Exchange rate API management — fetch, sync, cache, analytics.
"""

from __future__ import annotations

import enum
import base64
import hashlib
import json
import logging
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.country import Country
from app.models.economic_data import DataSource, EconomicData
from app.models.exchange_rate import (
    ExchangeRate,
    ExchangeRateApiConfig,
    ExchangeRateApiLog,
    ExchangeRateAuditLog,
    ExchangeRateHistory,
    PeriodType,
    RefreshInterval,
    SyncStatus,
)
from app.models.user import User
from app.schemas.exchange_rate import (
    ExchangeRateAnalyticsResponse,
    ExchangeRateConfigResponse,
    ExchangeRateConfigUpdate,
    ExchangeRateCountryResponse,
    ExchangeRateHealthResponse,
    ExchangeRateTestResponse,
)
from app.services.country_service import COUNTRY_REFERENCE
from app.services.currency_catalog_service import (
    SUPPORTED_CURRENCY_CODES,
    country_code_for_currency,
    get_currency_metadata,
    list_catalog_currencies,
)

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
STALE_MESSAGE = "Latest exchange rate data is temporarily unavailable."
STALE_THRESHOLD_HOURS = 48
SYNC_STALE_MINUTES = 30
GENERIC_API_ERROR = "Failed to connect to exchange rate provider"
GENERIC_SYNC_ERROR = "Exchange rate sync failed"
ALLOWED_BASE_URLS = frozenset({"https://v6.exchangerate-api.com"})

REFRESH_HOURS = {
    RefreshInterval.HOURLY: 1,
    RefreshInterval.DAILY: 24,
    RefreshInterval.WEEKLY: 168,
}

_encryption_fallback_warned = False


def _country_code_for_currency(currency: str, preferred_country: str | None = None) -> str | None:
    """Resolve country code for a currency via the ExchangeRate-API catalog."""
    return country_code_for_currency(currency, preferred_country)


def validate_encryption_config() -> None:
    """Validate ENCRYPTION_KEY at startup; warn when falling back to SECRET_KEY."""
    global _encryption_fallback_warned
    env_key = getattr(settings, "ENCRYPTION_KEY", None) or ""
    if env_key:
        try:
            Fernet(env_key.encode() if isinstance(env_key, str) else env_key)
        except (ValueError, TypeError) as exc:
            raise RuntimeError("ENCRYPTION_KEY is not a valid Fernet key") from exc
        return
    if not _encryption_fallback_warned:
        logger.warning(
            "ENCRYPTION_KEY not set; deriving exchange-rate encryption key from SECRET_KEY"
        )
        _encryption_fallback_warned = True


def _derive_fernet_key() -> bytes:
    raw = settings.SECRET_KEY.encode()
    digest = hashlib.sha256(raw).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    validate_encryption_config()
    env_key = getattr(settings, "ENCRYPTION_KEY", None) or ""
    if env_key:
        return Fernet(env_key.encode() if isinstance(env_key, str) else env_key)
    return Fernet(_derive_fernet_key())


def _validate_base_url(url: str) -> str:
    normalized = url.rstrip("/")
    if normalized not in ALLOWED_BASE_URLS:
        raise HTTPException(
            status_code=400,
            detail="base_url must be an approved ExchangeRate-API endpoint",
        )
    return normalized


def _escape_ilike(value: str) -> str:
    return re.sub(r"([%_\\])", r"\\\1", value)


def encrypt_api_key(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_api_key(encrypted: str | None) -> str | None:
    if not encrypted:
        return None
    try:
        return _get_fernet().decrypt(encrypted.encode()).decode()
    except (InvalidToken, ValueError):
        logger.warning("Failed to decrypt exchange rate API key")
        return None


def _interval_hours(interval: RefreshInterval) -> int:
    return REFRESH_HOURS.get(interval, 24)


def _compute_next_sync(interval: RefreshInterval, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _health_status(config: ExchangeRateApiConfig) -> str:
    if not config.is_active:
        return "inactive"
    if config.sync_status == SyncStatus.FAILED:
        return "red"
    if config.error_count > 0 and config.success_count == 0:
        return "red"
    if config.error_count > config.success_count:
        return "yellow"
    if config.is_active and config.api_key:
        return "green"
    return "yellow"


async def ensure_default_config(db: AsyncSession) -> ExchangeRateApiConfig:
    result = await db.execute(select(ExchangeRateApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        normalized = (config.base_url or "").rstrip("/")
        if normalized not in ALLOWED_BASE_URLS:
            config.base_url = "https://v6.exchangerate-api.com"
            config.updated_at = datetime.now(timezone.utc)
            await db.flush()
            logger.warning("Reset invalid exchange rate base_url to default endpoint")
        return config

    config = ExchangeRateApiConfig(
        provider_name="ExchangeRate-API",
        base_url="https://v6.exchangerate-api.com",
        base_currency="USD",
        refresh_interval=RefreshInterval.HOURLY,
        is_active=False,
        sync_status=SyncStatus.IDLE,
    )
    db.add(config)
    await db.flush()
    logger.info("Seeded default exchange_rate_api_config")
    return config


async def get_config(db: AsyncSession) -> ExchangeRateApiConfig:
    return await ensure_default_config(db)


def _to_config_response(config: ExchangeRateApiConfig) -> ExchangeRateConfigResponse:
    return ExchangeRateConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        api_key_masked=MASKED_KEY if config.api_key else "",
        api_key_set=bool(config.api_key),
        base_url=config.base_url,
        base_currency=config.base_currency,
        refresh_interval=config.refresh_interval.value,
        is_active=config.is_active,
        last_sync=config.last_sync,
        next_sync=config.next_sync,
        sync_status=config.sync_status.value,
        error_count=config.error_count,
        success_count=config.success_count,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


async def _log_audit(
    db: AsyncSession,
    *,
    action: str,
    changed_fields: dict,
    admin_id: uuid.UUID | None,
) -> None:
    db.add(
        ExchangeRateAuditLog(
            action=action,
            changed_fields=changed_fields,
            admin_user_id=admin_id,
        )
    )


async def _log_api_call(
    db: AsyncSession,
    *,
    endpoint: str,
    success: bool,
    response_time_ms: float | None,
    status_code: int | None,
    error_message: str | None = None,
    rate_limit_remaining: int | None = None,
) -> None:
    db.add(
        ExchangeRateApiLog(
            endpoint=endpoint,
            request_timestamp=datetime.now(timezone.utc),
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            rate_limit_remaining=rate_limit_remaining,
            status_code=status_code,
        )
    )


def _build_api_url(config: ExchangeRateApiConfig, api_key: str, path: str) -> str:
    base = _validate_base_url(config.base_url)
    return f"{base}/v6/{api_key}/{path.lstrip('/')}"


def _build_latest_url(config: ExchangeRateApiConfig, api_key: str) -> str:
    return _build_api_url(config, api_key, f"latest/{config.base_currency.upper()}")


async def _fetch_rates_from_api(
    db: AsyncSession,
    config: ExchangeRateApiConfig,
    *,
    api_key_override: str | None = None,
) -> tuple[dict, dict]:
    api_key = api_key_override or decrypt_api_key(config.api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is not configured")

    url = _build_latest_url(config, api_key)
    start = time.perf_counter()
    diagnostics: dict = {"url": url.split(api_key)[0] + "***", "base_currency": config.base_currency}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response_time_ms = round((time.perf_counter() - start) * 1000, 2)
            status_code = response.status_code
            rate_limit = response.headers.get("X-RateLimit-Remaining")
            rate_limit_int = int(rate_limit) if rate_limit and rate_limit.isdigit() else None

            if status_code != 200:
                await _log_api_call(
                    db,
                    endpoint=url.split(api_key)[0] + "latest/{BASE}",
                    success=False,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                    error_message=response.text[:500],
                    rate_limit_remaining=rate_limit_int,
                )
                raise HTTPException(status_code=502, detail=GENERIC_API_ERROR)

            try:
                payload = response.json()
            except json.JSONDecodeError:
                await _log_api_call(
                    db,
                    endpoint=url.split(api_key)[0] + "latest/{BASE}",
                    success=False,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                    error_message="Non-JSON response body",
                    rate_limit_remaining=rate_limit_int,
                )
                raise HTTPException(status_code=502, detail=GENERIC_API_ERROR)

            if payload.get("result") != "success":
                err = payload.get("error-type", "unknown_error")
                await _log_api_call(
                    db,
                    endpoint=url.split(api_key)[0] + "latest/{BASE}",
                    success=False,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                    error_message=str(err),
                    rate_limit_remaining=rate_limit_int,
                )
                raise HTTPException(status_code=502, detail=GENERIC_API_ERROR)

            await _log_api_call(
                db,
                endpoint=url.split(api_key)[0] + "latest/{BASE}",
                success=True,
                response_time_ms=response_time_ms,
                status_code=status_code,
                rate_limit_remaining=rate_limit_int,
            )
            diagnostics["conversion_count"] = len(payload.get("conversion_rates", {}))
            diagnostics["last_update_utc"] = payload.get("time_last_update_utc")
            return payload, diagnostics
    except HTTPException:
        raise
    except Exception as exc:
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        await _log_api_call(
            db,
            endpoint=url.split(api_key)[0] + "latest/{BASE}" if api_key else "unknown",
            success=False,
            response_time_ms=response_time_ms,
            status_code=None,
            error_message=str(exc),
        )
        logger.exception("Exchange rate API fetch failed")
        raise HTTPException(status_code=502, detail=GENERIC_API_ERROR) from exc


async def test_connection(
    db: AsyncSession,
    *,
    api_key_override: str | None = None,
    admin_id: uuid.UUID | None = None,
) -> ExchangeRateTestResponse:
    config = await get_config(db)
    test_key = api_key_override or decrypt_api_key(config.api_key)
    if not test_key:
        return ExchangeRateTestResponse(
            success=False,
            message="API key is not configured",
            diagnostics={"error_type": "missing_api_key"},
        )

    start = time.perf_counter()
    try:
        payload, diagnostics = await _fetch_rates_from_api(
            db, config, api_key_override=test_key
        )
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        rates = payload.get("conversion_rates", {})
        result = ExchangeRateTestResponse(
            success=True,
            message=f"Connection successful — {len(rates)} rates received",
            response_time_ms=response_time_ms,
            status_code=200,
            diagnostics=diagnostics,
        )
        if admin_id:
            await _log_audit(
                db,
                action="test_connection",
                changed_fields={"success": True, "rates_received": len(rates)},
                admin_id=admin_id,
            )
        return result
    except HTTPException as exc:
        if admin_id:
            await _log_audit(
                db,
                action="test_connection",
                changed_fields={"success": False, "error": str(exc.detail)},
                admin_id=admin_id,
            )
        detail = exc.detail if isinstance(exc.detail, str) else GENERIC_API_ERROR
        return ExchangeRateTestResponse(
            success=False,
            message=detail,
            diagnostics={"error_type": "api_error"},
        )


async def update_config(
    db: AsyncSession,
    *,
    admin: User,
    payload: ExchangeRateConfigUpdate,
) -> ExchangeRateConfigResponse:
    config = await get_config(db)
    data = payload.model_dump(exclude_unset=True)
    changed: dict = {}

    if "refresh_interval" in data and data["refresh_interval"]:
        try:
            data["refresh_interval"] = RefreshInterval(data["refresh_interval"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid refresh_interval")

    if "api_key" in data:
        key_val = data.pop("api_key")
        if key_val:
            config.api_key = encrypt_api_key(key_val)
            changed["api_key"] = "updated"

    if "base_url" in data and data["base_url"] is not None:
        data["base_url"] = _validate_base_url(data["base_url"])

    def _audit_value(val: object) -> object:
        if hasattr(val, "value") and isinstance(val, enum.Enum):
            return val.value
        return val

    for key, value in data.items():
        if value is not None and getattr(config, key, None) != value:
            changed[key] = {"from": _audit_value(getattr(config, key)), "to": _audit_value(value)}
            setattr(config, key, value)

    if changed:
        config.updated_at = datetime.now(timezone.utc)
        if config.is_active and not config.next_sync:
            config.next_sync = _compute_next_sync(config.refresh_interval)
        await _log_audit(db, action="config_update", changed_fields=changed, admin_id=admin.id)

    await db.flush()
    return _to_config_response(config)


async def enable_api(db: AsyncSession, *, admin: User) -> ExchangeRateConfigResponse:
    config = await get_config(db)
    if not config.api_key:
        raise HTTPException(status_code=400, detail="Configure API key before enabling")
    config.is_active = True
    config.next_sync = datetime.now(timezone.utc)
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="enable", changed_fields={"is_active": True}, admin_id=admin.id)
    await db.flush()
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> ExchangeRateConfigResponse:
    config = await get_config(db)
    config.is_active = False
    config.sync_status = SyncStatus.IDLE
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="disable", changed_fields={"is_active": False}, admin_id=admin.id)
    await db.flush()
    return _to_config_response(config)


async def _store_rates(
    db: AsyncSession,
    config: ExchangeRateApiConfig,
    conversion_rates: dict[str, float],
    retrieved_at: datetime,
) -> int:
    stored = 0
    base = config.base_currency.upper()
    for currency, rate in conversion_rates.items():
        if not isinstance(rate, (int, float)):
            continue
        cur = currency.upper()
        existing_q = await db.execute(
            select(ExchangeRate)
            .where(
                ExchangeRate.base_currency == base,
                ExchangeRate.target_currency == cur,
            )
            .limit(1)
        )
        row = existing_q.scalar_one_or_none()
        if row:
            row.exchange_rate = float(rate)
            row.retrieved_at = retrieved_at
            row.source = config.provider_name
        else:
            db.add(
                ExchangeRate(
                    base_currency=base,
                    target_currency=cur,
                    exchange_rate=float(rate),
                    retrieved_at=retrieved_at,
                    source=config.provider_name,
                )
            )
        stored += 1
    return stored


async def _update_economic_data_rates(db: AsyncSession, rates: dict[str, float]) -> int:
    updated = 0
    today = date.today().replace(day=1)

    countries_q = await db.execute(select(Country))
    countries = countries_q.scalars().all()

    for country in countries:
        code = country.code.upper()
        ref = COUNTRY_REFERENCE.get(code, {})
        currency = (country.currency or ref.get("currency") or "").upper()
        if not currency or currency not in rates:
            continue

        rate_val = float(rates[currency])

        month_q = await db.execute(
            select(EconomicData)
            .where(
                EconomicData.country_code == code,
                EconomicData.data_date == today,
            )
            .order_by(desc(EconomicData.created_at))
            .limit(1)
        )
        month_row = month_q.scalar_one_or_none()
        if month_row:
            month_row.exchange_rate = rate_val
            month_row.source = DataSource.EXCHANGE_RATE_API
            updated += 1
            continue

        latest_q = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == code)
            .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
            .limit(1)
        )
        latest = latest_q.scalar_one_or_none()
        snapshot = EconomicData(
            country_code=code,
            country_name=country.name,
            exchange_rate=rate_val,
            inflation_rate=latest.inflation_rate if latest else country.inflation_rate,
            interest_rate=latest.interest_rate if latest else country.interest_rate,
            gdp=latest.gdp if latest else country.gdp,
            gdp_growth=latest.gdp_growth if latest else None,
            cpi=latest.cpi if latest else None,
            unemployment_rate=latest.unemployment_rate if latest else None,
            data_date=today,
            source=DataSource.EXCHANGE_RATE_API,
        )
        db.add(snapshot)
        updated += 1

    return updated


async def _aggregate_history(
    db: AsyncSession,
    rates: dict[str, float],
    retrieved_at: datetime,
    base_currency: str,
) -> None:
    base = base_currency.upper()
    today = retrieved_at.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    for currency, rate in rates.items():
        if not isinstance(rate, (int, float)):
            continue
        cur = currency.upper()
        for period_type, period_date in (
            (PeriodType.DAILY, today),
            (PeriodType.WEEKLY, week_start),
            (PeriodType.MONTHLY, month_start),
        ):
            existing_q = await db.execute(
                select(ExchangeRateHistory)
                .where(
                    ExchangeRateHistory.base_currency == base,
                    ExchangeRateHistory.target_currency == cur,
                    ExchangeRateHistory.period_type == period_type,
                    ExchangeRateHistory.period_date == period_date,
                )
                .limit(1)
            )
            row = existing_q.scalar_one_or_none()
            if row:
                row.exchange_rate = float(rate)
            else:
                db.add(
                    ExchangeRateHistory(
                        base_currency=base,
                        target_currency=cur,
                        exchange_rate=float(rate),
                        period_type=period_type,
                        period_date=period_date,
                        source="ExchangeRate-API",
                    )
                )


async def _reset_stale_sync(config: ExchangeRateApiConfig) -> bool:
    """Clear SYNCING status if it has been stuck beyond the watchdog threshold."""
    if config.sync_status != SyncStatus.SYNCING:
        return False
    now = datetime.now(timezone.utc)
    anchor = config.updated_at or config.last_sync
    if anchor and (now - anchor) > timedelta(minutes=SYNC_STALE_MINUTES):
        config.sync_status = SyncStatus.FAILED
        config.updated_at = now
        logger.warning("Reset stale exchange rate sync (stuck in SYNCING)")
        return True
    return False


async def sync_rates(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    result = await db.execute(
        select(ExchangeRateApiConfig).limit(1).with_for_update()
    )
    config = result.scalar_one_or_none()
    if not config:
        config = await ensure_default_config(db)

    if not config.is_active and not force:
        raise HTTPException(status_code=400, detail="Exchange rate API is not active")

    await _reset_stale_sync(config)

    if config.sync_status == SyncStatus.SYNCING:
        if force:
            raise HTTPException(status_code=409, detail="Sync already in progress")
        return {"success": False, "message": "Sync already in progress"}

    config.sync_status = SyncStatus.SYNCING
    config.updated_at = datetime.now(timezone.utc)
    await db.flush()

    try:
        async with db.begin_nested():
            payload, _ = await _fetch_rates_from_api(db, config)
            rates = payload.get("conversion_rates")
            if not isinstance(rates, dict) or len(rates) == 0:
                raise HTTPException(
                    status_code=502, detail="Invalid conversion_rates in API response"
                )
            retrieved_at = datetime.now(timezone.utc)
            if payload.get("time_last_update_utc"):
                try:
                    retrieved_at = datetime.strptime(
                        payload["time_last_update_utc"], "%a, %d %b %Y %H:%M:%S %z"
                    )
                except ValueError:
                    pass

            stored = await _store_rates(db, config, rates, retrieved_at)
            economic_updated = await _update_economic_data_rates(db, rates)
            await _aggregate_history(db, rates, retrieved_at, config.base_currency)

            now = datetime.now(timezone.utc)
            config.last_sync = now
            config.next_sync = _compute_next_sync(config.refresh_interval, now)
            config.sync_status = SyncStatus.SUCCESS
            config.success_count += 1
            config.updated_at = now

        if admin_id:
            await _log_audit(
                db,
                action="manual_sync",
                changed_fields={
                    "success": True,
                    "rates_stored": stored,
                    "countries_updated": economic_updated,
                },
                admin_id=admin_id,
            )

        await db.flush()
        return {
            "success": True,
            "message": f"Synced {stored} rates, updated {economic_updated} countries",
            "rates_stored": stored,
            "countries_updated": economic_updated,
            "synced_at": now.isoformat(),
        }
    except HTTPException as exc:
        config.sync_status = SyncStatus.FAILED
        config.error_count += 1
        config.updated_at = datetime.now(timezone.utc)
        if admin_id:
            await _log_audit(
                db,
                action="manual_sync",
                changed_fields={"success": False, "error": str(exc.detail)},
                admin_id=admin_id,
            )
        await db.flush()
        detail = exc.detail if isinstance(exc.detail, str) else GENERIC_SYNC_ERROR
        return {"success": False, "message": detail}
    except Exception as exc:
        config.sync_status = SyncStatus.FAILED
        config.error_count += 1
        config.updated_at = datetime.now(timezone.utc)
        if admin_id:
            await _log_audit(
                db,
                action="manual_sync",
                changed_fields={"success": False, "error": GENERIC_SYNC_ERROR},
                admin_id=admin_id,
            )
        await db.flush()
        logger.exception("Exchange rate sync failed")
        return {"success": False, "message": GENERIC_SYNC_ERROR}


async def get_latest_rates_for_currencies(
    db: AsyncSession, currencies: set[str]
) -> dict[str, ExchangeRate]:
    """Batch-fetch the latest cached rate row per target currency."""
    if not currencies:
        return {}
    normalized = {c.upper() for c in currencies if c}
    result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.target_currency.in_(normalized))
        .order_by(ExchangeRate.target_currency, desc(ExchangeRate.retrieved_at))
    )
    latest: dict[str, ExchangeRate] = {}
    for row in result.scalars().all():
        if row.target_currency not in latest:
            latest[row.target_currency] = row
    return latest


async def get_latest_rate_for_currency(
    db: AsyncSession, currency: str
) -> tuple[ExchangeRate | None, bool]:
    result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.target_currency == currency.upper())
        .order_by(desc(ExchangeRate.retrieved_at))
        .limit(1)
    )
    rate = result.scalar_one_or_none()
    if not rate:
        return None, True

    age = datetime.now(timezone.utc) - rate.retrieved_at
    is_stale = age > timedelta(hours=STALE_THRESHOLD_HOURS)
    return rate, is_stale


async def get_rate_for_country(
    db: AsyncSession, country_code: str
) -> ExchangeRateCountryResponse:
    code = country_code.upper()
    ref = COUNTRY_REFERENCE.get(code, {})
    currency = ref.get("currency", "USD")

    rate_row, is_stale = await get_latest_rate_for_currency(db, currency)

    if not rate_row:
        econ_q = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == code)
            .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
            .limit(1)
        )
        econ = econ_q.scalar_one_or_none()
        if econ and econ.exchange_rate:
            return ExchangeRateCountryResponse(
                country_code=code,
                country_name=ref.get("name", code),
                currency_code=currency,
                currency_name=ref.get("currency_name"),
                currency_symbol=ref.get("currency_symbol"),
                exchange_rate=econ.exchange_rate,
                trend="stable",
                last_updated=datetime.combine(econ.data_date, datetime.min.time(), tzinfo=timezone.utc)
                if econ.data_date
                else None,
                is_stale=True,
                stale_message=STALE_MESSAGE,
            )
        return ExchangeRateCountryResponse(
            country_code=code,
            country_name=ref.get("name", code),
            currency_code=currency,
            currency_name=ref.get("currency_name"),
            currency_symbol=ref.get("currency_symbol"),
            exchange_rate=None,
            is_stale=True,
            stale_message=STALE_MESSAGE,
        )

    change_24h, change_7d = await _compute_changes(db, currency, rate_row.exchange_rate)
    trend = _trend_from_change(change_7d)

    return ExchangeRateCountryResponse(
        country_code=code,
        country_name=ref.get("name", code),
        currency_code=currency,
        currency_name=ref.get("currency_name"),
        currency_symbol=ref.get("currency_symbol"),
        exchange_rate=rate_row.exchange_rate,
        change_24h=change_24h,
        change_7d=change_7d,
        change_24h_pct=_pct_change(rate_row.exchange_rate, change_24h),
        change_7d_pct=_pct_change(rate_row.exchange_rate, change_7d),
        trend=trend,
        last_updated=rate_row.retrieved_at,
        is_stale=is_stale,
        stale_message=STALE_MESSAGE if is_stale else None,
    )


def _pct_change(current: float, delta: float | None) -> float | None:
    if delta is None or current == 0:
        return None
    prior = current - delta
    if prior == 0:
        return None
    return round((delta / prior) * 100, 2)


def _trend_from_change(change: float | None) -> str:
    if change is None:
        return "stable"
    if abs(change) < 0.01:
        return "stable"
    return "up" if change > 0 else "down"


async def _rate_from_history(
    db: AsyncSession, currency: str, days_ago: int
) -> float | None:
    target_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).date()
    result = await db.execute(
        select(ExchangeRateHistory)
        .where(
            ExchangeRateHistory.target_currency == currency.upper(),
            ExchangeRateHistory.period_type == PeriodType.DAILY,
            ExchangeRateHistory.period_date <= target_date,
        )
        .order_by(desc(ExchangeRateHistory.period_date))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row.exchange_rate if row else None


async def _compute_changes(
    db: AsyncSession, currency: str, current: float
) -> tuple[float | None, float | None]:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    async def _rate_near(since: datetime) -> float | None:
        result = await db.execute(
            select(ExchangeRate)
            .where(
                ExchangeRate.target_currency == currency.upper(),
                ExchangeRate.retrieved_at <= since,
            )
            .order_by(desc(ExchangeRate.retrieved_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row.exchange_rate if row else None

    prev_24h = await _rate_near(day_ago)
    if prev_24h is None:
        prev_24h = await _rate_from_history(db, currency, 1)

    prev_7d = await _rate_near(week_ago)
    if prev_7d is None:
        prev_7d = await _rate_from_history(db, currency, 7)

    change_24h = round(current - prev_24h, 4) if prev_24h is not None else None
    change_7d = round(current - prev_7d, 4) if prev_7d is not None else None
    return change_24h, change_7d


async def get_cached_rate_for_country(db: AsyncSession, country_code: str) -> float | None:
    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    currency = ref.get("currency")
    if not currency:
        return None
    rate_row, _ = await get_latest_rate_for_currency(db, currency)
    if rate_row:
        return rate_row.exchange_rate
    econ_q = await db.execute(
        select(EconomicData.exchange_rate)
        .where(EconomicData.country_code == country_code.upper())
        .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
        .limit(1)
    )
    return econ_q.scalar_one_or_none()


async def get_rates_for_countries_batch(
    db: AsyncSession, country_codes: list[str]
) -> dict[str, ExchangeRateCountryResponse]:
    """Resolve live FX responses for many countries with batched DB queries."""
    codes = [c.upper() for c in country_codes if c]
    if not codes:
        return {}

    currencies: dict[str, str] = {}
    for code in codes:
        ref = COUNTRY_REFERENCE.get(code, {})
        currencies[code] = ref.get("currency", "USD")

    rate_rows = await get_latest_rates_for_currencies(db, set(currencies.values()))
    now = datetime.now(timezone.utc)
    stale_cutoff = timedelta(hours=STALE_THRESHOLD_HOURS)
    responses: dict[str, ExchangeRateCountryResponse] = {}

    for code in codes:
        ref = COUNTRY_REFERENCE.get(code, {})
        currency = currencies[code]
        rate_row = rate_rows.get(currency.upper())

        if rate_row:
            is_stale = (now - rate_row.retrieved_at) > stale_cutoff
            change_24h, change_7d = await _compute_changes(db, currency, rate_row.exchange_rate)
            trend = _trend_from_change(change_7d)
            responses[code] = ExchangeRateCountryResponse(
                country_code=code,
                country_name=ref.get("name", code),
                currency_code=currency,
                currency_name=ref.get("currency_name"),
                currency_symbol=ref.get("currency_symbol"),
                exchange_rate=rate_row.exchange_rate,
                change_24h=change_24h,
                change_7d=change_7d,
                change_24h_pct=_pct_change(rate_row.exchange_rate, change_24h),
                change_7d_pct=_pct_change(rate_row.exchange_rate, change_7d),
                trend=trend,
                last_updated=rate_row.retrieved_at,
                is_stale=is_stale,
                stale_message=STALE_MESSAGE if is_stale else None,
            )
            continue

        econ_q = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == code)
            .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
            .limit(1)
        )
        econ = econ_q.scalar_one_or_none()
        if econ and econ.exchange_rate:
            responses[code] = ExchangeRateCountryResponse(
                country_code=code,
                country_name=ref.get("name", code),
                currency_code=currency,
                currency_name=ref.get("currency_name"),
                currency_symbol=ref.get("currency_symbol"),
                exchange_rate=econ.exchange_rate,
                trend="stable",
                last_updated=datetime.combine(
                    econ.data_date, datetime.min.time(), tzinfo=timezone.utc
                )
                if econ.data_date
                else None,
                is_stale=True,
                stale_message=STALE_MESSAGE,
            )
        else:
            responses[code] = ExchangeRateCountryResponse(
                country_code=code,
                country_name=ref.get("name", code),
                currency_code=currency,
                currency_name=ref.get("currency_name"),
                currency_symbol=ref.get("currency_symbol"),
                exchange_rate=None,
                is_stale=True,
                stale_message=STALE_MESSAGE,
            )

    return responses


async def list_current_rates(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ExchangeRate).order_by(ExchangeRate.target_currency)
    )
    rows = []
    for rate in result.scalars().all():
        country_code = _country_code_for_currency(rate.target_currency)
        cur_meta = get_currency_metadata(rate.target_currency) or {}
        country_meta = COUNTRY_REFERENCE.get(country_code or "", {})
        rows.append({
            "id": str(rate.id),
            "base_currency": rate.base_currency,
            "target_currency": rate.target_currency,
            "currency_name": cur_meta.get("name") or country_meta.get("currency_name"),
            "country_name": cur_meta.get("country") or country_meta.get("name"),
            "exchange_rate": rate.exchange_rate,
            "retrieved_at": rate.retrieved_at.isoformat(),
            "source": rate.source,
            "country_code": country_code,
        })
    return rows


async def get_health(db: AsyncSession) -> ExchangeRateHealthResponse:
    config = await get_config(db)
    total = config.success_count + config.error_count
    success_rate = round(config.success_count / total * 100, 2) if total > 0 else None

    last_log_q = await db.execute(
        select(ExchangeRateApiLog)
        .order_by(desc(ExchangeRateApiLog.request_timestamp))
        .limit(1)
    )
    last_log = last_log_q.scalar_one_or_none()

    return ExchangeRateHealthResponse(
        provider=config.provider_name,
        status=_health_status(config),
        is_active=config.is_active,
        response_time_ms=last_log.response_time_ms if last_log else None,
        last_sync=config.last_sync,
        next_sync=config.next_sync,
        error_count=config.error_count,
        success_count=config.success_count,
        success_rate=success_rate,
        sync_status=config.sync_status.value,
    )


async def get_logs(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    endpoint: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
) -> list[dict]:
    query = select(ExchangeRateApiLog).order_by(desc(ExchangeRateApiLog.request_timestamp))
    if status_filter:
        want_success = status_filter.lower() in ("success", "ok", "healthy")
        query = query.where(ExchangeRateApiLog.success == want_success)
    if endpoint:
        safe = _escape_ilike(endpoint)
        query = query.where(ExchangeRateApiLog.endpoint.ilike(f"%{safe}%", escape="\\"))
    if from_date:
        query = query.where(ExchangeRateApiLog.request_timestamp >= from_date)
    if to_date:
        query = query.where(ExchangeRateApiLog.request_timestamp <= to_date)

    result = await db.execute(query.limit(limit))
    return [
        {
            "id": str(log.id),
            "endpoint": log.endpoint,
            "request_timestamp": log.request_timestamp.isoformat(),
            "response_time_ms": log.response_time_ms,
            "success": log.success,
            "error_message": log.error_message,
            "rate_limit_remaining": log.rate_limit_remaining,
            "status_code": log.status_code,
            "created_at": log.created_at.isoformat(),
        }
        for log in result.scalars().all()
    ]


async def get_analytics(db: AsyncSession) -> ExchangeRateAnalyticsResponse:
    rates = await list_current_rates(db)
    if not rates:
        return ExchangeRateAnalyticsResponse(
            strongest=[],
            weakest=[],
            most_volatile=[],
            trends=[],
            summary={"total_currencies": 0, "last_sync": None},
        )

    config = await get_config(db)
    non_usd = [r for r in rates if r["target_currency"] != "USD"]
    by_strength = sorted(non_usd, key=lambda r: r["exchange_rate"])
    strongest = by_strength[:5]
    weakest = list(reversed(by_strength[-5:])) if len(by_strength) >= 5 else list(reversed(by_strength))

    volatility: list[dict] = []
    for item in non_usd[:20]:
        change_24h, change_7d = await _compute_changes(
            db, item["target_currency"], item["exchange_rate"]
        )
        vol = abs(change_7d or 0) + abs(change_24h or 0)
        volatility.append({**item, "volatility": vol, "change_7d": change_7d, "change_24h": change_24h})

    volatility.sort(key=lambda x: x["volatility"], reverse=True)
    most_volatile = volatility[:5]

    trends = []
    for item in non_usd[:10]:
        _, change_7d = await _compute_changes(
            db, item["target_currency"], item["exchange_rate"]
        )
        trends.append({
            "target_currency": item["target_currency"],
            "country_code": item.get("country_code"),
            "exchange_rate": item["exchange_rate"],
            "change_7d": change_7d,
            "trend": _trend_from_change(change_7d),
        })

    return ExchangeRateAnalyticsResponse(
        strongest=strongest,
        weakest=weakest,
        most_volatile=most_volatile,
        trends=trends,
        summary={
            "total_currencies": len(rates),
            "supported_currencies": len(SUPPORTED_CURRENCY_CODES),
            "supported_countries": len(COUNTRY_REFERENCE),
            "last_sync": config.last_sync.isoformat() if config.last_sync else None,
            "is_active": config.is_active,
            "sync_status": config.sync_status.value,
        },
    )


async def get_history(
    db: AsyncSession,
    *,
    target_currency: str | None = None,
    period_type: str | None = None,
    months: int = 12,
) -> list[dict]:
    cutoff = date.today() - timedelta(days=months * 30)
    query = select(ExchangeRateHistory).where(ExchangeRateHistory.period_date >= cutoff)
    if target_currency:
        query = query.where(ExchangeRateHistory.target_currency == target_currency.upper())
    if period_type:
        try:
            query = query.where(ExchangeRateHistory.period_type == PeriodType(period_type))
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid period_type: {period_type}. Use daily, weekly, or monthly.",
            ) from exc
    query = query.order_by(ExchangeRateHistory.period_date)

    result = await db.execute(query)
    return [
        {
            "target_currency": row.target_currency,
            "exchange_rate": row.exchange_rate,
            "period_type": row.period_type.value,
            "period_date": row.period_date.isoformat(),
            "source": row.source,
        }
        for row in result.scalars().all()
    ]


async def get_audit_logs(db: AsyncSession, *, limit: int = 100) -> list[dict]:
    result = await db.execute(
        select(ExchangeRateAuditLog, User.email)
        .outerjoin(User, ExchangeRateAuditLog.admin_user_id == User.id)
        .order_by(desc(ExchangeRateAuditLog.created_at))
        .limit(limit)
    )
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "changed_fields": log.changed_fields,
            "admin_user_id": str(log.admin_user_id) if log.admin_user_id else None,
            "admin_email": admin_email,
            "created_at": log.created_at.isoformat(),
        }
        for log, admin_email in result.all()
    ]


async def _fetch_api_endpoint(
    db: AsyncSession,
    config: ExchangeRateApiConfig,
    path: str,
    *,
    api_key_override: str | None = None,
    log_label: str | None = None,
) -> tuple[dict, dict]:
    """Generic ExchangeRate-API v6 proxy."""
    api_key = api_key_override or decrypt_api_key(config.api_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is not configured")

    url = _build_api_url(config, api_key, path)
    label = log_label or path
    start = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url)
            response_time_ms = round((time.perf_counter() - start) * 1000, 2)
            status_code = response.status_code
            rate_limit = response.headers.get("X-RateLimit-Remaining")
            rate_limit_int = int(rate_limit) if rate_limit and rate_limit.isdigit() else None

            try:
                payload = response.json()
            except json.JSONDecodeError:
                await _log_api_call(
                    db,
                    endpoint=label,
                    success=False,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                    error_message="Non-JSON response body",
                    rate_limit_remaining=rate_limit_int,
                )
                raise HTTPException(status_code=502, detail=GENERIC_API_ERROR)

            if payload.get("result") != "success":
                err = str(payload.get("error-type", "unknown_error"))
                await _log_api_call(
                    db,
                    endpoint=label,
                    success=False,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                    error_message=err,
                    rate_limit_remaining=rate_limit_int,
                )
                if err in ("plan-upgrade-required", "quota-reached", "invalid-key"):
                    raise HTTPException(status_code=400, detail=err.replace("-", " ").title())
                raise HTTPException(status_code=502, detail=GENERIC_API_ERROR)

            await _log_api_call(
                db,
                endpoint=label,
                success=True,
                response_time_ms=response_time_ms,
                status_code=status_code,
                rate_limit_remaining=rate_limit_int,
            )
            return payload, {
                "response_time_ms": response_time_ms,
                "endpoint": label,
            }
    except HTTPException:
        raise
    except Exception as exc:
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        await _log_api_call(
            db,
            endpoint=label,
            success=False,
            response_time_ms=response_time_ms,
            status_code=None,
            error_message=str(exc),
        )
        logger.exception("Exchange rate API request failed: %s", label)
        raise HTTPException(status_code=502, detail=GENERIC_API_ERROR) from exc


async def list_supported_currencies(db: AsyncSession) -> dict:
    """All ExchangeRate-API currencies with optional live cached rates."""
    catalog = list_catalog_currencies()
    codes = {c["code"] for c in catalog}
    rate_rows = await get_latest_rates_for_currencies(db, codes)
    config = await get_config(db)

    items = []
    for entry in catalog:
        code = entry["code"]
        rate_row = rate_rows.get(code)
        items.append({
            **entry,
            "exchange_rate": rate_row.exchange_rate if rate_row else None,
            "last_updated": rate_row.retrieved_at.isoformat() if rate_row else None,
            "base_currency": config.base_currency if rate_row else None,
        })

    return {
        "total": len(items),
        "base_currency": config.base_currency,
        "supported_codes": SUPPORTED_CURRENCY_CODES,
        "currencies": items,
    }


async def fetch_pair_conversion(
    db: AsyncSession,
    *,
    base_currency: str,
    target_currency: str,
    amount: float | None = None,
) -> dict:
    config = await get_config(db)
    base = base_currency.upper()
    target = target_currency.upper()
    path = f"pair/{base}/{target}"
    if amount is not None:
        path = f"{path}/{amount}"
    payload, meta = await _fetch_api_endpoint(db, config, path, log_label=f"pair/{base}/{target}")
    return {
        "base_code": payload.get("base_code", base),
        "target_code": payload.get("target_code", target),
        "conversion_rate": payload.get("conversion_rate"),
        "conversion_result": payload.get("conversion_result"),
        "time_last_update_utc": payload.get("time_last_update_utc"),
        **meta,
    }


async def fetch_provider_historical(
    db: AsyncSession,
    *,
    base_currency: str,
    year: int,
    month: int,
    day: int,
    amount: float | None = None,
) -> dict:
    config = await get_config(db)
    base = base_currency.upper()
    path = f"history/{base}/{year}/{month}/{day}"
    if amount is not None:
        path = f"{path}/{amount}"
    payload, meta = await _fetch_api_endpoint(
        db,
        config,
        path,
        log_label=f"history/{base}/{year}/{month}/{day}",
    )
    rates = payload.get("conversion_rates") or payload.get("conversion_amounts") or {}
    return {
        "base_code": payload.get("base_code", base),
        "year": payload.get("year", year),
        "month": payload.get("month", month),
        "day": payload.get("day", day),
        "conversion_rates": rates,
        "requested_amount": payload.get("requested_amount"),
        "conversion_amounts": payload.get("conversion_amounts"),
        "rates_count": len(rates) if isinstance(rates, dict) else 0,
        **meta,
    }


async def fetch_enriched_data(
    db: AsyncSession,
    *,
    base_currency: str,
    target_currency: str,
) -> dict:
    config = await get_config(db)
    base = base_currency.upper()
    target = target_currency.upper()
    payload, meta = await _fetch_api_endpoint(
        db,
        config,
        f"enriched/{base}/{target}",
        log_label=f"enriched/{base}/{target}",
    )
    static_meta = get_currency_metadata(target) or {}
    return {
        "base_code": payload.get("base_code", base),
        "target_code": payload.get("target_code", target),
        "conversion_rate": payload.get("conversion_rate"),
        "target_data": payload.get("target_data"),
        "static_metadata": static_meta,
        "time_last_update_utc": payload.get("time_last_update_utc"),
        **meta,
    }


async def get_rate_for_currency(
    db: AsyncSession,
    currency_code: str,
) -> ExchangeRateCountryResponse:
    """Resolve FX by ISO 4217 currency code."""
    cur = currency_code.upper()
    meta = get_currency_metadata(cur) or {}
    country_code = country_code_for_currency(cur) or cur
    ref = COUNTRY_REFERENCE.get(country_code, {})
    return await get_rate_for_country(db, country_code)