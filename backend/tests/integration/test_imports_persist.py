"""
Test di integrazione per la persistenza del log alla submit (POST /api/me/imports).

Con il flusso asincrono, POST ritorna subito con status=in_progress e results=[].
Il worker processa il job in background; i test attendono il completamento tramite
polling su GET /api/me/imports/{id} fino a status != in_progress.

Verifica: submit con esiti misti (E2E__OK / E2E__FAIL) → header con status/conteggi
corretti + import_rows coerenti; import_id nella response; connector_row_mappings
aggiornate; connettore E2E__DOWN → log persistito con status=failed.
"""

import time
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.security as security_module
import app.models  # noqa: F401 — registra tutti i modelli in Base.metadata
import app.routers.imports as imports_module
from app.adapters.base import ServiceType
from app.adapters.registry import adapter_registry
from app.adapters.stub import StubAdapter
from app.core.security import encrypt_secret
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user import User
from app.models.user_token import UserToken, UserTokenService

TEST_SECRET = "test-imports-integration-secret-xxxxxxxxxxxxxxxxxx"
TEST_ENCRYPT_KEY = "9efb0d60b1cc99a95e666c278d4999486959b52989f5a106803a1f3c62eae4c2"

USER_A_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

FAKE_SETTINGS = SimpleNamespace(
    jwt_secret=TEST_SECRET,
    token_encrypt_key=TEST_ENCRYPT_KEY,
)


def _make_session(user_id: UUID, role: str = "employee") -> str:
    now = datetime.now(UTC)
    return pyjwt.encode(
        {
            "sub": str(user_id),
            "email": f"{str(user_id)[:8]}@example.com",
            "role": role,
            "iat": now,
            "exp": now + timedelta(hours=8),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def stub_registered():
    # Registra lo StubAdapter per odoo/jira e ripristina lo stato al termine.
    saved = dict(adapter_registry._registry)
    adapter_registry.register(ServiceType.odoo, StubAdapter)
    adapter_registry.register(ServiceType.jira, StubAdapter)
    yield
    adapter_registry._registry = saved


@pytest.fixture()
def api(monkeypatch, db_engine, db_session, stub_registered):
    monkeypatch.setattr(security_module, "settings", FAKE_SETTINGS)
    # Patcha sia get_db (per i router) sia SessionLocal nel modulo imports
    # (usato dal worker asincrono che apre la propria sessione).
    TestSessionLocal = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(imports_module, "SessionLocal", TestSessionLocal)
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, db_session
    app.dependency_overrides.clear()


def _setup_user(db) -> User:
    user = User(id=USER_A_ID, email="user-a@example.com", name="User A")
    db.add(user)
    db.commit()
    return user


def _add_token(db, user_id: UUID, label: str, marker: str) -> UserToken:
    connector_id = uuid4()
    secret_enc, nonce, key_version = encrypt_secret(
        "test-secret", str(user_id), str(connector_id)
    )
    token = UserToken(
        id=connector_id,
        user_id=user_id,
        service=UserTokenService.odoo,
        label=label,
        base_url="https://odoo.example.com",
        account_identifier=marker,  # lo StubAdapter legge il marker E2E__ da qui
        secret_enc=secret_enc,
        nonce=nonce,
        key_version=key_version,
    )
    db.add(token)
    db.commit()
    return token


def _entry(date_str, project, task, hours, label, remote_project_id, remote_task_id):
    return {
        "date": date_str,
        "project": project,
        "task": task,
        "hours": hours,
        "connector_assignments": [
            {
                "connector_label": label,
                "remote_project_id": remote_project_id,
                "remote_project_name": f"{project} Remote",
                "remote_task_id": remote_task_id,
                "remote_task_name": f"{task} Remote",
            }
        ],
    }


def _wait_import_done(
    client: TestClient, import_id: UUID, session_cookie: str, timeout: float = 5.0
) -> dict:
    """Polling su GET /api/me/imports/{id} finché status != in_progress."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        r = client.get(
            f"/api/me/imports/{import_id}",
            cookies={"session": session_cookie},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        if data["status"] != "in_progress":
            return data
        time.sleep(0.05)
    raise TimeoutError(f"Import {import_id} still in_progress after {timeout}s")


def test_post_returns_immediately_with_in_progress(api):
    """POST ritorna subito con import_id, results=[] e status=in_progress."""
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-ok", "E2E__OK")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            _entry(
                "2026-06-10",
                "Progetto Alpha",
                "Task Frontend",
                8.0,
                "odoo-ok",
                "1",
                "101",
            ),
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    data = r.json()
    assert "import_id" in data
    assert data["results"] == []

    # Lo stato iniziale nel DB deve essere in_progress
    imp = db.query(Import).filter(Import.id == UUID(data["import_id"])).one()
    assert imp.status == ImportStatus.in_progress


def test_mixed_submit_persists_log(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-ok", "E2E__OK")
    _add_token(db, USER_A_ID, "odoo-fail", "E2E__FAIL")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            _entry(
                "2026-06-10",
                "Progetto Alpha",
                "Task Frontend",
                8.0,
                "odoo-ok",
                "1",
                "101",
            ),
            _entry(
                "2026-06-20",
                "Progetto Beta",
                "Task Backend",
                4.0,
                "odoo-fail",
                "2",
                "201",
            ),
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    data = r.json()

    assert "import_id" in data
    import_id = UUID(data["import_id"])

    # Attende che il worker completi il job
    final = _wait_import_done(client, import_id, session)

    # Verifica response finale via GET
    assert final["status"] == "partial"

    # Header persistito (rilegge dalla stessa sessione DB dopo commit del worker)
    db.expire_all()
    imp = db.query(Import).filter(Import.id == import_id).one()
    assert imp.employee_id == USER_A_ID
    assert imp.operator_id is None
    assert imp.status == ImportStatus.partial
    assert imp.total_rows == 2
    assert imp.success_rows == 1
    assert imp.failed_rows == 1
    assert imp.period_start.isoformat() == "2026-06-10"
    assert imp.period_end.isoformat() == "2026-06-20"

    # Righe coerenti
    rows = db.query(ImportRow).filter(ImportRow.import_id == import_id).all()
    assert len(rows) == 2
    ok_row = next(r for r in rows if r.connector_label == "odoo-ok")
    fail_row = next(r for r in rows if r.connector_label == "odoo-fail")
    assert ok_row.status == ImportRowStatus.success
    assert ok_row.error_message is None
    assert ok_row.row_number == 1
    assert fail_row.status == ImportRowStatus.failed
    assert fail_row.error_message == "Stub: errore applicativo"
    assert fail_row.row_number == 2

    # Mappature aggiornate
    mappings = (
        db.query(ConnectorRowMapping)
        .filter(ConnectorRowMapping.user_id == USER_A_ID)
        .all()
    )
    assert len(mappings) == 2


def test_all_success_status(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-ok", "E2E__OK")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            _entry(
                "2026-06-15",
                "Progetto Alpha",
                "Task Frontend",
                8.0,
                "odoo-ok",
                "1",
                "101",
            ),
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    import_id = UUID(r.json()["import_id"])

    _wait_import_done(client, import_id, _make_session(USER_A_ID))

    db.expire_all()
    imp = db.query(Import).filter(Import.id == import_id).one()
    assert imp.status == ImportStatus.success
    assert imp.success_rows == 1
    assert imp.failed_rows == 0


def test_multi_connector_row_counts_excel_rows(api):
    # Una singola riga Excel inviata a due connettori (uno OK, uno FAIL): l'header
    # deve contare 1 riga (non 2), fallita perché un connettore ha dato errore.
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-ok", "E2E__OK")
    _add_token(db, USER_A_ID, "odoo-fail", "E2E__FAIL")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            {
                "date": "2026-06-10",
                "project": "Progetto Alpha",
                "task": "Task Frontend",
                "hours": 8.0,
                "connector_assignments": [
                    {
                        "connector_label": "odoo-ok",
                        "remote_project_id": "1",
                        "remote_project_name": "Alpha OK",
                        "remote_task_id": "101",
                        "remote_task_name": "FE OK",
                    },
                    {
                        "connector_label": "odoo-fail",
                        "remote_project_id": "2",
                        "remote_project_name": "Alpha FAIL",
                        "remote_task_id": "201",
                        "remote_task_name": "FE FAIL",
                    },
                ],
            }
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    import_id = UUID(r.json()["import_id"])

    _wait_import_done(client, import_id, session)

    db.expire_all()
    imp = db.query(Import).filter(Import.id == import_id).one()
    # 1 riga Excel, contata una sola volta anche se ha due connettori.
    assert imp.total_rows == 1
    assert imp.failed_rows == 1
    assert imp.success_rows == 0
    # Badge derivato dai conteggi PER RIGA: nessuna riga pienamente importata
    # (success_rows == 0) → esito complessivo "failed", coerente coi numeri.
    # La riga resta comunque visibile come mista nel dettaglio (un OK, un KO).
    assert imp.status == ImportStatus.failed

    # Il dettaglio mantiene comunque una riga per connettore.
    rows = db.query(ImportRow).filter(ImportRow.import_id == imp.id).all()
    assert len(rows) == 2
    assert {row.status for row in rows} == {
        ImportRowStatus.success,
        ImportRowStatus.failed,
    }


def test_partial_status_from_row_counts(api):
    # Due righe Excel distinte, ciascuna su un solo connettore: una pienamente
    # OK, una pienamente KO → success_rows=1, failed_rows=1 → badge "partial".
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-ok", "E2E__OK")
    _add_token(db, USER_A_ID, "odoo-fail", "E2E__FAIL")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            _entry(
                "2026-06-10", "Progetto Alpha", "Task FE", 8.0, "odoo-ok", "1", "101"
            ),
            _entry(
                "2026-06-11", "Progetto Beta", "Task BE", 4.0, "odoo-fail", "2", "201"
            ),
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    import_id = UUID(r.json()["import_id"])

    _wait_import_done(client, import_id, session)

    db.expire_all()
    imp = db.query(Import).filter(Import.id == import_id).one()
    assert imp.total_rows == 2
    assert imp.success_rows == 1
    assert imp.failed_rows == 1
    assert imp.status == ImportStatus.partial


def test_connector_down_persists_failed_log(api):
    # Con il flusso asincrono, E2E__DOWN non genera più 502 a livello di POST.
    # La validazione early controlla solo l'esistenza del token (404 se mancante).
    # Il worker cattura l'AdapterConnectionError e persiste il log come failed.
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-down", "E2E__DOWN")
    session = _make_session(USER_A_ID)

    payload = {
        "entries": [
            _entry(
                "2026-06-15",
                "Progetto Alpha",
                "Task Frontend",
                8.0,
                "odoo-down",
                "1",
                "101",
            ),
        ]
    }
    r = client.post("/api/me/imports", json=payload, cookies={"session": session})
    assert r.status_code == 200
    import_id = UUID(r.json()["import_id"])

    _wait_import_done(client, import_id, session)

    db.expire_all()
    imp = db.query(Import).filter(Import.id == import_id).one()
    assert imp.status == ImportStatus.failed
    # Una riga persistita con stato failed
    rows = db.query(ImportRow).filter(ImportRow.import_id == import_id).all()
    assert len(rows) == 1
    assert rows[0].status == ImportRowStatus.failed
