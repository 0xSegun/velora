"""
Intelligence platform schemas — events, risk, explainability, scenarios.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Economic Events ──────────────────────────────────────────────────────────

class EconomicEventCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    country: str = Field(..., min_length=2, max_length=10)
    category: str
    event_date: date
    severity_score: float = Field(default=5.0, ge=0, le=10)
    economic_impact_score: float = Field(default=5.0, ge=0, le=10)
    description: str = ""


class EconomicEventUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    event_date: date | None = None
    severity_score: float | None = Field(default=None, ge=0, le=10)
    economic_impact_score: float | None = Field(default=None, ge=0, le=10)
    description: str | None = None


class EconomicEventResponse(BaseModel):
    id: uuid.UUID
    title: str
    country: str
    category: str
    event_date: date
    severity_score: float
    economic_impact_score: float
    description: str
    created_at: datetime
    model_config = {"from_attributes": True}


class EconomicEventList(BaseModel):
    events: list[EconomicEventResponse]
    total: int
    page: int
    per_page: int


# ── Explainability ───────────────────────────────────────────────────────────

class FeatureImportanceItem(BaseModel):
    rank: int
    feature: str
    key: str
    importance: float
    direction: str


class ExplainabilityResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    prediction_id: uuid.UUID | None = None
    attention_heatmap: list[list[float]] = []
    feature_importance: list[FeatureImportanceItem] = []
    prediction_explanation: str = ""
    confidence_analysis: dict = {}
    economic_interpretation: str = ""
    model_version: str = "TS-Transformer-v3.0"


# ── Multi-Horizon ────────────────────────────────────────────────────────────

class HorizonForecast(BaseModel):
    horizon_months: int
    predicted_value: float
    confidence_score: float
    trend_direction: str
    confidence_interval: dict
    best_case: float
    expected_case: float
    worst_case: float
    target_date: str


class MultiHorizonResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    country_code: str
    horizons: list[HorizonForecast]
    model_version: str


# ── Accuracy ─────────────────────────────────────────────────────────────────

class AccuracyMetrics(BaseModel):
    rmse: float | None
    mae: float | None
    mape: float | None
    r2_score: float | None


class AccuracyRecordResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    country_code: str
    period_date: date
    predicted_value: float
    actual_value: float
    metrics: AccuracyMetrics
    model_version: str


class AccuracyDashboard(BaseModel):
    overall_metrics: AccuracyMetrics
    monthly_trends: list[dict]
    country_rankings: list[dict]
    performance_history: list[dict]
    alerts: list[dict] = []


# ── Scenarios ────────────────────────────────────────────────────────────────

class ScenarioRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    name: str = "Custom Scenario"
    overrides: dict[str, float] = Field(default_factory=dict)


class ScenarioResponse(BaseModel):
    id: uuid.UUID
    country_code: str
    name: str
    baseline_forecast: float
    scenario_forecast: float
    forecast_difference: float
    impact_summary: str
    risk_assessment: dict
    confidence_bands: dict
    created_at: datetime


# ── Data Quality ─────────────────────────────────────────────────────────────

class DataQualityIssue(BaseModel):
    type: str
    severity: str
    count: int
    description: str
    recommendation: str


class DataQualityReportResponse(BaseModel):
    dataset_id: uuid.UUID | None
    quality_score: float
    issues: list[DataQualityIssue]
    recommendations: list[str]
    auto_cleaned: bool = False


# ── Country Risk ─────────────────────────────────────────────────────────────

class CountryRiskResponse(BaseModel):
    country_code: str
    country_name: str
    inflation_risk: float
    deflation_risk: float
    economic_stability: float
    currency_risk: float
    investment_risk: float
    overall_risk_label: str
    ai_summary: str
    factors: list[str]
    computed_at: datetime


class CountryRiskList(BaseModel):
    countries: list[CountryRiskResponse]
    global_average: dict


# ── Economic Health Index ────────────────────────────────────────────────────

class EconomicHealthResponse(BaseModel):
    country_code: str
    score: float
    label: str
    components: list[dict]
    ai_summary: str
    computed_at: datetime


# ── News & Sentiment ─────────────────────────────────────────────────────────

class NewsItemResponse(BaseModel):
    id: uuid.UUID
    title: str
    country_code: str | None
    source: str
    url: str | None
    summary: str
    category: str
    sentiment: dict
    published_at: datetime


class SentimentResponse(BaseModel):
    country_code: str
    positive: float
    neutral: float
    negative: float
    dominant: str
    summary: str
    records_analyzed: int


# ── Research ─────────────────────────────────────────────────────────────────

class ResearchPublicationResponse(BaseModel):
    id: uuid.UUID
    title: str
    authors: str
    category: str
    abstract: str
    citation: str | None
    references: list
    tags: list
    pdf_path: str | None
    published_at: datetime


class ResearchList(BaseModel):
    publications: list[ResearchPublicationResponse]
    total: int


# ── Settings ─────────────────────────────────────────────────────────────────

class IntelligenceSettingsUpdate(BaseModel):
    accuracy_threshold: float | None = Field(default=None, ge=0, le=100)
    auto_retrain_enabled: bool | None = None
    retrain_schedule_hours: int | None = Field(default=None, ge=1, le=720)
    news_api_enabled: bool | None = None
    sentiment_weight: float | None = Field(default=None, ge=0, le=1)
    event_impact_weight: float | None = Field(default=None, ge=0, le=1)


class RetrainingRecommendationResponse(BaseModel):
    id: uuid.UUID
    trigger_reason: str
    priority: str
    message: str
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}