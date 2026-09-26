"""add clockify to user_tokens_service_enum

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-21

Aggiunge il valore `clockify` all'enum dei servizi. Scritta a mano: gli
`ALTER TYPE ... ADD VALUE` non sono autogenerabili (ADR-004-B).

Questa migrazione resta separata da 0010 di proposito: PostgreSQL non consente
di *usare* un valore di enum nella stessa transazione in cui è stato aggiunto,
quindi il valore deve essere committato prima che qualunque altro DDL o DML vi
faccia riferimento.
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

_OLD_VALUES = ("jira", "odoo", "linear", "asana")

# Tabelle che usano user_tokens_service_enum: entrambe vanno convertite nel
# downgrade, altrimenti il DROP TYPE fallisce.
_TABLES = (("user_tokens", "service"), ("import_rows", "service"))


def upgrade() -> None:
    op.execute("ALTER TYPE user_tokens_service_enum ADD VALUE IF NOT EXISTS 'clockify'")


def downgrade() -> None:
    """WARNING — distruttivo.

    PostgreSQL non sa rimuovere un valore da un enum: il tipo va ricreato e le
    colonne riconvertite. Fallisce (volutamente) se esiste anche una sola riga
    con service = 'clockify', perché quel dato non ha una rappresentazione
    valida nel tipo di destinazione. Prima di eseguirlo occorre eliminare o
    riassegnare quelle righe a mano.
    """
    bind = op.get_bind()

    for table, column in _TABLES:
        leftover = bind.execute(
            sa.text(f"SELECT count(*) FROM {table} WHERE {column} = 'clockify'")
        ).scalar_one()
        if leftover:
            raise RuntimeError(
                f"downgrade 0009 impossibile: {leftover} righe in {table}.{column} "
                "hanno service='clockify'. Eliminarle o riassegnarle prima di "
                "procedere."
            )

    old_values = ", ".join(f"'{v}'" for v in _OLD_VALUES)
    op.execute(f"CREATE TYPE user_tokens_service_enum_old AS ENUM ({old_values})")
    for table, column in _TABLES:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE user_tokens_service_enum_old "
            f"USING {column}::text::user_tokens_service_enum_old"
        )
    op.execute("DROP TYPE user_tokens_service_enum")
    op.execute(
        "ALTER TYPE user_tokens_service_enum_old RENAME TO user_tokens_service_enum"
    )
