"""
API configuration management service.
"""

import time
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_config import ApiConfiguration, ApiHealthStatus, ApiType
from app.models.user import User
from app.schemas.api_config import ApiConfigCreate, ApiConfigResponse, ApiConfigUpdate, ApiTestResponse

CREDENTIAL_KEYS = (
    "api_key",
    "secret_key",
    "client_id",
    "client_secret",
    "bearer_token",
    "oauth_credentials",
)


def _coerce_api_type(value: str) -> ApiType:
    try:
        return ApiType(value)
    except ValueError:
        return ApiType.ECONOMIC


def _credentials_set_flags(credentials: dict | None, api_key: str | None) -> dict:
    creds = credentials or {}
    return {
        key: bool(creds.get(key)) or (key == "api_key" and bool(api_key))
        for key in CREDENTIAL_KEYS
    }


def _compute_health_metrics(config: ApiConfiguration) -> dict:
    stats = config.usage_stats or {}
    total = int(stats.get("requests", 0)) + int(stats.get("tests", 0))
    failures = int(stats.get("failures", 0))
    error_rate = round((failures / total * 100), 2) if total > 0 else 0.0
    return {
        "response_time_ms": stats.get("last_response_time_ms"),
        "last_successful_sync": config.last_sync_at.isoformat() if config.last_sync_at else None,
        "last_failed_sync": config.last_failed_sync_at.isoformat() if config.last_failed_sync_at else None,
        "usage_count": total,
        "error_rate": error_rate,
        "success_rate": round(100 - error_rate, 2) if total > 0 else None,
        "last_status_code": stats.get("last_status_code"),
    }


def _append_log(config: ApiConfiguration, entry: dict) -> None:
    logs = list(config.logs or [])
    logs.insert(0, entry)
    config.logs = logs[:200]


def _build_headers(config: ApiConfiguration) -> dict:
    headers = dict(config.custom_headers or {})
    creds = config.credentials or {}
    token = creds.get("bearer_token") or config.api_key
    if token:
        headers.setdefault("Authorization", f"Bearer {token}")
    secret = creds.get("secret_key")
    if secret and "X-API-Secret" not in headers:
        headers["X-API-Secret"] = secret
    return headers


def _to_response(config: ApiConfiguration) -> ApiConfigResponse:
    return ApiConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        api_type=config.api_type.value,
        endpoint_url=config.endpoint_url,
        base_url=config.base_url,
        api_key_set=bool(config.api_key),
        credentials_set=_credentials_set_flags(config.credentials, config.api_key),
        custom_headers=config.custom_headers or {},
        refresh_frequency_hours=config.refresh_frequency_hours,
        source_priority=config.source_priority,
        country_filters=config.country_filters or [],
        report_categories=config.report_categories or [],
        is_active=config.is_active,
        health_status=config.health_status.value,
        last_tested_at=config.last_tested_at,
        last_sync_at=config.last_sync_at,
        last_failed_sync_at=config.last_failed_sync_at,
        usage_stats=config.usage_stats or {},
        health_metrics=_compute_health_metrics(config),
        logs=config.logs or [],
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


async def list_api_configs(db: AsyncSession) -> list[ApiConfigResponse]:
    result = await db.execute(select(ApiConfiguration).order_by(desc(ApiConfiguration.source_priority)))
    return [_to_response(c) for c in result.scalars().all()]


async def create_api_config(
    db: AsyncSession,
    *,
    admin: User,
    payload: ApiConfigCreate,
) -> ApiConfigResponse:
    creds = dict(payload.credentials or {})
    if payload.api_key:
        creds.setdefault("api_key", payload.api_key)

    config = ApiConfiguration(
        name=payload.name,
        provider=payload.provider,
        api_type=_coerce_api_type(payload.api_type),
        endpoint_url=payload.endpoint_url,
        base_url=payload.base_url,
        api_key=payload.api_key,
        credentials=creds,
        custom_headers=payload.custom_headers,
        refresh_frequency_hours=payload.refresh_frequency_hours,
        source_priority=payload.source_priority,
        country_filters=payload.country_filters,
        report_categories=payload.report_categories,
        is_active=payload.is_active,
        updated_by=admin.id,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return _to_response(config)


async def update_api_config(
    db: AsyncSession,
    *,
    config_id: uuid.UUID,
    admin: User,
    payload: ApiConfigUpdate,
) -> ApiConfigResponse:
    result = await db.execute(select(ApiConfiguration).where(ApiConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API configuration not found")

    data = payload.model_dump(exclude_unset=True)
    if "api_type" in data and data["api_type"] is not None:
        data["api_type"] = _coerce_api_type(data["api_type"])
    if "credentials" in data and data["credentials"] is not None:
        merged = dict(config.credentials or {})
        merged.update(data["credentials"])
        data["credentials"] = merged
    if "api_key" in data and data["api_key"]:
        creds = dict(config.credentials or {})
        creds["api_key"] = data["api_key"]
        data["credentials"] = creds

    for key, value in data.items():
        setattr(config, key, value)
    config.updated_by = admin.id
    config.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(config)
    return _to_response(config)


async def delete_api_config(db: AsyncSession, config_id: uuid.UUID) -> None:
    result = await db.execute(select(ApiConfiguration).where(ApiConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API configuration not found")
    await db.delete(config)


async def test_api_config(db: AsyncSession, config_id: uuid.UUID) -> ApiTestResponse:
    result = await db.execute(select(ApiConfiguration).where(ApiConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API configuration not found")

    tested_at = datetime.now(timezone.utc)
    headers = _build_headers(config)
    url = config.endpoint_url
    if config.base_url and not url.startswith("http"):
        url = f"{config.base_url.rstrip('/')}/{url.lstrip('/')}"

    response_time_ms: float | None = None
    status_code: int | None = None
    diagnostics: dict = {"url": url, "headers_sent": list(headers.keys())}

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=headers)
            response_time_ms = round((time.perf_counter() - start) * 1000, 2)
            status_code = response.status_code
            response.raise_for_status()
        config.health_status = ApiHealthStatus.HEALTHY
        message = f"Connection successful (HTTP {status_code})"
        success = True
        diagnostics["response_size"] = len(response.content)
    except httpx.HTTPStatusError as exc:
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        status_code = exc.response.status_code
        config.health_status = ApiHealthStatus.DEGRADED if status_code < 500 else ApiHealthStatus.DOWN
        message = f"HTTP {status_code}: {exc.response.reason_phrase}"
        success = False
        diagnostics["error_type"] = "http_status"
    except Exception as exc:
        config.health_status = ApiHealthStatus.DOWN
        message = str(exc)
        success = False
        diagnostics["error_type"] = type(exc).__name__

    config.last_tested_at = tested_at
    _append_log(
        config,
        {
            "at": tested_at.isoformat(),
            "event": "test",
            "success": success,
            "message": message,
            "response_time_ms": response_time_ms,
            "status_code": status_code,
        },
    )
    stats = dict(config.usage_stats or {})
    stats["tests"] = int(stats.get("tests", 0)) + 1
    if not success:
        stats["failures"] = int(stats.get("failures", 0)) + 1
    if response_time_ms is not None:
        stats["last_response_time_ms"] = response_time_ms
    if status_code is not None:
        stats["last_status_code"] = status_code
    config.usage_stats = stats
    await db.flush()

    return ApiTestResponse(
        success=success,
        message=message,
        health_status=config.health_status.value,
        tested_at=tested_at,
        response_time_ms=response_time_ms,
        status_code=status_code,
        diagnostics=diagnostics,
    )


async def sync_api_config(db: AsyncSession, config_id: uuid.UUID) -> dict:
    """Trigger a sync attempt for a single API configuration."""
    result = await db.execute(select(ApiConfiguration).where(ApiConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API configuration not found")

    test_result = await test_api_config(db, config_id)
    synced_at = datetime.now(timezone.utc)

    if test_result.success:
        config.last_sync_at = synced_at
        _append_log(
            config,
            {
                "at": synced_at.isoformat(),
                "event": "sync",
                "success": True,
                "message": "Sync completed successfully",
            },
        )
    else:
        config.last_failed_sync_at = synced_at
        _append_log(
            config,
            {
                "at": synced_at.isoformat(),
                "event": "sync",
                "success": False,
                "message": test_result.message,
            },
        )

    stats = dict(config.usage_stats or {})
    stats["syncs"] = int(stats.get("syncs", 0)) + 1
    config.usage_stats = stats
    await db.flush()

    return {
        "success": test_result.success,
        "message": test_result.message,
        "synced_at": synced_at.isoformat(),
        "response_time_ms": test_result.response_time_ms,
    }


async def get_health_overview(db: AsyncSession) -> dict:
    configs = (await db.execute(select(ApiConfiguration))).scalars().all()
    apis = []
    healthy = warning = offline = 0

    for config in configs:
        status_val = config.health_status.value
        if status_val == ApiHealthStatus.HEALTHY.value:
            healthy += 1
        elif status_val == ApiHealthStatus.DEGRADED.value:
            warning += 1
        elif status_val == ApiHealthStatus.DOWN.value:
            offline += 1

        apis.append({
            "id": str(config.id),
            "name": config.name,
            "provider": config.provider,
            "status": status_val,
            "is_active": config.is_active,
            **_compute_health_metrics(config),
        })

    return {
        "total": len(configs),
        "active": sum(1 for c in configs if c.is_active),
        "healthy": healthy,
        "warning": warning,
        "offline": offline,
        "apis": apis,
    }


async def get_filtered_logs(
    db: AsyncSession,
    *,
    api_id: uuid.UUID | None = None,
    status: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
) -> list[dict]:
    if api_id:
        result = await db.execute(select(ApiConfiguration).where(ApiConfiguration.id == api_id))
        configs = [result.scalar_one_or_none()]
        if not configs[0]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API configuration not found")
    else:
        configs = list((await db.execute(select(ApiConfiguration))).scalars().all())

    entries: list[dict] = []
    for config in configs:
        for log in config.logs or []:
            entry = {**log, "api_id": str(config.id), "api_name": config.name}
            if status:
                want_success = status.lower() in ("success", "healthy", "ok")
                if log.get("success") != want_success:
                    continue
            if from_date or to_date:
                at_str = log.get("at")
                if at_str:
                    try:
                        at_dt = datetime.fromisoformat(at_str.replace("Z", "+00:00"))
                        if from_date and at_dt < from_date:
                            continue
                        if to_date and at_dt > to_date:
                            continue
                    except ValueError:
                        pass
            entries.append(entry)

    entries.sort(key=lambda e: e.get("at", ""), reverse=True)
    return entries[:limit]