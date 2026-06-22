"""
External news API — fetch, sync, sentiment enrichment, and EconomicNews persistence.
Supports NewsAPI.org, GNews.io, and generic JSON feeds.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.intelligence import EconomicNews
from app.models.news_api import NewsApiConfig, NewsApiLog, NewsProvider, NewsSyncStatus
from app.models.user import User
from app.schemas.news_api import (
    NewsConfigResponse,
    NewsConfigUpdate,
    NewsHealthResponse,
    NewsSourceConfig,
    NewsTestResponse,
)
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
ALLOWED_BASE_URLS = {
    NewsProvider.NEWSAPI: "https://newsapi.org/v2",
    NewsProvider.GNEWS: "https://gnews.io/api/v4",
    NewsProvider.GENERIC: None,
}
REFRESH_HOURS = {"hourly": 1, "daily": 24, "weekly": 168}
SYNC_STALE_MINUTES = 30

SOURCE_DISPLAY = {
    "reuters": "Reuters",
    "bloomberg": "Bloomberg",
    "financial-times": "Financial Times",
    "cnbc": "CNBC",
    "the-wall-street-journal": "Wall Street Journal",
    "business-insider": "Business Insider",
    "bbc-news": "BBC News",
}

POSITIVE_WORDS = frozenset(
    "ease easing decline stable recovery strong growth disinflation moderate improve".split()
)
NEGATIVE_WORDS = frozenset(
    "rise surge pressure weak crisis fall risk inflation depreciate shortage strike hike".split()
)


def _interval_hours(interval: str) -> int:
    return REFRESH_HOURS.get(interval, 1)


def _compute_next_sync(interval: str, from_dt: datetime | None = None) -> datetime:
    base = from_dt or datetime.now(timezone.utc)
    return base + timedelta(hours=_interval_hours(interval))


def _resolve_api_key(config: NewsApiConfig, override: str | None = None) -> str | None:
    if override:
        return override.strip() or None
    decrypted = decrypt_api_key(config.api_key)
    if decrypted:
        return decrypted
    env_key = getattr(settings, "NEWS_API_KEY", None) or ""
    return env_key.strip() or None


def _source_config(config: NewsApiConfig) -> NewsSourceConfig:
    raw = config.source_config or {}
    try:
        return NewsSourceConfig.model_validate(raw)
    except Exception:
        return NewsSourceConfig()


def _compute_sentiment(text: str) -> tuple[float, float, float]:
    words = re.findall(r"[a-z]+", text.lower())
    if not words:
        return 0.33, 0.34, 0.33
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)
    total = pos + neg + 1
    p = min(0.85, 0.25 + pos / total)
    n = min(0.85, 0.25 + neg / total)
    neu = max(0.1, 1.0 - p - n)
    norm = p + neu + n
    return round(p / norm, 3), round(neu / norm, 3), round(n / norm, 3)


def _categorize(title: str, summary: str) -> str:
    blob = f"{title} {summary}".lower()
    if any(k in blob for k in ("exchange", "currency", "forex", "naira", "dollar")):
        return "exchange_rates"
    if any(k in blob for k in ("interest rate", "central bank", "monetary", "fed", "boe")):
        return "interest_rates"
    if any(k in blob for k in ("gdp", "growth", "recession", "output")):
        return "gdp"
    if any(k in blob for k in ("oil", "crude", "energy", "commodity")):
        return "commodities"
    if "inflation" in blob or "cpi" in blob or "prices" in blob:
        return "inflation"
    return "markets"


def _infer_country(title: str, summary: str, default: str | None = None) -> str | None:
    blob = f"{title} {summary}".lower()
    if "nigeria" in blob or "naira" in blob:
        return "NG"
    if "ghana" in blob:
        return "GH"
    if "kenya" in blob:
        return "KE"
    if "united states" in blob or " u.s." in blob or " us " in blob:
        return "US"
    if "uk " in blob or "britain" in blob or "england" in blob:
        return "GB"
    return default


async def ensure_default_config(db: AsyncSession) -> NewsApiConfig:
    result = await db.execute(select(NewsApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        return config
    config = NewsApiConfig(
        provider=NewsProvider.NEWSAPI,
        provider_name="NewsAPI.org",
        base_url=ALLOWED_BASE_URLS[NewsProvider.NEWSAPI],
        refresh_interval="hourly",
        sync_enabled=True,
        is_active=False,
        sync_status=NewsSyncStatus.IDLE,
        source_config=NewsSourceConfig().model_dump(),
    )
    db.add(config)
    await db.flush()
    logger.info("Seeded default news_api_config")
    return config


async def get_config(db: AsyncSession) -> NewsApiConfig:
    return await ensure_default_config(db)


def _to_config_response(config: NewsApiConfig) -> NewsConfigResponse:
    return NewsConfigResponse(
        id=str(config.id),
        provider=config.provider.value,
        provider_name=config.provider_name,
        base_url=config.base_url,
        api_key_set=bool(config.api_key or getattr(settings, "NEWS_API_KEY", None)),
        refresh_interval=config.refresh_interval,
        sync_enabled=config.sync_enabled,
        is_active=config.is_active,
        source_config=config.source_config or {},
        last_sync=config.last_sync,
        last_failed_sync=config.last_failed_sync,
        next_sync=config.next_sync,
        sync_status=config.sync_status.value,
        articles_retrieved=config.articles_retrieved,
        error_count=config.error_count,
        success_count=config.success_count,
    )


async def get_full_config(db: AsyncSession) -> NewsConfigResponse:
    config = await get_config(db)
    return _to_config_response(config)


async def update_config(
    db: AsyncSession, *, admin: User, payload: NewsConfigUpdate
) -> NewsConfigResponse:
    config = await get_config(db)
    data = payload.model_dump(exclude_unset=True)

    if "api_key" in data:
        key = data.pop("api_key")
        if key and key != MASKED_KEY:
            config.api_key = encrypt_api_key(key)

    if "provider" in data and data["provider"]:
        config.provider = NewsProvider(data["provider"])
        default_url = ALLOWED_BASE_URLS.get(config.provider)
        if default_url and not payload.base_url:
            config.base_url = default_url

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
    articles: int = 0,
    error: str | None = None,
) -> None:
    db.add(
        NewsApiLog(
            config_id=config_id,
            endpoint=endpoint[:500],
            response_time_ms=response_time_ms,
            success=success,
            status_code=status_code,
            articles_fetched=articles,
            error_message=error,
        )
    )


async def _fetch_newsapi(
    api_key: str,
    base_url: str,
    source_cfg: NewsSourceConfig,
    page_size: int = 20,
) -> list[dict]:
    articles: list[dict] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        sources = ",".join(source_cfg.sources[:10])
        for query in source_cfg.queries[:4]:
            url = f"{base_url.rstrip('/')}/everything"
            params = {
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": min(page_size, 20),
                "apiKey": api_key,
            }
            if sources:
                params["sources"] = sources
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
            for item in payload.get("articles", []):
                source_id = (item.get("source") or {}).get("id") or ""
                source_name = (item.get("source") or {}).get("name") or SOURCE_DISPLAY.get(
                    source_id, source_id or "NewsAPI"
                )
                title = item.get("title") or ""
                summary = item.get("description") or item.get("content") or ""
                if not title or title == "[Removed]":
                    continue
                published = item.get("publishedAt")
                try:
                    pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00")) if published else datetime.now(timezone.utc)
                except Exception:
                    pub_dt = datetime.now(timezone.utc)
                articles.append({
                    "title": title,
                    "summary": summary,
                    "content": summary,
                    "source": source_name,
                    "url": item.get("url"),
                    "published_at": pub_dt,
                    "country_code": _infer_country(title, summary),
                    "category": _categorize(title, summary),
                })
    return articles


async def _fetch_gnews(
    api_key: str,
    base_url: str,
    source_cfg: NewsSourceConfig,
    page_size: int = 20,
) -> list[dict]:
    articles: list[dict] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for query in source_cfg.queries[:5]:
            url = f"{base_url.rstrip('/')}/search"
            params = {
                "q": f"{query} economy",
                "lang": "en",
                "max": min(page_size, 10),
                "token": api_key,
            }
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            for item in resp.json().get("articles", []):
                title = item.get("title") or ""
                summary = item.get("description") or ""
                if not title:
                    continue
                published = item.get("publishedAt")
                try:
                    pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00")) if published else datetime.now(timezone.utc)
                except Exception:
                    pub_dt = datetime.now(timezone.utc)
                source_name = (item.get("source") or {}).get("name") or "GNews"
                articles.append({
                    "title": title,
                    "summary": summary,
                    "content": summary,
                    "source": source_name,
                    "url": item.get("url"),
                    "published_at": pub_dt,
                    "country_code": _infer_country(title, summary),
                    "category": _categorize(title, summary),
                })
    return articles


async def fetch_articles(
    config: NewsApiConfig,
    api_key: str,
    *,
    limit: int = 40,
) -> list[dict]:
    source_cfg = _source_config(config)
    if config.provider == NewsProvider.GNEWS:
        return await _fetch_gnews(api_key, config.base_url, source_cfg, limit)
    if config.provider == NewsProvider.NEWSAPI:
        return await _fetch_newsapi(api_key, config.base_url, source_cfg, limit)
    raise HTTPException(status_code=400, detail="Generic provider requires manual JSON mapping — use NewsAPI or GNews")


async def _upsert_articles(db: AsyncSession, articles: list[dict]) -> int:
    stored = 0
    seen_urls: set[str] = set()
    for art in articles:
        url = art.get("url")
        if url:
            if url in seen_urls:
                continue
            seen_urls.add(url)
            existing = await db.execute(
                select(EconomicNews).where(EconomicNews.url == url).limit(1)
            )
            if existing.scalar_one_or_none():
                continue
        else:
            existing = await db.execute(
                select(EconomicNews)
                .where(EconomicNews.title == art["title"])
                .where(EconomicNews.source == art["source"])
                .limit(1)
            )
            if existing.scalar_one_or_none():
                continue

        text = f"{art['title']} {art.get('summary', '')}"
        pos, neu, neg = _compute_sentiment(text)
        db.add(
            EconomicNews(
                title=art["title"][:500],
                country_code=art.get("country_code"),
                source=art.get("source", "External")[:255],
                url=url,
                summary=art.get("summary", "")[:5000],
                content=art.get("content", art.get("summary", "")),
                category=art.get("category", "markets"),
                sentiment_positive=pos,
                sentiment_neutral=neu,
                sentiment_negative=neg,
                published_at=art.get("published_at") or datetime.now(timezone.utc),
            )
        )
        stored += 1
    return stored


async def test_connection(
    db: AsyncSession,
    *,
    api_key_override: str | None = None,
    admin_id: uuid.UUID | None = None,
) -> NewsTestResponse:
    config = await get_config(db)
    api_key = _resolve_api_key(config, api_key_override)
    if not api_key:
        return NewsTestResponse(success=False, message="API key is not configured")

    start = time.perf_counter()
    try:
        articles = await fetch_articles(config, api_key, limit=5)
        elapsed = int((time.perf_counter() - start) * 1000)
        await _log_request(
            db,
            config_id=config.id,
            endpoint="test",
            success=True,
            response_time_ms=elapsed,
            status_code=200,
            articles=len(articles),
        )
        return NewsTestResponse(
            success=True,
            message=f"Connected — fetched {len(articles)} sample articles",
            response_time_ms=elapsed,
            sample_articles=len(articles),
        )
    except httpx.HTTPStatusError as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        msg = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        await _log_request(
            db, config_id=config.id, endpoint="test", success=False,
            response_time_ms=elapsed, status_code=exc.response.status_code, error=msg,
        )
        return NewsTestResponse(success=False, message=msg, response_time_ms=elapsed)
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        msg = str(exc)[:300]
        await _log_request(
            db, config_id=config.id, endpoint="test", success=False,
            response_time_ms=elapsed, status_code=None, error=msg,
        )
        return NewsTestResponse(success=False, message=msg, response_time_ms=elapsed)


async def sync_news(
    db: AsyncSession,
    *,
    force: bool = False,
    admin_id: uuid.UUID | None = None,
) -> dict:
    config = await get_config(db)
    if not config.is_active and not force:
        return {"success": False, "message": "News API is not active"}
    if config.sync_status == NewsSyncStatus.SYNCING:
        return {"success": False, "message": "Sync already in progress"}

    api_key = _resolve_api_key(config)
    if not api_key:
        return {"success": False, "message": "API key is not configured"}

    config.sync_status = NewsSyncStatus.SYNCING
    await db.flush()

    start = time.perf_counter()
    try:
        articles = await fetch_articles(config, api_key, limit=50)
        stored = await _upsert_articles(db, articles)
        elapsed = int((time.perf_counter() - start) * 1000)
        now = datetime.now(timezone.utc)

        config.sync_status = NewsSyncStatus.SUCCESS
        config.last_sync = now
        config.next_sync = _compute_next_sync(config.refresh_interval, now)
        config.articles_retrieved += stored
        config.success_count += 1

        await _log_request(
            db,
            config_id=config.id,
            endpoint="sync",
            success=True,
            response_time_ms=elapsed,
            status_code=200,
            articles=stored,
        )
        return {
            "success": True,
            "message": f"Synced {stored} new articles ({len(articles)} fetched)",
            "stored": stored,
            "fetched": len(articles),
        }
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        now = datetime.now(timezone.utc)
        config.sync_status = NewsSyncStatus.FAILED
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
        return {"success": False, "message": msg}
    finally:
        await db.flush()


async def enable_api(db: AsyncSession, *, admin: User) -> NewsConfigResponse:
    config = await get_config(db)
    config.is_active = True
    config.next_sync = config.next_sync or datetime.now(timezone.utc)
    await db.flush()
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> NewsConfigResponse:
    config = await get_config(db)
    config.is_active = False
    await db.flush()
    return _to_config_response(config)


async def get_health(db: AsyncSession) -> NewsHealthResponse:
    config = await get_config(db)
    total = config.success_count + config.error_count
    rate = round(config.success_count / total * 100, 1) if total else None
    using_cache = False
    if config.last_sync:
        age = datetime.now(timezone.utc) - config.last_sync
        using_cache = age > timedelta(hours=_interval_hours(config.refresh_interval))

    status = "inactive"
    if config.is_active:
        if config.sync_status == NewsSyncStatus.FAILED:
            status = "red"
        elif not _resolve_api_key(config):
            status = "yellow"
        elif config.error_count > config.success_count:
            status = "yellow"
        else:
            status = "green"

    return NewsHealthResponse(
        status=status,
        provider=config.provider_name,
        is_active=config.is_active,
        sync_status=config.sync_status.value,
        last_sync=config.last_sync,
        next_sync=config.next_sync,
        articles_retrieved=config.articles_retrieved,
        success_rate=rate,
        using_cached_data=using_cache,
    )


async def maybe_sync_if_due(db: AsyncSession) -> bool:
    """Background scheduler hook — returns True if sync ran."""
    config = await get_config(db)
    if not config.is_active or not config.sync_enabled:
        return False
    if config.sync_status == NewsSyncStatus.SYNCING:
        return False
    if not _resolve_api_key(config):
        return False
    now = datetime.now(timezone.utc)
    if config.next_sync and now < config.next_sync:
        return False
    result = await sync_news(db, force=False)
    return bool(result.get("success"))


async def is_live_news_available(db: AsyncSession) -> bool:
    config = await get_config(db)
    return bool(config.is_active and _resolve_api_key(config))