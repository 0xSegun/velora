"""
IMF DataMapper API — fetch, sync, cache, and country macro indicator persistence.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data.imf_country_codes import (
    DEFAULT_IMF_INDICATORS,
    IMF_INDICATORS,
    iso2_to_imf,
)
from app.models.imf_api import ImfApiConfig, ImfApiLog, ImfCountryData, ImfSyncStatus
from app.models.user import User
from app.schemas.imf_api import (
    CountryContextImf,
    ImfConfigResponse,
    ImfConfigUpdate,
    ImfHealthResponse,
    ImfSourceConfig,
    ImfTestResponse,
)
from app.services.country_service import COUNTRY_REFERENCE
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
ALLOWED_BASE_URL = "https://www.imf.org/external/datamapper/api/v1"
REFRESH_HOURS = {"hourly": 1, "daily": 24, "weekly": 168}


def _interval_hours(interval: str) -> int:
    return REFRESH_HOURS.get(interval, 24)


def _compute_next_sync(interval: str, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _resolve_api_key(config: ImfApiConfig, override: str | None = None) -> str | None:
    if override:
        return override.strip() or None
    decrypted = decrypt_api_key(config.api_key)
    if decrypted:
        return decrypted
    env_key = getattr(settings, "IMF_API_KEY", None) or ""
    return env_key.strip() or None


def _source_config(config: ImfApiConfig) -> ImfSourceConfig:
    raw = config.source_config or {}
    try:
        return ImfSourceConfig.model_validate(raw)
    except Exception:
        return ImfSourceConfig()


def _country_name(country_code: str) -> str:
    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    return ref.get("name", country_code.upper())


def _latest_year(series: dict[str, float | int | None]) -> int | None:
    years = [int(y) for y in series.keys() if str(y).isdigit()]
    return max(years) if years else None


def _value_for_year(series: dict, year: int | None = None) -> tuple[int | None, float | None]:
    if not series:
        return None, None
    target_year = year or _latest_year(series)
    if target_year is None:
        return None, None
    raw = series.get(str(target_year))
    if raw is None:
        return target_year, None
    try:
        return target_year, float(raw)
    except (TypeError, ValueError):
        return target_year, None


def _build_fetch_url(base_url: str, imf_code: str, indicators: list[str]) -> str:
    """
    Build IMF DataMapper URL.

    The query-string form ({country}?indicator=...) returns metadata only;
    path segments return time series values.
    """
    base = base_url.rstrip("/")
    indicator_path = "/".join(indicators)
    return f"{base}/{indicator_path}/{imf_code}"


async def ensure_default_config(db: AsyncSession) -> ImfApiConfig:
    result = await db.execute(select(ImfApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        normalized = (config.base_url or "").rstrip("/")
        if normalized != ALLOWED_BASE_URL:
            config.base_url = ALLOWED_BASE_URL
            config.updated_at = datetime.now(timezone.utc)
            await db.flush()
        return config

    config = ImfApiConfig(
        provider_name="IMF DataMapper",
        base_url=ALLOWED_BASE_URL,
        refresh_interval="daily",
        sync_enabled=True,
        is_active=False,
        sync_status=ImfSyncStatus.IDLE,
        source_config=ImfSourceConfig().model_dump(),
    )
    db.add(config)
    await db.flush()
    logger.info("Seeded default imf_api_config")
    return config


async def get_config(db: AsyncSession) -> ImfApiConfig:
    return await ensure_default_config(db)


def _to_config_response(config: ImfApiConfig) -> ImfConfigResponse:
    return ImfConfigResponse(
        id=str(config.id),
        provider_name=config.provider_name,
        base_url=config.base_url,
        api_key_set=bool(config.api_key or getattr(settings, "IMF_API_KEY", None)),
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


async def get_full_config(db: AsyncSession) -> ImfConfigResponse:
    config = await get_config(db)
    return _to_config_response(config)


async def update_config(
    db: AsyncSession, *, admin: User, payload: ImfConfigUpdate
) -> ImfConfigResponse:
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
        ImfApiLog(
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
    config: ImfApiConfig,
    *,
    country_code: str,
    indicators: list[str] | None = None,
    api_key_override: str | None = None,
) -> dict:
    iso2 = country_code.upper().strip()
    imf_code = iso2_to_imf(iso2)
    if not imf_code:
        raise ValueError(f"No IMF mapping for country code {iso2}")

    source_cfg = _source_config(config)
    indicator_list = indicators or source_cfg.indicators or list(DEFAULT_IMF_INDICATORS)
    url = _build_fetch_url(config.base_url, imf_code, indicator_list)

    headers: dict[str, str] = {}
    api_key = _resolve_api_key(config, api_key_override)
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.get(url, headers=headers or None)
        resp.raise_for_status()
        payload = resp.json()

    values = payload.get("values") or {}
    preferred_year = source_cfg.preferred_year
    parsed: dict[str, dict] = {}
    indicator_values: dict[str, float | None] = {}

    for indicator in indicator_list:
        series = (values.get(indicator) or {}).get(imf_code) or {}
        year, value = _value_for_year(series, preferred_year)
        field_name = IMF_INDICATORS.get(indicator, indicator.lower())
        parsed[indicator] = {"year": year, "value": value, "series": series}
        indicator_values[field_name] = value

    data_year = preferred_year
    if not data_year:
        years = [item["year"] for item in parsed.values() if item.get("year")]
        data_year = max(years) if years else datetime.now(timezone.utc).year

    return {
        "country_code": iso2,
        "imf_country_code": imf_code,
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
        select(ImfCountryData)
        .where(ImfCountryData.country_code == iso2)
        .where(ImfCountryData.data_year == data_year)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if row:
        row.imf_country_code = record["imf_country_code"]
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
        ImfCountryData(
            country_code=iso2,
            imf_country_code=record["imf_country_code"],
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
) -> ImfTestResponse:
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
        return ImfTestResponse(
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
        return ImfTestResponse(success=False, message=msg, response_time_ms=elapsed)
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
        return ImfTestResponse(success=False, message=msg, response_time_ms=elapsed)


async def sync_imf_data(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    config = await get_config(db)
    if not config.is_active and not force:
        return {"success": False, "message": "IMF API is not active"}
    if config.sync_status == ImfSyncStatus.SYNCING and not force:
        return {"success": False, "message": "Sync already in progress"}

    source_cfg = _source_config(config)
    country_codes = source_cfg.country_codes or ["NG", "US", "GB", "GH"]

    if config.sync_status != ImfSyncStatus.SYNCING:
        config.sync_status = ImfSyncStatus.SYNCING
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

        config.sync_status = ImfSyncStatus.SUCCESS
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
        config.sync_status = ImfSyncStatus.FAILED
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


async def enable_api(db: AsyncSession, *, admin: User) -> ImfConfigResponse:
    config = await get_config(db)
    config.is_active = True
    config.next_sync = config.next_sync or datetime.now(timezone.utc)
    await db.flush()
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> ImfConfigResponse:
    config = await get_config(db)
    config.is_active = False
    await db.flush()
    return _to_config_response(config)


async def _count_stored_countries(db: AsyncSession) -> int:
    count = await db.scalar(select(func.count(func.distinct(ImfCountryData.country_code))))
    return int(count or 0)


async def get_health(db: AsyncSession) -> ImfHealthResponse:
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
        if config.sync_status == ImfSyncStatus.FAILED:
            status = "red"
        elif config.error_count > config.success_count:
            status = "yellow"
        else:
            status = "green"

    return ImfHealthResponse(
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
) -> ImfCountryData | None:
    iso2 = country_code.upper().strip()
    result = await db.execute(
        select(ImfCountryData)
        .where(ImfCountryData.country_code == iso2)
        .order_by(desc(ImfCountryData.data_year))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_country_context_imf(
    db: AsyncSession, country_code: str
) -> CountryContextImf | None:
    row = await get_country_data(db, country_code)
    if not row:
        return None
    return CountryContextImf(
        country_code=row.country_code,
        country_name=row.country_name,
        data_year=row.data_year,
        inflation_pct=row.inflation_pct,
        gdp_growth_pct=row.gdp_growth_pct,
        gdp_usd_billions=row.gdp_usd_billions,
        government_debt_pct_gdp=row.government_debt_pct_gdp,
        unemployment_pct=row.unemployment_pct,
        current_account_pct_gdp=row.current_account_pct_gdp,
        source="imf_datamapper",
        cached=True,
        retrieved_at=row.retrieved_at,
    )


async def maybe_sync_if_due(db: AsyncSession) -> bool:
    config = await get_config(db)
    if not config.is_active or not config.sync_enabled:
        return False
    if config.sync_status == ImfSyncStatus.SYNCING:
        return False
    now = datetime.now(timezone.utc)
    if config.next_sync and now < config.next_sync:
        return False
    result = await sync_imf_data(db, force=False)
    return bool(result.get("success"))