"""Velora rebrand — update legacy InfiniCast references in database

Revision ID: 013_velora_rebrand
Revises: 012_imf_wikipedia
Create Date: 2026-06-18
"""

from alembic import op

revision = "013_velora_rebrand"
down_revision = "012_imf_wikipedia"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE site_settings
        SET value = replace(replace(value::text, 'InfiniCast', 'Velora'), 'Infinicast', 'Velora')::json
        WHERE value::text ILIKE '%infinicast%'
        """
    )
    op.execute(
        """
        UPDATE research_publications
        SET authors = 'Velora Research'
        WHERE authors IN ('InfiniCast Research', 'Infinicast Research')
        """
    )
    op.execute(
        """
        UPDATE research_publications
        SET citation = REPLACE(REPLACE(citation, 'InfiniCast', 'Velora'), 'Infinicast', 'Velora')
        WHERE citation ILIKE '%infinicast%'
        """
    )
    op.execute(
        """
        UPDATE economic_news
        SET source = 'Velora'
        WHERE source IN ('InfiniCast', 'Infinicast')
        """
    )
    op.execute(
        """
        UPDATE reports
        SET source = 'Velora Intelligence Engine'
        WHERE source ILIKE '%infinicast%'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE site_settings
        SET value = REPLACE(value, 'Velora', 'InfiniCast')
        WHERE key IN ('site_name', 'site_title', 'meta_title')
        """
    )