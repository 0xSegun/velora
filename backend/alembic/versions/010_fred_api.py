"""FRED API integration tables

Revision ID: 010_fred_api
Revises: 009_resend_email_api
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_fred_api"
down_revision = "009_resend_email_api"
branch_labels = None
depends_on = None

FRED_SYNC_STATUSES = ("idle", "syncing", "success", "failed")


def upgrade() -> None:
    op.create_table(
        "fred_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider_name",
            sa.String(100),
            nullable=False,
            server_default="Federal Reserve Economic Data (FRED)",
        ),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://api.stlouisfed.org/fred",
        ),
        sa.Column("refresh_interval", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("date_range", sa.String(20), nullable=False, server_default="5y"),
        sa.Column("data_frequency", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("prediction_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "historical_storage_enabled", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*FRED_SYNC_STATUSES, name="fredsyncstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("records_retrieved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("feature_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "fred_indicators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("indicator_code", sa.String(30), nullable=False, index=True),
        sa.Column("indicator_name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("frequency", sa.String(30), nullable=False, server_default="Monthly"),
        sa.Column("field_mapping", sa.String(50), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("indicator_code", name="uq_fred_indicators_code"),
    )

    op.create_table(
        "fred_economic_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("indicator_code", sa.String(30), nullable=False, index=True),
        sa.Column("indicator_name", sa.String(200), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=False, index=True),
        sa.Column("frequency", sa.String(30), nullable=False, server_default="Monthly"),
        sa.Column("source", sa.String(50), nullable=False, server_default="FRED"),
        sa.Column(
            "retrieved_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "indicator_code",
            "observation_date",
            name="uq_fred_economic_data_code_date",
        ),
    )

    op.create_table(
        "fred_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("request_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("response_time_ms", sa.Float(), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "fred_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("changed_fields", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "admin_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("fred_audit_logs")
    op.drop_table("fred_api_logs")
    op.drop_table("fred_economic_data")
    op.drop_table("fred_indicators")
    op.drop_table("fred_api_config")
    op.execute("DROP TYPE IF EXISTS fredsyncstatus")