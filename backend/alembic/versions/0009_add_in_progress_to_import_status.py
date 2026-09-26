"""Add in_progress value to import_status_enum

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-03
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE import_status_enum ADD VALUE IF NOT EXISTS 'in_progress'")


def downgrade() -> None:
    # PostgreSQL non supporta DROP VALUE da un enum — richiede recreate manuale.
    # Per fare rollback: DROP TYPE + ricrea senza 'in_progress' + ricrea colonna.
    pass
