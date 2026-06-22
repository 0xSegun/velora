"""
Unified registry of all Velora platform API integrations.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.imf_api import ImfSyncStatus
from app.models.news_api import NewsSyncStatus
from app.models.trading_economics_api import TradingEconomicsSyncStatus
from app.models.world_bank_api import WorldBankSyncStatus
from app.models.wikipedia_api import WikipediaSyncStatus
from app.services import (
    exchange_rate_service,
    fred_service,
    imf_service,
    news_service,
    resend_service,
    trading_economics_service,
    world_bank_service,
    wikipedia_service,
)
from app.services.api_sync_tasks import schedule_api_sync
from app.services import auth_config_service

SyncFn = Callable[..., Awaitable[dict]]


def _status_color(raw: str) -> str:
    if raw in ("green", "healthy"):
        return "healthy"
    if raw in ("yellow", "degraded"):
        return "degraded"
    if raw in ("red", "down", "inactive"):
        return "down" if raw != "inactive" else "inactive"
    return raw or "inactive"


async def _fred_entry(db: AsyncSession) -> dict[str, Any]:
    config = await fred_service.get_config(db)
    health = await fred_service.get_health(db)
    return {
        "id": "fred",
        "name": "FRED API",
        "provider": config.provider_name,
        "category": "economic",
        "description": "US Federal Reserve economic indicators for models and analytics.",
        "admin_path": "/admin/fred-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": bool(config.api_key),
        "metrics": {
            "indicators_enabled": health.indicators_enabled,
            "records_retrieved": health.records_retrieved,
        },
        "supports_sync": True,
        "supports_background_sync": False,
    }


async def _exchange_rate_entry(db: AsyncSession) -> dict[str, Any]:
    config = await exchange_rate_service.get_config(db)
    health = await exchange_rate_service.get_health(db)
    return {
        "id": "exchange_rate",
        "name": "Exchange Rate API",
        "provider": config.provider_name,
        "category": "economic",
        "description": "Live and historical FX rates for country dashboards.",
        "admin_path": "/admin/exchange-rate-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": bool(config.api_key),
        "metrics": {"success_rate": health.success_rate},
        "supports_sync": True,
        "supports_background_sync": False,
    }


async def _news_entry(db: AsyncSession) -> dict[str, Any]:
    config = await news_service.get_config(db)
    health = await news_service.get_health(db)
    return {
        "id": "news",
        "name": "News API",
        "provider": config.provider_name,
        "category": "news",
        "description": "Country-prioritized economic and policy news feed.",
        "admin_path": "/admin/news-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": bool(config.api_key),
        "metrics": {"articles_retrieved": health.articles_retrieved},
        "supports_sync": True,
        "supports_background_sync": True,
    }


async def _imf_entry(db: AsyncSession) -> dict[str, Any]:
    config = await imf_service.get_config(db)
    health = await imf_service.get_health(db)
    return {
        "id": "imf",
        "name": "IMF DataMapper",
        "provider": config.provider_name,
        "category": "economic",
        "description": "IMF macro indicators for GDP, inflation, debt, and employment.",
        "admin_path": "/admin/imf-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": bool(config.api_key),
        "metrics": {"countries_synced": health.countries_synced},
        "supports_sync": True,
        "supports_background_sync": True,
    }


async def _world_bank_entry(db: AsyncSession) -> dict[str, Any]:
    config = await world_bank_service.get_config(db)
    health = await world_bank_service.get_health(db)
    return {
        "id": "world_bank",
        "name": "World Bank Open Data",
        "provider": config.provider_name,
        "category": "economic",
        "description": "World Bank development and macroeconomic indicators.",
        "admin_path": "/admin/world-bank-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": True,
        "metrics": {"countries_synced": health.countries_synced},
        "supports_sync": True,
        "supports_background_sync": True,
    }


async def _trading_economics_entry(db: AsyncSession) -> dict[str, Any]:
    settings = get_settings()
    config = await trading_economics_service.get_config(db)
    health = await trading_economics_service.get_health(db)
    return {
        "id": "trading_economics",
        "name": "Trading Economics",
        "provider": config.provider_name,
        "category": "economic",
        "description": "Live macro snapshots for predictions and intelligence.",
        "admin_path": "/admin/trading-economics-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": bool(config.api_key or settings.TRADING_ECONOMICS_API_KEY),
        "metrics": {"countries_synced": health.countries_synced},
        "supports_sync": True,
        "supports_background_sync": True,
    }


async def _wikipedia_entry(db: AsyncSession) -> dict[str, Any]:
    config = await wikipedia_service.get_config(db)
    health = await wikipedia_service.get_health(db)
    return {
        "id": "wikipedia",
        "name": "Wikipedia REST",
        "provider": config.provider_name,
        "category": "context",
        "description": "Economy and central bank summaries for country reports.",
        "admin_path": "/admin/wikipedia-api",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": config.sync_status.value,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "api_key_set": True,
        "metrics": {"countries_synced": health.countries_synced},
        "supports_sync": True,
        "supports_background_sync": True,
    }


async def _resend_entry(db: AsyncSession) -> dict[str, Any]:
    config = await resend_service.get_config(db)
    health = await resend_service.get_health(db)
    return {
        "id": "resend",
        "name": "Resend Email",
        "provider": config.provider_name,
        "category": "communications",
        "description": "Transactional email delivery for auth and notifications.",
        "admin_path": "/admin/resend-email",
        "is_active": config.is_active,
        "health_status": _status_color(health.status),
        "sync_status": "n/a",
        "last_sync": None,
        "api_key_set": bool(config.api_key),
        "metrics": {},
        "supports_sync": False,
        "supports_background_sync": False,
    }


async def _google_oauth_entry(db: AsyncSession) -> dict[str, Any]:
    cfg = await auth_config_service.get_google_oauth_config(db)
    enabled = bool(cfg.get("enabled") and cfg.get("client_id"))
    return {
        "id": "google_oauth",
        "name": "Google OAuth",
        "provider": "Google",
        "category": "authentication",
        "description": "Social sign-in and account linking.",
        "admin_path": "/admin/authentication",
        "is_active": enabled,
        "health_status": "healthy" if enabled else "inactive",
        "sync_status": "n/a",
        "last_sync": None,
        "api_key_set": bool(cfg.get("client_id")),
        "metrics": {},
        "supports_sync": False,
        "supports_background_sync": False,
    }


REGISTRY_BUILDERS = [
    _fred_entry,
    _exchange_rate_entry,
    _news_entry,
    _imf_entry,
    _world_bank_entry,
    _trading_economics_entry,
    _wikipedia_entry,
    _resend_entry,
    _google_oauth_entry,
]


async def list_integrations(db: AsyncSession) -> dict[str, Any]:
    integrations = []
    for builder in REGISTRY_BUILDERS:
        integrations.append(await builder(db))

    healthy = sum(1 for i in integrations if i["health_status"] == "healthy")
    active = sum(1 for i in integrations if i["is_active"])
    warning = sum(1 for i in integrations if i["health_status"] == "degraded")
    offline = sum(1 for i in integrations if i["health_status"] == "down")

    return {
        "total": len(integrations),
        "active": active,
        "healthy": healthy,
        "warning": warning,
        "offline": offline,
        "integrations": integrations,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def trigger_integration_sync(
    db: AsyncSession,
    integration_id: str,
    *,
    admin_id,
) -> dict:
    if integration_id == "fred":
        result = await fred_service.sync_data(db, force=True, admin_id=admin_id)
        return result

    if integration_id == "exchange_rate":
        result = await exchange_rate_service.sync_rates(db, force=True, admin_id=admin_id)
        return result

    if integration_id == "news":
        from app.models.news_api import NewsSyncStatus

        config = await news_service.get_config(db)
        if config.sync_status == NewsSyncStatus.SYNCING:
            return await schedule_api_sync(
                "news", news_service.sync_news, admin_id=admin_id, force=True, already_syncing=True
            )
        config.sync_status = NewsSyncStatus.SYNCING
        await db.commit()
        return await schedule_api_sync(
            "news", news_service.sync_news, admin_id=admin_id, force=True
        )

    if integration_id == "imf":
        config = await imf_service.get_config(db)
        if config.sync_status == ImfSyncStatus.SYNCING:
            return await schedule_api_sync(
                "imf", imf_service.sync_imf_data, admin_id=admin_id, force=True, already_syncing=True
            )
        config.sync_status = ImfSyncStatus.SYNCING
        await db.commit()
        return await schedule_api_sync(
            "imf", imf_service.sync_imf_data, admin_id=admin_id, force=True
        )

    if integration_id == "world_bank":
        config = await world_bank_service.get_config(db)
        if config.sync_status == WorldBankSyncStatus.SYNCING:
            return await schedule_api_sync(
                "world_bank",
                world_bank_service.sync_world_bank_data,
                admin_id=admin_id,
                force=True,
                already_syncing=True,
            )
        config.sync_status = WorldBankSyncStatus.SYNCING
        await db.commit()
        return await schedule_api_sync(
            "world_bank",
            world_bank_service.sync_world_bank_data,
            admin_id=admin_id,
            force=True,
        )

    if integration_id == "trading_economics":
        config = await trading_economics_service.get_config(db)
        if config.sync_status == TradingEconomicsSyncStatus.SYNCING:
            return await schedule_api_sync(
                "trading_economics",
                trading_economics_service.sync_trading_economics_data,
                admin_id=admin_id,
                force=True,
                already_syncing=True,
            )
        config.sync_status = TradingEconomicsSyncStatus.SYNCING
        await db.commit()
        return await schedule_api_sync(
            "trading_economics",
            trading_economics_service.sync_trading_economics_data,
            admin_id=admin_id,
            force=True,
        )

    if integration_id == "wikipedia":
        config = await wikipedia_service.get_config(db)
        if config.sync_status == WikipediaSyncStatus.SYNCING:
            return await schedule_api_sync(
                "wikipedia",
                wikipedia_service.sync_wikipedia_data,
                admin_id=admin_id,
                force=True,
                already_syncing=True,
            )
        config.sync_status = WikipediaSyncStatus.SYNCING
        await db.commit()
        return await schedule_api_sync(
            "wikipedia",
            wikipedia_service.sync_wikipedia_data,
            admin_id=admin_id,
            force=True,
        )

    return {"success": False, "message": f"Integration '{integration_id}' does not support sync"}