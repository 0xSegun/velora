"""
Personalized insights for ordinary user dashboard — charts, briefings, cost of living.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economic_data import EconomicData
from app.models.intelligence import EconomicEvent
from app.models.user import User
from app.services import intelligence_service
from app.services.country_service import COUNTRY_REFERENCE
from app.services.dashboard_service import (
    _get_economic_records,
    _get_latest_prediction,
    _merge_metrics,
    _resolve_timezone,
    _server_clock,
)
from app.services.exchange_rate_service import get_rate_for_country


def _direction_label(current: float | None, previous: float | None) -> str:
    if current is None or previous is None:
        return "Stable"
    diff = current - previous
    if abs(diff) < 0.1:
        return "Stable"
    return "Increasing" if diff > 0 else "Decreasing"


def _gauge_score(value: float | None, *, low: float = 5, high: float = 15, invert: bool = False) -> float:
    if value is None:
        return 50.0
    if invert:
        value = max(0, high - value)
    return min(100, max(0, (value / high) * 100))


async def _history_series(db: AsyncSession, code: str, field: str, limit: int = 12) -> list[dict]:
    result = await db.execute(
        select(EconomicData)
        .where(EconomicData.country_code == code.upper())
        .order_by(desc(EconomicData.data_date))
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    series = []
    for row in rows:
        val = getattr(row, field, None)
        if val is not None:
            series.append({
                "date": row.data_date.isoformat(),
                "label": row.data_date.strftime("%b %Y"),
                "value": round(float(val), 2),
            })
    return series


async def get_user_insights(
    db: AsyncSession,
    user: User,
    country_code: str | None = None,
) -> dict:
    code = (country_code or user.country).upper()
    ref = COUNTRY_REFERENCE.get(code, {})
    name = ref.get("name", code)
    clock = _server_clock(_resolve_timezone(user))

    economic = await _get_economic_records(db, code, limit=12)
    prediction = await _get_latest_prediction(db, user.id, code)
    metrics = _merge_metrics(None, economic, prediction)
    fx = await get_rate_for_country(db, code)
    health = await intelligence_service.compute_economic_health(db, code)
    sentiment = await intelligence_service.get_sentiment(db, code)

    latest = economic[0] if economic else None
    previous = economic[1] if len(economic) > 1 else None

    inflation = metrics.get("inflation_rate")
    pred = metrics.get("prediction") or {}
    trend = pred.get("trend_direction", "stable")

    ai_summary = pred.get("ai_summary") or health.get("ai_summary") or (
        f"Prices are expected to remain {'elevated' if (inflation or 0) > 8 else 'moderate' if (inflation or 0) > 4 else 'stable'} "
        f"over the next few months. Food and transportation costs may "
        f"{'increase slightly' if trend == 'up' else 'stay relatively steady'}."
    )

    cost_of_living = {
        "food": _direction_label(latest.inflation_rate if latest else None, previous.inflation_rate if previous else None),
        "housing": _direction_label(latest.cpi if latest else None, previous.cpi if previous else None),
        "transportation": _direction_label(latest.oil_price if latest else None, previous.oil_price if previous else None),
        "utilities": _direction_label(latest.gov_spending if latest else None, previous.gov_spending if previous else None),
        "fuel": _direction_label(latest.oil_price if latest else None, previous.oil_price if previous else None),
    }

    savings_recommendations = []
    if (inflation or 0) > 10:
        savings_recommendations.append(
            "High inflation may reduce purchasing power. Consider keeping emergency savings and controlling unnecessary spending."
        )
    elif (inflation or 0) > 5:
        savings_recommendations.append(
            "Moderate inflation suggests building a buffer fund and comparing prices before large purchases."
        )
    else:
        savings_recommendations.append(
            "Stable price conditions favour steady saving habits and long-term financial planning."
        )
    if fx.trend == "down":
        savings_recommendations.append(
            "A weakening currency can make imports costlier — delay non-essential foreign-currency purchases if possible."
        )
    savings_recommendations.append(
        "Aim for 3–6 months of essential expenses in an accessible emergency fund."
    )

    events_result = await db.execute(
        select(EconomicEvent)
        .where(EconomicEvent.country == code)
        .order_by(desc(EconomicEvent.event_date))
        .limit(5)
    )
    recent_events = [
        {
            "title": e.title,
            "date": e.event_date.isoformat(),
            "category": e.category,
            "impact": e.economic_impact_score,
        }
        for e in events_result.scalars().all()
    ]

    news = await intelligence_service.get_news(db, code, limit=5)

    return {
        "country_code": code,
        "country_name": name,
        "server_time": clock,
        "tracked_countries": user.tracked_countries or [],
        "todays_summary": {
            "economic_health": health.get("label", "Moderate"),
            "economic_health_score": health.get("score", 50),
            "inflation_trend": trend,
            "inflation_rate": inflation,
            "deflation_risk": metrics.get("deflation_risk"),
            "currency_strength": metrics.get("currency_strength"),
            "currency_trend": fx.trend,
            "ai_summary": ai_summary,
        },
        "cost_of_living": cost_of_living,
        "savings_advisor": savings_recommendations,
        "charts": {
            "inflation_trend": await _history_series(db, code, "inflation_rate"),
            "exchange_rate_trend": await _history_series(db, code, "exchange_rate"),
            "food_price_trend": await _history_series(db, code, "cpi"),
            "fuel_price_trend": await _history_series(db, code, "oil_price"),
            "gdp_trend": await _history_series(db, code, "gdp_growth"),
            "purchasing_power_trend": await _history_series(db, code, "inflation_rate"),
        },
        "gauges": {
            "economic_health": health.get("score", 50),
            "forecast_confidence": pred.get("confidence_score") or 70,
            "risk_level": pred.get("risk_level") or "medium",
            "sentiment_score": round(sentiment.get("positive", 0.33) * 100, 1),
        },
        "quick_forecasts": {
            "current_situation": (
                "Prices are rising quickly."
                if (inflation or 0) > 15
                else "Prices are increasing slowly."
                if (inflation or 0) > 3
                else "Prices are relatively stable."
            ),
            "expected_trend": (
                "Prices may continue rising over the next three months."
                if trend == "up"
                else "Price increases may slow down."
                if trend == "down"
                else "Prices may stay roughly the same."
            ),
            "risk_level": (pred.get("risk_level") or "medium").title(),
            "confidence": pred.get("confidence_score") or 70,
        },
        "recent_events": recent_events,
        "recent_news": news[:3],
        "weekly_summary": (
            f"This week in {name}: inflation at {inflation:.1f}% with {trend} trend. "
            f"Sentiment is predominantly {sentiment.get('dominant', 'neutral')}. "
            f"{len(recent_events)} major economic events on the calendar."
            if inflation is not None
            else f"Weekly update for {name} — generate a forecast for personalized insights."
        ),
        "ai_recommendations": savings_recommendations[:3],
    }


async def get_briefing(
    db: AsyncSession,
    user: User,
    period: str = "morning",
    country_code: str | None = None,
) -> dict:
    """Morning, weekly, or monthly AI economic briefing."""
    insights = await get_user_insights(db, user, country_code=country_code)
    name = user.full_name.split()[0] if user.full_name else "there"
    summary = insights["todays_summary"]
    code = insights["country_code"]
    country_name = insights["country_name"]

    if period == "weekly":
        greeting = f"Weekly briefing for {name}"
        body = insights["weekly_summary"]
    elif period == "monthly":
        greeting = f"Monthly economic outlook — {country_name}"
        body = (
            f"Over the coming month, inflation is expected to remain {summary['inflation_trend']} "
            f"with economic health rated {summary['economic_health']}. "
            f"{insights['savings_advisor'][0]}"
        )
    else:
        hour = datetime.now(timezone.utc).hour
        time_greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
        greeting = f"{time_greeting}, {name}"
        body = (
            f"Inflation is expected to remain {summary['inflation_trend']} over the next quarter. "
            f"Recent exchange rate movements and energy prices continue to influence consumer prices in "
            f"{country_name}. {summary['ai_summary']}"
        )

    return {
        "period": period,
        "greeting": greeting,
        "body": body,
        "country_code": code,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "highlights": insights["ai_recommendations"],
    }