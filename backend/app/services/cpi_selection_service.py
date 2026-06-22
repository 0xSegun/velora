"""
CPI selection — backward-compatible wrapper around indicator_selection_service.

Inflation/CPI is now resolved via the per-indicator single-source engine.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.indicator_selection_service import (
    CONTINENT_DEFAULT_INFLATION,
    SOURCE_BASE_SCORES,
    SOURCE_LABELS,
    TRACKED_INDICATORS,
    _regional_default_inflation,
    batch_select_best_indicators,
    cpi_selection_from_data_selection,
    select_best_indicators,
)

# Backward-compatible aliases
CPI_FIELDS = frozenset({"inflation_rate", "cpi", "core_inflation"})
CPI_ECON_SOURCES = frozenset({"NBS", "CBN", "FRED", "MANUAL"})


async def select_best_cpi(db: AsyncSession, country_code: str) -> dict:
    data = await select_best_indicators(db, country_code)
    return cpi_selection_from_data_selection(data)


async def batch_select_best_cpi(db: AsyncSession) -> dict[str, dict]:
    batch = await batch_select_best_indicators(db)
    return {code: cpi_selection_from_data_selection(sel) for code, sel in batch.items()}


async def load_best_cpi_batch(db: AsyncSession) -> dict[str, dict]:
    return await batch_select_best_cpi(db)