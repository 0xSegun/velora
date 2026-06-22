"""
Background scheduler for automatic FRED data synchronization.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.database import async_session_factory
from app.models.fred import FredSyncStatus
from app.services.fred_service import _reset_stale_sync, get_config, sync_data

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_CHECK_INTERVAL_SECONDS = 60
_BACKOFF_BASE_SECONDS = 120
_BACKOFF_MAX_SECONDS = 3600
_consecutive_failures = 0
_backoff_until: datetime | None = None


async def _scheduler_loop() -> None:
    global _consecutive_failures, _backoff_until
    logger.info("FRED scheduler started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            if _backoff_until and now < _backoff_until:
                await asyncio.sleep(_CHECK_INTERVAL_SECONDS)
                continue

            async with async_session_factory() as db:
                config = await get_config(db)
                now = datetime.now(timezone.utc)

                if await _reset_stale_sync(config):
                    await db.commit()

                if (
                    config.is_active
                    and config.sync_enabled
                    and config.api_key
                    and config.sync_status != FredSyncStatus.SYNCING
                    and (config.next_sync is None or now >= config.next_sync)
                ):
                    logger.info("Running scheduled FRED sync")
                    result = await sync_data(db, force=False)
                    await db.commit()
                    if result.get("success"):
                        _consecutive_failures = 0
                        _backoff_until = None
                        logger.info("FRED scheduled sync completed: %s", result.get("message"))
                    else:
                        _consecutive_failures += 1
                        backoff = min(
                            _BACKOFF_MAX_SECONDS,
                            _BACKOFF_BASE_SECONDS * (2 ** (_consecutive_failures - 1)),
                        )
                        _backoff_until = now + timedelta(seconds=backoff)
                        logger.warning(
                            "FRED scheduled sync failed: %s (retry in %ss)",
                            result.get("message"),
                            backoff,
                        )
        except asyncio.CancelledError:
            logger.info("FRED scheduler cancelled")
            raise
        except Exception:
            _consecutive_failures += 1
            backoff = min(
                _BACKOFF_MAX_SECONDS,
                _BACKOFF_BASE_SECONDS * (2 ** (_consecutive_failures - 1)),
            )
            _backoff_until = datetime.now(timezone.utc) + timedelta(seconds=backoff)
            logger.exception("FRED scheduler iteration failed (retry in %ss)", backoff)

        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)


def start_fred_scheduler() -> asyncio.Task:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    return _scheduler_task


async def stop_fred_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None
    logger.info("FRED scheduler stopped")