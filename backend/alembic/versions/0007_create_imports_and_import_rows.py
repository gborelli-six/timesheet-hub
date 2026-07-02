"""create imports and import_rows tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

# Enum nuovi creati a mano (ADR-004). L'enum del service (`user_tokens_service_enum`)
# esiste già da 0003 e viene solo referenziato (create_type=False).
_import_status_enum = pg.ENUM(
    "success",
    "partial",
    "failed",
    name="import_status_enum",
    create_type=False,
)
_import_row_status_enum = pg.ENUM(
    "success",
    "failed",
    name="import_row_status_enum",
    create_type=False,
)
_service_enum = pg.ENUM(
    "jira",
    "odoo",
    "linear",
    "asana",
    name="user_tokens_service_enum",
    create_type=False,
)


def upgrade() -> None:
    _import_status_enum.create(op.get_bind(), checkfirst=True)
    _import_row_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "imports",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("operator_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("status", _import_status_enum, nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("success_rows", sa.Integer(), nullable=False),
        sa.Column("failed_rows", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["users.id"],
            name="fk_imports_employee_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["users.id"],
            name="fk_imports_operator_id_users",
            # SET NULL (non CASCADE): eliminare l'operatore non deve cancellare
            # lo storico import del dipendente proprietario del log.
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_imports_employee_id", "imports", ["employee_id"])

    op.create_table(
        "import_rows",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("import_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("connector_label", sa.String(255), nullable=False),
        sa.Column("service", _service_enum, nullable=False),
        sa.Column("excel_project", sa.String(500), nullable=False),
        sa.Column("excel_task", sa.String(500), nullable=False),
        sa.Column("remote_project_id", sa.String(255), nullable=True),
        sa.Column("remote_project_name", sa.String(500), nullable=True),
        sa.Column("remote_task_id", sa.String(255), nullable=True),
        sa.Column("remote_task_name", sa.String(500), nullable=True),
        sa.Column("hours", sa.Float(), nullable=False),
        sa.Column("status", _import_row_status_enum, nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["import_id"],
            ["imports.id"],
            name="fk_import_rows_import_id_imports",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_import_rows_import_id", "import_rows", ["import_id"])


def downgrade() -> None:
    op.drop_index("ix_import_rows_import_id", table_name="import_rows")
    op.drop_table("import_rows")
    op.drop_index("ix_imports_employee_id", table_name="imports")
    op.drop_table("imports")
    # Non droppare user_tokens_service_enum: è di proprietà della 0003.
    _import_row_status_enum.drop(op.get_bind(), checkfirst=True)
    _import_status_enum.drop(op.get_bind(), checkfirst=True)
