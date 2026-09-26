import logging
from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.connector_types import ConfigValidationError, get_spec, validate_config
from app.core.rbac import CurrentUser, UserRole, require_role
from app.core.security import encrypt_secret
from app.db.session import get_db
from app.models.user_token import UserToken, UserTokenService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["connectors"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


class ConnectorUpsertRequest(BaseModel):
    service: UserTokenService | None = None  # obbligatorio solo in creazione
    account_identifier: str | None = None
    base_url: str | None = None
    secret: str | None = Field(default=None, max_length=4096)
    # Campi specifici del tipo di servizio (es. db_name per Odoo). Validati
    # contro il catalogo: un config errato fallisce al salvataggio, non al
    # primo import.
    config: dict | None = None


class ConnectorOut(BaseModel):
    label: str
    service: str
    base_url: str | None
    account_identifier: str | None
    config: dict
    configured: bool
    needs_reauth: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


def _validate_config_or_422(service: UserTokenService, config: dict | None) -> dict:
    try:
        return validate_config(service, config)
    except ConfigValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


def _to_out(token: UserToken) -> ConnectorOut:
    return ConnectorOut(
        label=token.label,
        service=token.service,
        base_url=token.base_url,
        account_identifier=token.account_identifier,
        config=token.config or {},
        configured=True,
        needs_reauth=token.needs_reauth,
        updated_at=token.updated_at,
    )


@router.get("/", response_model=list[ConnectorOut])
def list_connectors(
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> list[ConnectorOut]:
    tokens = db.query(UserToken).filter(UserToken.user_id == user.id).all()
    return [_to_out(t) for t in tokens]


@router.put("/{label}", response_model=ConnectorOut)
def upsert_connector(
    label: str,
    body: ConnectorUpsertRequest,
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> ConnectorOut:
    user_id = user.id
    token = (
        db.query(UserToken)
        .filter(UserToken.user_id == user_id, UserToken.label == label)
        .first()
    )

    if token is None:
        if "service" not in body.model_fields_set or body.service is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="service è obbligatorio per creare un nuovo connettore",
            )
        if "secret" not in body.model_fields_set or body.secret is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="secret è obbligatorio per creare un nuovo connettore",
            )
        # Un tipo senza implementazione (linear, asana) si creerebbe senza
        # errori per poi fallire al primo utilizzo: meglio rifiutarlo qui.
        if not get_spec(body.service).available:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Il servizio '{body.service}' non è ancora disponibile",
            )
        config = _validate_config_or_422(body.service, body.config)
        connector_id = uuid4()
        secret_enc, nonce, key_version = encrypt_secret(
            body.secret, str(user_id), str(connector_id)
        )
        token = UserToken(
            id=connector_id,
            user_id=user_id,
            service=body.service,
            label=label,
            account_identifier=body.account_identifier
            if "account_identifier" in body.model_fields_set
            else None,
            base_url=body.base_url if "base_url" in body.model_fields_set else None,
            config=config,
            secret_enc=secret_enc,
            nonce=nonce,
            key_version=key_version,
        )
        db.add(token)
    else:
        # service non è aggiornabile: è fissato alla creazione
        if "secret" in body.model_fields_set and body.secret is not None:
            secret_enc, nonce, key_version = encrypt_secret(
                body.secret, str(user_id), str(token.id)
            )
            token.secret_enc = secret_enc
            token.nonce = nonce
            token.key_version = key_version
            token.needs_reauth = False
        if "account_identifier" in body.model_fields_set:
            token.account_identifier = body.account_identifier
        if "base_url" in body.model_fields_set:
            token.base_url = body.base_url
        if "config" in body.model_fields_set:
            # Sostituzione, non merge: il form invia sempre il config completo,
            # e un merge renderebbe impossibile svuotare un campo opzionale.
            token.config = _validate_config_or_422(token.service, body.config)

    db.commit()
    db.refresh(token)
    return _to_out(token)


@router.delete("/{label}", status_code=status.HTTP_200_OK)
def delete_connector(
    label: str,
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> dict:
    token = (
        db.query(UserToken)
        .filter(UserToken.user_id == user.id, UserToken.label == label)
        .first()
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connettore non trovato"
        )
    db.delete(token)
    db.commit()
    return {"ok": True}
