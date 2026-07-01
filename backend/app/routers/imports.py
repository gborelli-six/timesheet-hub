from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.base import (
    AdapterAuthError,
    AdapterConnectionError,
)
from app.adapters.base import (
    ConnectorAssignment as AdapterAssignment,
)
from app.adapters.base import (
    TimesheetEntry as AdapterEntry,
)
from app.adapters.registry import adapter_registry
from app.core.rbac import CurrentUser, UserRole, require_role
from app.db.session import get_db
from app.routers.adapters import (
    _build_adapter_config,
    _get_token_or_404,
    _map_adapter_error,
)
from app.routers.connectors import _get_user_id
from app.services import mapping_service

router = APIRouter(prefix="/api/me", tags=["me-imports"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ConnectorAssignmentIn(BaseModel):
    connector_label: str
    remote_project_id: str | None = None
    remote_project_name: str | None = None
    remote_task_id: str | None = None
    remote_task_name: str | None = None


class EntryIn(BaseModel):
    date: str
    project: str
    task: str
    hours: float
    notes: str | None = None
    connector_assignments: list[ConnectorAssignmentIn] = []


class ImportRequest(BaseModel):
    entries: list[EntryIn]


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class RowErrorOut(BaseModel):
    row: int
    message: str


class ConnectorResultOut(BaseModel):
    connector_label: str
    success_count: int
    error_count: int
    errors: list[RowErrorOut] = []


class ImportResponse(BaseModel):
    results: list[ConnectorResultOut]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/imports", response_model=ImportResponse)
def submit_imports(
    body: ImportRequest,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> ImportResponse:
    entries = body.entries

    # 1. Raccogli i label distinti presenti nelle assignments
    distinct_labels: list[str] = list(
        {a.connector_label for entry in entries for a in entry.connector_assignments}
    )

    results: list[ConnectorResultOut] = []

    for label in distinct_labels:
        # 2a. Recupera token e config (404 se non trovato)
        token = _get_token_or_404(db, user_id, label)
        config = _build_adapter_config(token, user_id)

        # 2b. Filtra le entries che hanno almeno un assignment per questo label
        filtered: list[AdapterEntry] = []
        for entry in entries:
            matching = [
                a for a in entry.connector_assignments if a.connector_label == label
            ]
            if not matching:
                continue
            # Prendi solo il primo assignment per questo label (uno per label per entry)
            a = matching[0]
            filtered.append(
                AdapterEntry(
                    date=entry.date,
                    hours=entry.hours,
                    note=entry.notes,
                    connector_assignments=[
                        AdapterAssignment(
                            connector_id=label,
                            project_id=a.remote_project_id or "",
                            task_id=a.remote_task_id or "",
                        )
                    ],
                )
            )

        # 2c. Instanzia l'adapter e chiama submit
        try:
            adapter_cls = adapter_registry.get(config.service)
            import_result = adapter_cls().submit(filtered, config)
        except (AdapterAuthError, AdapterConnectionError) as exc:
            raise _map_adapter_error(exc) from exc

        results.append(
            ConnectorResultOut(
                connector_label=label,
                success_count=import_result.success_count,
                error_count=import_result.error_count,
                errors=[
                    RowErrorOut(row=e.row, message=e.message)
                    for e in import_result.errors
                ],
            )
        )

    # 3. Upsert mappature riga↔connettore
    assignments_list: list[dict] = [
        {
            "excel_project": entry.project,
            "excel_task": entry.task,
            "connector_label": a.connector_label,
            "remote_project_id": a.remote_project_id,
            "remote_project_name": a.remote_project_name,
            "remote_task_id": a.remote_task_id,
            "remote_task_name": a.remote_task_name,
        }
        for entry in entries
        for a in entry.connector_assignments
    ]
    mapping_service.upsert_row_mappings(db, user_id, assignments_list)

    return ImportResponse(results=results)
