from datetime import date
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin
from app.models.user_token import UserTokenService


class ImportStatus(StrEnum):
    success = "success"
    partial = "partial"
    failed = "failed"


class ImportRowStatus(StrEnum):
    success = "success"
    failed = "failed"


class Import(TimestampMixin, Base):
    """Header di un'importazione: esito complessivo e conteggi aggregati."""

    __tablename__ = "imports"
    __table_args__ = (Index("ix_imports_employee_id", "employee_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_imports_employee_id_users",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    # NULL per self-import; valorizzato da E8b/HR (import per conto terzi).
    # SET NULL (non CASCADE): l'operatore non è il proprietario del log, quindi
    # la sua eliminazione non deve distruggere lo storico del dipendente.
    operator_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_imports_operator_id_users",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    status: Mapped[ImportStatus] = mapped_column(
        SQLAlchemyEnum(
            ImportStatus,
            name="import_status_enum",
            create_type=True,
            native_enum=True,
        ),
        nullable=False,
    )
    # Derivati dalle date min/max delle entries; nullable per robustezza se
    # nessuna data è parseabile.
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    success_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    failed_rows: Mapped[int] = mapped_column(Integer, nullable=False)

    rows: Mapped[list["ImportRow"]] = relationship(
        back_populates="import_",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ImportRow(TimestampMixin, Base):
    """Dettaglio di una riga inviata a un connettore durante un'importazione."""

    __tablename__ = "import_rows"
    __table_args__ = (Index("ix_import_rows_import_id", "import_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    import_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "imports.id",
            name="fk_import_rows_import_id_imports",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    connector_label: Mapped[str] = mapped_column(String(255), nullable=False)
    # Riusa l'enum PostgreSQL già creato per user_tokens (create_type=False:
    # il tipo esiste, non va ricreato).
    service: Mapped[UserTokenService] = mapped_column(
        SQLAlchemyEnum(
            UserTokenService,
            name="user_tokens_service_enum",
            create_type=False,
            native_enum=True,
        ),
        nullable=False,
    )
    excel_project: Mapped[str] = mapped_column(String(500), nullable=False)
    excel_task: Mapped[str] = mapped_column(String(500), nullable=False)
    remote_project_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remote_project_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    remote_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remote_task_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[ImportRowStatus] = mapped_column(
        SQLAlchemyEnum(
            ImportRowStatus,
            name="import_row_status_enum",
            create_type=True,
            native_enum=True,
        ),
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    import_: Mapped["Import"] = relationship(back_populates="rows")
