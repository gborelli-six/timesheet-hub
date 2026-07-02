from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """Aggiunge created_at e updated_at automatici a ogni modello SQLAlchemy.

    Le colonne sono timezone-aware (``TIMESTAMP WITH TIME ZONE``): Postgres le
    memorizza in UTC e le serializza con offset, così il frontend può renderle
    nel fuso del browser senza ambiguità.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
