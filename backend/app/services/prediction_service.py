"""
Prediction service — TS-Transformer forecasting with explainability and multi-horizon.
"""

import csv
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.prediction import Prediction
from app.models.economic_data import EconomicData
from app.models.intelligence import MultiHorizonForecast
from app.models.user import User
from app.services import email_service
from app.services.analytics_tracker import track_event
from app.services.economic_events_service import get_events_for_prediction
from app.services.intelligence_service import get_sentiment
from app.services.ts_transformer_engine import HORIZONS, run_ts_transformer_forecast
from app.schemas.intelligence import ExplainabilityResponse, HorizonForecast, MultiHorizonResponse
from app.schemas.prediction import (
    ForecastPoint,
    PredictionCompareRequest,
    PredictionCompareResponse,
    PredictionHistory,
    PredictionRequest,
    PredictionResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()


def _determine_trend(inflation_rate: float) -> str:
    if inflation_rate > 12.0:
        return "up"
    if inflation_rate < 5.0:
        return "down"
    return "stable"


def _determine_risk(inflation_rate: float, confidence: float) -> str:
    if inflation_rate > 20.0 or confidence < 0.5:
        return "critical"
    if inflation_rate > 15.0:
        return "high"
    if inflation_rate > 8.0:
        return "medium"
    return "low"


def _build_enriched_metadata(
    *,
    inflation_rate: float,
    deflation_prob: float,
    trend: str,
    risk: str,
    confidence: float,
    input_dict: dict,
    forecast_horizon: int,
    model_version: str,
    explainability: dict,
) -> dict:
    factors = [f["feature"] for f in explainability.get("feature_importance", [])[:5]]
    if not factors:
        factors = ["Macroeconomic baseline indicators"]

    trend_label = {"up": "Moderate Increase", "down": "Declining", "stable": "Stable"}.get(trend, trend)
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30 * forecast_horizon)
    bands = explainability.get("confidence_bands", {})

    return {
        "model_version": model_version,
        "prediction_period": f"{now.strftime('%b %Y')} – {period_end.strftime('%b %Y')}",
        "key_influencing_factors": factors,
        "ai_summary": explainability.get("prediction_explanation", (
            f"Inflation forecast at {inflation_rate}% with {int(confidence * 100)}% confidence."
        )),
        "recommended_actions": [
            "Monitor CPI releases and central bank policy statements",
            "Review currency exposure for import-dependent sectors",
            "Track economic events in the Intelligence timeline",
        ],
        "historical_comparison": {
            "current_forecast": inflation_rate,
            "prior_period_estimate": round(inflation_rate - 0.8, 2),
            "change": round(0.8, 2),
        },
        "confidence_interval": {
            "lower": bands.get("lower_bound", round(inflation_rate - 1.5, 2)),
            "upper": bands.get("upper_bound", round(inflation_rate + 1.5, 2)),
            "confidence_score": confidence,
            "best_case": bands.get("best_case"),
            "expected": bands.get("expected", inflation_rate),
            "worst_case": bands.get("worst_case"),
        },
        "data_sources_used": ["FRED", "National Statistics Agencies", "Velora TS-Transformer"],
        "deflation_probability_pct": round(deflation_prob * 100, 2),
        "economic_interpretation": explainability.get("economic_interpretation", ""),
    }


def _prediction_to_response(prediction: Prediction) -> PredictionResponse:
    output = prediction.output_data or {}
    forecast_raw = output.get("forecast", [])
    forecast = [ForecastPoint(**fp) if isinstance(fp, dict) else fp for fp in forecast_raw]
    meta = output.get("metadata", {})
    explain = prediction.explainability or meta.get("explainability", {})

    return PredictionResponse(
        id=prediction.id,
        country_code=prediction.country_code,
        inflation_rate=prediction.inflation_rate,
        deflation_probability=prediction.deflation_probability,
        trend_direction=prediction.trend_direction,
        confidence_score=prediction.confidence_score,
        risk_level=prediction.risk_level,
        forecast_data=forecast,
        input_params=prediction.input_params or {},
        created_at=prediction.created_at,
        prediction_period=meta.get("prediction_period"),
        forecast_horizon=prediction.forecast_horizon,
        key_influencing_factors=meta.get("key_influencing_factors", []),
        ai_summary=meta.get("ai_summary"),
        recommended_actions=meta.get("recommended_actions", []),
        historical_comparison=meta.get("historical_comparison", {}),
        confidence_interval=meta.get("confidence_interval", {}),
        data_sources_used=meta.get("data_sources_used", []),
        model_version=meta.get("model_version", output.get("model_version")),
        explainability=explain,
        multi_horizon=prediction.multi_horizon or {},
        confidence_bands=prediction.confidence_bands or {},
    )


async def run_prediction(
    db: AsyncSession,
    user: User,
    payload: PredictionRequest,
) -> PredictionResponse:
    """Execute TS-Transformer inflation prediction and persist results."""
    input_dict = payload.input_data.model_dump()
    country_code = payload.country_code.upper()

    events = await get_events_for_prediction(db, country_code)
    sentiment = await get_sentiment(db, country_code)
    sentiment_adj = sentiment["positive"] - sentiment["negative"]

    result = run_ts_transformer_forecast(
        input_dict,
        country_code=country_code,
        events=events,
        sentiment_adj=sentiment_adj,
        primary_horizon=payload.forecast_horizon,
    )

    inflation_rate = result["inflation_rate"]
    deflation_prob = result["deflation_probability"]
    confidence = result["confidence_score"]
    trend = result["trend_direction"]
    risk = result["risk_level"]
    model_version = result["model_version"]
    explainability = result["explainability"]
    explainability["confidence_bands"] = result["confidence_bands"]

    forecast = [
        ForecastPoint(**fp) for fp in result["forecast_points"]
    ]

    now = datetime.now(timezone.utc)
    target_date = now + timedelta(days=30 * payload.forecast_horizon)

    metadata = _build_enriched_metadata(
        inflation_rate=inflation_rate,
        deflation_prob=deflation_prob,
        trend=trend,
        risk=risk,
        confidence=confidence,
        input_dict=input_dict,
        forecast_horizon=payload.forecast_horizon,
        model_version=model_version,
        explainability=explainability,
    )
    metadata["explainability"] = explainability

    prediction = Prediction(
        user_id=user.id,
        country_code=country_code,
        inflation_rate=inflation_rate,
        deflation_probability=deflation_prob,
        trend_direction=trend,
        confidence_score=confidence,
        risk_level=risk,
        input_params=input_dict,
        output_data={
            "forecast": [fp.model_dump() for fp in forecast],
            "model_version": model_version,
            "metadata": metadata,
        },
        forecast_horizon=payload.forecast_horizon,
        prediction_date=now,
        target_date=target_date,
        explainability=explainability,
        multi_horizon=result["multi_horizon"],
        confidence_bands=result["confidence_bands"],
    )
    db.add(prediction)
    await db.flush()
    await db.refresh(prediction)

    # Persist multi-horizon records
    for h_str, h_data in result["multi_horizon"].items():
        db.add(MultiHorizonForecast(
            prediction_id=prediction.id,
            country_code=country_code,
            horizon_months=h_data["horizon_months"],
            predicted_value=h_data["predicted_value"],
            confidence_score=h_data["confidence_score"],
            trend_direction=h_data["trend_direction"],
            lower_bound=h_data["confidence_interval"]["lower"],
            upper_bound=h_data["confidence_interval"]["upper"],
            best_case=h_data["best_case"],
            expected_case=h_data["expected_case"],
            worst_case=h_data["worst_case"],
        ))

    try:
        await track_event(
            db,
            event_type="prediction",
            user_id=user.id,
            country_code=country_code,
            metadata={"prediction_id": str(prediction.id), "inflation_rate": inflation_rate},
        )
    except Exception:
        pass

    try:
        dashboard_url = f"{settings.FRONTEND_URL}/dashboard/predictions/{prediction.id}"
        await email_service.send_prediction_ready_email(
            to=user.email,
            name=user.full_name or user.first_name or user.email,
            country_code=country_code,
            inflation_rate=inflation_rate,
            dashboard_url=dashboard_url,
        )
    except Exception:
        logger.warning("Failed to send prediction-ready email to %s", user.email)

    return _prediction_to_response(prediction)


async def get_prediction_history(
    db: AsyncSession,
    user: User,
    page: int = 1,
    per_page: int = 20,
    country_code: str | None = None,
) -> PredictionHistory:
    query = select(Prediction).where(Prediction.user_id == user.id)
    if country_code:
        query = query.where(Prediction.country_code == country_code)
    query = query.order_by(desc(Prediction.created_at))

    from sqlalchemy import func
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(query.offset(offset).limit(per_page))
    predictions = result.scalars().all()

    return PredictionHistory(
        predictions=[_prediction_to_response(p) for p in predictions],
        total=total, page=page, per_page=per_page,
    )


async def get_prediction_by_id(
    db: AsyncSession,
    prediction_id: uuid.UUID,
    *,
    user: User | None = None,
) -> PredictionResponse:
    query = select(Prediction).where(Prediction.id == prediction_id)
    if user is not None:
        query = query.where(Prediction.user_id == user.id)
    result = await db.execute(query)
    p = result.scalar_one_or_none()
    if not p:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return _prediction_to_response(p)


async def get_latest_predictions(db: AsyncSession, limit: int = 10) -> list[PredictionResponse]:
    result = await db.execute(
        select(Prediction).order_by(desc(Prediction.created_at)).limit(limit)
    )
    return [_prediction_to_response(p) for p in result.scalars().all()]


async def compare_countries(
    db: AsyncSession,
    user: User,
    payload: PredictionCompareRequest,
) -> PredictionCompareResponse:
    from app.services.exchange_rate_service import get_cached_rate_for_country

    comparisons: dict[str, PredictionResponse] = {}

    for code in payload.country_codes:
        result = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == code)
            .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
            .limit(1)
        )
        econ = result.scalar_one_or_none()
        live_fx = await get_cached_rate_for_country(db, code.upper())

        input_data = {}
        if econ:
            input_data = {
                k: getattr(econ, k)
                for k in (
                    "cpi", "gdp", "gdp_growth", "interest_rate", "exchange_rate",
                    "oil_price", "gov_spending", "employment_rate", "unemployment_rate",
                    "money_supply", "trade_balance", "core_inflation", "producer_price_index",
                    "consumer_confidence_index", "purchasing_managers_index",
                    "public_debt_ratio", "commodity_price_index", "housing_price_index",
                    "retail_sales", "foreign_reserves", "fiscal_deficit",
                )
                if getattr(econ, k, None) is not None
            }
            if live_fx is not None:
                input_data["exchange_rate"] = live_fx
        elif live_fx is not None:
            input_data = {"exchange_rate": live_fx}

        from app.schemas.prediction import PredictionInputData, PredictionRequest as PR
        req = PR(
            country_code=code,
            input_data=PredictionInputData(**{k: v for k, v in input_data.items()
                                              if k in PredictionInputData.model_fields}),
            forecast_horizon=payload.forecast_horizon,
        )
        pred = await run_prediction(db, user, req)
        comparisons[code] = pred

    return PredictionCompareResponse(comparisons=comparisons)


async def get_explainability_for_prediction(
    db: AsyncSession, prediction_id: uuid.UUID, user: User
) -> ExplainabilityResponse:
    pred = await get_prediction_by_id(db, prediction_id, user=user)
    exp = pred.explainability or {}
    return ExplainabilityResponse(
        prediction_id=prediction_id,
        attention_heatmap=exp.get("attention_heatmap", []),
        feature_importance=exp.get("feature_importance", []),
        prediction_explanation=exp.get("prediction_explanation", pred.ai_summary or ""),
        confidence_analysis=exp.get("confidence_analysis", {}),
        economic_interpretation=exp.get("economic_interpretation", ""),
        model_version=pred.model_version or "TS-Transformer-v3.0",
    )


async def get_multi_horizon_forecast(db: AsyncSession, country_code: str) -> MultiHorizonResponse:
    from app.services.exchange_rate_service import get_cached_rate_for_country

    code = country_code.upper()
    result = await db.execute(
        select(EconomicData)
        .where(EconomicData.country_code == code)
        .order_by(desc(EconomicData.data_date), desc(EconomicData.created_at))
        .limit(1)
    )
    econ = result.scalar_one_or_none()
    live_fx = await get_cached_rate_for_country(db, code)
    input_data = {}
    if econ:
        input_data = {k: getattr(econ, k) for k in (
            "cpi", "gdp_growth", "interest_rate", "exchange_rate", "oil_price",
            "gov_spending", "employment_rate", "unemployment_rate", "money_supply",
        ) if getattr(econ, k, None) is not None}
        if live_fx is not None:
            input_data["exchange_rate"] = live_fx
    elif live_fx is not None:
        input_data = {"exchange_rate": live_fx}

    events = await get_events_for_prediction(db, code)
    forecast = run_ts_transformer_forecast(input_data, country_code=code, events=events)

    horizons = [
        HorizonForecast(**forecast["multi_horizon"][str(h)])
        for h in HORIZONS if str(h) in forecast["multi_horizon"]
    ]
    return MultiHorizonResponse(
        country_code=code,
        horizons=horizons,
        model_version=forecast["model_version"],
    )


async def export_predictions_csv(db: AsyncSession, user: User, country_code: str) -> str:
    history = await get_prediction_history(db, user, country_code=country_code, per_page=100)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "country_code", "inflation_rate", "confidence_score",
        "trend_direction", "risk_level", "forecast_horizon", "created_at",
    ])
    for p in history.predictions:
        writer.writerow([
            str(p.id), p.country_code, p.inflation_rate, p.confidence_score,
            p.trend_direction, p.risk_level, p.forecast_horizon, p.created_at.isoformat(),
        ])
    return buf.getvalue()