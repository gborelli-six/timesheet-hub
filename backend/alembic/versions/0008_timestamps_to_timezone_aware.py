"""convert timestamp columns to timezone-aware (UTC)

Le colonne temporali delle tabelle preesistenti erano ``TIMESTAMP WITHOUT TIME
ZONE`` (naive). I valori sono sempre stati scritti in UTC (``func.now()`` /
``datetime.now(UTC)``), quindi la conversione li reinterpreta esplicitamente come
UTC con ``AT TIME ZONE 'UTC'``. Così l'API li serializza con offset e il frontend
li mostra nel fuso del browser senza ambiguità.

Le tabelle imports/import_rows nascono già timezone-aware (0007), qui non toccate.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-02
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

# (tabella, colonna) da convertire.
_COLUMNS = [
    ("users", "created_at"),
    ("users", "updated_at"),
    ("user_tokens", "created_at"),
    ("user_tokens", "updated_at"),
    ("connector_row_mappings", "created_at"),
    ("connector_row_mappings", "updated_at"),
    ("connector_row_mappings", "last_used_at"),
]


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.execute(
            f'ALTER TABLE "{table}" '
            f'ALTER COLUMN "{column}" '
            f"TYPE TIMESTAMP WITH TIME ZONE "
            f"USING \"{column}\" AT TIME ZONE 'UTC'"
        )


def downgrade() -> None:
    # Torna a naive esprimendo l'istante in UTC (inverso di AT TIME ZONE 'UTC').
    for table, column in _COLUMNS:
        op.execute(
            f'ALTER TABLE "{table}" '
            f'ALTER COLUMN "{column}" '
            f"TYPE TIMESTAMP WITHOUT TIME ZONE "
            f"USING \"{column}\" AT TIME ZONE 'UTC'"
        )
