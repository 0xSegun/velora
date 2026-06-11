"""Exchange rate round-2 fixes: dedupe tie-breaks, history base_currency, datasource enum

Revision ID: 008_exchange_rate_round2_fixes
Revises: 007_exchange_rate_constraints
Create Date: 2026-06-11
"""

from alembic import op

revision = "008_exchange_rate_round2_fixes"
down_revision = "007_exchange_rate_constraints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add EXCHANGE_RATE_API to datasource enum
    op.execute("ALTER TYPE datasource ADD VALUE IF NOT EXISTS 'EXCHANGE_RATE_API'")

    # Re-deduplicate exchange_rates with id tie-breaker for equal retrieved_at
    op.execute(
        """
        DELETE FROM exchange_rates a
        USING exchange_rates b
        WHERE a.base_currency = b.base_currency
          AND a.target_currency = b.target_currency
          AND (
            a.retrieved_at < b.retrieved_at
            OR (a.retrieved_at = b.retrieved_at AND a.id < b.id)
          )
        """
    )

    # Re-deduplicate history with id tie-breaker; keep newest per base+target+period
    op.execute(
        """
        DELETE FROM exchange_rate_history a
        USING exchange_rate_history b
        WHERE a.base_currency = b.base_currency
          AND a.target_currency = b.target_currency
          AND a.period_type = b.period_type
          AND a.period_date = b.period_date
          AND (
            a.created_at < b.created_at
            OR (a.created_at = b.created_at AND a.id < b.id)
          )
        """
    )

    # Replace history unique key to include base_currency
    op.drop_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        ["base_currency", "target_currency", "period_type", "period_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        ["target_currency", "period_type", "period_date"],
    )