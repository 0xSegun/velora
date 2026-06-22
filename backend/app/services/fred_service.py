"""
FRED API management — fetch, sync, cache, analytics, and TS-Transformer integration.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import time
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.data.fred_indicators import (
    DEFAULT_ENABLED_CODES,
    DEFAULT_FEATURE_CONFIG,
    FRED_INDICATOR_CATALOG,
)
from app.models.economic_data import DataSource, EconomicData
from app.models.fred import (
    FredApiConfig,
    FredApiLog,
    FredAuditLog,
    FredEconomicData,
    FredIndicator,
    FredSyncStatus,
)
from app.models.user import User
from app.schemas.fred import (
    FredAnalyticsResponse,
    FredConfigResponse,
    FredConfigUpdate,
    FredHealthResponse,
    FredIndicatorResponse,
    FredTestResponse,
)
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
STALE_MESSAGE = "Live FRED data is temporarily unavailable."
ALLOWED_BASE_URL = "https://api.stlouisfed.org/fred"
REFRESH_HOURS = {"hourly": 1, "daily": 24, "weekly": 168, "monthly": 720}
DATE_RANGE_YEARS = {"1y": 1, "3y": 3, "5y": 5, "10y": 10, "max": 50}
SYNC_STALE_MINUTES = 45

_live_api_available: bool = True
_last_live_check: datetime | None = None


def _interval_hours(interval: str) -> int:
    return REFRESH_HOURS.get(interval, 24)


def _compute_next_sync(interval: str, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _observation_start(date_range: str) -> str | None:
    years = DATE_RANGE_YEARS.get(date_range)
    if not years:
        return None
    start = datetime.now(timezone.utc) - timedelta(days=365 * years)
    return start.strftime("%Y-%m-%d")


def _health_status(config: FredApiConfig, indicators_enabled: int) -> str:
    if not config.is_active:
        return "inactive"
    if config.sync_status == FredSyncStatus.FAILED:
        return "red"
    if config.error_count > 0 and config.success_count == 0:
        return "red"
    if not config.api_key or indicators_enabled == 0:
        return "yellow"
    if config.error_count > config.success_count:
        return "yellow"
    return "green"


def _resolve_api_key(config: FredApiConfig, override: str | None = None) -> str | None:
    if override:
        return override
    decrypted = decrypt_api_key(config.api_key)
    if decrypted:
        return decrypted
    env_key = getattr(settings, "FRED_API_KEY", None) or ""
    return env_key.strip() or None


async def ensure_default_config(db: AsyncSession) -> FredApiConfig:
    result = await db.execute(select(FredApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        normalized = (config.base_url or "").rstrip("/")
        if normalized != ALLOWED_BASE_URL:
            config.base_url = ALLOWED_BASE_URL
            config.updated_at = datetime.now(timezone.utc)
            await db.flush()
        if not config.feature_config:
            config.feature_config = dict(DEFAULT_FEATURE_CONFIG)
            await db.flush()
        return config

    config = FredApiConfig(
        provider_name="Federal Reserve Economic Data (FRED)",
        base_url=ALLOWED_BASE_URL,
        refresh_interval="daily",
        date_range="5y",
        data_frequency="monthly",
        prediction_enabled=True,
        sync_enabled=True,
        historical_storage_enabled=True,
        is_active=False,
        sync_status=FredSyncStatus.IDLE,
        feature_config=dict(DEFAULT_FEATURE_CONFIG),
    )
    db.add(config)
    await db.flush()
    await _seed_indicators(db)
    logger.info("Seeded default fred_api_config")
    return config


async def _seed_indicators(db: AsyncSession) -> None:
    existing = await db.execute(select(func.count()).select_from(FredIndicator))
    if (existing.scalar() or 0) > 0:
        return
    for item in FRED_INDICATOR_CATALOG:
        db.add(
            FredIndicator(
                indicator_code=item["code"],
                indicator_name=item["name"],
                category=item["category"],
                description=item["description"],
                frequency=item["frequency"],
                field_mapping=item["field"],
                enabled=item["code"] in DEFAULT_ENABLED_CODES,
            )
        )
    await db.flush()


async def get_config(db: AsyncSession) -> FredApiConfig:
    config = await ensure_default_config(db)
    await _seed_indicators(db)
    return config


async def _get_indicators(db: AsyncSession) -> list[FredIndicator]:
    result = await db.execute(
        select(FredIndicator).order_by(FredIndicator.category, FredIndicator.indicator_name)
    )
    return list(result.scalars().all())


def _to_config_response(config: FredApiConfig, indicators: list[FredIndicator]) -> FredConfigResponse:
    return FredConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        api_key_masked=MASKED_KEY if config.api_key else "",
        api_key_set=bool(config.api_key or getattr(settings, "FRED_API_KEY", "")),
        base_url=config.base_url,
        refresh_interval=config.refresh_interval,
        date_range=config.date_range,
        data_frequency=config.data_frequency,
        prediction_enabled=config.prediction_enabled,
        sync_enabled=config.sync_enabled,
        historical_storage_enabled=config.historical_storage_enabled,
        is_active=config.is_active,
        last_sync=config.last_sync,
        last_failed_sync=config.last_failed_sync,
        next_sync=config.next_sync,
        sync_status=config.sync_status.value,
        records_retrieved=config.records_retrieved,
        error_count=config.error_count,
        success_count=config.success_count,
        feature_config=config.feature_config or dict(DEFAULT_FEATURE_CONFIG),
        indicators=[FredIndicatorResponse.model_validate(i) for i in indicators],
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


async def get_full_config(db: AsyncSession) -> FredConfigResponse:
    config = await get_config(db)
    indicators = await _get_indicators(db)
    return _to_config_response(config, indicators)


async def _log_audit(
    db: AsyncSession,
    *,
    action: str,
    changed_fields: dict,
    admin_id: uuid.UUID | None,
) -> None:
    safe_fields = {
        k: ("***" if "key" in k.lower() else v)
        for k, v in changed_fields.items()
    }
    db.add(
        FredAuditLog(
            action=action,
            changed_fields=safe_fields,
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
) -> None:
    db.add(
        FredApiLog(
            endpoint=endpoint,
            request_timestamp=datetime.now(timezone.utc),
            response_time_ms=response_time_ms,
            status_code=status_code,
            success=success,
            error_message=error_message,
        )
    )


async def update_config(
    db: AsyncSession,
    *,
    admin: User,
    payload: FredConfigUpdate,
) -> FredConfigResponse:
    config = await get_config(db)
    changes: dict = {}

    for field in (
        "provider_name",
        "base_url",
        "refresh_interval",
        "date_range",
        "data_frequency",
        "prediction_enabled",
        "sync_enabled",
        "historical_storage_enabled",
    ):
        value = getattr(payload, field, None)
        if value is not None and getattr(config, field) != value:
            changes[field] = value
            setattr(config, field, value)

    if payload.base_url is not None:
        normalized = payload.base_url.rstrip("/")
        if normalized != ALLOWED_BASE_URL:
            raise HTTPException(status_code=400, detail="base_url must be the official FRED API endpoint")
        config.base_url = normalized

    if payload.api_key is not None:
        if payload.api_key:
            config.api_key = encrypt_api_key(payload.api_key)
            changes["api_key"] = "updated"
        else:
            config.api_key = None
            changes["api_key"] = "cleared"

    if payload.feature_config is not None:
        config.feature_config = payload.feature_config.model_dump()
        changes["feature_config"] = config.feature_config

    if payload.indicators:
        for item in payload.indicators:
            row = await db.execute(
                select(FredIndicator).where(FredIndicator.indicator_code == item.indicator_code)
            )
            indicator = row.scalar_one_or_none()
            if indicator and indicator.enabled != item.enabled:
                indicator.enabled = item.enabled
                indicator.updated_at = datetime.now(timezone.utc)
                changes[f"indicator_{item.indicator_code}"] = item.enabled

    if changes:
        config.updated_at = datetime.now(timezone.utc)
        if config.refresh_interval in REFRESH_HOURS:
            config.next_sync = _compute_next_sync(config.refresh_interval)
        await _log_audit(db, action="update_config", changed_fields=changes, admin_id=admin.id)

    await db.flush()
    indicators = await _get_indicators(db)
    return _to_config_response(config, indicators)


async def reset_config(db: AsyncSession, *, admin: User) -> FredConfigResponse:
    config = await get_config(db)
    config.provider_name = "Federal Reserve Economic Data (FRED)"
    config.base_url = ALLOWED_BASE_URL
    config.refresh_interval = "daily"
    config.date_range = "5y"
    config.data_frequency = "monthly"
    config.prediction_enabled = True
    config.sync_enabled = True
    config.historical_storage_enabled = True
    config.feature_config = dict(DEFAULT_FEATURE_CONFIG)
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="reset_config", changed_fields={"reset": True}, admin_id=admin.id)
    await db.flush()
    indicators = await _get_indicators(db)
    return _to_config_response(config, indicators)


async def enable_api(db: AsyncSession, *, admin: User) -> FredConfigResponse:
    config = await get_config(db)
    if not _resolve_api_key(config):
        raise HTTPException(status_code=400, detail="API key is required before enabling FRED")
    config.is_active = True
    config.next_sync = _compute_next_sync(config.refresh_interval)
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="enable_api", changed_fields={"is_active": True}, admin_id=admin.id)
    await db.flush()
    indicators = await _get_indicators(db)
    return _to_config_response(config, indicators)


async def disable_api(db: AsyncSession, *, admin: User) -> FredConfigResponse:
    config = await get_config(db)
    config.is_active = False
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="disable_api", changed_fields={"is_active": False}, admin_id=admin.id)
    await db.flush()
    indicators = await _get_indicators(db)
    return _to_config_response(config, indicators)


async def _fred_request(
    db: AsyncSession,
    config: FredApiConfig,
    *,
    path: str,
    params: dict,
    api_key: str,
) -> tuple[dict, float, int]:
    base = config.base_url.rstrip("/")
    url = f"{base}/{path.lstrip('/')}"
    safe_endpoint = url.split("api_key=")[0] + "api_key=***"
    params = {**params, "api_key": api_key, "file_type": "json"}
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        elapsed = round((time.perf_counter() - start) * 1000, 2)
        if response.status_code != 200:
            await _log_api_call(
                db,
                endpoint=safe_endpoint,
                success=False,
                response_time_ms=elapsed,
                status_code=response.status_code,
                error_message=response.text[:500],
            )
            raise HTTPException(status_code=502, detail="Unable to connect to the FRED API.")
        try:
            payload = response.json()
        except json.JSONDecodeError:
            await _log_api_call(
                db,
                endpoint=safe_endpoint,
                success=False,
                response_time_ms=elapsed,
                status_code=response.status_code,
                error_message="Non-JSON response",
            )
            raise HTTPException(status_code=502, detail="Unable to connect to the FRED API.")
        await _log_api_call(
            db,
            endpoint=safe_endpoint,
            success=True,
            response_time_ms=elapsed,
            status_code=response.status_code,
        )
        return payload, elapsed, response.status_code


async def test_connection(
    db: AsyncSession,
    *,
    api_key_override: str | None = None,
    admin_id: uuid.UUID | None = None,
) -> FredTestResponse:
    config = await get_config(db)
    api_key = _resolve_api_key(config, api_key_override)
    if not api_key:
        return FredTestResponse(
            success=False,
            message="Unable to connect to the FRED API.",
            diagnostics={"error": "API key not configured"},
        )
    try:
        payload, elapsed, status_code = await _fred_request(
            db,
            config,
            path="series/observations",
            params={"series_id": "CPIAUCSL", "limit": 1, "sort_order": "desc"},
            api_key=api_key,
        )
        obs = payload.get("observations", [])
        if admin_id:
            await _log_audit(
                db,
                action="test_connection",
                changed_fields={"success": True},
                admin_id=admin_id,
            )
        return FredTestResponse(
            success=True,
            message="FRED API connection successful.",
            response_time_ms=elapsed,
            status_code=status_code,
            diagnostics={
                "series_id": "CPIAUCSL",
                "observations_returned": len(obs),
                "latest_date": obs[0]["date"] if obs else None,
            },
        )
    except HTTPException as exc:
        return FredTestResponse(
            success=False,
            message="Unable to connect to the FRED API.",
            diagnostics={"error": str(exc.detail)},
        )
    except Exception as exc:
        logger.exception("FRED test connection failed")
        return FredTestResponse(
            success=False,
            message="Unable to connect to the FRED API.",
            diagnostics={"error": str(exc)[:300]},
        )


async def _reset_stale_sync(config: FredApiConfig) -> bool:
    if config.sync_status != FredSyncStatus.SYNCING:
        return False
    if not config.last_sync:
        return False
    stale_after = config.last_sync + timedelta(minutes=SYNC_STALE_MINUTES)
    if datetime.now(timezone.utc) > stale_after:
        config.sync_status = FredSyncStatus.FAILED
        config.updated_at = datetime.now(timezone.utc)
        return True
    return False


async def sync_data(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    global _live_api_available
    config = await get_config(db)
    if not config.is_active and not force:
        return {"success": False, "message": "FRED API is disabled"}
    if config.sync_status == FredSyncStatus.SYNCING and not force:
        return {"success": False, "message": "Sync already in progress"}

    api_key = _resolve_api_key(config)
    if not api_key:
        return {"success": False, "message": "API key not configured"}

    indicators = [
        i for i in await _get_indicators(db) if i.enabled
    ]
    if not indicators:
        return {"success": False, "message": "No indicators enabled"}

    config.sync_status = FredSyncStatus.SYNCING
    config.updated_at = datetime.now(timezone.utc)
    await db.flush()

    total_records = 0
    obs_start = _observation_start(config.date_range)
    failed = False

    try:
        for indicator in indicators:
            params: dict = {
                "series_id": indicator.indicator_code,
                "sort_order": "asc",
            }
            if obs_start:
                params["observation_start"] = obs_start

            try:
                payload, _, _ = await _fred_request(
                    db,
                    config,
                    path="series/observations",
                    params=params,
                    api_key=api_key,
                )
                observations = payload.get("observations", [])
                now = datetime.now(timezone.utc)
                indicator_last: datetime | None = None

                for obs in observations:
                    value_str = obs.get("value", ".")
                    if value_str == ".":
                        continue
                    obs_date = date.fromisoformat(obs["date"])
                    value = float(value_str)

                    if config.historical_storage_enabled:
                        existing = await db.execute(
                            select(FredEconomicData).where(
                                FredEconomicData.indicator_code == indicator.indicator_code,
                                FredEconomicData.observation_date == obs_date,
                            )
                        )
                        row = existing.scalar_one_or_none()
                        if row:
                            row.value = value
                            row.retrieved_at = now
                        else:
                            db.add(
                                FredEconomicData(
                                    indicator_code=indicator.indicator_code,
                                    indicator_name=indicator.indicator_name,
                                    value=value,
                                    observation_date=obs_date,
                                    frequency=indicator.frequency,
                                    source="FRED",
                                    retrieved_at=now,
                                )
                            )
                        total_records += 1

                    indicator_last = now

                if indicator_last:
                    indicator.last_updated = indicator_last
                    indicator.updated_at = now

                await _sync_to_economic_data(db, indicator, observations)

            except Exception:
                logger.exception("Failed to sync FRED series %s", indicator.indicator_code)
                failed = True

        now = datetime.now(timezone.utc)
        if failed and total_records == 0:
            config.sync_status = FredSyncStatus.FAILED
            config.last_failed_sync = now
            config.error_count += 1
            _live_api_available = False
            await db.flush()
            return {"success": False, "message": "FRED sync failed", "records": 0}

        config.sync_status = FredSyncStatus.SUCCESS
        config.last_sync = now
        config.next_sync = _compute_next_sync(config.refresh_interval, now)
        config.records_retrieved += total_records
        config.success_count += 1
        _live_api_available = True
        config.updated_at = now
        if admin_id:
            await _log_audit(
                db,
                action="sync_data",
                changed_fields={"records": total_records},
                admin_id=admin_id,
            )
        await db.flush()
        return {
            "success": True,
            "message": f"Synchronized {total_records} records",
            "records": total_records,
            "last_sync": now.isoformat(),
            "next_sync": config.next_sync.isoformat() if config.next_sync else None,
        }
    except Exception as exc:
        logger.exception("FRED sync failed")
        config.sync_status = FredSyncStatus.FAILED
        config.last_failed_sync = datetime.now(timezone.utc)
        config.error_count += 1
        _live_api_available = False
        await db.flush()
        return {"success": False, "message": str(exc)[:200], "records": total_records}


_ECONOMIC_DATA_FIELDS = frozenset({
    "cpi", "gdp", "gdp_growth", "interest_rate", "exchange_rate", "oil_price",
    "gov_spending", "employment_rate", "unemployment_rate", "inflation_rate",
    "money_supply", "trade_balance", "core_inflation", "producer_price_index",
    "consumer_confidence_index", "purchasing_managers_index", "public_debt_ratio",
    "commodity_price_index", "housing_price_index", "retail_sales",
    "foreign_reserves", "fiscal_deficit",
})


async def _sync_to_economic_data(
    db: AsyncSession,
    indicator: FredIndicator,
    observations: list[dict],
) -> None:
    """Map latest FRED values into economic_data for US records."""
    field = indicator.field_mapping
    if not field or field not in _ECONOMIC_DATA_FIELDS or not observations:
        return
    latest = None
    for obs in reversed(observations):
        if obs.get("value", ".") != ".":
            latest = obs
            break
    if not latest:
        return

    data_date = date.fromisoformat(latest["date"])
    value = float(latest["value"])
    existing = await db.execute(
        select(EconomicData).where(
            EconomicData.country_code == "US",
            EconomicData.data_date == data_date,
            EconomicData.source == DataSource.FRED,
        )
    )
    record = existing.scalar_one_or_none()
    if record:
        if hasattr(record, field):
            setattr(record, field, value)
    else:
        kwargs = {field: value}
        record = EconomicData(
            country_code="US",
            country_name="United States",
            data_date=data_date,
            source=DataSource.FRED,
            **kwargs,
        )
        db.add(record)


async def get_health(db: AsyncSession) -> FredHealthResponse:
    config = await get_config(db)
    indicators = await _get_indicators(db)
    enabled = [i for i in indicators if i.enabled]

    last_log = await db.execute(
        select(FredApiLog)
        .where(FredApiLog.success.is_(True))
        .order_by(desc(FredApiLog.request_timestamp))
        .limit(1)
    )
    last_success_log = last_log.scalar_one_or_none()

    total_calls = config.success_count + config.error_count
    success_rate = (
        round(100.0 * config.success_count / total_calls, 1) if total_calls else None
    )

    data_count = await db.execute(select(func.count()).select_from(FredEconomicData))
    records = data_count.scalar() or 0
    quality = min(100.0, round((records / max(len(enabled), 1)) / 50 * 100, 1)) if enabled else 0.0

    feature_cfg = config.feature_config or DEFAULT_FEATURE_CONFIG
    base_features = len([i for i in enabled if i.field_mapping])
    engineered = sum(
        1
        for k in (
            "include_lag_variables",
            "include_rolling_means",
            "include_moving_averages",
            "include_percentage_changes",
            "include_growth_rates",
        )
        if feature_cfg.get(k)
    )
    model_features = base_features * max(engineered, 1)

    using_cache = (not _live_api_available) or bool(
        config.last_failed_sync
        and config.last_sync
        and config.last_failed_sync > config.last_sync
    )

    return FredHealthResponse(
        provider=config.provider_name,
        status=_health_status(config, len(enabled)),
        is_active=config.is_active,
        response_time_ms=last_success_log.response_time_ms if last_success_log else None,
        last_sync=config.last_sync,
        last_failed_sync=config.last_failed_sync,
        next_sync=config.next_sync,
        error_count=config.error_count,
        success_count=config.success_count,
        success_rate=success_rate,
        sync_status=config.sync_status.value,
        records_retrieved=config.records_retrieved,
        indicators_enabled=len(enabled),
        data_quality_score=quality,
        model_feature_count=model_features,
        using_cached_data=using_cache and records > 0,
        failover_warning=STALE_MESSAGE if using_cache and records > 0 else None,
    )


async def get_logs(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    endpoint: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
) -> list[FredApiLog]:
    query = select(FredApiLog).order_by(desc(FredApiLog.request_timestamp)).limit(limit)
    if status_filter == "success":
        query = query.where(FredApiLog.success.is_(True))
    elif status_filter == "failed":
        query = query.where(FredApiLog.success.is_(False))
    if endpoint:
        query = query.where(FredApiLog.endpoint.ilike(f"%{endpoint}%"))
    if from_date:
        query = query.where(FredApiLog.request_timestamp >= from_date)
    if to_date:
        query = query.where(FredApiLog.request_timestamp <= to_date)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_audit_logs(db: AsyncSession, limit: int = 100) -> list[FredAuditLog]:
    result = await db.execute(
        select(FredAuditLog).order_by(desc(FredAuditLog.created_at)).limit(limit)
    )
    return list(result.scalars().all())


async def get_cached_series(
    db: AsyncSession,
    indicator_code: str,
    *,
    limit: int = 120,
) -> list[FredEconomicData]:
    result = await db.execute(
        select(FredEconomicData)
        .where(FredEconomicData.indicator_code == indicator_code)
        .order_by(desc(FredEconomicData.observation_date))
        .limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def get_latest_values(db: AsyncSession) -> dict[str, dict]:
    """Latest cached value per enabled indicator — used by prediction pipeline."""
    indicators = [i for i in await _get_indicators(db) if i.enabled]
    out: dict[str, dict] = {}
    for ind in indicators:
        result = await db.execute(
            select(FredEconomicData)
            .where(FredEconomicData.indicator_code == ind.indicator_code)
            .order_by(desc(FredEconomicData.observation_date))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row:
            out[ind.indicator_code] = {
                "name": ind.indicator_name,
                "value": row.value,
                "date": row.observation_date.isoformat(),
                "field": ind.field_mapping,
                "category": ind.category,
            }
    return out


async def build_fred_training_frame(db: AsyncSession) -> "pd.DataFrame | None":
    """Build a wide DataFrame of FRED indicators for training merge."""
    import pandas as pd

    indicators = [i for i in await _get_indicators(db) if i.enabled]
    if not indicators:
        return None

    frames: list[pd.DataFrame] = []
    for ind in indicators:
        rows = await get_cached_series(db, ind.indicator_code, limit=500)
        if not rows:
            continue
        df = pd.DataFrame(
            {
                "observation_date": [r.observation_date for r in rows],
                ind.field_mapping or ind.indicator_code: [r.value for r in rows],
            }
        )
        df["observation_date"] = pd.to_datetime(df["observation_date"])
        frames.append(df)

    if not frames:
        return None

    merged = frames[0]
    for frame in frames[1:]:
        merged = merged.merge(frame, on="observation_date", how="outer")
    merged = merged.sort_values("observation_date")
    return merged


def merge_fred_with_dataset(
    df: "pd.DataFrame",
    fred_df: "pd.DataFrame | None",
    feature_config: dict | None = None,
) -> "pd.DataFrame":
    """Merge FRED features into training data with engineering toggles."""
    import pandas as pd

    if fred_df is None or fred_df.empty:
        return df

    cfg = feature_config or DEFAULT_FEATURE_CONFIG
    out = df.copy()
    if "data_date" in out.columns:
        out["_merge_date"] = pd.to_datetime(out["data_date"])
    elif "observation_date" in out.columns:
        out["_merge_date"] = pd.to_datetime(out["observation_date"])
    else:
        return out

    fred = fred_df.copy()
    fred["_merge_date"] = pd.to_datetime(fred["observation_date"])
    value_cols = [c for c in fred.columns if c not in ("observation_date", "_merge_date")]

    for col in value_cols:
        fred[col] = pd.to_numeric(fred[col], errors="coerce")

    merged = out.merge(
        fred[["_merge_date", *value_cols]],
        on="_merge_date",
        how="left",
    )

    for col in value_cols:
        merged[col] = merged[col].ffill().bfill()
        if cfg.get("include_lag_variables"):
            merged[f"{col}_lag1"] = merged[col].shift(1)
        if cfg.get("include_rolling_means"):
            merged[f"{col}_roll3"] = merged[col].rolling(3, min_periods=1).mean()
        if cfg.get("include_moving_averages"):
            merged[f"{col}_ma6"] = merged[col].rolling(6, min_periods=1).mean()
        if cfg.get("include_percentage_changes"):
            merged[f"{col}_pct"] = merged[col].pct_change().fillna(0) * 100
        if cfg.get("include_growth_rates"):
            merged[f"{col}_growth"] = merged[col].pct_change(12).fillna(0) * 100

    merged = merged.drop(columns=["_merge_date"], errors="ignore")
    return merged.fillna(0)


async def get_analytics(db: AsyncSession) -> FredAnalyticsResponse:
    key_series = ["CPIAUCSL", "FEDFUNDS", "GDP", "UNRATE", "DCOILWTICO", "M2SL"]
    trends: dict[str, list[dict]] = {}
    for code in key_series:
        rows = await get_cached_series(db, code, limit=60)
        trends[code] = [
            {"date": r.observation_date.isoformat(), "value": r.value}
            for r in rows
        ]

    count_result = await db.execute(select(func.count()).select_from(FredEconomicData))
    total = count_result.scalar() or 0
    indicators = await _get_indicators(db)
    enabled = sum(1 for i in indicators if i.enabled)

    heatmap: list[dict] = []
    for ind in indicators:
        if not ind.enabled:
            continue
        latest = await db.execute(
            select(FredEconomicData)
            .where(FredEconomicData.indicator_code == ind.indicator_code)
            .order_by(desc(FredEconomicData.observation_date))
            .limit(1)
        )
        row = latest.scalar_one_or_none()
        if row:
            heatmap.append(
                {
                    "code": ind.indicator_code,
                    "name": ind.indicator_name,
                    "category": ind.category,
                    "value": row.value,
                    "date": row.observation_date.isoformat(),
                }
            )

    return FredAnalyticsResponse(
        trends=trends,
        summary={
            "total_records": total,
            "indicators_enabled": enabled,
            "series_tracked": len(key_series),
        },
        heatmap=heatmap,
        country_comparison=[
            {"country": "United States", "source": "FRED", "indicators": enabled},
            {"country": "Nigeria", "source": "CBN/NBS", "indicators": 12},
        ],
    )


async def export_data(
    db: AsyncSession,
    *,
    fmt: str,
    indicator_code: str | None = None,
) -> Response:
    query = select(FredEconomicData).order_by(
        FredEconomicData.indicator_code,
        desc(FredEconomicData.observation_date),
    )
    if indicator_code:
        query = query.where(FredEconomicData.indicator_code == indicator_code)
    query = query.limit(10000)
    result = await db.execute(query)
    rows = result.scalars().all()

    if fmt == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["indicator_code", "indicator_name", "value", "observation_date", "frequency", "source", "retrieved_at"]
        )
        for r in rows:
            writer.writerow(
                [
                    r.indicator_code,
                    r.indicator_name,
                    r.value,
                    r.observation_date.isoformat(),
                    r.frequency,
                    r.source,
                    r.retrieved_at.isoformat(),
                ]
            )
        return Response(
            content=buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=fred_export.csv"},
        )

    if fmt == "xlsx":
        try:
            import openpyxl
            from openpyxl import Workbook

            wb = Workbook()
            ws = wb.active
            ws.title = "FRED Data"
            ws.append(
                ["indicator_code", "indicator_name", "value", "observation_date", "frequency", "source", "retrieved_at"]
            )
            for r in rows:
                ws.append(
                    [
                        r.indicator_code,
                        r.indicator_name,
                        r.value,
                        r.observation_date.isoformat(),
                        r.frequency,
                        r.source,
                        r.retrieved_at.isoformat(),
                    ]
                )
            xbuf = io.BytesIO()
            wb.save(xbuf)
            xbuf.seek(0)
            return StreamingResponse(
                xbuf,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=fred_export.xlsx"},
            )
        except ImportError:
            return await export_data(db, fmt="csv", indicator_code=indicator_code)

    if fmt == "pdf":
        lines = ["FRED Economic Data Export", "=" * 40, ""]
        for r in rows[:500]:
            lines.append(
                f"{r.indicator_code} | {r.indicator_name} | {r.value} | {r.observation_date}"
            )
        content = "\n".join(lines).encode("utf-8")
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=fred_export.pdf"},
        )

    raise HTTPException(status_code=400, detail="Unsupported export format")


def build_fred_explainability(
    fred_values: dict[str, dict],
    feature_importance: list[dict],
) -> dict:
    """Attach FRED indicator influence to explainability payload."""
    indicators_used = []
    for code, meta in fred_values.items():
        importance = next(
            (f for f in feature_importance if f.get("feature", "").lower() in meta.get("field", "").lower()),
            None,
        )
        indicators_used.append(
            {
                "code": code,
                "name": meta["name"],
                "current_value": meta["value"],
                "observation_date": meta["date"],
                "influence_score": importance["importance"] if importance else 0.1,
                "feature_importance": importance["importance"] if importance else 0.1,
                "attention_weight": round((importance["importance"] if importance else 0.1) * 0.85, 4),
                "category": meta.get("category"),
            }
        )
    indicators_used.sort(key=lambda x: x["influence_score"], reverse=True)
    return {
        "fred_indicators": indicators_used,
        "fred_data_source": "live" if _live_api_available else "cached_postgresql",
        "failover_active": not _live_api_available,
        "failover_warning": STALE_MESSAGE if not _live_api_available else None,
    }