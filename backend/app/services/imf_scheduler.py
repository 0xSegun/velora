"""Background scheduler for automatic IMF DataMapper synchronization."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.database import async_session_factory
from app.models.imf_api import ImfSyncStatus
from app.services.imf_service import get_config, sync_imf_data

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_CHECK_INTERVAL_SECONDS = 180
_BACKOFF_BASE_SECONDS = 300
_BACKOFF_MAX_SECONDS = 3600
_consecutive_failures = 0
_backoff_until: datetime | None = None


async def _scheduler_loop() -> None:
    global _consecutive_failures, _backoff_until
    logger.info("IMF API scheduler started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            if _backoff_until and now < _backoff_until:
                await asyncio.sleep(_CHECK_INTERVAL_SECONDS)
                continue

            async with async_session_factory() as db:
                config = await get_config(db)
                if (
                    config.is_active
                    and config.sync_enabled
                    and config.sync_status != ImfSyncStatus.SYNCING
                    and (config.next_sync is None or now >= config.next_sync)
                ):
                    logger.info("Running scheduled IMF sync")
                    result = await sync_imf_data(db, force=False)
                    await db.commit()
                    if result.get("success"):
                        _consecutive_failures = 0
                        _backoff_until = None
                        logger.info("IMF scheduled sync: %s", result.get("message"))
                    else:
                        _consecutive_failures += 1
                        backoff = min(
                            _BACKOFF_MAX_SECONDS,
                            _BACKOFF_BASE_SECONDS * (2 ** (_consecutive_failures - 1)),
                        )
                        _backoff_until = now + timedelta(seconds=backoff)
                        logger.warning("IMF sync failed: %s", result.get("message"))
        except Exception as exc:
            logger.exception("IMF scheduler error: %s", exc)
        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)


def start_imf_scheduler() -> asyncio.Task:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    return _scheduler_task


async def stop_imf_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None