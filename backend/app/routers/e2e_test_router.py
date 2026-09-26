"""
Rotte test-only — attive SOLO se E2E_TEST_MODE=true (ADR-003-B).
Questo modulo non viene importato se il flag è assente.

POST /_test/session         — emette JWT HS256 per il ruolo richiesto (STORY-020).
POST /_test/reset           — cancella imports, connector_row_mappings e user_tokens.
POST /_test/seed-mapping    — inserisce un UserToken e un ConnectorRowMapping di test.
POST /_test/seed-import-log — inietta Import + ImportRow per test RBAC (E9a-7).
POST /_test/seed-connector — inserisce un UserToken (sorgente o destinazione).
POST /_test/seed-report-data — inietta 4 ImportRow success per la pagina Report (E9d-5).
"""

import re
from datetime import UTC, date, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.rbac import UserRole
from app.core.security import create_jwt, encrypt_secret
from app.db.session import get_db
from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user import User, upsert_user
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
    # Marker E2E (E2E__OK / E2E__FAIL / E2E__EXPIRED / E2E__DOWN): gli stub lo
    # leggono da qui. Se resta None lo stub si comporta sempre come E2E__OK.
    account_identifier: str | None = None


class SeedConnectorRequest(BaseModel):
    email: str
    connector_label: str
    service: str
    account_identifier: str | None = None
    base_url: str | None = None
    config: dict | None = None
    secret: str = "e2e-stub-token"


def _upsert_seed_token(
    db: Session,
    user: User,
    label: str,
    service: UserTokenService,
    account_identifier: str | None = None,
    base_url: str | None = None,
    config: dict | None = None,
    secret: str = "e2e-stub-token",
) -> UserToken:
    """Crea o aggiorna un UserToken di test.

    L'AAD della cifratura deve essere (user_id, token.id) come in
    app/routers/connectors.py: usare un valore diverso — il label, per esempio —
    produce un token che si salva senza errori ma è indecifrabile al primo
    import. L'id va quindi generato qui ed è passato a entrambe le chiamate.
    """
    token = db.scalars(
        select(UserToken).where(
            UserToken.user_id == user.id,
            UserToken.label == label,
        )
    ).first()

    if token is None:
        connector_id = uuid4()
        secret_enc, nonce, key_version = encrypt_secret(
            secret, str(user.id), str(connector_id)
        )
        token = UserToken(
            id=connector_id,
            user_id=user.id,
            label=label,
            service=service,
            account_identifier=account_identifier,
            base_url=base_url,
            config=config or {},
            secret_enc=secret_enc,
            nonce=nonce,
            key_version=key_version,
            needs_reauth=False,
        )
        db.add(token)
        return token

    if token.service != service:
        token.service = service
    if account_identifier is not None:
        token.account_identifier = account_identifier
    if base_url is not None:
        token.base_url = base_url
    if config is not None:
        token.config = config
    return token


@router.post("/session")
def create_test_session(
    body: TestSessionRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    """
    Emette un JWT HS256 bypassando OAuth Google e lo imposta come cookie session.
    Crea/aggiorna l'utente nel DB identicamente a POST /api/auth/callback.
    Accetta: {"email": "..@sixfeetup.it", "role": "employee|hr|admin"}
    """
    user = upsert_user(db, email=body.email, name=None)
    token = create_jwt({"sub": str(user.id), "email": user.email, "role": body.role})
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
    db.execute(delete(Import))  # cascade elimina import_rows
    db.execute(delete(ConnectorRowMapping))
    db.execute(delete(UserToken))
    db.commit()
    return {"ok": True}


class SeedImportLogRequest(BaseModel):
    email: str


@router.post("/seed-import-log")
def seed_import_log(req: SeedImportLogRequest, db: Session = Depends(get_db)) -> dict:
    """
    Inietta un record Import (partial: 1 success + 1 failed) per l'utente dato.
    Usato in E2E per testare il RBAC "employee vede solo i propri log" (Scenario #15).
    """
    user = db.scalars(select(User).where(User.email == req.email)).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {req.email}")

    imp = Import(
        employee_id=user.id,
        operator_id=None,
        status=ImportStatus.partial,
        period_start=date(2026, 1, 15),
        period_end=date(2026, 1, 16),
        total_rows=2,
        success_rows=1,
        failed_rows=1,
    )
    db.add(imp)
    db.flush()

    db.add(
        ImportRow(
            import_id=imp.id,
            row_number=1,
            connector_label="odoo-test",
            service=UserTokenService.odoo,
            excel_project="E2E__OK",
            excel_task="development",
            hours=8.0,
            status=ImportRowStatus.success,
            error_message=None,
        )
    )
    db.add(
        ImportRow(
            import_id=imp.id,
            row_number=2,
            connector_label="odoo-test",
            service=UserTokenService.odoo,
            excel_project="E2E__OK",
            excel_task="E2E__FAIL",
            hours=4.0,
            status=ImportRowStatus.failed,
            error_message="Stub: task E2E__FAIL rejected",
        )
    )
    db.commit()
    return {"ok": True, "import_id": str(imp.id)}


@router.post("/seed-mapping")
def seed_mapping(req: SeedMappingRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalars(select(User).where(User.email == req.email)).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {req.email}")

    _upsert_seed_token(
        db,
        user,
        req.connector_label,
        UserTokenService(req.service),
        account_identifier=req.account_identifier,
    )

    norm_proj = _normalize(req.excel_project)
    norm_task = _normalize(req.excel_task)
    now = datetime.now(UTC)

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


@router.post("/seed-connector")
def seed_connector(req: SeedConnectorRequest, db: Session = Depends(get_db)) -> dict:
    """Inietta un connettore senza mappature — serve alle sorgenti (E13).

    Per attivare uno scenario di errore dello stub passare il marker in
    `account_identifier` (E2E__DOWN, E2E__EXPIRED, E2E__FAIL).
    """
    user = db.scalars(select(User).where(User.email == req.email)).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {req.email}")

    token = _upsert_seed_token(
        db,
        user,
        req.connector_label,
        UserTokenService(req.service),
        account_identifier=req.account_identifier,
        base_url=req.base_url,
        config=req.config,
        secret=req.secret,
    )
    db.commit()
    return {"ok": True, "connector_id": str(token.id)}


class SeedReportDataRequest(BaseModel):
    email: str


@router.post("/seed-report-data")
def seed_report_data(req: SeedReportDataRequest, db: Session = Depends(get_db)) -> dict:
    """
    Crea 4 ImportRow con status=success per testare la pagina Report (E9d-5).
    Dati: Alpha (odoo-report, 12h) + Beta (jira-report, 8h) — date giugno 2026.
    """
    user = db.scalars(select(User).where(User.email == req.email)).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {req.email}")

    imp = Import(
        employee_id=user.id,
        operator_id=None,
        status=ImportStatus.success,
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        total_rows=4,
        success_rows=4,
        failed_rows=0,
    )
    db.add(imp)
    db.flush()

    for row in [
        ImportRow(
            import_id=imp.id,
            row_number=1,
            connector_label="odoo-report",
            service=UserTokenService.odoo,
            excel_project="Alpha",
            excel_task="Dev",
            hours=8.0,
            entry_date=date(2026, 6, 1),
            status=ImportRowStatus.success,
        ),
        ImportRow(
            import_id=imp.id,
            row_number=2,
            connector_label="odoo-report",
            service=UserTokenService.odoo,
            excel_project="Alpha",
            excel_task="Review",
            hours=4.0,
            entry_date=date(2026, 6, 2),
            status=ImportRowStatus.success,
        ),
        ImportRow(
            import_id=imp.id,
            row_number=3,
            connector_label="jira-report",
            service=UserTokenService.jira,
            excel_project="Beta",
            excel_task="Dev",
            hours=6.0,
            entry_date=date(2026, 6, 1),
            status=ImportRowStatus.success,
        ),
        ImportRow(
            import_id=imp.id,
            row_number=4,
            connector_label="jira-report",
            service=UserTokenService.jira,
            excel_project="Beta",
            excel_task="QA",
            hours=2.0,
            entry_date=date(2026, 6, 3),
            status=ImportRowStatus.success,
        ),
    ]:
        db.add(row)

    db.commit()
    return {"ok": True, "import_id": str(imp.id)}
