from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    ForeignKey,
    LargeBinary,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin

# JSONB su PostgreSQL (indicizzabile, è ciò che la migrazione 0013 crea), JSON
# generico sugli altri dialetti: i test unit sui modelli girano su SQLite, che
# non conosce JSONB.
_JSONType = JSON().with_variant(JSONB(), "postgresql")


class UserTokenService(StrEnum):
    jira = "jira"
    odoo = "odoo"
    linear = "linear"
    asana = "asana"
    clockify = "clockify"


class UserToken(TimestampMixin, Base):
    __tablename__ = "user_tokens"
    __table_args__ = (
        UniqueConstraint("user_id", "label", name="uq_user_tokens_user_id_label"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_user_tokens_user_id_users",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    service: Mapped[UserTokenService] = mapped_column(
        SQLAlchemyEnum(
            UserTokenService,
            name="user_tokens_service_enum",
            create_type=True,
            native_enum=True,
        ),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    account_identifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    secret_enc: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    nonce: Mapped[bytes] = mapped_column(LargeBinary(12), nullable=False)
    key_version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    needs_reauth: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Configurazione specifica per tipo di servizio (es. db_name per Odoo).
    # Lo schema dei campi ammessi è dichiarato dal catalogo in
    # app/connector_types.py. Solo dati NON sensibili: i segreti vivono
    # in secret_enc, cifrati (ADR-005).
    config: Mapped[dict] = mapped_column(
        _JSONType, nullable=False, default=dict, server_default="{}"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
