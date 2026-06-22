"""Add composite indexes for dashboard query performance.

Revision ID: 017_performance_indexes
Revises: 016_intelligence_platform
Create Date: 2026-06-22
"""

from alembic import op

revision = "017_performance_indexes"
down_revision = "016_intelligence_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_predictions_user_created",
        "predictions",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_predictions_country_created",
        "predictions",
        ["country_code", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_read_created",
        "notifications",
        ["user_id", "is_read", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reports_user_published",
        "reports",
        ["user_id", "published_at"],
        unique=False,
    )
    op.create_index(
        "ix_users_role_active",
        "users",
        ["role", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_role_active", table_name="users")
    op.drop_index("ix_reports_user_published", table_name="reports")
    op.drop_index("ix_notifications_user_read_created", table_name="notifications")
    op.drop_index("ix_predictions_country_created", table_name="predictions")
    op.drop_index("ix_predictions_user_created", table_name="predictions")