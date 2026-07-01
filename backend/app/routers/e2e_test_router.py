"""
Rotte test-only — attive SOLO se E2E_TEST_MODE=true (ADR-003-B).
Questo modulo non viene importato se il flag è assente.

POST /_test/session      — emette JWT HS256 per il ruolo richiesto (STORY-020).
POST /_test/reset        — cancella connector_row_mappings e user_tokens.
POST /_test/seed-mapping — inserisce un UserToken e un ConnectorRowMapping di test.
"""

import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.rbac import UserRole
from app.core.security import create_jwt, encrypt_secret
from app.db.session import get_db
from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.user import User
from app.models.user_token import UserToken, UserTokenService

router = APIRouter(prefix="/_test", tags=["e2e-test-only"])


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip()).lower()


class TestSessionRequest(BaseModel):
    email: str
    role: UserRole


class SeedMappingRequest(BaseModel):
    email: str
    connector_label: str
    service: str = "odoo"
    excel_project: str
    excel_task: str
    remote_project_id: str
    remote_project_name: str
    remote_task_id: str
    remote_task_name: str


@router.post("/session")
async def create_test_session(body: TestSessionRequest, response: Response) -> dict:
    """
    Emette un JWT HS256 bypassando OAuth Google e lo imposta come cookie session.
    Identico al comportamento di POST /api/auth/callback.
    Accetta: {"email": "..@sixfeetup.it", "role": "employee|hr|admin"}
    """
    token = create_jwt(
        {"sub": f"test-{body.role}", "email": body.email, "role": body.role}
    )
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=False,  # E2E gira su HTTP — Secure=True bloccherebbe il cookie
        samesite="lax",  # lax necessario su HTTP (strict richiederebbe HTTPS)
        max_age=28800,
        path="/",
    )
    return {"ok": True}


@router.post("/reset")
def reset_test_data(db: Session = Depends(get_db)) -> dict:
    db.execute(delete(ConnectorRowMapping))
    db.execute(delete(UserToken))
    db.commit()
    return {"ok": True}


@router.post("/seed-mapping")
def seed_mapping(req: SeedMappingRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalars(select(User).where(User.email == req.email)).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {req.email}")

    service = UserTokenService(req.service)

    token = db.scalars(
        select(UserToken).where(
            UserToken.user_id == user.id,
            UserToken.label == req.connector_label,
        )
    ).first()

    if token is None:
        secret_enc, nonce, key_version = encrypt_secret(
            "e2e-stub-token", str(user.id), req.connector_label
        )
        token = UserToken(
            user_id=user.id,
            label=req.connector_label,
            service=service,
            secret_enc=secret_enc,
            nonce=nonce,
            key_version=key_version,
            needs_reauth=False,
        )
        db.add(token)
    elif token.service != service:
        token.service = service

    norm_proj = _normalize(req.excel_project)
    norm_task = _normalize(req.excel_task)
    now = datetime.now(UTC).replace(tzinfo=None)

    mapping = db.scalars(
        select(ConnectorRowMapping).where(
            ConnectorRowMapping.user_id == user.id,
            ConnectorRowMapping.excel_project == norm_proj,
            ConnectorRowMapping.excel_task == norm_task,
            ConnectorRowMapping.connector_label == req.connector_label,
        )
    ).first()

    if mapping is None:
        db.add(
            ConnectorRowMapping(
                user_id=user.id,
                excel_project=norm_proj,
                excel_task=norm_task,
                connector_label=req.connector_label,
                remote_project_id=req.remote_project_id,
                remote_project_name=req.remote_project_name,
                remote_task_id=req.remote_task_id,
                remote_task_name=req.remote_task_name,
                last_used_at=now,
            )
        )
    else:
        mapping.remote_project_id = req.remote_project_id
        mapping.remote_project_name = req.remote_project_name
        mapping.remote_task_id = req.remote_task_id
        mapping.remote_task_name = req.remote_task_name
        mapping.last_used_at = now

    db.commit()
    return {"ok": True}
