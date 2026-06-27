from sqlalchemy.orm import DeclarativeBase

from app.db.conventions import metadata


class Base(DeclarativeBase):
    metadata = metadata
