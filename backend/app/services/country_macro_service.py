"""
Batch country macro profile resolver — per-indicator single-source selection.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.world_countries import load_world_countries
from app.models.country import Country
from app.services.country_service import COUNTRY_REFERENCE
from app.services.indicator_selection_service import (
    _regional_default_inflation,
    batch_select_best_indicators,
)

FEATURES = ("inflation_rate", "gdp_growth", "interest_rate", "unemployment_rate", "exchange_rate")


async def load_macro_profiles(db: AsyncSession) -> dict[str, dict]:
    """Load macro profiles using per-indicator single-source selection."""
    countries_result = await db.execute(select(Country).order_by(Country.name))
    countries = {c.code.upper(): c for c in countries_result.scalars().all()}

    data_selections = await batch_select_best_indicators(db)

    profiles: dict[str, dict] = {}
    all_codes = set(countries) | set(data_selections)
    for entry in load_world_countries():
        all_codes.add(entry["code"].upper())

    for code in all_codes:
        c = countries.get(code)
        ref = COUNTRY_REFERENCE.get(code, {})
        sel = data_selections.get(code, {})
        values = sel.get("values", {})
        selections = sel.get("selections", {})

        continent = (c.continent if c else None) or ref.get("continent")
        name = (c.name if c else None) or ref.get("name") or code

        inflation = values.get("inflation_rate")
        if inflation is None:
            inflation = _regional_default_inflation(continent)

        inflation_sel = selections.get("inflation_rate", {})
        cpi_source = inflation_sel.get("source", "regional_default")
        has_live_data = any(
            s.get("source") not in (None, "regional_default")
            for s in selections.values()
            if s.get("value") is not None
        )

        profiles[code] = {
            "country_code": code,
            "country_name": name,
            "continent": continent,
            "region": (c.region if c else None) or ref.get("region"),
            "currency": (c.currency if c else None) or ref.get("currency"),
            "inflation_rate": float(inflation),
            "gdp_growth": float(values.get("gdp_growth") or 2.5),
            "interest_rate": float(values.get("interest_rate") or max(2.0, float(inflation) * 0.8)),
            "unemployment_rate": float(values.get("unemployment_rate") or 7.0),
            "exchange_rate": float(values.get("exchange_rate") or (1.0 if ref.get("currency") == "USD" else 1.0)),
            "gdp": values.get("gdp"),
            "gov_spending": values.get("gov_spending"),
            "population": values.get("population"),
            "deflation_risk": float(
                values.get("deflation_risk")
                or (c.deflation_risk if c else None)
                or max(0, (3 - float(inflation)) * 15)
            ),
            "economic_stability_score": float(
                values.get("economic_stability_score")
                or (c.economic_stability_score if c else None)
                or 50.0
            ),
            "currency_strength": float(
                values.get("currency_strength")
                or (c.currency_strength if c else None)
                or 50.0
            ),
            "data_source": cpi_source,
            "cpi_source_label": inflation_sel.get("source_label"),
            "cpi_accuracy_score": inflation_sel.get("accuracy_score"),
            "cpi_selection": sel,
            "data_selection": sel,
            "indicator_sources": {
                k: v.get("source_label")
                for k, v in selections.items()
                if v.get("value") is not None and v.get("source_label")
            },
            "has_live_data": has_live_data,
        }

    return profiles


def macro_feature_vector(profile: dict) -> list[float]:
    return [float(profile.get(f) or 0.0) for f in FEATURES]


def simplified_health_score(profile: dict) -> float:
    inflation = profile.get("inflation_rate", 5.0)
    gdp = profile.get("gdp_growth", 2.0)
    unemployment = profile.get("unemployment_rate", 7.0)
    debt_proxy = profile.get("economic_stability_score", 50.0)
    score = (
        max(0, 100 - float(inflation) * 4)
        + min(100, float(gdp) / 4 * 100)
        + max(0, 100 - float(unemployment) * 5)
        + float(debt_proxy) * 0.3
    ) / 3.3
    return round(min(100, max(0, score)), 1)