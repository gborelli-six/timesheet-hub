from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
    ServiceType,
)
from app.adapters.registry import adapter_registry
from app.core.rbac import CurrentUser, UserRole, require_role
from app.core.security import decrypt_secret
from app.db.session import get_db
from app.models.user_token import UserToken
from app.routers.connectors import _get_user_id

router = APIRouter(prefix="/api/adapters", tags=["adapters"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


class ProjectOut(BaseModel):
    id: str
    name: str


class TaskOut(BaseModel):
    id: str
    name: str


def _get_token_or_404(db: Session, user_id: UUID, label: str) -> UserToken:
    token = (
        db.query(UserToken)
        .filter(UserToken.user_id == user_id, UserToken.label == label)
        .first()
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connettore non trovato",
        )
    return token


def _build_adapter_config(token: UserToken, user_id: UUID) -> AdapterConfig:
    decrypted = decrypt_secret(
        token.secret_enc,
        token.nonce,
        str(user_id),
        str(token.id),
        token.key_version,
    )
    return AdapterConfig(
        service=ServiceType(token.service),
        base_url=token.base_url or "",
        marker=token.account_identifier,
        params={
            "password": decrypted,
            "user": token.account_identifier or "",
            "db": token.db_name or "",
        },
    )


def _map_adapter_error(exc: Exception) -> HTTPException:
    if isinstance(exc, AdapterAuthError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "needs_reauth", "message": str(exc)},
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={"code": "backend_unavailable", "message": str(exc)},
    )


@router.get("/{label}/projects", response_model=list[ProjectOut])
def get_projects(
    label: str,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
    query: str | None = Query(default=None),
) -> list[ProjectOut]:
    token = _get_token_or_404(db, user_id, label)
    config = _build_adapter_config(token, user_id)
    try:
        adapter_cls = adapter_registry.get(config.service)
        projects = adapter_cls().get_projects(config, query)
    except (AdapterAuthError, AdapterConnectionError) as exc:
        raise _map_adapter_error(exc) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Nessun adapter registrato per il servizio '{config.service}'",
        ) from exc
    return [ProjectOut(id=p.id, name=p.name) for p in projects]


@router.get("/{label}/projects/{project_id}/tasks", response_model=list[TaskOut])
def get_tasks(
    label: str,
    project_id: str,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
    query: str | None = Query(default=None),
) -> list[TaskOut]:
    token = _get_token_or_404(db, user_id, label)
    config = _build_adapter_config(token, user_id)
    try:
        adapter_cls = adapter_registry.get(config.service)
        tasks = adapter_cls().get_tasks(project_id, config, query)
    except (AdapterAuthError, AdapterConnectionError) as exc:
        raise _map_adapter_error(exc) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Nessun adapter registrato per il servizio '{config.service}'",
        ) from exc
    return [TaskOut(id=t.id, name=t.name) for t in tasks]
