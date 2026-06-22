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


def _model_artifact_status() -> dict:
    from pathlib import Path

    backend_root = Path(__file__).resolve().parents[2]
    models_dir = backend_root / "models"
    checkpoint = models_dir / "best_model.pt"
    meta_path = models_dir / "scaler_meta.json"
    status = {
        "checkpoint_present": checkpoint.exists(),
        "checkpoint_bytes": checkpoint.stat().st_size if checkpoint.exists() else 0,
        "feature_scaler_present": (models_dir / "feature_scaler.pkl").exists(),
        "target_scaler_present": (models_dir / "target_scaler.pkl").exists(),
        "training_history_present": (models_dir / "training_history.json").exists(),
    }
    if meta_path.exists():
        try:
            import json

            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            status["residual_mode"] = meta.get("residual_mode")
            status["evaluation_metrics"] = meta.get("evaluation_metrics")
        except Exception:
            pass
    return status


async def get_health_status(db: AsyncSession) -> dict:
    db_ok = await check_database_connection()
    return {
        "database": "connected" if db_ok else "disconnected",
        "backend": "running",
        "status": "healthy" if db_ok else "degraded",
        "model": _model_artifact_status(),
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