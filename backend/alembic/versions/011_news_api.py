"""News API integration tables

Revision ID: 011_news_api
Revises: 010_fred_api
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_news_api"
down_revision = "010_fred_api"
branch_labels = None
depends_on = None

NEWS_PROVIDERS = ("newsapi", "gnews", "generic")
NEWS_SYNC_STATUSES = ("idle", "syncing", "success", "failed")


def upgrade() -> None:
    op.create_table(
        "news_api_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider",
            sa.Enum(*NEWS_PROVIDERS, name="newsprovider"),
            nullable=False,
            server_default="newsapi",
        ),
        sa.Column("provider_name", sa.String(120), nullable=False, server_default="NewsAPI.org"),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column(
            "base_url", sa.Text(), nullable=False, server_default="https://newsapi.org/v2"
        ),
        sa.Column("refresh_interval", sa.String(20), nullable=False, server_default="hourly"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(*NEWS_SYNC_STATUSES, name="newssyncstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("articles_retrieved", sa.Integer(), nullable=False, server_default="0"),
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
        "news_api_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("news_api_config.id", ondelete="SET NULL"),
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
        sa.Column("articles_fetched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("news_api_logs")
    op.drop_table("news_api_config")
    op.execute("DROP TYPE IF EXISTS newssyncstatus")
    op.execute("DROP TYPE IF EXISTS newsprovider")