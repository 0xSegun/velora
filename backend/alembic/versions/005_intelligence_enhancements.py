"""Intelligence platform enhancements — events, multi-horizon, accuracy, risk

Revision ID: 005_intelligence
Revises: 004_api_credentials
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005_intelligence"
down_revision = "004_api_credentials"
branch_labels = None
depends_on = None

EVENT_CATEGORIES = (
    "interest_rate_decision",
    "monetary_policy",
    "exchange_rate_policy",
    "fuel_subsidy",
    "tax_reform",
    "budget_release",
    "public_spending",
    "trade_restriction",
    "oil_price_shock",
    "commodity_shock",
    "geopolitical_conflict",
    "election",
    "recession",
    "pandemic",
    "natural_disaster",
)


def upgrade() -> None:
    # ── Advanced economic indicators on economic_data ─────────────────
    for col in (
        "core_inflation",
        "producer_price_index",
        "consumer_confidence_index",
        "purchasing_managers_index",
        "public_debt_ratio",
        "commodity_price_index",
        "housing_price_index",
        "retail_sales",
        "foreign_reserves",
        "fiscal_deficit",
    ):
        op.add_column("economic_data", sa.Column(col, sa.Float(), nullable=True))

    # ── Dataset quality tracking ──────────────────────────────────────
    op.add_column("datasets", sa.Column("quality_score", sa.Float(), nullable=True))
    op.add_column(
        "datasets",
        sa.Column("quality_report", postgresql.JSON(), nullable=False, server_default="{}"),
    )

    # ── Prediction explainability & multi-horizon metadata ────────────
    op.add_column(
        "predictions",
        sa.Column("explainability", postgresql.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "predictions",
        sa.Column("multi_horizon", postgresql.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "predictions",
        sa.Column("confidence_bands", postgresql.JSON(), nullable=False, server_default="{}"),
    )

    # ── Economic events ───────────────────────────────────────────────
    op.create_table(
        "economic_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("country", sa.String(10), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("event_date", sa.Date(), nullable=False, index=True),
        sa.Column("severity_score", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("economic_impact_score", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Multi-horizon forecast records ────────────────────────────────
    op.create_table(
        "multi_horizon_forecasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "prediction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("predictions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("horizon_months", sa.Integer(), nullable=False),
        sa.Column("predicted_value", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("trend_direction", sa.String(20), nullable=False),
        sa.Column("lower_bound", sa.Float(), nullable=False),
        sa.Column("upper_bound", sa.Float(), nullable=False),
        sa.Column("best_case", sa.Float(), nullable=False),
        sa.Column("expected_case", sa.Float(), nullable=False),
        sa.Column("worst_case", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Prediction accuracy records ─────────────────────────────────
    op.create_table(
        "prediction_accuracy_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("period_date", sa.Date(), nullable=False, index=True),
        sa.Column("predicted_value", sa.Float(), nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=False),
        sa.Column("rmse", sa.Float(), nullable=True),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("mape", sa.Float(), nullable=True),
        sa.Column("r2_score", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=False, server_default="TS-Transformer-v3"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Country risk scores ─────────────────────────────────────────
    op.create_table(
        "country_risk_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("inflation_risk", sa.Float(), nullable=False),
        sa.Column("deflation_risk", sa.Float(), nullable=False),
        sa.Column("economic_stability", sa.Float(), nullable=False),
        sa.Column("currency_risk", sa.Float(), nullable=False),
        sa.Column("investment_risk", sa.Float(), nullable=False),
        sa.Column("overall_risk_label", sa.String(20), nullable=False),
        sa.Column("ai_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("factors", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Economic news ───────────────────────────────────────────────
    op.create_table(
        "economic_news",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=True, index=True),
        sa.Column("source", sa.String(255), nullable=False, server_default="InfiniCast"),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False, server_default="general"),
        sa.Column("sentiment_positive", sa.Float(), nullable=False, server_default="0.33"),
        sa.Column("sentiment_neutral", sa.Float(), nullable=False, server_default="0.34"),
        sa.Column("sentiment_negative", sa.Float(), nullable=False, server_default="0.33"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Sentiment records ───────────────────────────────────────────
    op.create_table(
        "sentiment_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(255), nullable=True),
        sa.Column("positive_score", sa.Float(), nullable=False),
        sa.Column("neutral_score", sa.Float(), nullable=False),
        sa.Column("negative_score", sa.Float(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Research publications ───────────────────────────────────────
    op.create_table(
        "research_publications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("authors", sa.String(500), nullable=False, server_default="InfiniCast Research"),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("abstract", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("pdf_path", sa.Text(), nullable=True),
        sa.Column("citation", sa.Text(), nullable=True),
        sa.Column("references", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("tags", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Data quality reports ──────────────────────────────────────────
    op.create_table(
        "data_quality_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("quality_score", sa.Float(), nullable=False),
        sa.Column("issues", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("recommendations", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("auto_cleaned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Forecast scenarios ────────────────────────────────────────────
    op.create_table(
        "forecast_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False, server_default="Custom Scenario"),
        sa.Column("input_overrides", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("baseline_forecast", sa.Float(), nullable=False),
        sa.Column("scenario_forecast", sa.Float(), nullable=False),
        sa.Column("forecast_difference", sa.Float(), nullable=False),
        sa.Column("impact_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("risk_assessment", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Intelligence platform settings ──────────────────────────────
    op.create_table(
        "intelligence_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("value", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Retraining recommendations ────────────────────────────────────
    op.create_table(
        "retraining_recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trigger_reason", sa.String(100), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("extra_data", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("retraining_recommendations")
    op.drop_table("intelligence_settings")
    op.drop_table("forecast_scenarios")
    op.drop_table("data_quality_reports")
    op.drop_table("research_publications")
    op.drop_table("sentiment_records")
    op.drop_table("economic_news")
    op.drop_table("country_risk_scores")
    op.drop_table("prediction_accuracy_records")
    op.drop_table("multi_horizon_forecasts")
    op.drop_table("economic_events")

    op.drop_column("predictions", "confidence_bands")
    op.drop_column("predictions", "multi_horizon")
    op.drop_column("predictions", "explainability")

    op.drop_column("datasets", "quality_report")
    op.drop_column("datasets", "quality_score")

    for col in (
        "fiscal_deficit",
        "foreign_reserves",
        "retail_sales",
        "housing_price_index",
        "commodity_price_index",
        "public_debt_ratio",
        "purchasing_managers_index",
        "consumer_confidence_index",
        "producer_price_index",
        "core_inflation",
    ):
        op.drop_column("economic_data", col)