from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, selectinload

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
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user_token import UserTokenService
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
    # `import_id` identifica il log persistito, così il wizard può linkare al
    # dettaglio. `results` resta invariato per non rompere il contratto E8a.
    import_id: UUID
    results: list[ConnectorResultOut]


class ImportRowOut(BaseModel):
    id: UUID
    row_number: int
    connector_label: str
    service: str
    excel_project: str
    excel_task: str
    remote_project_id: str | None
    remote_project_name: str | None
    remote_task_id: str | None
    remote_task_name: str | None
    hours: float
    status: ImportRowStatus
    error_message: str | None

    model_config = ConfigDict(from_attributes=True)


class ImportLogSummary(BaseModel):
    id: UUID
    period_start: date | None
    period_end: date | None
    status: ImportStatus
    total_rows: int
    success_rows: int
    failed_rows: int
    services: list[str]
    created_at: datetime


class ImportLogDetail(ImportLogSummary):
    rows: list[ImportRowOut]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _distinct_services(imp: Import) -> list[str]:
    return sorted({row.service.value for row in imp.rows})


def _to_summary(imp: Import) -> ImportLogSummary:
    return ImportLogSummary(
        id=imp.id,
        period_start=imp.period_start,
        period_end=imp.period_end,
        status=imp.status,
        total_rows=imp.total_rows,
        success_rows=imp.success_rows,
        failed_rows=imp.failed_rows,
        services=_distinct_services(imp),
        created_at=imp.created_at,
    )


def _to_detail(imp: Import) -> ImportLogDetail:
    ordered_rows = sorted(imp.rows, key=lambda r: (r.row_number, r.connector_label))
    return ImportLogDetail(
        **_to_summary(imp).model_dump(),
        rows=[ImportRowOut.model_validate(r) for r in ordered_rows],
    )


def _derive_period(entries: list[EntryIn]) -> tuple[date | None, date | None]:
    parsed: list[date] = []
    for entry in entries:
        try:
            parsed.append(date.fromisoformat(entry.date))
        except (ValueError, TypeError):
            continue
    if not parsed:
        return None, None
    return min(parsed), max(parsed)


# ---------------------------------------------------------------------------
# Endpoints
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
    # Per ogni label: service usato + mappa row_number(1-based) → messaggio d'errore.
    label_service: dict[str, UserTokenService] = {}
    label_failures: dict[str, dict[int, str]] = {}

    for label in distinct_labels:
        # 2a. Recupera token e config (404 se non trovato)
        token = _get_token_or_404(db, user_id, label)
        config = _build_adapter_config(token, user_id)
        label_service[label] = token.service

        # 2b. Filtra le entries che hanno almeno un assignment per questo label.
        #     original_rows mappa la posizione in `filtered` all'indice (1-based)
        #     della entry nel foglio, così gli errori restituiti puntano alla riga
        #     vista dall'utente e non alla posizione nel sottoinsieme filtrato.
        filtered: list[AdapterEntry] = []
        original_rows: list[int] = []
        for idx, entry in enumerate(entries):
            matching = [
                a for a in entry.connector_assignments if a.connector_label == label
            ]
            if not matching:
                continue
            # Prendi solo il primo assignment per questo label (uno per label per entry)
            a = matching[0]
            original_rows.append(idx + 1)
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

        # 2c. Instanzia l'adapter e chiama submit. Un errore di auth/connessione
        #     interrompe l'intera richiesta (409/502) PRIMA di qualsiasi commit:
        #     nessun log viene persistito (import atomico).
        try:
            adapter_cls = adapter_registry.get(config.service)
            import_result = adapter_cls().submit(filtered, config)
        except (AdapterAuthError, AdapterConnectionError) as exc:
            raise _map_adapter_error(exc) from exc

        label_failures[label] = {
            original_rows[e.row]: e.message for e in import_result.errors
        }
        results.append(
            ConnectorResultOut(
                connector_label=label,
                success_count=import_result.success_count,
                error_count=import_result.error_count,
                errors=[
                    RowErrorOut(row=original_rows[e.row], message=e.message)
                    for e in import_result.errors
                ],
            )
        )

    # 3. Costruisci il log: una ImportRow per ogni assignment inviato (serve al
    #    dettaglio), ma i conteggi dell'header sono per RIGA EXCEL, non per
    #    connettore. Una riga con più connettori conta 1: è "fallita" se almeno
    #    un connettore ha dato errore.
    import_rows: list[ImportRow] = []
    row_failed: dict[int, bool] = {}
    for idx, entry in enumerate(entries):
        row_number = idx + 1
        for a in entry.connector_assignments:
            failures = label_failures.get(a.connector_label, {})
            error_message = failures.get(row_number)
            is_failed = row_number in failures
            row_failed[row_number] = row_failed.get(row_number, False) or is_failed
            import_rows.append(
                ImportRow(
                    row_number=row_number,
                    connector_label=a.connector_label,
                    service=label_service[a.connector_label],
                    excel_project=entry.project,
                    excel_task=entry.task,
                    remote_project_id=a.remote_project_id,
                    remote_project_name=a.remote_project_name,
                    remote_task_id=a.remote_task_id,
                    remote_task_name=a.remote_task_name,
                    hours=entry.hours,
                    status=(
                        ImportRowStatus.failed if is_failed else ImportRowStatus.success
                    ),
                    error_message=error_message,
                )
            )

    total_rows = len(row_failed)
    failed_rows = sum(1 for failed in row_failed.values() if failed)
    success_rows = total_rows - failed_rows

    # Badge derivato dagli stessi conteggi PER RIGA, così esito e numeri sono
    # sempre coerenti: "success" se nessuna riga è fallita, "failed" se nessuna
    # è passata, "partial" altrimenti. Una riga mista (alcuni connettori KO)
    # conta come fallita qui, ma nel dettaglio resta visibile come tale.
    if failed_rows == 0:
        overall_status = ImportStatus.success
    elif success_rows == 0:
        overall_status = ImportStatus.failed
    else:
        overall_status = ImportStatus.partial

    period_start, period_end = _derive_period(entries)
    import_obj = Import(
        employee_id=user_id,
        operator_id=None,  # self-import; l'import per conto terzi è E8b/HR
        status=overall_status,
        period_start=period_start,
        period_end=period_end,
        total_rows=total_rows,
        success_rows=success_rows,
        failed_rows=failed_rows,
        rows=import_rows,
    )
    db.add(import_obj)

    # 4. Upsert mappature riga↔connettore (fa il commit finale della transazione).
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
    db.refresh(import_obj)

    return ImportResponse(import_id=import_obj.id, results=results)


@router.get("/imports", response_model=list[ImportLogSummary])
def list_imports(
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    service: UserTokenService | None = Query(default=None),
    status: ImportStatus | None = Query(default=None),
) -> list[ImportLogSummary]:
    # Filtra SEMPRE sui log del richiedente: la vista di tutti i log è E9b.
    # selectinload evita l'N+1: `_distinct_services` legge `imp.rows`, che
    # senza eager-load genererebbe una SELECT su import_rows per ogni import.
    q = (
        db.query(Import)
        .options(selectinload(Import.rows))
        .filter(Import.employee_id == user_id)
    )
    if period_from is not None:
        q = q.filter(Import.period_end >= period_from)
    if period_to is not None:
        q = q.filter(Import.period_start <= period_to)
    if status is not None:
        q = q.filter(Import.status == status)
    if service is not None:
        q = q.filter(
            Import.id.in_(
                db.query(ImportRow.import_id).filter(ImportRow.service == service)
            )
        )
    imports = q.order_by(Import.created_at.desc()).all()
    return [_to_summary(imp) for imp in imports]


@router.get("/imports/{import_id}", response_model=ImportLogDetail)
def get_import(
    import_id: UUID,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> ImportLogDetail:
    imp = (
        db.query(Import)
        .filter(Import.id == import_id, Import.employee_id == user_id)
        .first()
    )
    # Stessa risposta per inesistente e per log di altro utente: nessun leakage.
    if imp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importazione non trovata",
        )
    return _to_detail(imp)
