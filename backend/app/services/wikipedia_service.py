"""
Wikipedia REST API — fetch, sync, and country economic context cache.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.wikipedia_api import (
    WikipediaApiConfig,
    WikipediaCountryCache,
    WikipediaSyncStatus,
)
from app.schemas.wikipedia_api import (
    CountryContextWikipedia,
    WikipediaConfigResponse,
    WikipediaConfigUpdate,
    WikipediaHealthResponse,
    WikipediaSourceConfig,
    WikipediaTestResponse,
)
from app.services.country_service import COUNTRY_REFERENCE

logger = logging.getLogger(__name__)

ALLOWED_BASE_URL = "https://en.wikipedia.org/api/rest_v1"
REFRESH_HOURS = {"daily": 24, "weekly": 168, "monthly": 720}

WIKIPEDIA_NAME_OVERRIDES: dict[str, str] = {
    "US": "the_United_States",
    "GB": "the_United_Kingdom",
    "AE": "the_United_Arab_Emirates",
    "NL": "the_Netherlands",
    "PH": "the_Philippines",
    "GM": "the_Gambia",
    "BS": "the_Bahamas",
    "CD": "the_Democratic_Republic_of_the_Congo",
    "CG": "the_Republic_of_the_Congo",
    "KR": "South_Korea",
    "KP": "North_Korea",
}


def _interval_hours(interval: str) -> int:
    return REFRESH_HOURS.get(interval, 168)


def _compute_next_sync(interval: str, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _source_config(config: WikipediaApiConfig) -> WikipediaSourceConfig:
    raw = config.source_config or {}
    try:
        return WikipediaSourceConfig.model_validate(raw)
    except Exception:
        return WikipediaSourceConfig()


def _country_name(country_code: str) -> str:
    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    return ref.get("name", country_code.upper())


def _wikipedia_name(country_code: str) -> str:
    iso2 = country_code.upper().strip()
    if iso2 in WIKIPEDIA_NAME_OVERRIDES:
        return WIKIPEDIA_NAME_OVERRIDES[iso2]
    name = _country_name(iso2)
    return name.replace(" ", "_").replace("'", "%27")


def _resolve_titles(
    country_code: str, source_cfg: WikipediaSourceConfig
) -> tuple[str, str]:
    iso2 = country_code.upper().strip()
    overrides = (source_cfg.title_overrides or {}).get(iso2, {})
    wiki_name = _wikipedia_name(iso2)

    economy = overrides.get("economy") or source_cfg.economy_title_template.format(
        wikipedia_name=wiki_name
    )
    central_bank = overrides.get("central_bank") or source_cfg.central_bank_title_template.format(
        wikipedia_name=wiki_name
    )
    return economy, central_bank


async def ensure_default_config(db: AsyncSession) -> WikipediaApiConfig:
    result = await db.execute(select(WikipediaApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        normalized = (config.base_url or "").rstrip("/")
        if normalized != ALLOWED_BASE_URL:
            config.base_url = ALLOWED_BASE_URL
            config.updated_at = datetime.now(timezone.utc)
            await db.flush()
        return config

    config = WikipediaApiConfig(
        provider_name="Wikipedia REST API",
        base_url=ALLOWED_BASE_URL,
        refresh_interval="weekly",
        sync_enabled=True,
        is_active=False,
        sync_status=WikipediaSyncStatus.IDLE,
        source_config=WikipediaSourceConfig().model_dump(),
    )
    db.add(config)
    await db.flush()
    logger.info("Seeded default wikipedia_api_config")
    return config


async def get_config(db: AsyncSession) -> WikipediaApiConfig:
    return await ensure_default_config(db)


def _to_config_response(config: WikipediaApiConfig) -> WikipediaConfigResponse:
    return WikipediaConfigResponse(
        id=str(config.id),
        provider_name=config.provider_name,
        base_url=config.base_url,
        user_agent=config.user_agent,
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


async def get_full_config(db: AsyncSession) -> WikipediaConfigResponse:
    config = await get_config(db)
    return _to_config_response(config)


async def update_config(
    db: AsyncSession, *, admin: User, payload: WikipediaConfigUpdate
) -> WikipediaConfigResponse:
    config = await get_config(db)
    data = payload.model_dump(exclude_unset=True)

    if "base_url" in data and data["base_url"]:
        config.base_url = data["base_url"].rstrip("/")

    if "source_config" in data and data["source_config"]:
        sc = data["source_config"]
        if hasattr(sc, "model_dump"):
            config.source_config = sc.model_dump()
        else:
            config.source_config = sc

    for field in (
        "provider_name",
        "user_agent",
        "refresh_interval",
        "sync_enabled",
        "is_active",
    ):
        if field in data and data[field] is not None:
            setattr(config, field, data[field])

    config.updated_at = datetime.now(timezone.utc)
    if config.is_active and config.sync_enabled:
        config.next_sync = config.next_sync or _compute_next_sync(config.refresh_interval)

    await db.flush()
    return _to_config_response(config)


async def _fetch_page_summary(
    config: WikipediaApiConfig, title: str
) -> dict | None:
    url = f"{config.base_url.rstrip('/')}/page/summary/{title}"
    headers = {"User-Agent": config.user_agent}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


def _summary_from_payload(payload: dict | None) -> dict:
    if not payload:
        return {
            "title": None,
            "extract": None,
            "thumbnail": None,
            "url": None,
        }
    desktop = (payload.get("content_urls") or {}).get("desktop") or {}
    thumb = payload.get("thumbnail") or {}
    return {
        "title": payload.get("title"),
        "extract": payload.get("extract"),
        "thumbnail": thumb.get("source"),
        "url": desktop.get("page"),
    }


async def fetch_country_context(
    config: WikipediaApiConfig, *, country_code: str
) -> dict:
    source_cfg = _source_config(config)
    iso2 = country_code.upper().strip()
    economy_title, central_bank_title = _resolve_titles(iso2, source_cfg)

    economy_payload = await _fetch_page_summary(config, economy_title)
    central_bank_payload = await _fetch_page_summary(config, central_bank_title)

    economy = _summary_from_payload(economy_payload)
    central_bank = _summary_from_payload(central_bank_payload)

    if not economy["title"] and not central_bank["title"]:
        raise ValueError(f"No Wikipedia pages found for {iso2}")

    return {
        "country_code": iso2,
        "country_name": _country_name(iso2),
        "economy_title": economy["title"],
        "economy_summary": economy["extract"],
        "economy_thumbnail": economy["thumbnail"],
        "economy_url": economy["url"],
        "central_bank_title": central_bank["title"],
        "central_bank_summary": central_bank["extract"],
        "central_bank_thumbnail": central_bank["thumbnail"],
        "central_bank_url": central_bank["url"],
        "raw_payload": {
            "economy": economy_payload,
            "central_bank": central_bank_payload,
            "requested_titles": {
                "economy": economy_title,
                "central_bank": central_bank_title,
            },
        },
    }


async def _upsert_country_cache(db: AsyncSession, record: dict) -> bool:
    iso2 = record["country_code"]
    result = await db.execute(
        select(WikipediaCountryCache)
        .where(WikipediaCountryCache.country_code == iso2)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if row:
        row.country_name = record["country_name"]
        row.economy_title = record.get("economy_title")
        row.economy_summary = record.get("economy_summary")
        row.economy_thumbnail = record.get("economy_thumbnail")
        row.economy_url = record.get("economy_url")
        row.central_bank_title = record.get("central_bank_title")
        row.central_bank_summary = record.get("central_bank_summary")
        row.central_bank_thumbnail = record.get("central_bank_thumbnail")
        row.central_bank_url = record.get("central_bank_url")
        row.raw_payload = record.get("raw_payload") or {}
        row.fetched_at = now
        row.updated_at = now
        return False

    db.add(
        WikipediaCountryCache(
            country_code=iso2,
            country_name=record["country_name"],
            economy_title=record.get("economy_title"),
            economy_summary=record.get("economy_summary"),
            economy_thumbnail=record.get("economy_thumbnail"),
            economy_url=record.get("economy_url"),
            central_bank_title=record.get("central_bank_title"),
            central_bank_summary=record.get("central_bank_summary"),
            central_bank_thumbnail=record.get("central_bank_thumbnail"),
            central_bank_url=record.get("central_bank_url"),
            raw_payload=record.get("raw_payload") or {},
            fetched_at=now,
            updated_at=now,
        )
    )
    return True


async def test_connection(
    db: AsyncSession,
    *,
    country_code: str = "NG",
    admin_id: uuid.UUID | None = None,
) -> WikipediaTestResponse:
    config = await get_config(db)
    start = time.perf_counter()
    try:
        record = await fetch_country_context(config, country_code=country_code)
        elapsed = int((time.perf_counter() - start) * 1000)
        return WikipediaTestResponse(
            success=True,
            message=f"Fetched Wikipedia context for {record['country_name']}",
            response_time_ms=elapsed,
            economy_title=record.get("economy_title"),
            central_bank_title=record.get("central_bank_title"),
        )
    except httpx.HTTPStatusError as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        msg = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        return WikipediaTestResponse(success=False, message=msg, response_time_ms=elapsed)
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        return WikipediaTestResponse(success=False, message=str(exc)[:300], response_time_ms=elapsed)


async def sync_wikipedia_data(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    config = await get_config(db)
    if not config.is_active and not force:
        return {"success": False, "message": "Wikipedia API is not active"}
    if config.sync_status == WikipediaSyncStatus.SYNCING and not force:
        return {"success": False, "message": "Sync already in progress"}

    source_cfg = _source_config(config)
    country_codes = source_cfg.country_codes or ["NG", "US", "GB", "GH"]

    if config.sync_status != WikipediaSyncStatus.SYNCING:
        config.sync_status = WikipediaSyncStatus.SYNCING
        await db.flush()

    start = time.perf_counter()
    stored = 0
    updated = 0
    errors: list[str] = []

    try:
        from app.services.api_sync_tasks import gather_country_fetches

        fetch_results = await gather_country_fetches(
            country_codes,
            lambda code: fetch_country_context(config, country_code=code),
            concurrency=2,
        )
        for code, outcome in fetch_results:
            if isinstance(outcome, BaseException):
                errors.append(f"{code}: {str(outcome)[:120]}")
                continue
            created = await _upsert_country_cache(db, outcome)
            if created:
                stored += 1
            else:
                updated += 1

        elapsed = int((time.perf_counter() - start) * 1000)
        now = datetime.now(timezone.utc)
        synced = stored + updated

        if synced == 0 and errors:
            raise RuntimeError("; ".join(errors[:3]))

        config.sync_status = WikipediaSyncStatus.SUCCESS
        config.last_sync = now
        config.next_sync = _compute_next_sync(config.refresh_interval, now)
        config.countries_synced = await _count_stored_countries(db)
        config.success_count += 1

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
        now = datetime.now(timezone.utc)
        config.sync_status = WikipediaSyncStatus.FAILED
        config.last_failed_sync = now
        config.error_count += 1
        return {"success": False, "message": str(exc)[:500], "errors": errors}
    finally:
        await db.flush()


async def enable_api(db: AsyncSession, *, admin: User) -> WikipediaConfigResponse:
    config = await get_config(db)
    config.is_active = True
    config.next_sync = config.next_sync or datetime.now(timezone.utc)
    await db.flush()
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> WikipediaConfigResponse:
    config = await get_config(db)
    config.is_active = False
    await db.flush()
    return _to_config_response(config)


async def _count_stored_countries(db: AsyncSession) -> int:
    count = await db.scalar(
        select(func.count(func.distinct(WikipediaCountryCache.country_code)))
    )
    return int(count or 0)


async def get_health(db: AsyncSession) -> WikipediaHealthResponse:
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
        if config.sync_status == WikipediaSyncStatus.FAILED:
            status = "red"
        elif config.error_count > config.success_count:
            status = "yellow"
        else:
            status = "green"

    return WikipediaHealthResponse(
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


async def get_country_cache(
    db: AsyncSession, country_code: str
) -> WikipediaCountryCache | None:
    iso2 = country_code.upper().strip()
    result = await db.execute(
        select(WikipediaCountryCache)
        .where(WikipediaCountryCache.country_code == iso2)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_country_context_wikipedia(
    db: AsyncSession, country_code: str
) -> CountryContextWikipedia | None:
    row = await get_country_cache(db, country_code)
    if not row:
        return None
    return CountryContextWikipedia(
        country_code=row.country_code,
        country_name=row.country_name,
        economy_title=row.economy_title,
        economy_summary=row.economy_summary,
        economy_url=row.economy_url,
        central_bank_title=row.central_bank_title,
        central_bank_summary=row.central_bank_summary,
        central_bank_url=row.central_bank_url,
        source="wikipedia",
        cached=True,
        fetched_at=row.fetched_at,
    )


async def maybe_sync_if_due(db: AsyncSession) -> bool:
    config = await get_config(db)
    if not config.is_active or not config.sync_enabled:
        return False
    if config.sync_status == WikipediaSyncStatus.SYNCING:
        return False
    now = datetime.now(timezone.utc)
    if config.next_sync and now < config.next_sync:
        return False
    result = await sync_wikipedia_data(db, force=False)
    return bool(result.get("success"))