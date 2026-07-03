import asyncio
import logging
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, selectinload

from app.adapters.base import AdapterAuthError, AdapterConnectionError
from app.adapters.base import ConnectorAssignment as AdapterAssignment
from app.adapters.base import TimesheetEntry as AdapterEntry
from app.adapters.registry import adapter_registry
from app.core.rbac import CurrentUser, UserRole, require_role
from app.db.session import SessionLocal, get_db
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user_token import UserTokenService
from app.routers.adapters import _build_adapter_config, _get_token_or_404
from app.services import mapping_service

logger = logging.getLogger(__name__)
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


class ConnectorRef(BaseModel):
    service: str
    label: str


class ImportResponse(BaseModel):
    # `import_id` identifica il log persistito, così il wizard può linkare al
    # dettaglio. `results` è vuoto al momento del ritorno asincrono.
    import_id: UUID
    results: list[ConnectorResultOut] = []


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
    connectors: list[ConnectorRef]
    created_at: datetime


class ImportLogDetail(ImportLogSummary):
    rows: list[ImportRowOut]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _distinct_services(imp: Import) -> list[str]:
    return sorted({row.service.value for row in imp.rows})


def _distinct_connectors(imp: Import) -> list[ConnectorRef]:
    seen: set[tuple] = set()
    result = []
    for row in imp.rows:
        key = (row.service.value, row.connector_label)
        if key not in seen:
            seen.add(key)
            result.append(
                ConnectorRef(service=row.service.value, label=row.connector_label)
            )
    return sorted(result, key=lambda x: (x.service, x.label))


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
        connectors=_distinct_connectors(imp),
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


def _filter_entries_for_label(
    entries: list[EntryIn], label: str
) -> tuple[list[AdapterEntry], list[int]]:
    """Ritorna (filtered_entries, original_row_numbers_1based) per il label dato."""
    filtered: list[AdapterEntry] = []
    original_rows: list[int] = []
    for idx, entry in enumerate(entries):
        matching = [
            a for a in entry.connector_assignments if a.connector_label == label
        ]
        if not matching:
            continue
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
    return filtered, original_rows


def _persist_import_results(
    db: Session,
    import_id: UUID,
    user_id: UUID,
    entries: list[EntryIn],
    outcomes: list,
) -> None:
    """Costruisce le ImportRow dagli outcomes, aggiorna l'Import e fa commit."""
    label_service: dict[str, UserTokenService] = {}
    label_failures: dict[str, dict[int, str]] = {}

    for label, original_rows, _config, service, import_result, exc in outcomes:
        label_service[label] = service
        if import_result is not None:
            label_failures[label] = {
                original_rows[e.row]: e.message for e in import_result.errors
            }
        else:
            # Errore di adapter: tutte le righe di questo label fallite.
            err_msg = str(exc) if exc is not None else "Errore sconosciuto"
            label_failures[label] = {row_num: err_msg for row_num in original_rows}

    import_rows: list[ImportRow] = []
    row_failed: dict[int, bool] = {}
    for idx, entry in enumerate(entries):
        row_number = idx + 1
        for a in entry.connector_assignments:
            label = a.connector_label
            failures = label_failures.get(label, {})
            error_message = failures.get(row_number)
            is_failed = row_number in failures
            row_failed[row_number] = row_failed.get(row_number, False) or is_failed
            import_rows.append(
                ImportRow(
                    row_number=row_number,
                    connector_label=label,
                    service=label_service[label],
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

    if failed_rows == 0:
        overall_status = ImportStatus.success
    elif success_rows == 0:
        overall_status = ImportStatus.failed
    else:
        overall_status = ImportStatus.partial

    imp = db.get(Import, import_id)
    if imp is not None:
        imp.status = overall_status
        imp.total_rows = total_rows
        imp.success_rows = success_rows
        imp.failed_rows = failed_rows
        imp.rows = import_rows
        db.add(imp)

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
    db.commit()


def _mark_import_failed(import_id: UUID) -> None:
    with SessionLocal() as db:
        imp = db.get(Import, import_id)
        if imp is not None:
            # Nessuna riga persistita in questo path (errore imprevisto): allinea
            # i conteggi allo status così l'header non mostra "0/0" con badge Fallito.
            imp.status = ImportStatus.failed
            imp.failed_rows = imp.total_rows
            imp.success_rows = 0
            db.commit()


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------


async def import_worker(queue: asyncio.Queue) -> None:
    while True:
        job = await queue.get()
        try:
            await _run_import_job(job)
        except Exception:
            logger.exception(
                "Errore nel worker import per import_id=%s", job.get("import_id")
            )
            _mark_import_failed(job["import_id"])
        finally:
            queue.task_done()


async def _run_import_job(job: dict) -> None:
    import_id: UUID = job["import_id"]
    entries: list[EntryIn] = job["entries"]
    label_configs: list[tuple] = job["label_configs"]
    user_id: UUID = job["user_id"]

    async def call_one(label, filtered, original_rows, config, service):
        try:
            adapter_cls = adapter_registry.get(config.service)
            result = await asyncio.to_thread(adapter_cls().submit, filtered, config)
            return label, original_rows, config, service, result, None
        except (AdapterAuthError, AdapterConnectionError) as exc:
            return label, original_rows, config, service, None, exc

    outcomes = await asyncio.gather(*[call_one(*lc) for lc in label_configs])

    with SessionLocal() as db:
        _persist_import_results(db, import_id, user_id, entries, list(outcomes))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/imports", response_model=ImportResponse)
async def submit_imports(
    body: ImportRequest,
    request: Request,
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> ImportResponse:
    entries = body.entries

    distinct_labels = list(
        {a.connector_label for entry in entries for a in entry.connector_assignments}
    )

    # Validazione early: se un token manca → 404 prima di qualsiasi commit
    label_configs = []
    for label in distinct_labels:
        token = _get_token_or_404(db, user.id, label)
        config = _build_adapter_config(token, user.id)
        filtered, original_rows = _filter_entries_for_label(entries, label)
        label_configs.append((label, filtered, original_rows, config, token.service))

    period_start, period_end = _derive_period(entries)
    total_rows = len(
        {idx + 1 for idx, e in enumerate(entries) if e.connector_assignments}
    )

    import_obj = Import(
        employee_id=user.id,
        operator_id=None,
        status=ImportStatus.in_progress,
        period_start=period_start,
        period_end=period_end,
        total_rows=total_rows,
        success_rows=0,
        failed_rows=0,
    )
    db.add(import_obj)
    db.commit()
    db.refresh(import_obj)

    job = {
        "import_id": import_obj.id,
        "user_id": user.id,
        "entries": entries,
        "label_configs": label_configs,
    }
    await request.app.state.import_queue.put(job)

    return ImportResponse(import_id=import_obj.id, results=[])


@router.get("/imports", response_model=list[ImportLogSummary])
def list_imports(
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    service: UserTokenService | None = Query(default=None),
    connector_label: str | None = Query(default=None),
    status: ImportStatus | None = Query(default=None),
) -> list[ImportLogSummary]:
    # Filtra SEMPRE sui log del richiedente: la vista di tutti i log è E9b.
    # selectinload evita l'N+1: `_distinct_services` legge `imp.rows`, che
    # senza eager-load genererebbe una SELECT su import_rows per ogni import.
    q = (
        db.query(Import)
        .options(selectinload(Import.rows))
        .filter(Import.employee_id == user.id)
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
    if connector_label is not None:
        q = q.filter(
            Import.id.in_(
                db.query(ImportRow.import_id).filter(
                    ImportRow.connector_label == connector_label
                )
            )
        )
    imports = q.order_by(Import.created_at.desc()).all()
    return [_to_summary(imp) for imp in imports]


@router.get("/imports/{import_id}", response_model=ImportLogDetail)
def get_import(
    import_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
) -> ImportLogDetail:
    imp = (
        db.query(Import)
        .filter(Import.id == import_id, Import.employee_id == user.id)
        .first()
    )
    # Stessa risposta per inesistente e per log di altro utente: nessun leakage.
    if imp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importazione non trovata",
        )
    return _to_detail(imp)
