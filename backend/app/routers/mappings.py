from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rbac import CurrentUser, UserRole, require_role
from app.db.session import get_db
from app.routers.connectors import _get_user_id
from app.services import mapping_service

router = APIRouter(prefix="/api/me", tags=["me-mappings"])

_ALL_ROLES = [UserRole.employee, UserRole.hr, UserRole.admin]


class RowKey(BaseModel):
    excel_project: str
    excel_task: str


class MappingSuggestionsRequest(BaseModel):
    rows: list[RowKey]


class ConnectorAssignmentOut(BaseModel):
    connector_label: str
    remote_project_id: str | None = None
    remote_project_name: str | None = None
    remote_task_id: str | None = None
    remote_task_name: str | None = None
    suggested: bool


class MappingSuggestionsResponse(BaseModel):
    suggestions: list[list[ConnectorAssignmentOut]]


@router.post("/mapping-suggestions", response_model=MappingSuggestionsResponse)
def mapping_suggestions(
    body: MappingSuggestionsRequest,
    _: Annotated[CurrentUser, Depends(require_role(_ALL_ROLES))],
    user_id: Annotated[UUID, Depends(_get_user_id)],
    db: Session = Depends(get_db),
) -> MappingSuggestionsResponse:
    rows = [r.model_dump() for r in body.rows]
    raw = mapping_service.get_suggestions(db, user_id, rows)
    suggestions = [
        [ConnectorAssignmentOut(**item) for item in row_items] for row_items in raw
    ]
    return MappingSuggestionsResponse(suggestions=suggestions)
