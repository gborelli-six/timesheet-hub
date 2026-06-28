from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class UserRole(StrEnum):
    employee = "employee"
    hr = "hr"
    admin = "admin"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(
            UserRole,
            name="users_role_enum",
            create_type=True,
            native_enum=True,
        ),
        nullable=False,
        default=UserRole.employee,
    )


def upsert_user(db: Session, email: str, name: str | None) -> "User":
    user = db.query(User).filter_by(email=email).first()
    if user is None:
        user = User(email=email, name=name)
        db.add(user)
    else:
        user.name = name
    db.commit()
    db.refresh(user)
    return user
