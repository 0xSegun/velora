"""
Per-indicator source selection — pick the single most accurate source for each
economic field (inflation, GDP, unemployment, population, etc.).

No merging across APIs: every indicator uses only its highest-scoring candidate.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Callable

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.world_countries import load_world_countries
from app.models.country import Country
from app.models.economic_data import EconomicData
from app.models.exchange_rate import ExchangeRate
from app.models.imf_api import ImfCountryData
from app.models.trading_economics_api import TradingEconomicsCountryData
from app.models.world_bank_api import WorldBankCountryData
from app.services.country_service import COUNTRY_REFERENCE

# ── Shared scoring constants ──────────────────────────────────────────────────

CONTINENT_DEFAULT_INFLATION: dict[str, float] = {
    "Africa": 8.0,
    "Asia": 4.5,
    "Europe": 3.0,
    "North America": 3.5,
    "South America": 6.5,
    "Oceania": 3.0,
    "Antarctica": 2.0,
}

SOURCE_BASE_SCORES: dict[str, float] = {
    "NBS": 96.0,
    "CBN": 94.0,
    "FRED": 92.0,
    "TRADING_ECONOMICS": 88.0,
    "IMF": 84.0,
    "WORLD_BANK": 80.0,
    "MANUAL": 72.0,
    "EXCHANGE_RATE_API": 88.0,
    "country_table": 55.0,
    "regional_default": 5.0,
}

SOURCE_LABELS: dict[str, str] = {
    "NBS": "National Bureau of Statistics",
    "CBN": "Central Bank of Nigeria",
    "FRED": "Federal Reserve Economic Data (FRED)",
    "TRADING_ECONOMICS": "Trading Economics",
    "IMF": "IMF World Economic Outlook",
    "WORLD_BANK": "World Bank Open Data",
    "MANUAL": "Velora Manual Entry",
    "EXCHANGE_RATE_API": "Exchange Rate API",
    "country_table": "Velora Country Intelligence",
    "regional_default": "Regional Estimate",
}

COUNTRY_SOURCE_BOOST: dict[str, dict[str, float]] = {
    "NG": {"NBS": 8.0, "CBN": 6.0},
    "US": {"FRED": 10.0},
    "GB": {"FRED": 4.0},
    "CA": {"FRED": 3.0},
}

FREQUENCY_BONUS: dict[str, float] = {
    "monthly": 12.0,
    "quarterly": 8.0,
    "annual": 4.0,
    "daily": 14.0,
    "unknown": 0.0,
}

ECON_SNAPSHOT_SOURCES = frozenset({"NBS", "CBN", "FRED", "MANUAL", "EXCHANGE_RATE_API"})

# Live API sources — always preferred over manual / country table / estimates
API_SOURCES = frozenset({
    "NBS",
    "CBN",
    "FRED",
    "IMF",
    "WORLD_BANK",
    "TRADING_ECONOMICS",
    "EXCHANGE_RATE_API",
})

FALLBACK_SOURCES = frozenset({"MANUAL", "country_table", "regional_default"})


def is_api_source(source: str | None) -> bool:
    return bool(source and source in API_SOURCES)

# Which indicators each source is allowed to compete on
SOURCE_FIELD_ELIGIBILITY: dict[str, frozenset[str] | None] = {
    "NBS": None,  # all econ fields
    "CBN": None,
    "FRED": None,
    "MANUAL": None,
    "EXCHANGE_RATE_API": frozenset({"exchange_rate"}),
    "IMF": frozenset({
        "inflation_rate", "gdp_growth", "gdp", "unemployment_rate",
        "public_debt_ratio", "trade_balance", "population", "gov_spending",
        "fiscal_deficit", "foreign_reserves", "interest_rate",
    }),
    "WORLD_BANK": frozenset({
        "inflation_rate", "gdp_growth", "gdp", "unemployment_rate",
        "public_debt_ratio", "trade_balance", "population", "gov_spending",
        "fiscal_deficit", "foreign_reserves",
    }),
    "TRADING_ECONOMICS": frozenset({
        "inflation_rate", "gdp_growth", "gdp", "unemployment_rate",
        "interest_rate", "public_debt_ratio", "trade_balance", "oil_price",
        "retail_sales", "consumer_confidence_index", "purchasing_managers_index",
    }),
    "country_table": frozenset({
        "inflation_rate", "deflation_risk", "gdp", "interest_rate",
        "economic_stability_score", "currency_strength",
    }),
}

# All indicators the platform resolves via single-source selection
TRACKED_INDICATORS: tuple[str, ...] = (
    "inflation_rate",
    "cpi",
    "core_inflation",
    "deflation_risk",
    "gdp",
    "gdp_growth",
    "interest_rate",
    "exchange_rate",
    "oil_price",
    "gov_spending",
    "employment_rate",
    "unemployment_rate",
    "money_supply",
    "trade_balance",
    "producer_price_index",
    "consumer_confidence_index",
    "purchasing_managers_index",
    "public_debt_ratio",
    "commodity_price_index",
    "housing_price_index",
    "retail_sales",
    "foreign_reserves",
    "fiscal_deficit",
    "population",
    "economic_stability_score",
    "currency_strength",
)

INDICATOR_CATEGORIES: dict[str, str] = {
    "inflation_rate": "inflation",
    "cpi": "inflation",
    "core_inflation": "inflation",
    "deflation_risk": "inflation",
    "gdp": "gdp",
    "gdp_growth": "gdp",
    "gov_spending": "fiscal",
    "fiscal_deficit": "fiscal",
    "public_debt_ratio": "fiscal",
    "interest_rate": "monetary",
    "money_supply": "monetary",
    "exchange_rate": "fx",
    "currency_strength": "fx",
    "unemployment_rate": "labor",
    "employment_rate": "labor",
    "oil_price": "commodity",
    "commodity_price_index": "commodity",
    "trade_balance": "trade",
    "foreign_reserves": "trade",
    "retail_sales": "activity",
    "housing_price_index": "activity",
    "consumer_confidence_index": "sentiment",
    "purchasing_managers_index": "sentiment",
    "producer_price_index": "prices",
    "population": "demographics",
    "economic_stability_score": "composite",
}

CATEGORY_SOURCE_BOOST: dict[str, dict[str, float]] = {
    "inflation": {"NBS": 6.0, "CBN": 5.0, "FRED": 4.0, "TRADING_ECONOMICS": 3.0},
    "gdp": {"IMF": 4.0, "WORLD_BANK": 5.0, "NBS": 6.0, "FRED": 3.0},
    "fiscal": {"IMF": 5.0, "WORLD_BANK": 5.0, "NBS": 4.0},
    "monetary": {"CBN": 8.0, "FRED": 6.0, "TRADING_ECONOMICS": 4.0},
    "fx": {"EXCHANGE_RATE_API": 12.0, "CBN": 6.0, "FRED": 3.0},
    "labor": {"NBS": 5.0, "FRED": 5.0, "WORLD_BANK": 4.0},
    "commodity": {"FRED": 8.0, "TRADING_ECONOMICS": 5.0},
    "trade": {"IMF": 5.0, "WORLD_BANK": 5.0, "CBN": 4.0},
    "activity": {"FRED": 6.0, "NBS": 5.0, "TRADING_ECONOMICS": 4.0},
    "demographics": {"WORLD_BANK": 8.0, "IMF": 5.0, "NBS": 6.0},
    "composite": {"country_table": 8.0},
}

ECON_FIELD_NAMES = frozenset(TRACKED_INDICATORS)

POPULATION_JSON_KEYS = ("population", "SP.POP.TOTL", "pop")


def _regional_default_inflation(continent: str | None) -> float:
    if not continent:
        return 5.0
    for key, val in CONTINENT_DEFAULT_INFLATION.items():
        if key.lower() in continent.lower():
            return val
    return 5.0


def _regional_fallback(indicator: str, continent: str | None) -> float | None:
    fallbacks: dict[str, Callable[[str | None], float]] = {
        "inflation_rate": _regional_default_inflation,
        "gdp_growth": lambda _: 2.5,
        "interest_rate": lambda c: max(2.0, _regional_default_inflation(c) * 0.8),
        "unemployment_rate": lambda _: 7.0,
        "exchange_rate": lambda _: 1.0,
        "deflation_risk": lambda c: max(0.0, (3.0 - _regional_default_inflation(c)) * 15.0),
        "economic_stability_score": lambda _: 50.0,
        "currency_strength": lambda _: 50.0,
    }
    fn = fallbacks.get(indicator)
    return fn(continent) if fn else None


def _observation_date(
    data_date: date | datetime | None = None,
    data_year: int | None = None,
    retrieved_at: datetime | None = None,
) -> date | None:
    if data_date is not None:
        if isinstance(data_date, datetime):
            return data_date.date()
        return data_date
    if data_year is not None:
        return date(data_year, 12, 31)
    if retrieved_at is not None:
        return retrieved_at.date() if hasattr(retrieved_at, "date") else None
    return None


def _recency_score(obs_date: date | None) -> float:
    if obs_date is None:
        return 0.0
    today = date.today()
    age_days = (today - obs_date).days
    if age_days < 0:
        return -20.0
    if age_days <= 30:
        return 20.0
    if age_days <= 90:
        return 15.0
    if age_days <= 180:
        return 10.0
    if age_days <= 365:
        return 5.0
    if age_days <= 730:
        return -5.0
    return -15.0


def score_indicator_candidate(
    source: str,
    observation_date: date | None,
    frequency: str,
    country_code: str,
    indicator: str,
) -> float:
    base = SOURCE_BASE_SCORES.get(source, 50.0)
    boost = COUNTRY_SOURCE_BOOST.get(country_code.upper(), {}).get(source, 0.0)
    category = INDICATOR_CATEGORIES.get(indicator, "general")
    boost += CATEGORY_SOURCE_BOOST.get(category, {}).get(source, 0.0)
    recency = _recency_score(observation_date)
    freq = FREQUENCY_BONUS.get(frequency, 0.0)
    return round(base + boost + recency + freq, 2)


def _snapshot(
    *,
    source: str,
    values: dict[str, float],
    observation_date: date | None = None,
    frequency: str = "unknown",
) -> dict | None:
    clean = {k: float(v) for k, v in values.items() if v is not None and k in ECON_FIELD_NAMES}
    if not clean:
        return None
    return {
        "source": source,
        "source_label": SOURCE_LABELS.get(source, source),
        "values": clean,
        "observation_date": observation_date,
        "frequency": frequency,
    }


def _filter_values_for_source(source: str, values: dict[str, float]) -> dict[str, float]:
    allowed = SOURCE_FIELD_ELIGIBILITY.get(source)
    if allowed is None:
        return values
    return {k: v for k, v in values.items() if k in allowed}


def _econ_row_to_values(row: EconomicData, source: str) -> dict[str, float]:
    values: dict[str, float] = {}
    for field in ECON_FIELD_NAMES:
        val = getattr(row, field, None)
        if val is not None:
            values[field] = float(val)
    return _filter_values_for_source(source, values)


def _api_row_to_values(row: Any, source: str) -> dict[str, float]:
    values: dict[str, float] = {}
    mapping = {
        "inflation_pct": "inflation_rate",
        "gdp_growth_pct": "gdp_growth",
        "gdp_usd_billions": "gdp",
        "government_debt_pct_gdp": "public_debt_ratio",
        "unemployment_pct": "unemployment_rate",
        "current_account_pct_gdp": "trade_balance",
    }
    for src_attr, dst_field in mapping.items():
        val = getattr(row, src_attr, None)
        if val is not None:
            values[dst_field] = float(val)

    indicators_json = getattr(row, "indicators_json", None) or {}
    if isinstance(indicators_json, dict):
        for key in POPULATION_JSON_KEYS:
            if key in indicators_json and indicators_json[key] is not None:
                values["population"] = float(indicators_json[key])
                break
        for json_key, field in (
            ("gov_spending", "gov_spending"),
            ("government_spending", "gov_spending"),
            ("fiscal_deficit", "fiscal_deficit"),
            ("foreign_reserves", "foreign_reserves"),
            ("interest_rate", "interest_rate"),
            ("employment_rate", "employment_rate"),
            ("oil_price", "oil_price"),
            ("retail_sales", "retail_sales"),
        ):
            if json_key in indicators_json and indicators_json[json_key] is not None:
                values[field] = float(indicators_json[json_key])
    return _filter_values_for_source(source, values)


def _country_to_values(country: Country) -> dict[str, float]:
    values: dict[str, float] = {}
    for field in (
        "inflation_rate",
        "deflation_risk",
        "gdp",
        "interest_rate",
        "economic_stability_score",
        "currency_strength",
    ):
        val = getattr(country, field, None)
        if val is not None:
            values[field] = float(val)
    return _filter_values_for_source("country_table", values)


def _select_indicator(
    indicator: str,
    snapshots: list[dict],
    country_code: str,
    continent: str | None,
) -> dict:
    candidates: list[dict] = []
    for snap in snapshots:
        val = snap["values"].get(indicator)
        if val is None:
            continue
        score = score_indicator_candidate(
            snap["source"],
            snap.get("observation_date"),
            snap.get("frequency", "unknown"),
            country_code,
            indicator,
        )
        candidates.append({
            "source": snap["source"],
            "source_label": snap["source_label"],
            "value": float(val),
            "accuracy_score": score,
            "observation_date": snap.get("observation_date"),
            "frequency": snap.get("frequency"),
        })

    api_candidates = [c for c in candidates if is_api_source(c["source"])]
    pool = api_candidates if api_candidates else candidates
    pool.sort(key=lambda x: x["accuracy_score"], reverse=True)

    if pool:
        winner = pool[0]
        from_api = is_api_source(winner["source"])
        reason_parts = []
        if from_api:
            reason_parts.append("Live API source (auto-synced)")
        else:
            reason_parts.append("No API data available — using fallback")
        reason_parts.extend([
            f"accuracy {winner['accuracy_score']:.1f}/100",
            f"source: {winner['source_label']}",
        ])
        obs = winner.get("observation_date")
        if obs:
            reason_parts.append(f"as of {obs.isoformat() if hasattr(obs, 'isoformat') else obs}")
        if len(pool) > 1:
            runner = pool[1]
            reason_parts.append(
                f"beat {runner['source_label']} ({runner['accuracy_score']:.1f})"
            )
        return {
            "indicator": indicator,
            "value": winner["value"],
            "source": winner["source"],
            "source_label": winner["source_label"],
            "accuracy_score": winner["accuracy_score"],
            "data_tier": "api" if from_api else "fallback",
            "observation_date": (
                winner["observation_date"].isoformat()
                if winner.get("observation_date") and hasattr(winner["observation_date"], "isoformat")
                else winner.get("observation_date")
            ),
            "frequency": winner.get("frequency"),
            "candidates_considered": len(candidates),
            "api_candidates_considered": len(api_candidates),
            "all_candidates": [
                {
                    "source": c["source"],
                    "source_label": c["source_label"],
                    "value": c["value"],
                    "accuracy_score": c["accuracy_score"],
                    "data_tier": "api" if is_api_source(c["source"]) else "fallback",
                    "observation_date": (
                        c["observation_date"].isoformat()
                        if c.get("observation_date") and hasattr(c["observation_date"], "isoformat")
                        else c.get("observation_date")
                    ),
                }
                for c in pool[:8]
            ],
            "reason": "; ".join(reason_parts) + ".",
            "selection_method": "api_single_best_source" if from_api else "fallback_no_api",
        }

    fallback = _regional_fallback(indicator, continent)
    if fallback is not None:
        return {
            "indicator": indicator,
            "value": float(fallback),
            "source": "regional_default",
            "source_label": SOURCE_LABELS["regional_default"],
            "accuracy_score": SOURCE_BASE_SCORES["regional_default"],
            "data_tier": "fallback",
            "observation_date": None,
            "frequency": "unknown",
            "candidates_considered": 0,
            "api_candidates_considered": 0,
            "all_candidates": [],
            "reason": "No API or stored data; using regional estimate.",
            "selection_method": "fallback_regional_estimate",
        }

    return {
        "indicator": indicator,
        "value": None,
        "source": None,
        "source_label": None,
        "accuracy_score": None,
        "observation_date": None,
        "frequency": None,
        "candidates_considered": 0,
        "all_candidates": [],
        "reason": "No data available for this indicator.",
        "selection_method": "unresolved",
    }


def _build_country_selection(
    code: str,
    snapshots: list[dict],
    continent: str | None,
    indicators: tuple[str, ...] | None = None,
) -> dict:
    fields = indicators or TRACKED_INDICATORS
    selections: dict[str, dict] = {}
    values: dict[str, float] = {}

    for indicator in fields:
        sel = _select_indicator(indicator, snapshots, code, continent)
        selections[indicator] = sel
        if sel["value"] is not None:
            values[indicator] = sel["value"]

    if values.get("inflation_rate") is None and values.get("cpi") is not None:
        values["inflation_rate"] = round(values["cpi"] / 30.0, 2)
        if "inflation_rate" not in selections or selections["inflation_rate"]["value"] is None:
            selections["inflation_rate"] = {
                **selections.get("cpi", {}),
                "indicator": "inflation_rate",
                "value": values["inflation_rate"],
                "reason": "Derived from selected CPI index.",
            }

    api_sources_used = sorted({
        s["source_label"]
        for s in selections.values()
        if is_api_source(s.get("source"))
    })
    fallback_sources_used = sorted({
        s["source_label"]
        for s in selections.values()
        if s.get("source") in FALLBACK_SOURCES and s.get("value") is not None
    })
    api_indicator_count = sum(
        1 for s in selections.values() if s.get("data_tier") == "api" and s.get("value") is not None
    )
    fallback_indicator_count = sum(
        1 for s in selections.values() if s.get("data_tier") == "fallback" and s.get("value") is not None
    )

    return {
        "country_code": code,
        "values": values,
        "selections": selections,
        "sources_used": api_sources_used + fallback_sources_used,
        "api_sources_used": api_sources_used,
        "fallback_sources_used": fallback_sources_used,
        "indicators_resolved": len(values),
        "api_indicators": api_indicator_count,
        "fallback_indicators": fallback_indicator_count,
        "api_coverage_pct": round(
            (api_indicator_count / len(values) * 100) if values else 0.0, 1
        ),
        "selection_method": "api_first_per_indicator",
        "selection_policy": "API sources preferred; fallback only when no API data exists",
        "selected_at": datetime.now(timezone.utc).isoformat(),
    }


async def _collect_snapshots(db: AsyncSession, country_code: str) -> list[dict]:
    code = country_code.upper()
    snapshots: list[dict] = []
    current_year = date.today().year
    ref = COUNTRY_REFERENCE.get(code, {})
    continent = ref.get("continent")

    econ_result = await db.execute(
        select(EconomicData)
        .where(EconomicData.country_code == code)
        .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
    )
    seen_econ: set[str] = set()
    for row in econ_result.scalars().all():
        src_key = row.source.value if hasattr(row.source, "value") else str(row.source)
        if src_key not in ECON_SNAPSHOT_SOURCES or src_key in seen_econ:
            continue
        seen_econ.add(src_key)
        freq = (
            "daily" if src_key == "EXCHANGE_RATE_API"
            else "monthly" if src_key in ("NBS", "CBN", "FRED")
            else "quarterly"
        )
        snap = _snapshot(
            source=src_key,
            values=_econ_row_to_values(row, src_key),
            observation_date=_observation_date(data_date=row.data_date),
            frequency=freq,
        )
        if snap:
            snapshots.append(snap)

    currency = ref.get("currency")
    if currency and currency != "USD":
        fx_result = await db.execute(
            select(ExchangeRate)
            .where(ExchangeRate.target_currency == currency)
            .order_by(desc(ExchangeRate.retrieved_at))
            .limit(1)
        )
        fx_row = fx_result.scalar_one_or_none()
        if fx_row:
            snap = _snapshot(
                source="EXCHANGE_RATE_API",
                values={"exchange_rate": float(fx_row.exchange_rate)},
                observation_date=_observation_date(retrieved_at=fx_row.retrieved_at),
                frequency="daily",
            )
            if snap:
                snapshots.append(snap)

    for model, source_key, freq in (
        (ImfCountryData, "IMF", "annual"),
        (WorldBankCountryData, "WORLD_BANK", "annual"),
        (TradingEconomicsCountryData, "TRADING_ECONOMICS", "monthly"),
    ):
        result = await db.execute(
            select(model)
            .where(
                model.country_code == code,
                model.data_year <= current_year,
            )
            .order_by(desc(model.data_year))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row:
            snap = _snapshot(
                source=source_key,
                values=_api_row_to_values(row, source_key),
                observation_date=_observation_date(
                    data_year=row.data_year, retrieved_at=row.retrieved_at
                ),
                frequency=freq,
            )
            if snap:
                snapshots.append(snap)

    country_result = await db.execute(select(Country).where(Country.code == code))
    country = country_result.scalar_one_or_none()
    if country:
        snap = _snapshot(
            source="country_table",
            values=_country_to_values(country),
            observation_date=country.updated_at.date() if country.updated_at else None,
            frequency="unknown",
        )
        if snap:
            snapshots.append(snap)

    return snapshots, continent


async def select_best_indicators(
    db: AsyncSession,
    country_code: str,
    indicators: tuple[str, ...] | None = None,
    *,
    refresh_apis: bool = True,
) -> dict:
    """Select the single best source for each economic indicator in one country."""
    import logging

    _logger = logging.getLogger(__name__)
    code = country_code.upper()

    refresh_meta = None
    if refresh_apis:
        try:
            from app.services.api_data_refresh_service import ensure_fresh_api_data

            refresh_meta = await ensure_fresh_api_data(db, code)
            await db.flush()
        except Exception:
            _logger.debug("API refresh before selection skipped for %s", code, exc_info=True)

    snapshots, continent = await _collect_snapshots(db, code)
    result = _build_country_selection(code, snapshots, continent, indicators)
    if refresh_meta:
        result["api_refresh"] = refresh_meta
    return result


async def batch_collect_snapshots(db: AsyncSession) -> dict[str, tuple[list[dict], str | None]]:
    """Batch-load source snapshots for all countries."""
    by_country: dict[str, list[dict]] = {}
    continents: dict[str, str | None] = {}
    current_year = date.today().year

    for entry in load_world_countries():
        code = entry["code"].upper()
        continents[code] = entry.get("continent")
        by_country.setdefault(code, [])

    country_result = await db.execute(select(Country))
    countries = {c.code.upper(): c for c in country_result.scalars().all()}
    for code, c in countries.items():
        continents[code] = c.continent or continents.get(code)
        snap = _snapshot(
            source="country_table",
            values=_country_to_values(c),
            observation_date=c.updated_at.date() if c.updated_at else None,
            frequency="unknown",
        )
        if snap:
            by_country.setdefault(code, []).append(snap)

    econ_result = await db.execute(
        select(EconomicData).order_by(
            EconomicData.country_code,
            desc(EconomicData.data_date),
            desc(EconomicData.created_at),
        )
    )
    seen_econ: set[tuple[str, str]] = set()
    for row in econ_result.scalars().all():
        code = row.country_code.upper()
        src_key = row.source.value if hasattr(row.source, "value") else str(row.source)
        if src_key not in ECON_SNAPSHOT_SOURCES:
            continue
        key = (code, src_key)
        if key in seen_econ:
            continue
        seen_econ.add(key)
        freq = (
            "daily" if src_key == "EXCHANGE_RATE_API"
            else "monthly" if src_key in ("NBS", "CBN", "FRED")
            else "quarterly"
        )
        snap = _snapshot(
            source=src_key,
            values=_econ_row_to_values(row, src_key),
            observation_date=_observation_date(data_date=row.data_date),
            frequency=freq,
        )
        if snap:
            by_country.setdefault(code, []).append(snap)

    fx_result = await db.execute(
        select(ExchangeRate).order_by(
            ExchangeRate.target_currency,
            desc(ExchangeRate.retrieved_at),
        )
    )
    seen_fx: set[str] = set()
    currency_to_country: dict[str, str] = {}
    for entry in load_world_countries():
        cur = entry.get("currency")
        if cur:
            currency_to_country.setdefault(cur, entry["code"].upper())

    for fx_row in fx_result.scalars().all():
        cur = fx_row.target_currency
        if cur in seen_fx:
            continue
        seen_fx.add(cur)
        code = currency_to_country.get(cur)
        if not code:
            continue
        snap = _snapshot(
            source="EXCHANGE_RATE_API",
            values={"exchange_rate": float(fx_row.exchange_rate)},
            observation_date=_observation_date(retrieved_at=fx_row.retrieved_at),
            frequency="daily",
        )
        if snap:
            by_country.setdefault(code, []).append(snap)

    for model, source_key, freq in (
        (ImfCountryData, "IMF", "annual"),
        (WorldBankCountryData, "WORLD_BANK", "annual"),
        (TradingEconomicsCountryData, "TRADING_ECONOMICS", "monthly"),
    ):
        api_result = await db.execute(
            select(model)
            .where(model.data_year <= current_year)
            .order_by(model.country_code, desc(model.data_year))
        )
        seen_api: set[str] = set()
        for row in api_result.scalars().all():
            code = row.country_code.upper()
            if code in seen_api:
                continue
            seen_api.add(code)
            snap = _snapshot(
                source=source_key,
                values=_api_row_to_values(row, source_key),
                observation_date=_observation_date(
                    data_year=row.data_year, retrieved_at=row.retrieved_at
                ),
                frequency=freq,
            )
            if snap:
                by_country.setdefault(code, []).append(snap)

    all_codes = set(by_country) | set(continents)
    return {
        code: (by_country.get(code, []), continents.get(code))
        for code in all_codes
    }


async def batch_select_best_indicators(
    db: AsyncSession,
    *,
    refresh_apis: bool = False,
) -> dict[str, dict]:
    """Batch per-indicator selection for all countries (no per-country API refresh)."""
    snapshot_map = await batch_collect_snapshots(db)
    return {
        code: _build_country_selection(code, snapshots, continent)
        for code, (snapshots, continent) in snapshot_map.items()
    }


def cpi_selection_from_data_selection(data_selection: dict) -> dict:
    """Backward-compatible CPI-only view from full data selection."""
    selections = data_selection.get("selections", {})
    inflation_sel = selections.get("inflation_rate") or selections.get("cpi")
    if not inflation_sel or inflation_sel.get("value") is None:
        return {
            "country_code": data_selection.get("country_code"),
            "inflation_rate": data_selection.get("values", {}).get("inflation_rate"),
            "cpi": data_selection.get("values", {}).get("cpi"),
            "source": inflation_sel.get("source", "regional_default") if inflation_sel else "regional_default",
            "source_label": inflation_sel.get("source_label", SOURCE_LABELS["regional_default"]) if inflation_sel else SOURCE_LABELS["regional_default"],
            "accuracy_score": inflation_sel.get("accuracy_score") if inflation_sel else SOURCE_BASE_SCORES["regional_default"],
            "selection_method": inflation_sel.get("selection_method", "single_best_source") if inflation_sel else "fallback_regional_estimate",
            "candidates_considered": inflation_sel.get("candidates_considered", 0) if inflation_sel else 0,
            "all_candidates": inflation_sel.get("all_candidates", []) if inflation_sel else [],
            "reason": inflation_sel.get("reason", "") if inflation_sel else "No CPI data available.",
            "selected_at": data_selection.get("selected_at"),
        }

    return {
        "country_code": data_selection.get("country_code"),
        "inflation_rate": data_selection.get("values", {}).get("inflation_rate"),
        "cpi": data_selection.get("values", {}).get("cpi"),
        "source": inflation_sel["source"],
        "source_label": inflation_sel["source_label"],
        "accuracy_score": inflation_sel["accuracy_score"],
        "observation_date": inflation_sel.get("observation_date"),
        "frequency": inflation_sel.get("frequency"),
        "selection_method": inflation_sel.get("selection_method", "single_best_source"),
        "candidates_considered": inflation_sel.get("candidates_considered", 0),
        "all_candidates": [
            {
                "source": c["source"],
                "source_label": c["source_label"],
                "inflation_rate": c.get("value"),
                "cpi": None,
                "accuracy_score": c.get("accuracy_score"),
                "observation_date": c.get("observation_date"),
            }
            for c in inflation_sel.get("all_candidates", [])
        ],
        "reason": inflation_sel.get("reason", ""),
        "selected_at": data_selection.get("selected_at"),
    }