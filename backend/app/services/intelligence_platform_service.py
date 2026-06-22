"""
Final Intelligence Layer — backtesting, reliability, regime, anomalies,
early warnings, similarity, inflation map, lineage, ML ops, NLQ, hub.
"""

from __future__ import annotations

import asyncio
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.country import Country
from app.models.economic_data import EconomicData
from app.models.intelligence import (
    BacktestSession,
    ForecastArchive,
    IntelligenceAlert,
    ModelExperiment,
    PredictionAccuracyRecord,
)
from app.models.prediction import Prediction
from app.models.site_settings import AIModel, ModelStatus
from app.models.model_training import ModelTraining
from app.services.country_service import COUNTRY_REFERENCE
from app.services.country_macro_service import (
    load_macro_profiles,
    macro_feature_vector,
    simplified_health_score,
)
from app.services.intelligence_service import (
    _latest_econ,
    compute_country_risk,
    compute_economic_health,
    get_accuracy_dashboard,
    get_sentiment,
)

INDICATOR_LABELS = {
    "inflation_rate": "Inflation Rate",
    "interest_rate": "Interest Rate",
    "exchange_rate": "Exchange Rate",
    "oil_price": "Oil Price",
    "gdp_growth": "GDP Growth",
    "unemployment_rate": "Unemployment",
    "food_inflation": "Food Inflation",
    "core_inflation": "Core Inflation",
}

REGIME_EXPLANATIONS = {
    "low_inflation": "Price growth is subdued, supporting stable purchasing power and accommodative policy.",
    "moderate_inflation": "Inflation is within a manageable band; policy has room to respond without emergency measures.",
    "high_inflation": "Elevated price pressures erode purchasing power and may require tighter monetary policy.",
    "hyperinflation": "Extreme price instability — confidence collapse risk and urgent policy intervention required.",
    "deflationary": "Falling prices may signal weak demand; debt burdens rise in real terms.",
    "stagflation": "High inflation combined with weak growth — a challenging policy trade-off.",
    "expansion": "Growth momentum is positive with manageable price pressures.",
    "recession": "Contracting activity with elevated downside risks to employment and incomes.",
}

RELIABILITY_LEVELS = [
    (85, "Excellent"),
    (70, "Good"),
    (50, "Moderate"),
    (0, "Low"),
]


def _reliability_level(score: float) -> str:
    for threshold, label in RELIABILITY_LEVELS:
        if score >= threshold:
            return label
    return "Low"


def _pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or abs(previous) < 1e-9:
        return None
    return round((current - previous) / abs(previous) * 100, 2)


def _impact_on_inflation(indicator: str, change_pct: float) -> float:
    """Heuristic inflation impact from indicator movement (% points)."""
    weights = {
        "oil_price": 0.05,
        "exchange_rate": 0.07,
        "interest_rate": -0.03,
        "food_inflation": 0.08,
        "inflation_rate": 0.10,
        "gdp_growth": -0.02,
    }
    w = weights.get(indicator, 0.02)
    return round(change_pct * w, 2)


# ── Reliability Score ───────────────────────────────────────────────────────

async def compute_reliability(
    db: AsyncSession,
    country_code: str,
    confidence: float,
    data_quality: float = 80.0,
) -> dict:
    code = country_code.upper()
    accuracy = await get_accuracy_dashboard(db, code)
    hist_acc = accuracy["overall_metrics"].get("accuracy_pct", 70.0)

    econ = await _latest_econ(db, code)
    volatility = 30.0
    if econ and econ.inflation_rate is not None:
        result = await db.execute(
            select(EconomicData.inflation_rate)
            .where(EconomicData.country_code == code, EconomicData.inflation_rate.isnot(None))
            .order_by(desc(EconomicData.data_date))
            .limit(12)
        )
        rates = [r[0] for r in result.all()]
        if len(rates) >= 3:
            volatility = min(100, float(np.std(rates)) * 10)

    conf_norm = confidence if confidence <= 1 else confidence / 100
    score = (
        conf_norm * 30
        + (hist_acc / 100) * 30
        + (data_quality / 100) * 25
        + max(0, 100 - volatility) / 100 * 15
    )
    score = round(min(100, max(0, score)), 1)
    return {
        "reliability_score": score,
        "reliability_level": _reliability_level(score),
        "components": {
            "prediction_confidence": round(conf_norm * 100, 1),
            "historical_accuracy": round(hist_acc, 1),
            "data_quality": round(data_quality, 1),
            "economic_volatility": round(volatility, 1),
        },
    }


# ── What Changed Since Last Forecast ─────────────────────────────────────────

async def get_forecast_changes(db: AsyncSession, country_code: str) -> dict:
    code = country_code.upper()
    result = await db.execute(
        select(Prediction)
        .where(Prediction.country_code == code)
        .order_by(desc(Prediction.created_at))
        .limit(2)
    )
    preds = list(result.scalars().all())
    if not preds:
        return {"country_code": code, "changes": [], "forecast_delta": None, "previous_forecast": None, "current_forecast": None}

    current = preds[0]
    previous = preds[1] if len(preds) > 1 else None

    changes: list[dict] = []
    if previous:
        curr_inputs = current.input_params or {}
        prev_inputs = previous.input_params or {}
        all_keys = set(curr_inputs) | set(prev_inputs)
        for key in sorted(all_keys):
            cv, pv = curr_inputs.get(key), prev_inputs.get(key)
            if cv is None and pv is None:
                continue
            try:
                cv_f, pv_f = float(cv), float(pv)
            except (TypeError, ValueError):
                continue
            chg = _pct_change(cv_f, pv_f)
            if chg is None or abs(chg) < 0.5:
                continue
            impact = _impact_on_inflation(key, chg)
            label = INDICATOR_LABELS.get(key, key.replace("_", " ").title())
            changes.append({
                "indicator": key,
                "label": label,
                "previous_value": round(pv_f, 3),
                "current_value": round(cv_f, 3),
                "change_pct": chg,
                "impact_on_inflation_pct": impact,
                "direction": "up" if chg > 0 else "down",
            })
        changes.sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    forecast_delta = None
    if previous:
        forecast_delta = round(current.inflation_rate - previous.inflation_rate, 2)

    return {
        "country_code": code,
        "current_forecast": {
            "prediction_id": str(current.id),
            "inflation_rate": current.inflation_rate,
            "created_at": current.created_at.isoformat(),
            "reliability_score": current.reliability_score,
        },
        "previous_forecast": {
            "prediction_id": str(previous.id),
            "inflation_rate": previous.inflation_rate,
            "created_at": previous.created_at.isoformat(),
        } if previous else None,
        "forecast_delta": forecast_delta,
        "changes": changes[:10],
    }


# ── Economic Regime Detection ───────────────────────────────────────────────

async def detect_economic_regime(db: AsyncSession, country_code: str) -> dict:
    code = country_code.upper()
    profiles = await load_macro_profiles(db)
    profile = profiles.get(code)
    ref = COUNTRY_REFERENCE.get(code, {})
    name = profile["country_name"] if profile else ref.get("name", code)

    if profile:
        inflation = profile["inflation_rate"]
        gdp = profile["gdp_growth"]
        unemployment = profile["unemployment_rate"]
    else:
        econ = await _latest_econ(db, code)
        inflation = econ.inflation_rate if econ and econ.inflation_rate is not None else 8.0
        gdp = econ.gdp_growth if econ and econ.gdp_growth is not None else 2.0
        unemployment = econ.unemployment_rate if econ and econ.unemployment_rate is not None else 7.0

    if inflation >= 50:
        regime = "hyperinflation"
    elif inflation < 0:
        regime = "deflationary"
    elif inflation < 3:
        regime = "low_inflation"
    elif inflation < 8:
        regime = "moderate_inflation"
    elif inflation >= 8 and gdp < 1:
        regime = "stagflation"
    elif inflation >= 8:
        regime = "high_inflation"
    elif gdp < 0:
        regime = "recession"
    else:
        regime = "expansion"

    return {
        "country_code": code,
        "country_name": name,
        "regime": regime,
        "regime_label": regime.replace("_", " ").title(),
        "explanation": REGIME_EXPLANATIONS.get(regime, ""),
        "indicators": {
            "inflation_rate": inflation,
            "gdp_growth": gdp,
            "unemployment_rate": unemployment,
        },
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Anomaly Detection ───────────────────────────────────────────────────────

async def detect_anomalies(db: AsyncSession, country_code: str) -> list[dict]:
    code = country_code.upper()
    alerts: list[dict] = []

    for field, label, spike_threshold in (
        ("inflation_rate", "Inflation", 15.0),
        ("exchange_rate", "Exchange Rate", 8.0),
        ("interest_rate", "Interest Rate", 10.0),
    ):
        result = await db.execute(
            select(getattr(EconomicData, field), EconomicData.data_date)
            .where(EconomicData.country_code == code, getattr(EconomicData, field).isnot(None))
            .order_by(desc(EconomicData.data_date))
            .limit(6)
        )
        rows = result.all()
        if len(rows) < 2:
            continue
        current_val, _ = rows[0]
        prev_val, _ = rows[1]
        chg = _pct_change(float(current_val), float(prev_val))
        if chg is None:
            continue
        if abs(chg) >= spike_threshold:
            severity = "red" if abs(chg) >= spike_threshold * 2 else "yellow"
            alert = {
                "alert_type": "anomaly",
                "severity": severity,
                "title": f"Unusual {label} Movement",
                "message": f"{label} moved {chg:+.1f}% month-over-month.",
                "explanation": (
                    f"A {chg:+.1f}% change in {label.lower()} exceeds normal volatility bands. "
                    "This may signal a structural shock or data revision."
                ),
                "indicator": field,
                "current_value": float(current_val),
                "previous_value": float(prev_val),
                "change_pct": chg,
            }
            alerts.append(alert)
            await _persist_alert(db, code, alert)

    return alerts


async def _persist_alert(db: AsyncSession, country_code: str, data: dict) -> None:
    existing = await db.execute(
        select(IntelligenceAlert)
        .where(
            IntelligenceAlert.country_code == country_code,
            IntelligenceAlert.alert_type == data["alert_type"],
            IntelligenceAlert.indicator == data.get("indicator"),
            IntelligenceAlert.is_active.is_(True),
        )
        .limit(1)
    )
    if existing.scalar_one_or_none():
        return
    db.add(IntelligenceAlert(
        country_code=country_code,
        alert_type=data["alert_type"],
        severity=data["severity"],
        title=data["title"],
        message=data["message"],
        explanation=data.get("explanation", ""),
        indicator=data.get("indicator"),
        current_value=data.get("current_value"),
        previous_value=data.get("previous_value"),
        change_pct=data.get("change_pct"),
    ))
    await db.flush()


# ── Early Warning System ─────────────────────────────────────────────────────

async def get_early_warnings(db: AsyncSession, country_code: str | None = None) -> dict:
    codes: list[str]
    if country_code:
        codes = [country_code.upper()]
    else:
        result = await db.execute(select(Country.code).limit(30))
        codes = [r[0] for r in result.all()]

    warnings: list[dict] = []
    for code in codes:
        risk = await compute_country_risk(db, code)
        health = await compute_economic_health(db, code)
        ref = COUNTRY_REFERENCE.get(code, {})

        checks = [
            ("high_inflation_risk", risk.inflation_risk, 70, "High Inflation Risk",
             "Inflation risk score exceeds critical threshold."),
            ("deflation_risk", risk.deflation_risk, 60, "Deflation Risk",
             "Deflation probability elevated — monitor demand indicators."),
            ("currency_collapse_risk", risk.currency_risk, 75, "Currency Collapse Risk",
             "Exchange rate volatility suggests currency stress."),
            ("interest_rate_shock", risk.investment_risk, 70, "Interest Rate Shock",
             "Restrictive rates may constrain credit and growth."),
            ("economic_instability", 100 - health["score"], 55, "Economic Instability",
             "Composite health index signals systemic weakness."),
        ]
        for alert_type, score, threshold, title, msg in checks:
            if score >= threshold:
                severity = "red" if score >= threshold + 15 else "yellow" if score >= threshold else "green"
                if severity == "green":
                    continue
                w = {
                    "country_code": code,
                    "country_name": ref.get("name", code),
                    "alert_type": alert_type,
                    "severity": severity,
                    "title": title,
                    "message": msg,
                    "score": round(score, 1),
                    "explanation": f"Risk score {score:.0f}/100 vs threshold {threshold}.",
                }
                warnings.append(w)
                await _persist_alert(db, code, {**w, "alert_type": f"early_warning_{alert_type}"})

    # Oil price shock (global)
    oil_result = await db.execute(
        select(EconomicData.oil_price, EconomicData.data_date)
        .where(EconomicData.oil_price.isnot(None))
        .order_by(desc(EconomicData.data_date))
        .limit(4)
    )
    oil_rows = oil_result.all()
    if len(oil_rows) >= 2:
        chg = _pct_change(float(oil_rows[0][0]), float(oil_rows[1][0]))
        if chg and abs(chg) >= 5:
            warnings.append({
                "country_code": "GLOBAL",
                "country_name": "Global",
                "alert_type": "oil_price_shock",
                "severity": "red" if abs(chg) >= 10 else "yellow",
                "title": "Oil Price Shock",
                "message": f"Oil prices moved {chg:+.1f}% recently.",
                "score": abs(chg),
                "explanation": "Energy price shocks transmit to transport and food inflation globally.",
            })

    by_severity = {"green": 0, "yellow": 0, "red": 0}
    for w in warnings:
        by_severity[w["severity"]] = by_severity.get(w["severity"], 0) + 1

    return {"warnings": warnings, "summary": by_severity, "total": len(warnings)}


# ── Country Similarity ────────────────────────────────────────────────────────

async def get_similar_countries(db: AsyncSession, country_code: str, limit: int = 5) -> dict:
    code = country_code.upper()
    profiles = await load_macro_profiles(db)
    target = profiles.get(code)
    if not target:
        return {"country_code": code, "similar": [], "method": "economic_indicators"}

    target_vec = np.array(macro_feature_vector(target))
    scores: list[dict] = []

    for other_code, profile in profiles.items():
        if other_code == code:
            continue
        vec = np.array(macro_feature_vector(profile))
        dist = float(np.linalg.norm(target_vec - vec))
        max_dist = float(np.linalg.norm(target_vec)) + float(np.linalg.norm(vec)) or 1
        similarity = max(0, round((1 - dist / max_dist) * 100, 1))
        if similarity < 35:
            continue
        common = [
            INDICATOR_LABELS.get(f, f.replace("_", " ").title())
            for f in ("inflation_rate", "gdp_growth", "interest_rate", "unemployment_rate")
        ]
        scores.append({
            "country_code": other_code,
            "country_name": profile["country_name"],
            "similarity_pct": similarity,
            "common_indicators": common,
            "trend_alignment": "similar" if similarity >= 70 else "moderate",
            "data_source": profile.get("data_source"),
        })

    scores.sort(key=lambda x: x["similarity_pct"], reverse=True)
    return {"country_code": code, "similar": scores[:limit], "method": "macro_profile_similarity", "total_compared": len(profiles)}


# ── Global Inflation Map ──────────────────────────────────────────────────────

async def get_inflation_map(
    db: AsyncSession,
    year: int | None = None,
    continent: str | None = None,
    indicator: str = "inflation_level",
    horizon: int = 6,
) -> dict:
    profiles = await load_macro_profiles(db)
    entries: list[dict] = []

    for code, profile in sorted(profiles.items(), key=lambda x: x[1]["country_name"]):
        if continent and profile.get("continent"):
            if continent.lower() not in str(profile["continent"]).lower():
                continue

        inflation = profile["inflation_rate"]
        if indicator == "deflation_risk":
            value = max(0, (3 - inflation) * 20) if inflation < 3 else 0
            color_value = value
        elif indicator == "economic_health":
            value = simplified_health_score(profile)
            color_value = value
        elif indicator == "currency_strength":
            value = profile.get("currency_strength", 50.0)
            color_value = float(value)
        else:
            value = inflation
            color_value = min(100, inflation * 3)

        entries.append({
            "country_code": code,
            "country_name": profile["country_name"],
            "continent": profile.get("continent"),
            "value": round(float(value), 2),
            "color_intensity": round(float(color_value), 1),
            "forecast_horizon": horizon,
            "year": year or date.today().year,
            "data_source": profile.get("data_source"),
            "cpi_source_label": profile.get("cpi_source_label"),
            "cpi_accuracy_score": profile.get("cpi_accuracy_score"),
            "has_live_data": profile.get("has_live_data", False),
        })

    live_count = sum(1 for e in entries if e.get("has_live_data"))

    return {
        "indicator": indicator,
        "year": year or date.today().year,
        "continent": continent,
        "horizon": horizon,
        "countries": entries,
        "total": len(entries),
        "live_data_count": live_count,
    }


# ── Backtesting Center ────────────────────────────────────────────────────────

async def run_backtest_center(
    db: AsyncSession,
    country_code: str | None,
    user_id: uuid.UUID | None = None,
    months: int = 24,
) -> dict:
    from ai.training.backtest import (
        BACKTEST_MODEL_VERSION,
        SUPPORTED_BACKTEST_COUNTRIES,
        compute_accuracy_from_records,
        run_all_backtest_records,
        run_backtest_records,
    )

    dashboard = await get_accuracy_dashboard(db, country_code)
    metrics = dashboard["overall_metrics"]
    records = dashboard["performance_history"]

    errors = [abs(r["predicted"] - r["actual"]) for r in records if "predicted" in r]
    error_dist = {
        "bins": ["0-1", "1-2", "2-5", "5+"],
        "counts": [
            sum(1 for e in errors if e < 1),
            sum(1 for e in errors if 1 <= e < 2),
            sum(1 for e in errors if 2 <= e < 5),
            sum(1 for e in errors if e >= 5),
        ],
    }

    forecast_errors = [
        {"period": r["period"], "country": r["country"],
         "predicted": r["predicted"], "actual": r["actual"],
         "error": round(abs(r["predicted"] - r["actual"]), 3)}
        for r in records
    ]

    session = BacktestSession(
        country_code=country_code.upper() if country_code else None,
        model_version=BACKTEST_MODEL_VERSION,
        metrics=metrics,
        records_count=len(records),
        monthly_report={"trends": dashboard["monthly_trends"]},
        error_distribution=error_dist,
        country_rankings=dashboard["country_rankings"],
        created_by=user_id,
    )
    db.add(session)
    await db.flush()

    return {
        "session_id": str(session.id),
        "metrics": {
            **metrics,
            "forecast_error": round(metrics.get("mae", 0), 3),
        },
        "accuracy_chart": dashboard["monthly_trends"],
        "error_distribution": error_dist,
        "country_rankings": dashboard["country_rankings"],
        "monthly_performance": dashboard["monthly_trends"],
        "predicted_vs_actual": forecast_errors[:50],
        "model_version": BACKTEST_MODEL_VERSION,
        "supported_countries": list(SUPPORTED_BACKTEST_COUNTRIES),
    }


# ── Data Lineage ──────────────────────────────────────────────────────────────

async def build_data_lineage(db: AsyncSession, country_code: str, input_params: dict) -> dict:
    from app.services.indicator_selection_service import (
        cpi_selection_from_data_selection,
        select_best_indicators,
    )

    code = country_code.upper()
    params = input_params or {}
    data_selection = params.get("_data_selection")
    if not data_selection:
        data_selection = await select_best_indicators(db, code)
    cpi_selection = params.get("_cpi_selection") or cpi_selection_from_data_selection(data_selection)

    indicators_used: list[str] = []
    missing = 0
    for key, val in params.items():
        if key.startswith("_"):
            continue
        indicators_used.append(key)
        if val is None:
            missing += 1

    selections = data_selection.get("selections", {})
    resolved = [
        {
            "indicator": ind,
            "value": sel.get("value"),
            "source": sel.get("source_label"),
            "source_key": sel.get("source"),
            "accuracy_score": sel.get("accuracy_score"),
            "observation_date": sel.get("observation_date"),
            "reason": sel.get("reason"),
        }
        for ind, sel in selections.items()
        if sel.get("value") is not None
    ]

    scores = [r["accuracy_score"] for r in resolved if r.get("accuracy_score") is not None]
    avg_accuracy = sum(scores) / len(scores) if scores else 50.0
    total = len(indicators_used) or 1
    quality = round(max(0, 100 - (missing / total) * 40), 1)
    quality = round(min(100, (quality + avg_accuracy) / 2), 1)

    source_apis = [
        {
            "name": r["source"],
            "source_key": r["source_key"],
            "status": "selected",
            "role": r["indicator"],
            "value": r["value"],
            "accuracy_score": r["accuracy_score"],
            "observation_date": r["observation_date"],
            "selection_reason": r["reason"],
        }
        for r in resolved
    ]

    return {
        "data_selection": data_selection,
        "cpi_selection": cpi_selection,
        "indicator_selections": resolved,
        "source_apis": source_apis,
        "sources_used": data_selection.get("sources_used", []),
        "selection_method": data_selection.get(
            "selection_method", "per_indicator_single_best_source"
        ),
        "indicators_used": indicators_used,
        "indicators_resolved": data_selection.get("indicators_resolved", len(resolved)),
        "retrieval_dates": {
            r["source"]: data_selection.get("selected_at", datetime.now(timezone.utc).isoformat())
            for r in resolved
            if r.get("source")
        },
        "data_quality_score": quality,
        "missing_values": missing,
        "preprocessing_steps": [
            "Auto-refresh stale API data before selection",
            "API-first per-indicator source selection",
            "Fallback to manual/estimates only when no API data exists",
            "Z-score normalization",
            "Attention-weighted feature selection",
        ],
        "country_code": code,
    }


# ── Model Versioning ──────────────────────────────────────────────────────────

async def list_model_versions(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(AIModel).order_by(desc(AIModel.created_at)))
    models = result.scalars().all()
    if not models:
        ckpt = Path(__file__).resolve().parents[2] / "models" / "best_model.pt"
        return [{
            "id": None,
            "name": "TS-Transformer",
            "version": "TS-Transformer-v3.0",
            "status": "active" if ckpt.exists() else "unavailable",
            "accuracy": None,
            "rmse": None,
            "mae": None,
            "hyperparams": {"d_model": 128, "nhead": 8, "num_layers": 4},
            "trained_at": None,
            "deployment_date": datetime.now(timezone.utc).isoformat() if ckpt.exists() else None,
            "dataset_used": "multi_country_panel",
            "can_rollback": False,
        }]

    return [
        {
            "id": str(m.id),
            "name": m.name,
            "version": m.version,
            "status": m.status.value if hasattr(m.status, "value") else str(m.status),
            "accuracy": m.accuracy,
            "rmse": m.rmse,
            "mae": m.mae,
            "hyperparams": m.hyperparams,
            "trained_at": m.trained_at.isoformat() if m.trained_at else None,
            "deployment_date": m.created_at.isoformat(),
            "dataset_used": m.hyperparams.get("dataset", "unknown"),
            "can_rollback": m.status != ModelStatus.ACTIVE,
        }
        for m in models
    ]


async def rollback_model_version(db: AsyncSession, model_id: uuid.UUID) -> dict:
    result = await db.execute(select(AIModel).where(AIModel.id == model_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Model version not found")
    if not target.model_path:
        raise HTTPException(status_code=400, detail="No model artifact path stored")

    await db.execute(
        select(AIModel).where(AIModel.status == ModelStatus.ACTIVE)
    )
    active_result = await db.execute(select(AIModel).where(AIModel.status == ModelStatus.ACTIVE))
    for m in active_result.scalars().all():
        m.status = ModelStatus.ARCHIVED
    target.status = ModelStatus.ACTIVE
    await db.flush()
    return {"status": "rolled_back", "active_version": target.version, "model_id": str(target.id)}


# ── Experiment Tracking ─────────────────────────────────────────────────────────

async def list_experiments(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ModelExperiment).order_by(desc(ModelExperiment.created_at)).limit(50))
    exps = result.scalars().all()
    if exps:
        return [_experiment_dict(e) for e in exps]

    training_result = await db.execute(
        select(ModelTraining).order_by(desc(ModelTraining.training_date)).limit(20)
    )
    trainings = training_result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": f"Training Run {t.model_version}",
            "model_version": t.model_version,
            "sequence_length": t.metrics.get("sequence_length"),
            "forecast_horizon": t.metrics.get("forecast_horizon"),
            "training_loss": t.metrics.get("train_loss"),
            "validation_loss": t.metrics.get("val_loss"),
            "epoch_count": t.epochs,
            "attention_config": t.metrics.get("attention", {}),
            "metrics": {"accuracy": t.accuracy, "rmse": t.rmse, "mae": t.mae},
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
            "is_deployed": t.status.value == "completed" if hasattr(t.status, "value") else False,
            "created_at": t.training_date.isoformat(),
        }
        for t in trainings
    ]


def _experiment_dict(e: ModelExperiment) -> dict:
    return {
        "id": str(e.id),
        "name": e.name,
        "model_version": e.model_version,
        "sequence_length": e.sequence_length,
        "forecast_horizon": e.forecast_horizon,
        "training_loss": e.training_loss,
        "validation_loss": e.validation_loss,
        "epoch_count": e.epoch_count,
        "attention_config": e.attention_config,
        "hyperparameters": e.hyperparameters,
        "metrics": e.metrics,
        "status": e.status,
        "is_deployed": e.is_deployed,
        "created_at": e.created_at.isoformat(),
    }


async def compare_experiments(db: AsyncSession, experiment_ids: list[uuid.UUID]) -> dict:
    result = await db.execute(
        select(ModelExperiment).where(ModelExperiment.id.in_(experiment_ids))
    )
    exps = [_experiment_dict(e) for e in result.scalars().all()]
    return {"experiments": exps, "comparison": {
        "best_validation_loss": min((e["validation_loss"] for e in exps if e["validation_loss"]), default=None),
        "best_rmse": min((e["metrics"].get("rmse") for e in exps if e["metrics"].get("rmse")), default=None),
    }}


# ── Recommendations ───────────────────────────────────────────────────────────

async def get_recommendations(
    db: AsyncSession,
    country_code: str,
    risk_level: str | None = None,
    forecast_horizon: int = 6,
) -> list[dict]:
    code = country_code.upper()
    regime = await detect_economic_regime(db, code)
    risk = await compute_country_risk(db, code)
    ref = COUNTRY_REFERENCE.get(code, {})
    level = risk_level or risk.overall_risk_label

    recs: list[dict] = []
    if regime["regime"] in ("high_inflation", "hyperinflation", "stagflation"):
        recs.append({
            "category": "spending",
            "priority": "high",
            "message": "Reduce unnecessary spending and strengthen emergency savings.",
            "rationale": f"Inflation at elevated levels in {ref.get('name', code)}.",
        })
    elif regime["regime"] in ("low_inflation", "moderate_inflation", "expansion"):
        recs.append({
            "category": "stability",
            "priority": "low",
            "message": "Purchasing power remains relatively stable.",
            "rationale": "Price growth is within manageable bounds.",
        })
    elif regime["regime"] == "deflationary":
        recs.append({
            "category": "opportunity",
            "priority": "medium",
            "message": "Lower prices may improve purchasing power in the near term.",
            "rationale": "Deflationary conditions can benefit cash holders short-term.",
        })

    if risk.deflation_risk > 50:
        recs.append({
            "category": "deflation",
            "priority": "medium",
            "message": "Monitor for falling prices that could signal weak demand.",
            "rationale": f"Deflation risk score: {risk.deflation_risk:.0f}/100.",
        })
    if risk.currency_risk > 60:
        recs.append({
            "category": "currency",
            "priority": "high",
            "message": "Currency volatility may increase import costs — consider hedging exposure.",
            "rationale": f"Currency risk score: {risk.currency_risk:.0f}/100.",
        })

    recs.append({
        "category": "horizon",
        "priority": "info",
        "message": f"Forecast horizon: {forecast_horizon} months. Review quarterly for updates.",
        "rationale": f"Risk classification: {level}.",
    })
    return recs


# ── Offline Resilience ────────────────────────────────────────────────────────

async def check_data_resilience(db: AsyncSession, country_code: str) -> dict:
    code = country_code.upper()
    warnings: list[str] = []
    using_cache = False

    try:
        from app.services import news_service
        health = await news_service.get_health(db)
        if health.using_cached_data:
            using_cache = True
            warnings.append("News feed using cached articles — live API unavailable.")
    except Exception:
        warnings.append("News service status unavailable.")

    econ = await _latest_econ(db, code)
    if econ:
        age_days = (date.today() - econ.data_date).days if hasattr(econ.data_date, "day") else 0
        if age_days > 60:
            using_cache = True
            warnings.append(f"Economic data last updated {age_days} days ago — using cached values.")
    else:
        using_cache = True
        warnings.append("No live economic data — predictions use reference baselines.")

    return {
        "country_code": code,
        "using_cached_data": using_cache,
        "can_generate_predictions": True,
        "warnings": warnings,
        "status": "degraded" if using_cache else "live",
    }


# ── Forecast Archive ──────────────────────────────────────────────────────────

async def archive_forecast(db: AsyncSession, prediction: Prediction) -> ForecastArchive:
    archive = ForecastArchive(
        prediction_id=prediction.id,
        country_code=prediction.country_code,
        inflation_rate=prediction.inflation_rate,
        confidence_score=prediction.confidence_score,
        reliability_score=prediction.reliability_score,
        forecast_horizon=prediction.forecast_horizon,
        input_snapshot=prediction.input_params or {},
        output_snapshot=prediction.output_data or {},
        model_version=(prediction.output_data or {}).get("model_version", "TS-Transformer-v3"),
    )
    db.add(archive)
    await db.flush()
    return archive


async def get_forecast_archive(
    db: AsyncSession,
    country_code: str,
    limit: int = 20,
) -> dict:
    code = country_code.upper()
    result = await db.execute(
        select(ForecastArchive)
        .where(ForecastArchive.country_code == code)
        .order_by(desc(ForecastArchive.archived_at))
        .limit(limit)
    )
    archives = result.scalars().all()

    trend = [
        {"date": a.archived_at.isoformat(), "inflation_rate": a.inflation_rate,
         "reliability_score": a.reliability_score}
        for a in reversed(archives)
    ]

    current_pred = await db.execute(
        select(Prediction)
        .where(Prediction.country_code == code)
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    current = current_pred.scalar_one_or_none()

    return {
        "country_code": code,
        "archives": [
            {
                "id": str(a.id),
                "prediction_id": str(a.prediction_id),
                "inflation_rate": a.inflation_rate,
                "confidence_score": a.confidence_score,
                "reliability_score": a.reliability_score,
                "forecast_horizon": a.forecast_horizon,
                "model_version": a.model_version,
                "archived_at": a.archived_at.isoformat(),
            }
            for a in archives
        ],
        "trend_analysis": trend,
        "current_forecast": {
            "inflation_rate": current.inflation_rate,
            "created_at": current.created_at.isoformat(),
        } if current else None,
        "comparison": {
            "archive_count": len(archives),
            "avg_inflation": round(float(np.mean([a.inflation_rate for a in archives])), 2) if archives else None,
        },
    }


# ── AI Economic Storytelling ──────────────────────────────────────────────────

async def generate_narrative(
    db: AsyncSession,
    country_code: str,
    inflation_rate: float,
    trend: str,
    confidence: float,
    explainability: dict | None = None,
) -> str:
    code = country_code.upper()
    ref = COUNTRY_REFERENCE.get(code, {})
    name = ref.get("name", code)
    regime = await detect_economic_regime(db, code)
    changes = await get_forecast_changes(db, code)

    drivers: list[str] = []
    if explainability:
        for f in explainability.get("feature_importance", [])[:3]:
            drivers.append(f.get("feature", "").replace("_", " "))
    for ch in changes.get("changes", [])[:2]:
        drivers.append(f"{ch['label']} ({ch['change_pct']:+.1f}%)")

    driver_text = ", ".join(drivers) if drivers else "macroeconomic fundamentals"
    trend_word = {"up": "rise", "down": "ease", "stable": "remain broadly stable"}.get(trend, "shift")
    conf_pct = confidence if confidence > 1 else confidence * 100

    narrative = (
        f"Inflation in {name} is expected to {trend_word} over the next several months. "
        f"{driver_text.capitalize()} remain the primary drivers. "
        f"The economy is classified as {regime['regime_label']} — {regime['explanation']} "
        f"Model confidence stands at {conf_pct:.0f}%."
    )
    return narrative


# ── Auto Insights ─────────────────────────────────────────────────────────────

async def generate_page_insights(db: AsyncSession, country_code: str, page: str = "overview") -> dict:
    code = country_code.upper()
    regime = await detect_economic_regime(db, code)
    risk = await compute_country_risk(db, code)
    health = await compute_economic_health(db, code)
    changes = await get_forecast_changes(db, code)
    warnings = await get_early_warnings(db, code)

    top_warning = warnings["warnings"][0] if warnings["warnings"] else None
    top_change = changes["changes"][0] if changes.get("changes") else None

    trend_dir = "rising" if changes.get("forecast_delta", 0) and changes["forecast_delta"] > 0 else (
        "falling" if changes.get("forecast_delta", 0) and changes["forecast_delta"] < 0 else "stable"
    )

    return {
        "page": page,
        "country_code": code,
        "key_insight": (
            f"{regime['regime_label']} regime with health index {health['score']:.0f}/100."
        ),
        "biggest_risk": top_warning["title"] if top_warning else risk.factors[0] if risk.factors else "Moderate macro risk",
        "biggest_opportunity": (
            "Stable purchasing power" if regime["regime"] in ("low_inflation", "expansion")
            else "Policy response may anchor expectations"
        ),
        "trend_direction": trend_dir,
        "confidence_level": "high" if health["score"] >= 65 else "moderate" if health["score"] >= 45 else "low",
        "highlight_change": top_change,
    }


# ── Natural Language Query ────────────────────────────────────────────────────

async def answer_natural_language(
    db: AsyncSession,
    question: str,
    country_code: str,
) -> dict:
    code = country_code.upper()
    q = question.lower().strip()
    ref = COUNTRY_REFERENCE.get(code, {})
    name = ref.get("name", code)

    pred_result = await db.execute(
        select(Prediction)
        .where(Prediction.country_code == code)
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    pred = pred_result.scalar_one_or_none()

    if "oil" in q:
        answer = (
            "Oil prices transmit to inflation through fuel, transport, and food supply chains. "
            "The TS-Transformer model weights oil_price as a leading indicator in attention layers. "
            "A 10% oil increase typically adds 0.3–0.5% to headline inflation over 3–6 months."
        )
        sources = ["economic_theory", "model_features"]
    elif "similar" in q:
        sim = await get_similar_countries(db, code)
        names = [f"{s['country_name']} ({s['similarity_pct']}%)" for s in sim["similar"][:3]]
        answer = f"Economies most similar to {name}: {', '.join(names) or 'insufficient data for comparison'}."
        sources = ["similarity_engine"]
    elif any(w in q for w in ("caused", "latest", "prediction", "forecast")):
        if pred:
            answer = pred.narrative or pred.ai_summary or f"Latest forecast: {pred.inflation_rate:.2f}% inflation, {pred.trend_direction} trend."
        else:
            answer = f"No recent forecast available for {name}. Run a new prediction to generate analysis."
        sources = ["latest_prediction", "explainability"]
    elif any(w in q for w in ("why", "increasing", "rising")) or ("inflation" in q and "oil" not in q):
        changes = await get_forecast_changes(db, code)
        regime = await detect_economic_regime(db, code)
        drivers = [f"{c['label']}: {c['change_pct']:+.1f}% (expected inflation impact: {c['impact_on_inflation_pct']:+.1f}%)" for c in changes.get("changes", [])[:4]]
        answer = (
            f"Inflation in {name} is influenced by {regime['regime_label'].lower()} conditions. "
            + ("Key movers: " + "; ".join(drivers) + "." if drivers else regime["explanation"])
        )
        sources = ["forecast_diff", "regime_detection", "economic_data"]
    else:
        health = await compute_economic_health(db, code)
        answer = (
            f"{name} economic health: {health['score']:.0f}/100 ({health['label']}). "
            f"{health['ai_summary']}"
        )
        sources = ["economic_health", "risk_scores"]

    return {
        "question": question,
        "answer": answer,
        "country_code": code,
        "sources": sources,
        "confidence": pred.confidence_score if pred else 0.7,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Explainability PDF ────────────────────────────────────────────────────────

async def generate_explainability_pdf(
    db: AsyncSession,
    prediction_id: uuid.UUID,
) -> bytes:
    result = await db.execute(select(Prediction).where(Prediction.id == prediction_id))
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    ref = COUNTRY_REFERENCE.get(pred.country_code, {})
    explain = pred.explainability or {}
    lineage = pred.data_lineage or await build_data_lineage(db, pred.country_code, pred.input_params)
    changes = await get_forecast_changes(db, pred.country_code)
    regime = await detect_economic_regime(db, pred.country_code)
    reliability = {"reliability_score": pred.reliability_score, "reliability_level": pred.reliability_level}
    if not pred.reliability_score:
        reliability = await compute_reliability(db, pred.country_code, pred.confidence_score)

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = [
        Paragraph("Velora Forecast Explainability Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"<b>Country:</b> {ref.get('name', pred.country_code)}", styles["Normal"]),
        Paragraph(f"<b>Forecast:</b> {pred.inflation_rate:.2f}% inflation ({pred.trend_direction})", styles["Normal"]),
        Paragraph(f"<b>Reliability:</b> {reliability.get('reliability_score', 'N/A')} ({reliability.get('reliability_level', '')})", styles["Normal"]),
        Paragraph(f"<b>Regime:</b> {regime['regime_label']}", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("<b>Why the forecast changed</b>", styles["Heading2"]),
        Paragraph(pred.narrative or explain.get("prediction_explanation", "No narrative available."), styles["Normal"]),
        Spacer(1, 12),
        Paragraph("<b>Indicator Changes</b>", styles["Heading2"]),
    ]
    for ch in changes.get("changes", [])[:5]:
        story.append(Paragraph(
            f"• {ch['label']}: {ch['change_pct']:+.1f}% (impact: {ch['impact_on_inflation_pct']:+.1f}%)",
            styles["Normal"],
        ))
    story.extend([
        Spacer(1, 12),
        Paragraph("<b>Attention Weights (Top Features)</b>", styles["Heading2"]),
    ])
    for f in explain.get("feature_importance", [])[:8]:
        story.append(Paragraph(
            f"• {f.get('feature', '')}: {f.get('importance', 0):.3f} ({f.get('direction', '')})",
            styles["Normal"],
        ))
    story.extend([
        Spacer(1, 12),
        Paragraph("<b>Data Lineage</b>", styles["Heading2"]),
        Paragraph(f"Quality score: {lineage.get('data_quality_score', 'N/A')}. Missing values: {lineage.get('missing_values', 0)}.", styles["Normal"]),
        Paragraph(f"Sources: {', '.join(s['name'] for s in lineage.get('source_apis', []))}.", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("<b>Confidence Intervals</b>", styles["Heading2"]),
        Paragraph(str(pred.confidence_bands or explain.get("confidence_bands", {})), styles["Normal"]),
    ])
    doc.build(story)
    buffer.seek(0)
    return buffer.read()


# ── Intelligence Hub (orchestrator) ─────────────────────────────────────────

async def get_intelligence_hub(
    db: AsyncSession,
    country_code: str,
    include_admin: bool = False,
) -> dict:
    code = country_code.upper()

    results = await asyncio.gather(
        get_forecast_changes(db, code),
        detect_economic_regime(db, code),
        detect_anomalies(db, code),
        get_early_warnings(db, code),
        get_similar_countries(db, code),
        get_recommendations(db, code),
        check_data_resilience(db, code),
        get_forecast_archive(db, code, limit=10),
        generate_page_insights(db, code),
        compute_economic_health(db, code),
        return_exceptions=True,
    )

    def _safe(idx: int, default):
        r = results[idx]
        return default if isinstance(r, Exception) else r

    from app.services.indicator_selection_service import (
        cpi_selection_from_data_selection,
        select_best_indicators,
    )

    data_selection = await select_best_indicators(db, code)
    cpi_selection = cpi_selection_from_data_selection(data_selection)

    hub = {
        "country_code": code,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_selection": data_selection,
        "cpi_selection": cpi_selection,
        "forecast_changes": _safe(0, {}),
        "regime": _safe(1, {}),
        "anomalies": _safe(2, []),
        "early_warnings": _safe(3, {"warnings": [], "summary": {}}),
        "similar_countries": _safe(4, {"similar": []}),
        "recommendations": _safe(5, []),
        "resilience": _safe(6, {}),
        "forecast_archive": _safe(7, {}),
        "insights": _safe(8, {}),
        "economic_health": _safe(9, {}),
    }

    pred_result = await db.execute(
        select(Prediction)
        .where(Prediction.country_code == code)
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    pred = pred_result.scalar_one_or_none()
    if pred:
        hub["latest_forecast"] = {
            "prediction_id": str(pred.id),
            "inflation_rate": pred.inflation_rate,
            "reliability_score": pred.reliability_score,
            "reliability_level": pred.reliability_level,
            "narrative": pred.narrative,
            "using_cached_data": pred.using_cached_data,
            "data_lineage": pred.data_lineage,
        }

    if include_admin:
        hub["model_versions"] = await list_model_versions(db)
        hub["experiments"] = await list_experiments(db)

    return hub


async def enrich_prediction(db: AsyncSession, prediction: Prediction) -> None:
    """Attach intelligence metadata to a newly created prediction."""
    lineage = await build_data_lineage(db, prediction.country_code, prediction.input_params)
    resilience = await check_data_resilience(db, prediction.country_code)
    reliability = await compute_reliability(
        db, prediction.country_code, prediction.confidence_score,
        data_quality=lineage["data_quality_score"],
    )
    regime = await detect_economic_regime(db, prediction.country_code)
    narrative = await generate_narrative(
        db, prediction.country_code,
        prediction.inflation_rate, prediction.trend_direction,
        prediction.confidence_score, prediction.explainability,
    )

    prediction.data_lineage = lineage
    prediction.reliability_score = reliability["reliability_score"]
    prediction.reliability_level = reliability["reliability_level"]
    prediction.economic_regime = regime["regime"]
    prediction.narrative = narrative
    prediction.using_cached_data = resilience["using_cached_data"]
    if not prediction.ai_summary:
        prediction.ai_summary = narrative

    await archive_forecast(db, prediction)
    await db.flush()