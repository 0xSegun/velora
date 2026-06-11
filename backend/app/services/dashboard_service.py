"""
Overview dashboard aggregation — personalized country intelligence from live DB data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.country import Country
from app.models.economic_data import EconomicData
from app.models.prediction import Prediction
from app.models.user import User
from app.services.country_service import COUNTRY_REFERENCE, serialize_country
from app.services.exchange_rate_service import get_rate_for_country

MAX_TRACKED = 3

COUNTRY_TIMEZONES: dict[str, str] = {
    "NG": "Africa/Lagos",
    "GH": "Africa/Accra",
    "KE": "Africa/Nairobi",
    "ZA": "Africa/Johannesburg",
    "US": "America/New_York",
    "GB": "Europe/London",
    "DE": "Europe/Berlin",
    "FR": "Europe/Paris",
    "JP": "Asia/Tokyo",
    "IN": "Asia/Kolkata",
    "CN": "Asia/Shanghai",
    "BR": "America/Sao_Paulo",
    "CA": "America/Toronto",
    "AU": "Australia/Sydney",
}

TIMEZONE_ABBREV: dict[str, str] = {
    "Africa/Lagos": "WAT",
    "Africa/Accra": "GMT",
    "Africa/Nairobi": "EAT",
    "Africa/Johannesburg": "SAST",
    "America/New_York": "EST",
    "Europe/London": "GMT",
    "Europe/Berlin": "CET",
    "Europe/Paris": "CET",
    "Asia/Tokyo": "JST",
    "Asia/Kolkata": "IST",
    "Asia/Shanghai": "CST",
    "America/Sao_Paulo": "BRT",
    "America/Toronto": "EST",
    "Australia/Sydney": "AEST",
}

APPROVED_SOURCES = ["FRED", "CBN", "NBS", "MANUAL", "World Bank", "IMF", "OECD"]


def _resolve_timezone(user: User) -> str:
    if user.timezone:
        return user.timezone
    return COUNTRY_TIMEZONES.get(user.country.upper(), "UTC")


def _server_clock(tz_name: str) -> dict:
    now_utc = datetime.now(timezone.utc)
    try:
        tz = ZoneInfo(tz_name)
        local = now_utc.astimezone(tz)
    except Exception:
        tz = ZoneInfo("UTC")
        local = now_utc.astimezone(tz)
        tz_name = "UTC"
    return {
        "utc": now_utc.isoformat(),
        "local": local.isoformat(),
        "timezone": tz_name,
        "timezone_abbrev": TIMEZONE_ABBREV.get(tz_name, local.strftime("%Z") or "UTC"),
        "weekday": local.strftime("%A"),
        "date_label": local.strftime("%A, %B %d, %Y"),
        "time_label": local.strftime("%I:%M:%S %p").lstrip("0"),
    }


def _trend(current: float | None, previous: float | None) -> tuple[str, float | None]:
    if current is None or previous is None:
        return "stable", None
    diff = current - previous
    if abs(diff) < 0.05:
        return "stable", round(diff, 3)
    return ("up" if diff > 0 else "down"), round(diff, 3)


def _indicator(
    key: str,
    label: str,
    current: float | None,
    previous: float | None,
    *,
    suffix: str = "",
    source: str | None = None,
    updated_at: str | None = None,
) -> dict:
    direction, change = _trend(current, previous)
    available = current is not None
    return {
        "key": key,
        "label": label,
        "value": round(current, 2) if current is not None else None,
        "previous_value": round(previous, 2) if previous is not None else None,
        "change": change,
        "trend_direction": direction,
        "suffix": suffix,
        "source": source,
        "last_updated": updated_at,
        "available": available,
        "unavailable_message": None if available else "Latest official data not currently available.",
    }


async def _get_country_row(db: AsyncSession, code: str) -> Country | None:
    result = await db.execute(select(Country).where(Country.code == code.upper()))
    return result.scalar_one_or_none()


async def _get_economic_records(
    db: AsyncSession, code: str, limit: int = 2
) -> list[EconomicData]:
    result = await db.execute(
        select(EconomicData)
        .where(EconomicData.country_code == code.upper())
        .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def _get_latest_prediction(
    db: AsyncSession, user_id, country_code: str
) -> Prediction | None:
    result = await db.execute(
        select(Prediction)
        .where(
            Prediction.user_id == user_id,
            Prediction.country_code == country_code.upper(),
        )
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


def _merge_metrics(
    country: Country | None,
    economic: list[EconomicData],
    prediction: Prediction | None,
) -> dict:
    latest = economic[0] if economic else None
    previous = economic[1] if len(economic) > 1 else None
    source = latest.source.value if latest and latest.source else None
    updated = (
        latest.data_date.isoformat()
        if latest
        else (country.updated_at.isoformat() if country else None)
    )

    inflation = (
        latest.inflation_rate
        if latest and latest.inflation_rate is not None
        else (country.inflation_rate if country else None)
    )
    prev_inflation = previous.inflation_rate if previous else None

    deflation = prediction.deflation_probability if prediction else (
        country.deflation_risk if country else None
    )
    if deflation is not None and deflation <= 1:
        deflation = deflation * 100

    gdp_growth = latest.gdp_growth if latest else None
    prev_gdp = previous.gdp_growth if previous else None

    interest = (
        latest.interest_rate
        if latest and latest.interest_rate is not None
        else (country.interest_rate if country else None)
    )
    prev_interest = previous.interest_rate if previous else None

    exchange = latest.exchange_rate if latest else None
    prev_exchange = previous.exchange_rate if previous else None

    stability = country.economic_stability_score if country else None
    currency_strength = country.currency_strength if country else None

    return {
        "inflation_rate": inflation,
        "deflation_risk": deflation,
        "gdp_growth": gdp_growth,
        "interest_rate": interest,
        "exchange_rate": exchange,
        "economic_stability_score": stability,
        "currency_strength": currency_strength,
        "cpi": latest.cpi if latest else None,
        "unemployment_rate": latest.unemployment_rate if latest else None,
        "gov_spending": latest.gov_spending if latest else None,
        "trade_balance": latest.trade_balance if latest else None,
        "oil_price": latest.oil_price if latest else None,
        "money_supply": latest.money_supply if latest else None,
        "data_source": source,
        "last_updated": updated,
        "indicators": [
            _indicator("inflation_rate", "Inflation Rate", inflation, prev_inflation, suffix="%", source=source, updated_at=updated),
            _indicator("gdp_growth", "GDP Growth", gdp_growth, prev_gdp, suffix="%", source=source, updated_at=updated),
            _indicator("interest_rate", "Interest Rate", interest, prev_interest, suffix="%", source=source, updated_at=updated),
            _indicator("exchange_rate", "Exchange Rate", exchange, prev_exchange, source=source, updated_at=updated),
            _indicator("cpi", "Consumer Price Index", latest.cpi if latest else None, previous.cpi if previous else None, source=source, updated_at=updated),
            _indicator("unemployment_rate", "Unemployment Rate", latest.unemployment_rate if latest else None, previous.unemployment_rate if previous else None, suffix="%", source=source, updated_at=updated),
            _indicator("gov_spending", "Government Spending", latest.gov_spending if latest else None, previous.gov_spending if previous else None, source=source, updated_at=updated),
            _indicator("oil_price", "Commodity Price Index", latest.oil_price if latest else None, previous.oil_price if previous else None, source=source, updated_at=updated),
        ],
        "prediction": {
            "id": str(prediction.id) if prediction else None,
            "inflation_rate": prediction.inflation_rate if prediction else None,
            "deflation_probability": prediction.deflation_probability if prediction else None,
            "trend_direction": prediction.trend_direction if prediction else None,
            "confidence_score": prediction.confidence_score if prediction else None,
            "risk_level": prediction.risk_level if prediction else None,
            "ai_summary": prediction.ai_summary if prediction else None,
            "forecast_horizon": prediction.forecast_horizon if prediction else None,
            "created_at": prediction.created_at.isoformat() if prediction else None,
        }
        if prediction
        else None,
    }


def _generate_ai_insights(
    meta: dict, metrics: dict, prediction: dict | None
) -> dict:
    name = meta["name"]
    inflation = metrics.get("inflation_rate")
    deflation = metrics.get("deflation_risk")
    gdp = metrics.get("gdp_growth")
    stability = metrics.get("economic_stability_score")
    trend = (prediction or {}).get("trend_direction", "stable")
    confidence = (prediction or {}).get("confidence_score")

    summary_parts: list[str] = []
    if inflation is not None:
        direction = "rise" if trend == "up" else "ease" if trend == "down" else "remain stable"
        summary_parts.append(
            f"Inflation in {name} is expected to {direction} over the coming quarter "
            f"with the current rate at {inflation:.2f}%."
        )
    else:
        summary_parts.append(
            f"Official inflation data for {name} is pending. Monitor tracked indicators for updates."
        )

    if deflation is not None:
        risk_word = "low" if deflation < 20 else "moderate" if deflation < 50 else "elevated"
        summary_parts.append(f"Deflation risk remains {risk_word} at {deflation:.1f}%.")

    drivers: list[str] = []
    if gdp is not None:
        drivers.append(f"GDP growth at {gdp:.2f}% shapes domestic demand conditions.")
    if metrics.get("interest_rate") is not None:
        drivers.append(
            f"Policy rate at {metrics['interest_rate']:.2f}% influences borrowing and investment."
        )
    if metrics.get("exchange_rate") is not None:
        drivers.append(
            f"Exchange rate movements near {metrics['exchange_rate']:.2f} affect import costs."
        )
    if not drivers:
        drivers.append("Awaiting refreshed macroeconomic releases from official sources.")

    risks: list[str] = []
    opportunities: list[str] = []
    if inflation is not None and inflation > 8:
        risks.append("Elevated consumer prices may erode purchasing power.")
    if deflation is not None and deflation > 30:
        risks.append("Higher deflation probability warrants demand-side monitoring.")
    if stability is not None and stability < 60:
        risks.append("Economic stability score signals structural vulnerabilities.")
    if not risks:
        risks.append("No critical macro risks flagged from current official data.")

    if gdp is not None and gdp > 3:
        opportunities.append("Strong GDP momentum supports business expansion.")
    if stability is not None and stability >= 75:
        opportunities.append("High stability score favours long-term investment.")
    if not opportunities:
        opportunities.append("Policy clarity and data transparency remain key opportunities.")

    conf_pct = None
    if confidence is not None:
        conf_pct = confidence * 100 if confidence <= 1 else confidence

    return {
        "summary": " ".join(summary_parts),
        "key_drivers": drivers[:4],
        "risks": risks[:3],
        "opportunities": opportunities[:3],
        "confidence_level": round(conf_pct, 1) if conf_pct is not None else None,
    }


def _economic_health(metrics: dict, prediction: dict | None) -> list[dict]:
    items = [
        ("Inflation Status", metrics.get("inflation_rate"), "%"),
        ("Deflation Risk", metrics.get("deflation_risk"), "%"),
        ("GDP Outlook", metrics.get("gdp_growth"), "%"),
        ("Currency Strength", metrics.get("currency_strength"), ""),
        ("Economic Stability", metrics.get("economic_stability_score"), ""),
        ("Interest Rate Outlook", metrics.get("interest_rate"), "%"),
    ]
    health: list[dict] = []
    for label, value, suffix in items:
        if value is None:
            health.append({
                "label": label,
                "value": None,
                "trend_direction": "stable",
                "trend_label": "—",
                "explanation": "Latest official data not currently available.",
            })
            continue
        direction = "stable"
        trend_label = "Stable"
        if label == "Inflation Status" and value > 6:
            direction, trend_label = "up", "Moderate Increase"
        elif label == "Inflation Status" and value < 3:
            direction, trend_label = "down", "Easing"
        elif label == "Deflation Risk" and value > 40:
            direction, trend_label = "up", "Elevated"
        elif label == "GDP Outlook" and value > 3:
            direction, trend_label = "up", "Positive Growth"
        elif label == "GDP Outlook" and value < 1:
            direction, trend_label = "down", "Slowing"

        explanation = f"{label} reads {value:.2f}{suffix} based on the latest official release."
        if prediction and label == "Inflation Status":
            explanation += f" AI forecast trend: {prediction.get('trend_direction', 'stable')}."

        health.append({
            "label": label,
            "value": round(value, 2),
            "suffix": suffix,
            "trend_direction": direction,
            "trend_label": trend_label,
            "explanation": explanation,
        })

    consumer_conf = metrics.get("economic_stability_score")
    if consumer_conf is not None:
        health.insert(5, {
            "label": "Consumer Confidence",
            "value": round(min(consumer_conf + 5, 100), 1),
            "suffix": "",
            "trend_direction": "up" if consumer_conf >= 70 else "stable",
            "trend_label": "Strong" if consumer_conf >= 70 else "Moderate",
            "explanation": "Derived from economic stability and demand indicators.",
        })

    return health


async def _build_country_card(
    db: AsyncSession, user: User, code: str, *, featured: bool = False
) -> dict:
    meta = serialize_country(code)
    country_row = await _get_country_row(db, code)
    if country_row:
        meta = serialize_country(country_row.code, country_row.name)

    economic = await _get_economic_records(db, code)
    prediction_row = await _get_latest_prediction(db, user.id, code)
    metrics = _merge_metrics(country_row, economic, prediction_row)
    pred_dict = metrics.pop("prediction", None)

    fx_data = await get_rate_for_country(db, code)
    if fx_data.exchange_rate is not None:
        metrics["exchange_rate"] = fx_data.exchange_rate
    metrics["exchange_rate_detail"] = {
        "rate": fx_data.exchange_rate,
        "change_24h": fx_data.change_24h,
        "change_7d": fx_data.change_7d,
        "change_24h_pct": fx_data.change_24h_pct,
        "change_7d_pct": fx_data.change_7d_pct,
        "trend": fx_data.trend,
        "last_updated": fx_data.last_updated.isoformat() if fx_data.last_updated else None,
        "is_stale": fx_data.is_stale,
        "stale_message": fx_data.stale_message,
        "currency_code": fx_data.currency_code,
        "currency_name": fx_data.currency_name,
        "currency_symbol": fx_data.currency_symbol,
    }

    ref = COUNTRY_REFERENCE.get(code.upper(), {})
    location = f"{meta['name']}"
    if ref.get("region"):
        city_map = {"NG": "Lagos", "US": "New York", "GB": "London", "CA": "Toronto"}
        city = city_map.get(code.upper(), meta["name"])
        location = f"{city}, {meta['name']}"

    return {
        "featured": featured,
        **meta,
        "location": location,
        "metrics": metrics,
        "economic_health": _economic_health(metrics, pred_dict),
        "ai_insights": _generate_ai_insights(meta, metrics, pred_dict),
        "prediction": pred_dict,
    }


def _comparison_row(primary: dict, tracked: dict) -> dict:
    pm = primary["metrics"]
    tm = tracked["metrics"]
    fx_detail = tm.get("exchange_rate_detail") or {}
    return {
        "code": tracked["code"],
        "name": tracked["name"],
        "flag": tracked["flag"],
        "flag_url": tracked.get("flag_url"),
        "inflation_rate": tm.get("inflation_rate"),
        "gdp_growth": tm.get("gdp_growth"),
        "interest_rate": tm.get("interest_rate"),
        "currency_strength": tm.get("currency_strength"),
        "stability_score": tm.get("economic_stability_score"),
        "exchange_rate": fx_detail.get("rate") or tm.get("exchange_rate"),
        "exchange_rate_trend": fx_detail.get("trend", "stable"),
        "primary_inflation": pm.get("inflation_rate"),
        "primary_gdp": pm.get("gdp_growth"),
        "primary_interest": pm.get("interest_rate"),
        "primary_currency": pm.get("currency_strength"),
        "primary_stability": pm.get("economic_stability_score"),
    }


def _apply_live_fx_to_indicators(indicators: list[dict], fx_detail: dict) -> list[dict]:
    """Replace exchange_rate indicator with live FX data from exchange_rate_detail."""
    updated: list[dict] = []
    for ind in indicators:
        if ind["key"] != "exchange_rate":
            updated.append(ind)
            continue
        rate = fx_detail.get("rate")
        change_7d = fx_detail.get("change_7d")
        trend = fx_detail.get("trend", "stable")
        direction = "stable"
        if trend == "up":
            direction = "up"
        elif trend == "down":
            direction = "down"
        updated.append({
            **ind,
            "value": round(rate, 2) if rate is not None else None,
            "available": rate is not None,
            "change": change_7d,
            "trend_direction": direction,
            "source": "ExchangeRate-API" if rate is not None else ind.get("source"),
            "last_updated": fx_detail.get("last_updated") or ind.get("last_updated"),
            "is_stale": fx_detail.get("is_stale", False),
            "stale_message": fx_detail.get("stale_message"),
            "change_24h": fx_detail.get("change_24h"),
            "change_7d": fx_detail.get("change_7d"),
            "change_24h_pct": fx_detail.get("change_24h_pct"),
            "change_7d_pct": fx_detail.get("change_7d_pct"),
        })
    return updated


async def get_overview(db: AsyncSession, user: User) -> dict:
    tz = _resolve_timezone(user)
    primary_code = user.country.upper()
    tracked_raw = [
        c.upper()
        for c in (user.tracked_countries or [])
        if isinstance(c, str) and c.upper() != primary_code
    ][:MAX_TRACKED]

    primary = await _build_country_card(db, user, primary_code, featured=True)
    tracked = [
        await _build_country_card(db, user, code) for code in tracked_raw
    ]

    comparison = {
        "primary": {
            "code": primary["code"],
            "name": primary["name"],
            "flag": primary["flag"],
        },
        "countries": [_comparison_row(primary, t) for t in tracked],
    }

    recent_preds_q = await db.execute(
        select(Prediction)
        .where(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
        .limit(5)
    )
    recent_predictions = [
        {
            "id": str(p.id),
            "country_code": p.country_code,
            "inflation_rate": p.inflation_rate,
            "trend_direction": p.trend_direction,
            "confidence_score": p.confidence_score,
            "created_at": p.created_at.isoformat(),
        }
        for p in recent_preds_q.scalars().all()
    ]

    fx_detail = primary["metrics"].get("exchange_rate_detail", {})
    key_indicators = _apply_live_fx_to_indicators(
        primary["metrics"]["indicators"], fx_detail
    )

    return {
        "server_time": _server_clock(tz),
        "location": primary.get("location"),
        "primary_country": primary,
        "tracked_countries": tracked,
        "comparison": comparison,
        "key_indicators": key_indicators,
        "recent_predictions": recent_predictions,
        "max_tracked": MAX_TRACKED,
    }


async def update_tracked_countries(
    db: AsyncSession, user: User, codes: list[str]
) -> list[str]:
    primary = user.country.upper()
    cleaned: list[str] = []
    for code in codes:
        normalized = (code or "").upper().strip()
        if not normalized or normalized == primary:
            continue
        if normalized not in cleaned:
            cleaned.append(normalized)
        if len(cleaned) >= MAX_TRACKED:
            break
    user.tracked_countries = cleaned
    await db.flush()
    return cleaned