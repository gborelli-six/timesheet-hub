import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.rbac import CurrentUser, UserRole, require_role
from app.core.security import decode_jwt, encrypt_secret
from app.db.session import get_db
from app.models.user_token import UserToken, UserTokenService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["connectors"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


def _get_user_id(session: Annotated[str | None, Cookie()] = None) -> UUID:
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token"
        )
    try:
        payload = decode_jwt(session)
        return UUID(payload["sub"])
    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
        KeyError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc


class ConnectorUpsertRequest(BaseModel):
    service: UserTokenService | None = None  # obbligatorio solo in creazione
    account_identifier: str | None = None
    base_url: str | None = None
    secret: str | None = Field(default=None, max_length=4096)
    db_name: str | None = None


class ConnectorOut(BaseModel):
    label: str
    service: str
    base_url: str | None
    account_identifier: str | None
    db_name: str | None
    configured: bool
    needs_reauth: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=list[ConnectorOut])
def list_connectors(
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> list[ConnectorOut]:
    tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
    return [
        ConnectorOut(
            label=t.label,
            service=t.service,
            base_url=t.base_url,
            account_identifier=t.account_identifier,
            db_name=t.db_name,
            configured=True,
            needs_reauth=t.needs_reauth,
            updated_at=t.updated_at,
        )
        for t in tokens
    ]


@router.put("/{label}", response_model=ConnectorOut)
def upsert_connector(
    label: str,
    body: ConnectorUpsertRequest,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> ConnectorOut:
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
            db_name=body.db_name if "db_name" in body.model_fields_set else None,
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
        if "db_name" in body.model_fields_set:
            token.db_name = body.db_name

    db.commit()
    db.refresh(token)
    return ConnectorOut(
        label=token.label,
        service=token.service,
        base_url=token.base_url,
        account_identifier=token.account_identifier,
        db_name=token.db_name,
        configured=True,
        needs_reauth=token.needs_reauth,
        updated_at=token.updated_at,
    )


@router.delete("/{label}", status_code=status.HTTP_200_OK)
def delete_connector(
    label: str,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> dict:
    token = (
        db.query(UserToken)
        .filter(UserToken.user_id == user_id, UserToken.label == label)
        .first()
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connettore non trovato"
        )
    db.delete(token)
    db.commit()
    return {"ok": True}
