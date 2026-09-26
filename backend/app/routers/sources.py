"""Scarico delle voci timesheet da una sorgente esterna (E13).

Speculare a `imports.py`: là le voci escono verso le destinazioni, qui entrano
da una sorgente. Il risultato non viene persistito — è materiale per la preview
del wizard, che resta il punto in cui l'utente approva prima che qualcosa venga
scritto da qualche parte (ADR-006).
"""

import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.base import AdapterError
from app.core.rbac import CurrentUser, UserRole, require_role
from app.core.security import decrypt_secret
from app.db.session import get_db
from app.models.user_token import UserToken
from app.routers.adapters import _get_token_or_404, _map_adapter_error
from app.sources.base import ServiceType, SourceConfig
from app.sources.registry import source_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/me/sources", tags=["me-sources"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]

# Limite di sicurezza sull'ampiezza del periodo: una richiesta su anni interi
# farebbe paginare la sorgente per minuti bloccando un thread del pool.
_MAX_PERIOD_DAYS = 366


class FetchRequest(BaseModel):
    start: date
    end: date


class SourceRowOut(BaseModel):
    date: str
    project: str
    task: str
    hours: float
    notes: str | None = None


class FetchResponse(BaseModel):
    rows: list[SourceRowOut]


def _build_source_config(token: UserToken, user_id) -> SourceConfig:
    decrypted = decrypt_secret(
        token.secret_enc,
        token.nonce,
        str(user_id),
        str(token.id),
        token.key_version,
    )
    return SourceConfig(
        service=ServiceType(token.service),
        secret=decrypted,
        base_url=token.base_url,
        account_identifier=token.account_identifier,
        config=token.config or {},
        # Stessa convenzione degli adapter: il marker E2E viaggia
        # nell'account_identifier (vedi app/sources/stub.py).
        marker=token.account_identifier,
    )


@router.post("/{label}/fetch", response_model=FetchResponse)
def fetch_source_entries(
    label: str,
    body: FetchRequest,
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> FetchResponse:
    if body.start > body.end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La data di inizio deve precedere la data di fine",
        )
    if (body.end - body.start).days > _MAX_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Il periodo non può superare {_MAX_PERIOD_DAYS} giorni",
        )

    token = _get_token_or_404(db, user.id, label)
    config = _build_source_config(token, user.id)

    try:
        source_cls = source_registry.get(config.service)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Il servizio '{config.service}' non è una sorgente di importazione",
        ) from exc

    try:
        rows = source_cls().fetch_entries(
            body.start.isoformat(), body.end.isoformat(), config
        )
    except AdapterError as exc:
        # Il messaggio non contiene mai il segreto: la libreria riporta solo
        # status HTTP e causa di trasporto.
        logger.warning(
            "fetch sorgente fallito: service=%s label=%s err=%s",
            config.service,
            label,
            type(exc).__name__,
        )
        raise _map_adapter_error(exc) from exc

    return FetchResponse(
        rows=[
            SourceRowOut(
                date=row.date,
                project=row.project,
                task=row.task,
                hours=row.hours,
                notes=row.notes,
            )
            for row in rows
        ]
    )
