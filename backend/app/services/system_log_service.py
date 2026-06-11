"""
System log persistence service.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_log import LogLevel, SystemLog


async def log_system_event(
    db: AsyncSession,
    level: str,
    message: str,
    *,
    source: str = "api",
    context: dict | None = None,
) -> SystemLog:
    entry = SystemLog(
        level=LogLevel(level) if level in LogLevel._value2member_map_ else LogLevel.INFO,
        message=message,
        source=source,
        context=context or {},
    )
    db.add(entry)
    await db.flush()
    return entry