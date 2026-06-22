"""
Intelligence platform API — events, explainability, risk, scenarios, accuracy, research.
"""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.intelligence import (
    EconomicEventCreate,
    EconomicEventList,
    EconomicEventResponse,
    EconomicEventUpdate,
    ExplainabilityResponse,
    MultiHorizonResponse,
    ScenarioRequest,
    ScenarioResponse,
)
from app.schemas.wikipedia_api import CountryContextResponse
from app.services import economic_events_service, intelligence_service
from app.services import intelligence_platform_service as platform
from app.services.prediction_service import get_explainability_for_prediction
from app.utils.security import get_current_user, require_admin, require_analyst

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])
admin_router = APIRouter(prefix="/api/admin/intelligence", tags=["Admin Intelligence"])


# ── Economic Events (public read, admin write) ───────────────────────────────

@router.get("/events", response_model=EconomicEventList)
async def list_events(
    country: str | None = None,
    category: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    data = await economic_events_service.list_events(
        db, country=country, category=category, search=search,
        date_from=date_from, date_to=date_to, page=page, per_page=per_page,
    )
    return EconomicEventList(
        events=[EconomicEventResponse.model_validate(e) for e in data["events"]],
        total=data["total"], page=data["page"], per_page=data["per_page"],
    )


@router.get("/events/timeline/{country_code}")
async def event_timeline(
    country_code: str,
    months: int = Query(24, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await economic_events_service.get_timeline(db, country_code, months)


@router.get("/events/{event_id}", response_model=EconomicEventResponse)
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    event = await economic_events_service.get_event(db, event_id)
    return EconomicEventResponse.model_validate(event)


# ── Explainability ───────────────────────────────────────────────────────────

@router.get("/explainability/{prediction_id}", response_model=ExplainabilityResponse)
async def get_explainability(
    prediction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_explainability_for_prediction(db, prediction_id, user)


# ── Multi-Horizon ────────────────────────────────────────────────────────────

@router.get("/multi-horizon/{country_code}", response_model=MultiHorizonResponse)
async def get_multi_horizon(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.services.prediction_service import get_multi_horizon_forecast
    return await get_multi_horizon_forecast(db, country_code)


# ── Accuracy ─────────────────────────────────────────────────────────────────

@router.get("/accuracy")
async def accuracy_dashboard(
    country_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.get_accuracy_dashboard(db, country_code)


# ── Scenarios ────────────────────────────────────────────────────────────────

@router.post("/scenarios", response_model=ScenarioResponse)
async def create_scenario(
    payload: ScenarioRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fs = await intelligence_service.run_scenario(
        db, user, payload.country_code, payload.overrides, payload.name
    )
    return ScenarioResponse(
        id=fs.id,
        country_code=fs.country_code,
        name=fs.name,
        baseline_forecast=fs.baseline_forecast,
        scenario_forecast=fs.scenario_forecast,
        forecast_difference=fs.forecast_difference,
        impact_summary=fs.impact_summary,
        risk_assessment=fs.risk_assessment,
        confidence_bands={},
        created_at=fs.created_at,
    )


@router.get("/scenarios")
async def list_scenarios(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import desc, select
    from app.models.intelligence import ForecastScenario
    result = await db.execute(
        select(ForecastScenario)
        .where(ForecastScenario.user_id == user.id)
        .order_by(desc(ForecastScenario.created_at))
        .limit(20)
    )
    return [
        {
            "id": str(s.id),
            "country_code": s.country_code,
            "name": s.name,
            "baseline_forecast": s.baseline_forecast,
            "scenario_forecast": s.scenario_forecast,
            "forecast_difference": s.forecast_difference,
            "created_at": s.created_at.isoformat(),
        }
        for s in result.scalars().all()
    ]


# ── Risk & Health ────────────────────────────────────────────────────────────

@router.get("/risk")
async def country_risks(
    codes: str | None = Query(None, description="Comma-separated country codes"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    code_list = [c.strip() for c in codes.split(",")] if codes else None
    return await intelligence_service.get_country_risks(db, code_list)


@router.get("/risk/{country_code}")
async def country_risk(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    score = await intelligence_service.compute_country_risk(db, country_code)
    from app.services.country_service import COUNTRY_REFERENCE
    ref = COUNTRY_REFERENCE.get(country_code.upper(), {})
    return {
        "country_code": score.country_code,
        "country_name": ref.get("name", country_code),
        "inflation_risk": score.inflation_risk,
        "deflation_risk": score.deflation_risk,
        "economic_stability": score.economic_stability,
        "currency_risk": score.currency_risk,
        "investment_risk": score.investment_risk,
        "overall_risk_label": score.overall_risk_label,
        "ai_summary": score.ai_summary,
        "factors": score.factors,
        "computed_at": score.computed_at,
    }


@router.get("/health/{country_code}")
async def economic_health(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.compute_economic_health(db, country_code)


# ── Country Context (IMF + Wikipedia) ────────────────────────────────────────

@router.get("/country-context/{country_code}", response_model=CountryContextResponse)
async def get_country_context(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.get_country_context(db, country_code)


# ── News & Sentiment ─────────────────────────────────────────────────────────

@router.get("/news/status")
async def news_feed_status(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.services import news_service
    health = await news_service.get_health(db)
    return {
        "live_feed_enabled": health.is_active,
        "provider": health.provider,
        "status": health.status,
        "last_sync": health.last_sync.isoformat() if health.last_sync else None,
        "articles_retrieved": health.articles_retrieved,
        "using_cached_data": health.using_cached_data,
    }


@router.get("/news")
async def economic_news(
    country_code: str | None = None,
    category: str | None = None,
    source: str | None = None,
    topic: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(20, ge=1, le=50),
    country_priority: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    active_country = (country_code or user.country or "NG").upper()
    items = await intelligence_service.get_news(
        db,
        active_country,
        category,
        source,
        topic,
        search,
        date_from,
        date_to,
        limit,
        tracked_countries=user.tracked_countries or [],
        country_priority=country_priority,
    )
    from app.services.country_priority_service import build_priority_tiers

    return {
        "items": items,
        "total": len(items),
        "country_code": active_country,
        "priority_tiers": build_priority_tiers(active_country, user.tracked_countries or []),
    }


@router.get("/news/{article_id}")
async def get_news_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.get_news_by_id(db, article_id)


@router.get("/sentiment/{country_code}")
async def sentiment_analysis(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.get_sentiment(db, country_code)


# ── Advanced Indicators ────────────────────────────────────────────────────────

@router.get("/indicators/{country_code}")
async def advanced_indicators(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.get_advanced_indicators(db, country_code)


# ── Research ─────────────────────────────────────────────────────────────────

@router.get("/research")
async def research_publications(
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await intelligence_service.list_publications(db, category, search)


@router.get("/research/{pub_id}")
async def research_detail(
    pub_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    pub = await intelligence_service.get_publication(db, pub_id)
    return {
        "id": str(pub.id),
        "title": pub.title,
        "authors": pub.authors,
        "category": pub.category,
        "abstract": pub.abstract,
        "content": pub.content,
        "citation": pub.citation,
        "references": pub.references,
        "tags": pub.tags,
        "pdf_path": pub.pdf_path,
        "published_at": pub.published_at.isoformat(),
    }


# ── Intelligence Hub (Final Layer) ───────────────────────────────────────────

@router.get("/hub/{country_code}")
async def intelligence_hub(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    include_admin = role in ("admin", "analyst")
    return await platform.get_intelligence_hub(db, country_code, include_admin=include_admin)


@router.get("/reliability/{country_code}")
async def forecast_reliability(
    country_code: str,
    confidence: float = Query(0.75, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.compute_reliability(db, country_code, confidence)


@router.get("/changes/{country_code}")
async def forecast_changes(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_forecast_changes(db, country_code)


@router.get("/regime/{country_code}")
async def economic_regime(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.detect_economic_regime(db, country_code)


@router.get("/anomalies/{country_code}")
async def economic_anomalies(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.detect_anomalies(db, country_code)


@router.get("/warnings")
async def early_warnings(
    country_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_early_warnings(db, country_code)


@router.get("/similarity/{country_code}")
async def country_similarity(
    country_code: str,
    limit: int = Query(5, ge=1, le=15),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_similar_countries(db, country_code, limit)


@router.get("/data-selection/{country_code}")
async def data_selection(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.services.indicator_selection_service import select_best_indicators

    return await select_best_indicators(db, country_code)


@router.get("/cpi-selection/{country_code}")
async def cpi_selection(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.services.cpi_selection_service import select_best_cpi

    return await select_best_cpi(db, country_code)


@router.get("/inflation-map")
async def global_inflation_map(
    year: int | None = None,
    continent: str | None = None,
    indicator: str = Query("inflation_level"),
    horizon: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_inflation_map(db, year, continent, indicator, horizon)


@router.get("/backtest")
async def backtest_center(
    country_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_analyst),
):
    return await platform.run_backtest_center(db, country_code, user.id)


@router.get("/lineage/{prediction_id}")
async def data_lineage(
    prediction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.prediction import Prediction
    result = await db.execute(select(Prediction).where(Prediction.id == prediction_id))
    pred = result.scalar_one_or_none()
    if not pred:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Prediction not found")
    if pred.data_lineage:
        return pred.data_lineage
    return await platform.build_data_lineage(db, pred.country_code, pred.input_params)


@router.get("/archive/{country_code}")
async def forecast_archive(
    country_code: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_forecast_archive(db, country_code, limit)


@router.get("/recommendations/{country_code}")
async def forecast_recommendations(
    country_code: str,
    risk_level: str | None = None,
    horizon: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.get_recommendations(db, country_code, risk_level, horizon)


@router.get("/resilience/{country_code}")
async def offline_resilience(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.check_data_resilience(db, country_code)


@router.get("/insights/{country_code}")
async def page_insights(
    country_code: str,
    page: str = Query("overview"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await platform.generate_page_insights(db, country_code, page)


@router.get("/narrative/{country_code}")
async def economic_narrative(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from sqlalchemy import select, desc
    from app.models.prediction import Prediction
    result = await db.execute(
        select(Prediction).where(Prediction.country_code == country_code.upper())
        .order_by(desc(Prediction.created_at)).limit(1)
    )
    pred = result.scalar_one_or_none()
    if pred and pred.narrative:
        return {"country_code": country_code.upper(), "narrative": pred.narrative}
    return {
        "country_code": country_code.upper(),
        "narrative": await platform.generate_narrative(
            db, country_code, pred.inflation_rate if pred else 8.0,
            pred.trend_direction if pred else "stable",
            pred.confidence_score if pred else 0.7,
            pred.explainability if pred else {},
        ),
    }


@router.post("/nlq")
async def natural_language_query(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = payload.get("question", "")
    country_code = payload.get("country_code") or user.country or "NG"
    if not question:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="question is required")
    return await platform.answer_natural_language(db, question, country_code)


@router.get("/explainability-pdf/{prediction_id}")
async def explainability_pdf(
    prediction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    pdf_bytes = await platform.generate_explainability_pdf(db, prediction_id)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=explainability_{prediction_id}.pdf"},
    )


@router.get("/models/versions")
async def model_versions(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_analyst),
):
    return await platform.list_model_versions(db)


@router.post("/models/rollback/{model_id}")
async def rollback_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await platform.rollback_model_version(db, model_id)


@router.get("/experiments")
async def list_experiments(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_analyst),
):
    return await platform.list_experiments(db)


@router.post("/experiments/compare")
async def compare_experiments(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_analyst),
):
    ids = [uuid.UUID(i) for i in payload.get("experiment_ids", [])]
    return await platform.compare_experiments(db, ids)


# ── Export ───────────────────────────────────────────────────────────────────

@router.get("/export/predictions/{country_code}")
async def export_predictions_csv(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.services.prediction_service import export_predictions_csv
    content = await export_predictions_csv(db, user, country_code)
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=predictions_{country_code}.csv"},
    )


# ── Admin endpoints ──────────────────────────────────────────────────────────

@admin_router.post("/events", response_model=EconomicEventResponse)
async def admin_create_event(
    payload: EconomicEventCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    event = await economic_events_service.create_event(db, payload)
    return EconomicEventResponse.model_validate(event)


@admin_router.put("/events/{event_id}", response_model=EconomicEventResponse)
async def admin_update_event(
    event_id: uuid.UUID,
    payload: EconomicEventUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    event = await economic_events_service.update_event(db, event_id, payload)
    return EconomicEventResponse.model_validate(event)


@admin_router.delete("/events/{event_id}", status_code=200)
async def admin_delete_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await economic_events_service.delete_event(db, event_id)
    return {"status": "deleted"}


@admin_router.post("/events/import")
async def admin_import_events(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await economic_events_service.import_events_csv(db, file)


@admin_router.get("/settings")
async def admin_get_settings(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await intelligence_service.get_settings(db)


@admin_router.put("/settings")
async def admin_update_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await intelligence_service.update_settings(db, payload)


@admin_router.get("/retraining")
async def admin_retraining_recommendations(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await intelligence_service.check_retraining_triggers(db)
    recs = await intelligence_service.get_retraining_recommendations(db)
    return [
        {
            "id": str(r.id),
            "trigger_reason": r.trigger_reason,
            "priority": r.priority,
            "message": r.message,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in recs
    ]


@admin_router.post("/datasets/{dataset_id}/quality-check")
async def admin_quality_check(
    dataset_id: uuid.UUID,
    auto_clean: bool = False,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await intelligence_service.inspect_dataset(db, dataset_id, auto_clean)


@admin_router.post("/research")
async def admin_create_publication(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.models.intelligence import ResearchPublication
    pub = ResearchPublication(
        title=payload["title"],
        authors=payload.get("authors", "Velora Research"),
        category=payload.get("category", "general"),
        abstract=payload.get("abstract", ""),
        content=payload.get("content"),
        citation=payload.get("citation"),
        references=payload.get("references", []),
        tags=payload.get("tags", []),
        pdf_path=payload.get("pdf_path"),
        published_at=datetime_from_payload(payload.get("published_at")),
    )
    db.add(pub)
    await db.flush()
    return {"id": str(pub.id), "title": pub.title}


def datetime_from_payload(val: str | None) -> datetime:
    if val:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)