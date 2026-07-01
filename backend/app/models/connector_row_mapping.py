from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class ConnectorRowMapping(TimestampMixin, Base):
    __tablename__ = "connector_row_mappings"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "excel_project",
            "excel_task",
            "connector_label",
            name="uq_connector_row_mappings_user_project_task_connector",
        ),
        Index(
            "ix_connector_row_mappings_user_project_task",
            "user_id",
            "excel_project",
            "excel_task",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_connector_row_mappings_user_id_users",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    excel_project: Mapped[str] = mapped_column(String(500), nullable=False)
    excel_task: Mapped[str] = mapped_column(String(500), nullable=False)
    connector_label: Mapped[str] = mapped_column(String(255), nullable=False)
    remote_project_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remote_project_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    remote_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remote_task_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
