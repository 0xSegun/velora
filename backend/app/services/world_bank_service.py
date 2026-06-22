"""
World Bank Open Data API — fetch, sync, cache, and country macro indicator persistence.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data.world_bank_country_codes import (
    DEFAULT_WB_INDICATORS,
    WB_INDICATORS,
    iso2_to_wb,
)
from app.models.user import User
from app.models.world_bank_api import (
    WorldBankApiConfig,
    WorldBankApiLog,
    WorldBankCountryData,
    WorldBankSyncStatus,
)
from app.schemas.world_bank_api import (
    WorldBankConfigResponse,
    WorldBankConfigUpdate,
    WorldBankHealthResponse,
    WorldBankSourceConfig,
    WorldBankTestResponse,
)
from app.services.country_service import COUNTRY_REFERENCE
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
ALLOWED_BASE_URL = "https://api.worldbank.org/v2"
REFRESH_HOURS = {"hourly": 1, "daily": 24, "weekly": 168}


def _interval_hours(interval: str) -> int:
    return REFRESH_HOURS.get(interval, 24)


def _compute_next_sync(interval: str, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _resolve_api_key(config: WorldBankApiConfig, override: str | None = None) -> str | None:
    if override:
        return override.strip() or None
    decrypted = decrypt_api_key(config.api_key)
    if decrypted:
        return decrypted
    return None


def _source_config(config: WorldBankApiConfig) -> WorldBankSourceConfig:
    raw = config.source_config or {}
    try:
        return WorldBankSourceConfig.model_validate(raw)
    except Exception:
        return WorldBankSourceConfig()


def _country_name(country_code: str) -> str:
    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    return ref.get("name", country_code.upper())


def _build_fetch_url(
    base_url: str,
    wb_code: str,
    indicator: str,
    date_range: str,
) -> str:
    base = base_url.rstrip("/")
    return (
        f"{base}/country/{wb_code}/indicator/{indicator}"
        f"?format=json&per_page=60&date={date_range}"
    )


def _parse_world_bank_response(
    payload: list,
    *,
    indicator_list: list[str],
    preferred_year: int | None = None,
) -> tuple[int, dict[str, dict], dict[str, float | None]]:
    if not isinstance(payload, list) or len(payload) < 2:
        raise ValueError("Unexpected World Bank response format")

    rows = payload[1] or []
    by_indicator: dict[str, dict[str, float | None]] = {code: {} for code in indicator_list}

    for row in rows:
        if not isinstance(row, dict):
            continue
        indicator_id = (row.get("indicator") or {}).get("id")
        if not indicator_id or indicator_id not in by_indicator:
            continue
        date_str = str(row.get("date", ""))
        if not date_str.isdigit():
            continue
        raw_value = row.get("value")
        try:
            value = float(raw_value) if raw_value is not None else None
        except (TypeError, ValueError):
            value = None
        by_indicator[indicator_id][date_str] = value

    parsed: dict[str, dict] = {}
    indicator_values: dict[str, float | None] = {}

    for indicator in indicator_list:
        series = by_indicator.get(indicator, {})
        years = [int(y) for y in series.keys() if str(y).isdigit()]
        target_year = preferred_year if preferred_year in years else (max(years) if years else None)
        value = series.get(str(target_year)) if target_year is not None else None
        field_name = WB_INDICATORS.get(indicator, indicator.lower())
        parsed[indicator] = {"year": target_year, "value": value, "series": series}
        if field_name == "gdp_usd_billions" and value is not None:
            value = value / 1_000_000_000
        indicator_values[field_name] = value

    data_year = preferred_year
    if not data_year:
        years = [item["year"] for item in parsed.values() if item.get("year")]
        data_year = max(years) if years else datetime.now(timezone.utc).year

    return data_year, parsed, indicator_values


async def ensure_default_config(db: AsyncSession) -> WorldBankApiConfig:
    result = await db.execute(select(WorldBankApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        normalized = (config.base_url or "").rstrip("/")
        if normalized != ALLOWED_BASE_URL:
            config.base_url = ALLOWED_BASE_URL
            config.updated_at = datetime.now(timezone.utc)
            await db.flush()
        return config

    config = WorldBankApiConfig(
        provider_name="World Bank Open Data",
        base_url=ALLOWED_BASE_URL,
        refresh_interval="daily",
        sync_enabled=True,
        is_active=False,
        sync_status=WorldBankSyncStatus.IDLE,
        source_config=WorldBankSourceConfig().model_dump(),
    )
    db.add(config)
    await db.flush()
    logger.info("Seeded default world_bank_api_config")
    return config


async def get_config(db: AsyncSession) -> WorldBankApiConfig:
    return await ensure_default_config(db)


def _to_config_response(config: WorldBankApiConfig) -> WorldBankConfigResponse:
    return WorldBankConfigResponse(
        id=str(config.id),
        provider_name=config.provider_name,
        base_url=config.base_url,
        api_key_set=bool(config.api_key),
        refresh_interval=config.refresh_interval,
        sync_enabled=config.sync_enabled,
        is_active=config.is_active,
        source_config=config.source_config or {},
        last_sync=config.last_sync,
        last_failed_sync=config.last_failed_sync,
        next_sync=config.next_sync,
        sync_status=config.sync_status.value,
        countries_synced=config.countries_synced,
        error_count=config.error_count,
        success_count=config.success_count,
    )


async def get_full_config(db: AsyncSession) -> WorldBankConfigResponse:
    config = await get_config(db)
    return _to_config_response(config)


async def update_config(
    db: AsyncSession, *, admin: User, payload: WorldBankConfigUpdate
) -> WorldBankConfigResponse:
    config = await get_config(db)
    data = payload.model_dump(exclude_unset=True)

    if "api_key" in data:
        key = data.pop("api_key")
        if key and key != MASKED_KEY:
            config.api_key = encrypt_api_key(key)

    if "base_url" in data and data["base_url"]:
        config.base_url = data["base_url"].rstrip("/")

    if "source_config" in data and data["source_config"]:
        sc = data["source_config"]
        if hasattr(sc, "model_dump"):
            config.source_config = sc.model_dump()
        else:
            config.source_config = sc

    for field in ("provider_name", "refresh_interval", "sync_enabled", "is_active"):
        if field in data and data[field] is not None:
            setattr(config, field, data[field])

    config.updated_at = datetime.now(timezone.utc)
    if config.is_active and config.sync_enabled:
        config.next_sync = config.next_sync or _compute_next_sync(config.refresh_interval)

    await db.flush()
    return _to_config_response(config)


async def _log_request(
    db: AsyncSession,
    *,
    config_id: uuid.UUID,
    endpoint: str,
    success: bool,
    response_time_ms: int | None,
    status_code: int | None,
    countries: int = 0,
    error: str | None = None,
) -> None:
    db.add(
        WorldBankApiLog(
            config_id=config_id,
            endpoint=endpoint[:500],
            response_time_ms=response_time_ms,
            success=success,
            status_code=status_code,
            countries_synced=countries,
            error_message=error,
        )
    )


async def fetch_country_indicators(
    config: WorldBankApiConfig,
    *,
    country_code: str,
    indicators: list[str] | None = None,
    api_key_override: str | None = None,
) -> dict:
    iso2 = country_code.upper().strip()
    wb_code = iso2_to_wb(iso2)
    if not wb_code:
        raise ValueError(f"No World Bank mapping for country code {iso2}")

    source_cfg = _source_config(config)
    indicator_list = indicators or source_cfg.indicators or list(DEFAULT_WB_INDICATORS.keys())

    headers: dict[str, str] = {}
    api_key = _resolve_api_key(config, api_key_override)
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    combined_rows: list[dict] = []

    async def _fetch_indicator(client: httpx.AsyncClient, indicator: str) -> list[dict]:
        url = _build_fetch_url(
            config.base_url,
            wb_code,
            indicator,
            source_cfg.date_range,
        )
        resp = await client.get(url, headers=headers or None)
        resp.raise_for_status()
        payload = resp.json()
        if isinstance(payload, list) and len(payload) >= 2 and isinstance(payload[1], list):
            return payload[1]
        return []

    async with httpx.AsyncClient(timeout=45.0) as client:
        batches = await asyncio.gather(
            *[_fetch_indicator(client, indicator) for indicator in indicator_list],
            return_exceptions=True,
        )
        for batch in batches:
            if isinstance(batch, Exception):
                raise batch
            combined_rows.extend(batch)

    data_year, parsed, indicator_values = _parse_world_bank_response(
        [None, combined_rows],
        indicator_list=indicator_list,
        preferred_year=source_cfg.preferred_year,
    )

    return {
        "country_code": iso2,
        "wb_country_code": wb_code,
        "country_name": _country_name(iso2),
        "data_year": data_year,
        "indicators": parsed,
        "indicator_values": indicator_values,
    }


async def _upsert_country_data(db: AsyncSession, record: dict) -> bool:
    iso2 = record["country_code"]
    data_year = record["data_year"]
    values = record["indicator_values"]

    result = await db.execute(
        select(WorldBankCountryData)
        .where(WorldBankCountryData.country_code == iso2)
        .where(WorldBankCountryData.data_year == data_year)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if row:
        row.wb_country_code = record["wb_country_code"]
        row.country_name = record["country_name"]
        row.inflation_pct = values.get("inflation_pct")
        row.gdp_growth_pct = values.get("gdp_growth_pct")
        row.gdp_usd_billions = values.get("gdp_usd_billions")
        row.government_debt_pct_gdp = values.get("government_debt_pct_gdp")
        row.unemployment_pct = values.get("unemployment_pct")
        row.current_account_pct_gdp = values.get("current_account_pct_gdp")
        row.indicators_json = record["indicators"]
        row.retrieved_at = now
        row.updated_at = now
        return False

    db.add(
        WorldBankCountryData(
            country_code=iso2,
            wb_country_code=record["wb_country_code"],
            country_name=record["country_name"],
            data_year=data_year,
            inflation_pct=values.get("inflation_pct"),
            gdp_growth_pct=values.get("gdp_growth_pct"),
            gdp_usd_billions=values.get("gdp_usd_billions"),
            government_debt_pct_gdp=values.get("government_debt_pct_gdp"),
            unemployment_pct=values.get("unemployment_pct"),
            current_account_pct_gdp=values.get("current_account_pct_gdp"),
            indicators_json=record["indicators"],
            retrieved_at=now,
            updated_at=now,
        )
    )
    return True


async def test_connection(
    db: AsyncSession,
    *,
    api_key_override: str | None = None,
    country_code: str = "NG",
    admin_id: uuid.UUID | None = None,
) -> WorldBankTestResponse:
    config = await get_config(db)
    start = time.perf_counter()
    try:
        record = await fetch_country_indicators(
            config, country_code=country_code, api_key_override=api_key_override
        )
        elapsed = int((time.perf_counter() - start) * 1000)
        found = sum(1 for v in record["indicator_values"].values() if v is not None)
        await _log_request(
            db,
            config_id=config.id,
            endpoint="test",
            success=True,
            response_time_ms=elapsed,
            status_code=200,
            countries=1,
        )
        return WorldBankTestResponse(
            success=True,
            message=f"Connected — fetched {found} indicators for {record['country_name']}",
            response_time_ms=elapsed,
            sample_country=record["country_code"],
            indicators_found=found,
        )
    except httpx.HTTPStatusError as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        msg = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        await _log_request(
            db,
            config_id=config.id,
            endpoint="test",
            success=False,
            response_time_ms=elapsed,
            status_code=exc.response.status_code,
            error=msg,
        )
        return WorldBankTestResponse(success=False, message=msg, response_time_ms=elapsed)
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        msg = str(exc)[:300]
        await _log_request(
            db,
            config_id=config.id,
            endpoint="test",
            success=False,
            response_time_ms=elapsed,
            status_code=None,
            error=msg,
        )
        return WorldBankTestResponse(success=False, message=msg, response_time_ms=elapsed)


async def sync_world_bank_data(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    config = await get_config(db)
    if not config.is_active and not force:
        return {"success": False, "message": "World Bank API is not active"}
    if config.sync_status == WorldBankSyncStatus.SYNCING and not force:
        return {"success": False, "message": "Sync already in progress"}

    source_cfg = _source_config(config)
    country_codes = source_cfg.country_codes or ["NG", "US", "GB", "GH"]

    if config.sync_status != WorldBankSyncStatus.SYNCING:
        config.sync_status = WorldBankSyncStatus.SYNCING
        await db.flush()

    start = time.perf_counter()
    stored = 0
    updated = 0
    errors: list[str] = []

    try:
        from app.services.api_sync_tasks import gather_country_fetches

        fetch_results = await gather_country_fetches(
            country_codes,
            lambda code: fetch_country_indicators(config, country_code=code),
            concurrency=3,
        )
        for code, outcome in fetch_results:
            if isinstance(outcome, BaseException):
                errors.append(f"{code}: {str(outcome)[:120]}")
                continue
            created = await _upsert_country_data(db, outcome)
            if created:
                stored += 1
            else:
                updated += 1

        elapsed = int((time.perf_counter() - start) * 1000)
        now = datetime.now(timezone.utc)
        synced = stored + updated

        if synced == 0 and errors:
            raise RuntimeError("; ".join(errors[:3]))

        config.sync_status = WorldBankSyncStatus.SUCCESS
        config.last_sync = now
        config.next_sync = _compute_next_sync(config.refresh_interval, now)
        config.countries_synced = await _count_stored_countries(db)
        config.success_count += 1

        await _log_request(
            db,
            config_id=config.id,
            endpoint="sync",
            success=True,
            response_time_ms=elapsed,
            status_code=200,
            countries=synced,
        )
        msg = f"Synced {synced} country records ({stored} new, {updated} updated)"
        if errors:
            msg += f" — {len(errors)} warnings"
        return {
            "success": True,
            "message": msg,
            "stored": stored,
            "updated": updated,
            "errors": errors,
        }
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        now = datetime.now(timezone.utc)
        config.sync_status = WorldBankSyncStatus.FAILED
        config.last_failed_sync = now
        config.error_count += 1
        msg = str(exc)[:500]
        await _log_request(
            db,
            config_id=config.id,
            endpoint="sync",
            success=False,
            response_time_ms=elapsed,
            status_code=None,
            error=msg,
        )
        return {"success": False, "message": msg, "errors": errors}
    finally:
        await db.flush()


async def enable_api(db: AsyncSession, *, admin: User) -> WorldBankConfigResponse:
    config = await get_config(db)
    config.is_active = True
    config.next_sync = config.next_sync or datetime.now(timezone.utc)
    await db.flush()
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> WorldBankConfigResponse:
    config = await get_config(db)
    config.is_active = False
    await db.flush()
    return _to_config_response(config)


async def _count_stored_countries(db: AsyncSession) -> int:
    count = await db.scalar(
        select(func.count(func.distinct(WorldBankCountryData.country_code)))
    )
    return int(count or 0)


async def get_health(db: AsyncSession) -> WorldBankHealthResponse:
    config = await get_config(db)
    stored_countries = await _count_stored_countries(db)
    total = config.success_count + config.error_count
    rate = round(config.success_count / total * 100, 1) if total else None
    using_cache = False
    if config.last_sync:
        age = datetime.now(timezone.utc) - config.last_sync
        using_cache = age > timedelta(hours=_interval_hours(config.refresh_interval))

    status = "inactive"
    if config.is_active:
        if config.sync_status == WorldBankSyncStatus.FAILED:
            status = "red"
        elif config.error_count > config.success_count:
            status = "yellow"
        else:
            status = "green"

    return WorldBankHealthResponse(
        status=status,
        provider=config.provider_name,
        is_active=config.is_active,
        sync_status=config.sync_status.value,
        last_sync=config.last_sync,
        next_sync=config.next_sync,
        countries_synced=stored_countries,
        success_rate=rate,
        using_cached_data=using_cache,
    )


async def get_country_data(
    db: AsyncSession, country_code: str
) -> WorldBankCountryData | None:
    iso2 = country_code.upper().strip()
    result = await db.execute(
        select(WorldBankCountryData)
        .where(WorldBankCountryData.country_code == iso2)
        .order_by(desc(WorldBankCountryData.data_year))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_country_context_world_bank(db: AsyncSession, country_code: str):
    from app.schemas.world_bank_api import CountryContextWorldBank

    row = await get_country_data(db, country_code)
    if not row:
        return None
    return CountryContextWorldBank(
        country_code=row.country_code,
        country_name=row.country_name,
        data_year=row.data_year,
        inflation_pct=row.inflation_pct,
        gdp_growth_pct=row.gdp_growth_pct,
        gdp_usd_billions=row.gdp_usd_billions,
        government_debt_pct_gdp=row.government_debt_pct_gdp,
        unemployment_pct=row.unemployment_pct,
        current_account_pct_gdp=row.current_account_pct_gdp,
        source="world_bank_open_data",
        cached=True,
        retrieved_at=row.retrieved_at,
    )


async def maybe_sync_if_due(db: AsyncSession) -> bool:
    config = await get_config(db)
    if not config.is_active or not config.sync_enabled:
        return False
    if config.sync_status == WorldBankSyncStatus.SYNCING:
        return False
    now = datetime.now(timezone.utc)
    if config.next_sync and now < config.next_sync:
        return False
    result = await sync_world_bank_data(db, force=False)
    return bool(result.get("success"))