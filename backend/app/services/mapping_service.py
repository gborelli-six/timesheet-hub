"""Servizio per la gestione dei suggerimenti di mappatura riga↔connettore."""

import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.user_token import UserToken


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip()).lower()


def _active_labels(db: Session, user_id: UUID) -> set[str]:
    tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
    return {t.label for t in tokens}


def get_suggestions(
    db: Session,
    user_id: UUID,
    rows: list[dict],
) -> list[list[dict]]:
    """
    Restituisce, per ogni riga in `rows`, le mappature storiche come lista di
    dict con suggested=True. Le mappature il cui connector_label non è più
    attivo vengono filtrate.

    rows: lista di dict con chiavi excel_project e excel_task.
    """
    active = _active_labels(db, user_id)
    result: list[list[dict]] = []

    for row in rows:
        norm_proj = _normalize(row.get("excel_project", ""))
        norm_task = _normalize(row.get("excel_task", ""))

        mappings = (
            db.query(ConnectorRowMapping)
            .filter(
                ConnectorRowMapping.user_id == user_id,
                ConnectorRowMapping.excel_project == norm_proj,
                ConnectorRowMapping.excel_task == norm_task,
                ConnectorRowMapping.connector_label.in_(active),
            )
            .order_by(ConnectorRowMapping.last_used_at.desc().nulls_last())
            .all()
        )

        row_suggestions = [
            {
                "connector_label": m.connector_label,
                "remote_project_id": m.remote_project_id,
                "remote_project_name": m.remote_project_name,
                "remote_task_id": m.remote_task_id,
                "remote_task_name": m.remote_task_name,
                "suggested": True,
            }
            for m in mappings
        ]
        result.append(row_suggestions)

    return result


def upsert_row_mappings(
    db: Session,
    user_id: UUID,
    assignments: list[dict],
) -> None:
    """
    Upsert delle mappature dopo una submit di importazione.

    assignments: lista di dict con chiavi excel_project, excel_task,
    connector_label, remote_project_id, remote_project_name,
    remote_task_id, remote_task_name.
    """
    now = datetime.now(UTC)

    for a in assignments:
        norm_proj = _normalize(a.get("excel_project", ""))
        norm_task = _normalize(a.get("excel_task", ""))
        label = a.get("connector_label", "")

        existing = (
            db.query(ConnectorRowMapping)
            .filter(
                ConnectorRowMapping.user_id == user_id,
                ConnectorRowMapping.excel_project == norm_proj,
                ConnectorRowMapping.excel_task == norm_task,
                ConnectorRowMapping.connector_label == label,
            )
            .first()
        )

        if existing is None:
            db.add(
                ConnectorRowMapping(
                    user_id=user_id,
                    excel_project=norm_proj,
                    excel_task=norm_task,
                    connector_label=label,
                    remote_project_id=a.get("remote_project_id"),
                    remote_project_name=a.get("remote_project_name"),
                    remote_task_id=a.get("remote_task_id"),
                    remote_task_name=a.get("remote_task_name"),
                    last_used_at=now,
                )
            )
        else:
            existing.remote_project_id = a.get("remote_project_id")
            existing.remote_project_name = a.get("remote_project_name")
            existing.remote_task_id = a.get("remote_task_id")
            existing.remote_task_name = a.get("remote_task_name")
            existing.last_used_at = now

    db.commit()
