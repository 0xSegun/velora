"""Platform enhancements: OAuth fields, country reference, analytics events.

Revision ID: 002_platform_enhancements
Revises: 001_initial_schema
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_platform_enhancements"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=20), nullable=False, server_default="local"),
    )
    op.add_column("users", sa.Column("google_id", sa.String(length=128), nullable=True))
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=False)

    op.add_column("countries", sa.Column("region", sa.String(length=100), nullable=True))
    op.add_column("countries", sa.Column("continent", sa.String(length=50), nullable=True))
    op.add_column("countries", sa.Column("currency", sa.String(length=10), nullable=True))

    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("country_code", sa.String(length=10), nullable=True),
        sa.Column("event_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"])
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_country_code", "analytics_events", ["country_code"])
    op.create_index("ix_analytics_events_created_at", "analytics_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_created_at", table_name="analytics_events")
    op.drop_index("ix_analytics_events_country_code", table_name="analytics_events")
    op.drop_index("ix_analytics_events_user_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_event_type", table_name="analytics_events")
    op.drop_table("analytics_events")

    op.drop_column("countries", "currency")
    op.drop_column("countries", "continent")
    op.drop_column("countries", "region")

    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.drop_column("users", "auth_provider")