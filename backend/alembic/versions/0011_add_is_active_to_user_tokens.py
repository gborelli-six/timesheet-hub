"""Add is_active column to user_tokens for soft-delete

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-04
"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_tokens",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("user_tokens", "is_active")
