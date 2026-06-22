"""
Async SQLAlchemy engine and session configuration for PostgreSQL.
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_async_engine(
    settings.effective_database_url,
    echo=settings.DEBUG,
    connect_args=settings.database_connect_args,
    pool_size=5 if settings.is_production else 20,
    max_overflow=5 if settings.is_production else 10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

logger.info("Database target host: %s", settings.database_host_label)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection() -> bool:
    """Verify PostgreSQL connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database connection check failed: %s", exc)
        return False


async def init_db() -> None:
    """Ensure all ORM tables exist (fallback when migrations haven't run)."""
    import app.models  # noqa: F401 — register all models

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Dispose of the connection pool."""
    await engine.dispose()