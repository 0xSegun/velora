"""Exchange rate API integration tables

Revision ID: 006_exchange_rate_api
Revises: 005_intelligence
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006_exchange_rate_api"
down_revision = "005_intelligence"
branch_labels = None
depends_on = None

REFRESH_INTERVALS = ("hourly", "daily", "weekly")
SYNC_STATUSES = ("idle", "syncing", "success", "failed")
PERIOD_TYPES = ("daily", "weekly", "monthly")


def upgrade() -> None:
    op.create_table(
        "exchange_rate_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_name", sa.String(100), nullable=False, server_default="ExchangeRate-API"),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://v6.exchangerate-api.com",
        ),
        sa.Column("base_currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column(
            "refresh_interval",
            sa.Enum(*REFRESH_INTERVALS, name="refreshinterval"),
            nullable=False,
            server_default="hourly",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*SYNC_STATUSES, name="syncstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
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
        "exchange_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("base_currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("target_currency", sa.String(10), nullable=False, index=True),
        sa.Column("exchange_rate", sa.Float(), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(100), nullable=False, server_default="ExchangeRate-API"),
    )

    op.create_table(
        "exchange_rate_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("base_currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("target_currency", sa.String(10), nullable=False, index=True),
        sa.Column("exchange_rate", sa.Float(), nullable=False),
        sa.Column(
            "period_type",
            sa.Enum(*PERIOD_TYPES, name="periodtype"),
            nullable=False,
        ),
        sa.Column("period_date", sa.Date(), nullable=False, index=True),
        sa.Column("source", sa.String(100), nullable=False, server_default="ExchangeRate-API"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "exchange_rate_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("request_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("response_time_ms", sa.Float(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("rate_limit_remaining", sa.Integer(), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "exchange_rate_audit_logs",
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
    op.drop_table("exchange_rate_audit_logs")
    op.drop_table("exchange_rate_api_logs")
    op.drop_table("exchange_rate_history")
    op.drop_table("exchange_rates")
    op.drop_table("exchange_rate_api_config")
    op.execute("DROP TYPE IF EXISTS periodtype")
    op.execute("DROP TYPE IF EXISTS syncstatus")
    op.execute("DROP TYPE IF EXISTS refreshinterval")