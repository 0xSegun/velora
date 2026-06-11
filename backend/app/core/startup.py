"""
Application startup tasks — migrations, admin seeding, directories.
"""

import asyncio
import logging
import subprocess
import sys
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.postgres import ensure_postgres_running
from app.database import check_database_connection, init_db
from app.services.email_service import _resolve_provider
from app.services.currency_catalog_service import seed_exchangerate_countries
from app.services.exchange_rate_service import ensure_default_config, validate_encryption_config
from app.services.resend_service import ensure_default_config as ensure_default_resend_config
from app.services.seed_service import (
    seed_admin_user,
    seed_default_countries,
    seed_economic_data,
    seed_intelligence_data,
    sync_countries_to_economic_data,
)
from app.services.site_settings_service import seed_default_site_settings
from app.services.system_log_service import log_system_event

logger = logging.getLogger(__name__)
settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def ensure_storage_dirs() -> None:
    """Create upload and PDF output directories."""
    for rel in (settings.UPLOAD_DIR, settings.PDF_DIR):
        path = BACKEND_ROOT / rel
        path.mkdir(parents=True, exist_ok=True)


def run_alembic_migrations() -> bool:
    """Run `alembic upgrade head` if alembic is configured."""
    alembic_ini = BACKEND_ROOT / "alembic.ini"
    if not alembic_ini.exists():
        logger.warning("alembic.ini not found — skipping migrations")
        return False
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            logger.warning("Alembic migration failed: %s", result.stderr.strip())
            return False
        logger.info("Alembic migrations applied successfully")
        return True
    except Exception as exc:
        logger.warning("Could not run Alembic: %s", exc)
        return False


async def _wait_for_database(retries: int = 10, delay: float = 1.0) -> bool:
    for attempt in range(retries):
        if await check_database_connection():
            return True
        if attempt == 0 and settings.APP_ENV == "development":
            ensure_postgres_running(port=settings.POSTGRES_PORT)
        await asyncio.sleep(delay)
    return False


async def bootstrap_database(db: AsyncSession) -> None:
    """Run migrations, ensure schema, seed defaults."""
    validate_encryption_config()
    ensure_storage_dirs()

    if settings.APP_ENV == "development":
        ensure_postgres_running(port=settings.POSTGRES_PORT)

    connected = await _wait_for_database()
    if not connected:
        raise RuntimeError(
            "PostgreSQL is not reachable. Run: backend\\scripts\\setup_postgres.ps1"
        )

    migrated = run_alembic_migrations()
    if not migrated:
        logger.info("Falling back to SQLAlchemy create_all")
        await init_db()

    admin = await seed_admin_user(db)
    if admin:
        logger.warning(
            "Default admin created: %s — CHANGE PASSWORD IMMEDIATELY IN PRODUCTION",
            settings.ADMIN_EMAIL,
        )

    logger.info("Email provider: %s", _resolve_provider())

    await seed_default_countries(db)
    await seed_exchangerate_countries(db)
    await seed_economic_data(db)
    await sync_countries_to_economic_data(db)
    await seed_intelligence_data(db)
    await seed_default_site_settings(db)
    await ensure_default_config(db)
    await ensure_default_resend_config(db)
    await log_system_event(db, "info", "Application started", source="startup")
    await db.commit()