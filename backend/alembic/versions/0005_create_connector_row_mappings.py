"""create connector_row_mappings table

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-01
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connector_row_mappings",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("excel_project", sa.String(500), nullable=False),
        sa.Column("excel_task", sa.String(500), nullable=False),
        sa.Column("connector_label", sa.String(255), nullable=False),
        sa.Column("remote_project_id", sa.String(255), nullable=True),
        sa.Column("remote_project_name", sa.String(500), nullable=True),
        sa.Column("remote_task_id", sa.String(255), nullable=True),
        sa.Column("remote_task_name", sa.String(500), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
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
        sa.UniqueConstraint(
            "user_id",
            "excel_project",
            "excel_task",
            "connector_label",
            name="uq_connector_row_mappings_user_project_task_connector",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_connector_row_mappings_user_id_users",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_connector_row_mappings_user_project_task",
        "connector_row_mappings",
        ["user_id", "excel_project", "excel_task"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_connector_row_mappings_user_project_task",
        table_name="connector_row_mappings",
    )
    op.drop_table("connector_row_mappings")
