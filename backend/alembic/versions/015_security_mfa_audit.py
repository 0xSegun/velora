"""Security: MFA fields, session metadata, admin audit log

Revision ID: 015_security_mfa_audit
Revises: 014_world_bank_trading_economics
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015_security_mfa_audit"
down_revision = "014_world_bank_trading_economics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("users", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("backup_codes_hash", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column("user_sessions", sa.Column("ip_address", sa.String(64), nullable=True))
    op.add_column("user_sessions", sa.Column("user_agent", sa.String(512), nullable=True))
    op.add_column("user_sessions", sa.Column("device_label", sa.String(255), nullable=True))
    op.add_column(
        "user_sessions",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_sessions",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "security_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(120), nullable=False, index=True),
        sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_security_audit_logs_created_at", "security_audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_security_audit_logs_created_at", table_name="security_audit_logs")
    op.drop_table("security_audit_logs")
    op.drop_column("user_sessions", "revoked_at")
    op.drop_column("user_sessions", "last_active_at")
    op.drop_column("user_sessions", "device_label")
    op.drop_column("user_sessions", "user_agent")
    op.drop_column("user_sessions", "ip_address")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "backup_codes_hash")
    op.drop_column("users", "totp_secret")
    op.drop_column("users", "mfa_enabled")