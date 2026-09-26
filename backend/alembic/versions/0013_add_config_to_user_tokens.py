"""add config jsonb to user_tokens, replacing db_name

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-21

Sostituisce la colonna Odoo-specifica `db_name` (0006) con una colonna JSONB
`config` generica: ogni tipo di connettore dichiara il proprio schema di campi
nel catalogo applicativo (app/connector_types.py) invece di aggiungere una
colonna nullable alla tabella condivisa a ogni nuova integrazione.

`config` contiene SOLO dati non sensibili: i segreti restano in `secret_enc`,
cifrati AES-256-GCM (ADR-005).
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_tokens",
        sa.Column(
            "config",
            pg.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    # Travaso di db_name dentro config prima di eliminare la colonna: nessun
    # dato perso per i connettori Odoo già configurati.
    op.execute(
        "UPDATE user_tokens "
        "SET config = jsonb_build_object('db_name', db_name) "
        "WHERE db_name IS NOT NULL AND db_name <> ''"
    )
    op.drop_column("user_tokens", "db_name")


def downgrade() -> None:
    """WARNING — perdita di dati.

    Ripristina `db_name` dal contenuto di `config`, ma ogni altra chiave di
    `config` non ha una colonna di destinazione e viene persa con il DROP
    COLUMN.
    """
    op.add_column("user_tokens", sa.Column("db_name", sa.String(255), nullable=True))
    op.execute("UPDATE user_tokens SET db_name = config ->> 'db_name'")
    op.drop_column("user_tokens", "config")
