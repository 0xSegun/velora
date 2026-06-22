"""Intelligence platform — reliability, archive, alerts, experiments

Revision ID: 016_intelligence_platform
Revises: 015_security_mfa_audit
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "016_intelligence_platform"
down_revision = "015_security_mfa_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Prediction intelligence metadata ────────────────────────────────
    for col_def in (
        ("reliability_score", sa.Float(), None),
        ("reliability_level", sa.String(20), None),
        ("economic_regime", sa.String(30), None),
        ("narrative", sa.Text(), None),
        ("using_cached_data", sa.Boolean(), "false"),
    ):
        name, col_type, default = col_def
        kwargs = {"nullable": True}
        if default is not None:
            kwargs["server_default"] = default
            kwargs["nullable"] = False
        op.add_column("predictions", sa.Column(name, col_type, **kwargs))

    op.add_column(
        "predictions",
        sa.Column("data_lineage", postgresql.JSON(), nullable=False, server_default="{}"),
    )

    # ── Forecast archive ────────────────────────────────────────────────
    op.create_table(
        "forecast_archives",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prediction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("inflation_rate", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("reliability_score", sa.Float(), nullable=True),
        sa.Column("forecast_horizon", sa.Integer(), nullable=False, default=6),
        sa.Column("input_snapshot", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("output_snapshot", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("model_version", sa.String(50), nullable=False, default="TS-Transformer-v3"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Intelligence alerts (anomalies + early warnings) ──────────────────
    op.create_table(
        "intelligence_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False, index=True),
        sa.Column("alert_type", sa.String(50), nullable=False, index=True),
        sa.Column("severity", sa.String(10), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False, server_default=""),
        sa.Column("indicator", sa.String(100), nullable=True),
        sa.Column("current_value", sa.Float(), nullable=True),
        sa.Column("previous_value", sa.Float(), nullable=True),
        sa.Column("change_pct", sa.Float(), nullable=True),
        sa.Column("extra_data", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Model experiments ───────────────────────────────────────────────
    op.create_table(
        "model_experiments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("sequence_length", sa.Integer(), nullable=True),
        sa.Column("forecast_horizon", sa.Integer(), nullable=True),
        sa.Column("training_loss", sa.Float(), nullable=True),
        sa.Column("validation_loss", sa.Float(), nullable=True),
        sa.Column("epoch_count", sa.Integer(), nullable=True),
        sa.Column("attention_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("hyperparameters", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("metrics", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("dataset_name", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("is_deployed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Backtest sessions ───────────────────────────────────────────────
    op.create_table(
        "backtest_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=True, index=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("metrics", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("records_count", sa.Integer(), nullable=False, default=0),
        sa.Column("monthly_report", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("error_distribution", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("country_rankings", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("backtest_sessions")
    op.drop_table("model_experiments")
    op.drop_table("intelligence_alerts")
    op.drop_table("forecast_archives")
    for col in ("data_lineage", "using_cached_data", "narrative", "economic_regime", "reliability_level", "reliability_score"):
        op.drop_column("predictions", col)