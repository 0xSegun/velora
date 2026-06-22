"""
Intelligence platform ORM models — events, risk, news, accuracy, research.
"""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EventCategory(str, enum.Enum):
    INTEREST_RATE_DECISION = "interest_rate_decision"
    MONETARY_POLICY = "monetary_policy"
    EXCHANGE_RATE_POLICY = "exchange_rate_policy"
    FUEL_SUBSIDY = "fuel_subsidy"
    TAX_REFORM = "tax_reform"
    BUDGET_RELEASE = "budget_release"
    PUBLIC_SPENDING = "public_spending"
    TRADE_RESTRICTION = "trade_restriction"
    OIL_PRICE_SHOCK = "oil_price_shock"
    COMMODITY_SHOCK = "commodity_shock"
    GEOPOLITICAL_CONFLICT = "geopolitical_conflict"
    ELECTION = "election"
    RECESSION = "recession"
    PANDEMIC = "pandemic"
    NATURAL_DISASTER = "natural_disaster"


class EconomicEvent(Base):
    __tablename__ = "economic_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    country: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    severity_score: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    economic_impact_score: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class MultiHorizonForecast(Base):
    __tablename__ = "multi_horizon_forecasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    horizon_months: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_value: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    trend_direction: Mapped[str] = mapped_column(String(20), nullable=False)
    lower_bound: Mapped[float] = mapped_column(Float, nullable=False)
    upper_bound: Mapped[float] = mapped_column(Float, nullable=False)
    best_case: Mapped[float] = mapped_column(Float, nullable=False)
    expected_case: Mapped[float] = mapped_column(Float, nullable=False)
    worst_case: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class PredictionAccuracyRecord(Base):
    __tablename__ = "prediction_accuracy_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    period_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    predicted_value: Mapped[float] = mapped_column(Float, nullable=False)
    actual_value: Mapped[float] = mapped_column(Float, nullable=False)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    mape: Mapped[float | None] = mapped_column(Float, nullable=True)
    r2_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="TS-Transformer-v3")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class CountryRiskScore(Base):
    __tablename__ = "country_risk_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    inflation_risk: Mapped[float] = mapped_column(Float, nullable=False)
    deflation_risk: Mapped[float] = mapped_column(Float, nullable=False)
    economic_stability: Mapped[float] = mapped_column(Float, nullable=False)
    currency_risk: Mapped[float] = mapped_column(Float, nullable=False)
    investment_risk: Mapped[float] = mapped_column(Float, nullable=False)
    overall_risk_label: Mapped[str] = mapped_column(String(20), nullable=False)
    ai_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    factors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class EconomicNews(Base):
    __tablename__ = "economic_news"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    country_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(255), nullable=False, default="Velora")
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    sentiment_positive: Mapped[float] = mapped_column(Float, nullable=False, default=0.33)
    sentiment_neutral: Mapped[float] = mapped_column(Float, nullable=False, default=0.34)
    sentiment_negative: Mapped[float] = mapped_column(Float, nullable=False, default=0.33)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class SentimentRecord(Base):
    __tablename__ = "sentiment_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    positive_score: Mapped[float] = mapped_column(Float, nullable=False)
    neutral_score: Mapped[float] = mapped_column(Float, nullable=False)
    negative_score: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ResearchPublication(Base):
    __tablename__ = "research_publications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[str] = mapped_column(String(500), nullable=False, default="Velora Research")
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    abstract: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    citation: Mapped[str | None] = mapped_column(Text, nullable=True)
    references: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class DataQualityReport(Base):
    __tablename__ = "data_quality_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    issues: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    auto_cleaned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ForecastScenario(Base):
    __tablename__ = "forecast_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Custom Scenario")
    input_overrides: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    baseline_forecast: Mapped[float] = mapped_column(Float, nullable=False)
    scenario_forecast: Mapped[float] = mapped_column(Float, nullable=False)
    forecast_difference: Mapped[float] = mapped_column(Float, nullable=False)
    impact_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    risk_assessment: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class IntelligenceSetting(Base):
    __tablename__ = "intelligence_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class RetrainingRecommendation(Base):
    __tablename__ = "retraining_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trigger_reason: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    extra_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ForecastArchive(Base):
    __tablename__ = "forecast_archives"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    inflation_rate: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    reliability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    forecast_horizon: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    input_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    output_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="TS-Transformer-v3")
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class IntelligenceAlert(Base):
    __tablename__ = "intelligence_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    indicator: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    extra_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ModelExperiment(Base):
    __tablename__ = "model_experiments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    sequence_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forecast_horizon: Mapped[int | None] = mapped_column(Integer, nullable=True)
    training_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    validation_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    epoch_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attention_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    hyperparameters: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    dataset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    is_deployed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class BacktestSession(Base):
    __tablename__ = "backtest_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    records_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_report: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_distribution: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    country_rankings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )