"""Initial database schema

Revision ID: 001_initial
Revises:
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(128), nullable=False, server_default="User"),
        sa.Column("last_name", sa.String(128), nullable=False, server_default=""),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False, server_default="User"),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("institution", sa.String(255), nullable=True),
        sa.Column("country", sa.String(10), nullable=False, server_default="NG"),
        sa.Column("role", sa.Enum("user", "admin", "analyst", name="userrole"), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # User sessions
    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token", "user_sessions", ["token"], unique=True)

    # Countries
    op.create_table(
        "countries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("inflation_rate", sa.Float(), nullable=True),
        sa.Column("deflation_risk", sa.Float(), nullable=True),
        sa.Column("gdp", sa.Float(), nullable=True),
        sa.Column("interest_rate", sa.Float(), nullable=True),
        sa.Column("economic_stability_score", sa.Float(), nullable=True),
        sa.Column("currency_strength", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_countries_code", "countries", ["code"], unique=True)

    # Predictions
    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("inflation_rate", sa.Float(), nullable=False),
        sa.Column("deflation_probability", sa.Float(), nullable=False, server_default="0"),
        sa.Column("trend_direction", sa.String(20), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("input_params", postgresql.JSON(), nullable=False),
        sa.Column("output_data", postgresql.JSON(), nullable=False),
        sa.Column("forecast_horizon", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("prediction_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"])
    op.create_index("ix_predictions_country_code", "predictions", ["country_code"])

    # Prediction details
    op.create_table(
        "prediction_details",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prediction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factors", postgresql.JSON(), nullable=False),
        sa.Column("indicators", postgresql.JSON(), nullable=False),
        sa.Column("historical_comparison", postgresql.JSON(), nullable=False),
        sa.Column("confidence_interval", postgresql.JSON(), nullable=False),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("recommended_actions", postgresql.JSON(), nullable=False),
        sa.Column("data_sources", postgresql.JSON(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prediction_details_prediction_id", "prediction_details", ["prediction_id"], unique=True)

    # Economic data
    op.create_table(
        "economic_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("country_name", sa.String(255), nullable=False),
        sa.Column("cpi", sa.Float(), nullable=True),
        sa.Column("gdp", sa.Float(), nullable=True),
        sa.Column("gdp_growth", sa.Float(), nullable=True),
        sa.Column("interest_rate", sa.Float(), nullable=True),
        sa.Column("exchange_rate", sa.Float(), nullable=True),
        sa.Column("oil_price", sa.Float(), nullable=True),
        sa.Column("gov_spending", sa.Float(), nullable=True),
        sa.Column("employment_rate", sa.Float(), nullable=True),
        sa.Column("unemployment_rate", sa.Float(), nullable=True),
        sa.Column("inflation_rate", sa.Float(), nullable=True),
        sa.Column("money_supply", sa.Float(), nullable=True),
        sa.Column("trade_balance", sa.Float(), nullable=True),
        sa.Column("data_date", sa.Date(), nullable=False),
        sa.Column("source", sa.Enum("CBN", "NBS", "FRED", "MANUAL", name="datasource"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_economic_data_country_code", "economic_data", ["country_code"])
    op.create_index("ix_economic_data_data_date", "economic_data", ["data_date"])

    # Reports
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSON(), nullable=False),
        sa.Column("report_type", sa.Enum("inflation", "deflation", "country", "forecast", "monthly", "quarterly", "annual", "custom", name="reporttype"), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=True),
        sa.Column("source", sa.String(255), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("pdf_path", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_extra", postgresql.JSON(), nullable=False),
    )

    # Datasets
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dataset_version", sa.String(50), nullable=False, server_default="1.0"),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("upload_date", sa.DateTime(timezone=True), nullable=False),
    )

    # Model training
    op.create_table(
        "model_training",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("training_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("rmse", sa.Float(), nullable=True),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("epochs", sa.Integer(), nullable=True),
        sa.Column("training_time_seconds", sa.Float(), nullable=True),
        sa.Column("status", sa.Enum("pending", "running", "completed", "failed", "stopped", name="trainingstatus"), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("metrics", postgresql.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Notifications
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.Enum("info", "warning", "alert", "prediction", "training", "dataset", "model", "system", "security", name="notificationtype"), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # API configurations
    op.create_table(
        "api_configurations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("api_type", sa.Enum("economic", "report", "news", "forecast", name="apitype"), nullable=False),
        sa.Column("endpoint_url", sa.Text(), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column("refresh_frequency_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("source_priority", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("country_filters", postgresql.JSON(), nullable=False),
        sa.Column("report_categories", postgresql.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("health_status", sa.Enum("healthy", "degraded", "down", "unknown", name="apihealthstatus"), nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("usage_stats", postgresql.JSON(), nullable=False),
        sa.Column("logs", postgresql.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )

    # Site settings & AI models
    op.create_table(
        "site_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", postgresql.JSON(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_site_settings_key", "site_settings", ["key"], unique=True)

    op.create_table(
        "ai_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("precision_score", sa.Float(), nullable=True),
        sa.Column("recall_score", sa.Float(), nullable=True),
        sa.Column("f1_score", sa.Float(), nullable=True),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("rmse", sa.Float(), nullable=True),
        sa.Column("status", sa.Enum("training", "ready", "archived", name="modelstatus"), nullable=False),
        sa.Column("model_path", sa.Text(), nullable=True),
        sa.Column("hyperparams", postgresql.JSON(), nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # System logs
    op.create_table(
        "system_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("level", sa.Enum("debug", "info", "warning", "error", "critical", name="loglevel"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("context", postgresql.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_system_logs_created_at", "system_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("system_logs")
    op.drop_table("ai_models")
    op.drop_table("site_settings")
    op.drop_table("api_configurations")
    op.drop_table("notifications")
    op.drop_table("model_training")
    op.drop_table("datasets")
    op.drop_table("reports")
    op.drop_table("economic_data")
    op.drop_table("prediction_details")
    op.drop_table("predictions")
    op.drop_table("countries")
    op.drop_table("user_sessions")
    op.drop_table("users")
    for enum_name in (
        "loglevel", "modelstatus", "apihealthstatus", "apitype",
        "notificationtype", "trainingstatus", "reporttype", "datasource", "userrole",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")