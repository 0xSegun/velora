"""Dashboard enhancements: tracked countries and timezone.

Revision ID: 003_dashboard_enhancements
Revises: 002_platform_enhancements
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_dashboard_enhancements"
down_revision: Union[str, None] = "002_platform_enhancements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "tracked_countries",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "timezone",
            sa.String(length=64),
            nullable=False,
            server_default="Africa/Lagos",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "timezone")
    op.drop_column("users", "tracked_countries")