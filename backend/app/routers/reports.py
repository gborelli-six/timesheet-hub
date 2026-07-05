"""
Router report ore: GET /api/me/reports/hours

Restituisce le ore aggregate alla granularità massima
(excel_project, excel_task, entry_date, connector_label, service).
L'aggregazione gerarchica è demandata al client (E9d-3).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.rbac import CurrentUser, UserRole, require_role
from app.db.session import get_db
from app.models.import_log import Import, ImportRow, ImportRowStatus
from app.models.user_token import UserTokenService

router = APIRouter(prefix="/api/me", tags=["me-reports"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


class HoursDetailRow(BaseModel):
    excel_project: str
    excel_task: str
    entry_date: date | None
    connector_label: str
    service: str
    total_hours: float
    row_count: int


class HoursReportResponse(BaseModel):
    rows: list[HoursDetailRow]
    grand_total_hours: float


@router.get("/reports/hours", response_model=HoursReportResponse)
def get_hours_report(
    user: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    db: Session = Depends(get_db),
    period_from: date | None = Query(default=None),
    period_to: date | None = Query(default=None),
    service: UserTokenService | None = Query(default=None),
    connector_label: str | None = Query(default=None),
    project: str | None = Query(default=None),
    task: str | None = Query(default=None),
) -> HoursReportResponse:
    own_imports_sel = select(Import.id).where(Import.employee_id == user.id)

    q = db.query(
        ImportRow.excel_project,
        ImportRow.excel_task,
        ImportRow.entry_date,
        ImportRow.connector_label,
        ImportRow.service,
        func.sum(ImportRow.hours).label("total_hours"),
        func.count(ImportRow.id).label("row_count"),
    ).filter(
        ImportRow.import_id.in_(own_imports_sel),
        ImportRow.status == ImportRowStatus.success,
    )

    # Le righe con entry_date=null vengono escluse quando è attivo un filtro periodo.
    if period_from is not None:
        q = q.filter(
            ImportRow.entry_date.is_not(None),
            ImportRow.entry_date >= period_from,
        )
    if period_to is not None:
        q = q.filter(
            ImportRow.entry_date.is_not(None),
            ImportRow.entry_date <= period_to,
        )
    if service is not None:
        q = q.filter(ImportRow.service == service)
    if connector_label is not None:
        q = q.filter(ImportRow.connector_label == connector_label)
    if project is not None:
        q = q.filter(ImportRow.excel_project == project)
    if task is not None:
        q = q.filter(ImportRow.excel_task == task)

    rows_raw = (
        q.group_by(
            ImportRow.excel_project,
            ImportRow.excel_task,
            ImportRow.entry_date,
            ImportRow.connector_label,
            ImportRow.service,
        )
        .order_by(
            ImportRow.excel_project,
            ImportRow.excel_task,
            ImportRow.entry_date,
            ImportRow.connector_label,
            ImportRow.service,
        )
        .all()
    )

    rows = [
        HoursDetailRow(
            excel_project=r.excel_project,
            excel_task=r.excel_task,
            entry_date=r.entry_date,
            connector_label=r.connector_label,
            service=r.service.value if hasattr(r.service, "value") else r.service,
            total_hours=float(r.total_hours),
            row_count=r.row_count,
        )
        for r in rows_raw
    ]
    grand_total = sum(r.total_hours for r in rows)
    return HoursReportResponse(rows=rows, grand_total_hours=grand_total)
