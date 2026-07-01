from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    ForeignKey,
    LargeBinary,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class UserTokenService(StrEnum):
    jira = "jira"
    odoo = "odoo"
    linear = "linear"
    asana = "asana"


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
    db_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
