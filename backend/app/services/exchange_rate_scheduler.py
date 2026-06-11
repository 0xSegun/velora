"""
Background scheduler for automatic exchange rate sync.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.database import async_session_factory
from app.models.exchange_rate import SyncStatus
from app.services.exchange_rate_service import _reset_stale_sync, get_config, sync_rates

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_CHECK_INTERVAL_SECONDS = 60
_BACKOFF_BASE_SECONDS = 60
_BACKOFF_MAX_SECONDS = 3600
_consecutive_failures = 0
_backoff_until: datetime | None = None


async def _scheduler_loop() -> None:
    global _consecutive_failures, _backoff_until
    logger.info("Exchange rate scheduler started")
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
                    and config.api_key
                    and config.sync_status != SyncStatus.SYNCING
                    and (config.next_sync is None or now >= config.next_sync)
                ):
                    logger.info("Running scheduled exchange rate sync")
                    result = await sync_rates(db, force=False)
                    await db.commit()
                    if result.get("success"):
                        _consecutive_failures = 0
                        _backoff_until = None
                        logger.info("Scheduled sync completed: %s", result.get("message"))
                    else:
                        _consecutive_failures += 1
                        backoff = min(
                            _BACKOFF_MAX_SECONDS,
                            _BACKOFF_BASE_SECONDS * (2 ** (_consecutive_failures - 1)),
                        )
                        _backoff_until = now + timedelta(seconds=backoff)
                        logger.warning(
                            "Scheduled sync failed: %s (retry in %ss)",
                            result.get("message"),
                            backoff,
                        )
        except asyncio.CancelledError:
            logger.info("Exchange rate scheduler cancelled")
            raise
        except Exception:
            _consecutive_failures += 1
            backoff = min(
                _BACKOFF_MAX_SECONDS,
                _BACKOFF_BASE_SECONDS * (2 ** (_consecutive_failures - 1)),
            )
            _backoff_until = datetime.now(timezone.utc) + timedelta(seconds=backoff)
            logger.exception(
                "Exchange rate scheduler iteration failed (retry in %ss)", backoff
            )

        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)


def start_exchange_rate_scheduler() -> asyncio.Task:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    return _scheduler_task


async def stop_exchange_rate_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None
    logger.info("Exchange rate scheduler stopped")