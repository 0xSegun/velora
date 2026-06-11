"""Add unique constraints for exchange rate tables

Revision ID: 007_exchange_rate_constraints
Revises: 006_exchange_rate_api
Create Date: 2026-06-11
"""

from alembic import op

revision = "007_exchange_rate_constraints"
down_revision = "006_exchange_rate_api"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Deduplicate exchange_rates — keep the most recently retrieved row per pair.
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
    op.create_unique_constraint(
        "uq_exchange_rates_base_target",
        "exchange_rates",
        ["base_currency", "target_currency"],
    )

    # Deduplicate history — keep the newest row per period bucket.
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
    op.create_unique_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        ["target_currency", "period_type", "period_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_exchange_rate_history_period",
        "exchange_rate_history",
        type_="unique",
    )
    op.drop_constraint(
        "uq_exchange_rates_base_target",
        "exchange_rates",
        type_="unique",
    )