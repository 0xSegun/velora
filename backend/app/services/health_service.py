"""
Health and system status service.
"""

import time
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import check_database_connection
from app.models.system_log import SystemLog

settings = get_settings()
_START_TIME = time.time()


async def get_health_status(db: AsyncSession) -> dict:
    db_ok = await check_database_connection()
    return {
        "database": "connected" if db_ok else "disconnected",
        "backend": "running",
        "status": "healthy" if db_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def get_system_status(db: AsyncSession) -> dict:
    db_ok = await check_database_connection()
    redis_status = "not_configured"
    if settings.REDIS_URL:
        try:
            import redis

            client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
            client.ping()
            redis_status = "connected"
        except Exception:
            redis_status = "disconnected"

    log_count = 0
    if db_ok:
        result = await db.execute(select(func.count()).select_from(SystemLog))
        log_count = result.scalar() or 0

    uptime_seconds = int(time.time() - _START_TIME)
    hours, rem = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(rem, 60)

    return {
        "database": {
            "status": "connected" if db_ok else "disconnected",
            "host": settings.POSTGRES_HOST,
            "database": settings.POSTGRES_DB,
        },
        "api": {
            "status": "running",
            "environment": settings.APP_ENV,
            "version": "1.0.0",
        },
        "redis": {"status": redis_status},
        "uptime": {
            "seconds": uptime_seconds,
            "formatted": f"{hours}h {minutes}m {seconds}s",
        },
        "system_logs_count": log_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }