"""World Bank and Trading Economics API integration tables

Revision ID: 014_world_bank_trading_economics
Revises: 013_velora_rebrand
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014_world_bank_trading_economics"
down_revision = "013_velora_rebrand"
branch_labels = None
depends_on = None

WORLD_BANK_SYNC_STATUSES = ("idle", "syncing", "success", "failed")
TRADING_ECONOMICS_SYNC_STATUSES = ("idle", "syncing", "success", "failed")


def upgrade() -> None:
    op.create_table(
        "world_bank_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider_name",
            sa.String(120),
            nullable=False,
            server_default="World Bank Open Data",
        ),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://api.worldbank.org/v2",
        ),
        sa.Column("refresh_interval", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*WORLD_BANK_SYNC_STATUSES, name="worldbanksyncstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("countries_synced", sa.Integer(), nullable=False, server_default="0"),
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
        "world_bank_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("world_bank_api_config.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("endpoint", sa.String(500), nullable=False, server_default=""),
        sa.Column(
            "request_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("countries_synced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    op.create_table(
        "world_bank_country_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("wb_country_code", sa.String(10), nullable=False),
        sa.Column("country_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("data_year", sa.Integer(), nullable=False),
        sa.Column("inflation_pct", sa.Float(), nullable=True),
        sa.Column("gdp_growth_pct", sa.Float(), nullable=True),
        sa.Column("gdp_usd_billions", sa.Float(), nullable=True),
        sa.Column("government_debt_pct_gdp", sa.Float(), nullable=True),
        sa.Column("unemployment_pct", sa.Float(), nullable=True),
        sa.Column("current_account_pct_gdp", sa.Float(), nullable=True),
        sa.Column("indicators_json", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "retrieved_at",
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
        sa.UniqueConstraint(
            "country_code", "data_year", name="uq_world_bank_country_data_code_year"
        ),
    )
    op.create_index(
        "ix_world_bank_country_data_country_code", "world_bank_country_data", ["country_code"]
    )
    op.create_index(
        "ix_world_bank_country_data_data_year", "world_bank_country_data", ["data_year"]
    )

    op.create_table(
        "trading_economics_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider_name",
            sa.String(120),
            nullable=False,
            server_default="Trading Economics",
        ),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://api.tradingeconomics.com",
        ),
        sa.Column("refresh_interval", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*TRADING_ECONOMICS_SYNC_STATUSES, name="tradingeconomicssyncstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("countries_synced", sa.Integer(), nullable=False, server_default="0"),
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
        "trading_economics_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("trading_economics_api_config.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("endpoint", sa.String(500), nullable=False, server_default=""),
        sa.Column(
            "request_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("countries_synced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    op.create_table(
        "trading_economics_country_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("te_country_slug", sa.String(120), nullable=False),
        sa.Column("country_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("data_year", sa.Integer(), nullable=False),
        sa.Column("inflation_pct", sa.Float(), nullable=True),
        sa.Column("gdp_growth_pct", sa.Float(), nullable=True),
        sa.Column("gdp_usd_billions", sa.Float(), nullable=True),
        sa.Column("government_debt_pct_gdp", sa.Float(), nullable=True),
        sa.Column("unemployment_pct", sa.Float(), nullable=True),
        sa.Column("current_account_pct_gdp", sa.Float(), nullable=True),
        sa.Column("indicators_json", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "retrieved_at",
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
        sa.UniqueConstraint(
            "country_code",
            "data_year",
            name="uq_trading_economics_country_data_code_year",
        ),
    )
    op.create_index(
        "ix_trading_economics_country_data_country_code",
        "trading_economics_country_data",
        ["country_code"],
    )
    op.create_index(
        "ix_trading_economics_country_data_data_year",
        "trading_economics_country_data",
        ["data_year"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_trading_economics_country_data_data_year",
        table_name="trading_economics_country_data",
    )
    op.drop_index(
        "ix_trading_economics_country_data_country_code",
        table_name="trading_economics_country_data",
    )
    op.drop_table("trading_economics_country_data")
    op.drop_table("trading_economics_api_logs")
    op.drop_table("trading_economics_api_config")
    op.execute("DROP TYPE IF EXISTS tradingeconomicssyncstatus")

    op.drop_index("ix_world_bank_country_data_data_year", table_name="world_bank_country_data")
    op.drop_index("ix_world_bank_country_data_country_code", table_name="world_bank_country_data")
    op.drop_table("world_bank_country_data")
    op.drop_table("world_bank_api_logs")
    op.drop_table("world_bank_api_config")
    op.execute("DROP TYPE IF EXISTS worldbanksyncstatus")