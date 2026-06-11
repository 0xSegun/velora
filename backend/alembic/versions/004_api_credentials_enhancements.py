"""API credentials and health monitoring enhancements

Revision ID: 004_api_credentials
Revises: 003_dashboard_enhancements
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004_api_credentials"
down_revision = "003_dashboard_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_configurations", sa.Column("base_url", sa.Text(), nullable=True))
    op.add_column(
        "api_configurations",
        sa.Column("credentials", postgresql.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "api_configurations",
        sa.Column("custom_headers", postgresql.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "api_configurations",
        sa.Column("last_failed_sync_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("api_configurations", "last_failed_sync_at")
    op.drop_column("api_configurations", "custom_headers")
    op.drop_column("api_configurations", "credentials")
    op.drop_column("api_configurations", "base_url")