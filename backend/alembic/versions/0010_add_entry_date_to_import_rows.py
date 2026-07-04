"""Add entry_date column to import_rows

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-04
"""

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("import_rows", sa.Column("entry_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("import_rows", "entry_date")
