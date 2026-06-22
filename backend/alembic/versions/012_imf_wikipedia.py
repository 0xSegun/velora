"""IMF and Wikipedia API integration tables

Revision ID: 012_imf_wikipedia
Revises: 011_news_api
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012_imf_wikipedia"
down_revision = "011_news_api"
branch_labels = None
depends_on = None

IMF_SYNC_STATUSES = ("idle", "syncing", "success", "failed")
WIKIPEDIA_SYNC_STATUSES = ("idle", "syncing", "success", "failed")


def upgrade() -> None:
    op.create_table(
        "imf_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_name", sa.String(120), nullable=False, server_default="IMF DataMapper"),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://www.imf.org/external/datamapper/api/v1",
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
            sa.Enum(*IMF_SYNC_STATUSES, name="imfsyncstatus"),
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
        "imf_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("imf_api_config.id", ondelete="SET NULL"),
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
        "imf_country_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("imf_country_code", sa.String(10), nullable=False),
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
        sa.UniqueConstraint("country_code", "data_year", name="uq_imf_country_data_code_year"),
    )
    op.create_index("ix_imf_country_data_country_code", "imf_country_data", ["country_code"])
    op.create_index("ix_imf_country_data_data_year", "imf_country_data", ["data_year"])

    op.create_table(
        "wikipedia_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider_name", sa.String(120), nullable=False, server_default="Wikipedia REST API"
        ),
        sa.Column(
            "base_url",
            sa.Text(),
            nullable=False,
            server_default="https://en.wikipedia.org/api/rest_v1",
        ),
        sa.Column(
            "user_agent",
            sa.Text(),
            nullable=False,
            server_default="Velora/1.0 (economic-intelligence; contact@velora.app)",
        ),
        sa.Column("refresh_interval", sa.String(20), nullable=False, server_default="weekly"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*WIKIPEDIA_SYNC_STATUSES, name="wikipediasyncstatus"),
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
        "wikipedia_country_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("country_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("economy_title", sa.String(500), nullable=True),
        sa.Column("economy_summary", sa.Text(), nullable=True),
        sa.Column("economy_thumbnail", sa.Text(), nullable=True),
        sa.Column("economy_url", sa.Text(), nullable=True),
        sa.Column("central_bank_title", sa.String(500), nullable=True),
        sa.Column("central_bank_summary", sa.Text(), nullable=True),
        sa.Column("central_bank_thumbnail", sa.Text(), nullable=True),
        sa.Column("central_bank_url", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "fetched_at",
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
        sa.UniqueConstraint("country_code", name="uq_wikipedia_country_cache_code"),
    )
    op.create_index(
        "ix_wikipedia_country_cache_country_code", "wikipedia_country_cache", ["country_code"]
    )


def downgrade() -> None:
    op.drop_index("ix_wikipedia_country_cache_country_code", table_name="wikipedia_country_cache")
    op.drop_table("wikipedia_country_cache")
    op.drop_table("wikipedia_api_config")
    op.execute("DROP TYPE IF EXISTS wikipediasyncstatus")

    op.drop_index("ix_imf_country_data_data_year", table_name="imf_country_data")
    op.drop_index("ix_imf_country_data_country_code", table_name="imf_country_data")
    op.drop_table("imf_country_data")
    op.drop_table("imf_api_logs")
    op.drop_table("imf_api_config")
    op.execute("DROP TYPE IF EXISTS imfsyncstatus")