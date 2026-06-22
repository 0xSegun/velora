"""
Background execution for long-running external API sync jobs.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable

from app.database import async_session_factory

logger = logging.getLogger(__name__)

SyncFn = Callable[..., Awaitable[dict]]
FetchFn = Callable[[str], Awaitable[dict]]
_running: set[str] = set()


async def gather_country_fetches(
    country_codes: list[str],
    fetcher: FetchFn,
    *,
    concurrency: int = 3,
) -> list[tuple[str, dict | BaseException]]:
    """Fetch multiple countries concurrently (HTTP only)."""
    sem = asyncio.Semaphore(concurrency)

    async def _one(code: str) -> tuple[str, dict | BaseException]:
        async with sem:
            try:
                return code, await fetcher(code)
            except Exception as exc:
                return code, exc

    return list(await asyncio.gather(*[_one(code) for code in country_codes]))


async def _run_sync_job(
    provider_key: str,
    sync_fn: SyncFn,
    *,
    admin_id: uuid.UUID | None,
    force: bool,
) -> None:
    _running.add(provider_key)
    try:
        async with async_session_factory() as db:
            try:
                result = await sync_fn(db, force=force, admin_id=admin_id)
                await db.commit()
                logger.info(
                    "Background sync %s finished: success=%s message=%s",
                    provider_key,
                    result.get("success"),
                    result.get("message"),
                )
            except Exception:
                await db.rollback()
                logger.exception("Background sync failed for %s", provider_key)
    finally:
        _running.discard(provider_key)


async def schedule_api_sync(
    provider_key: str,
    sync_fn: SyncFn,
    *,
    admin_id: uuid.UUID | None = None,
    force: bool = True,
    already_syncing: bool = False,
) -> dict:
    """Return immediately and run sync in a background task."""
    if already_syncing or provider_key in _running:
        return {
            "success": True,
            "message": "Sync already in progress",
            "background": True,
            "already_running": True,
        }

    asyncio.create_task(
        _run_sync_job(provider_key, sync_fn, admin_id=admin_id, force=force)
    )
    return {
        "success": True,
        "message": "Sync started in the background. Status will update when complete.",
        "background": True,
    }