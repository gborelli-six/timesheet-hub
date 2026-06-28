"""create users table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-28
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_role_enum = pg.ENUM(
    "employee", "hr", "admin", name="users_role_enum", create_type=False
)


def upgrade() -> None:
    _role_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column(
            "role",
            _role_enum,
            nullable=False,
            server_default="employee",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )


def downgrade() -> None:
    op.drop_table("users")
    _role_enum.drop(op.get_bind(), checkfirst=True)
