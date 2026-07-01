"""add db_name to user_tokens

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-01
"""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_tokens", sa.Column("db_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("user_tokens", "db_name")
