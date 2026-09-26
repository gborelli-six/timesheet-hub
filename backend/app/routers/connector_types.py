"""Catalogo dei tipi di connettore, esposto al frontend.

Permette alla UI di generare il form di configurazione a partire dallo schema
dichiarato dal backend, invece di duplicarne i campi lato client (com'era per
`db_name`), e di distinguere le sorgenti dalle destinazioni nello Step 0 del
wizard di importazione.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.connector_types import CONNECTOR_TYPES
from app.core.rbac import CurrentUser, UserRole, require_role

router = APIRouter(prefix="/api/connector-types", tags=["connector-types"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


class ConfigFieldOut(BaseModel):
    key: str
    label: str
    type: str
    required: bool
    help: str | None = None


class ConnectorTypeOut(BaseModel):
    service: str
    label: str
    is_source: bool
    is_destination: bool
    available: bool
    secret_label: str
    secret_help: str | None = None
    requires_base_url: bool
    requires_account_identifier: bool
    account_identifier_label: str
    config_fields: list[ConfigFieldOut]


@router.get("", response_model=list[ConnectorTypeOut])
def list_connector_types(
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
) -> list[ConnectorTypeOut]:
    return [
        ConnectorTypeOut(
            service=spec.service.value,
            label=spec.label,
            is_source=spec.is_source,
            is_destination=spec.is_destination,
            available=spec.available,
            secret_label=spec.secret_label,
            secret_help=spec.secret_help,
            requires_base_url=spec.requires_base_url,
            requires_account_identifier=spec.requires_account_identifier,
            account_identifier_label=spec.account_identifier_label,
            config_fields=[
                ConfigFieldOut(
                    key=f.key,
                    label=f.label,
                    type=f.type,
                    required=f.required,
                    help=f.help,
                )
                for f in spec.config_fields
            ],
        )
        for spec in CONNECTOR_TYPES.values()
    ]
