"""
Test di integrazione per la lettura dei log (GET /api/me/imports[/{id}]).

Verifica: lista propria ordinata desc + filtri (period/service/status); log di altro
utente assente dalla lista; dettaglio con righe miste (error_message sui fail);
404 per import inesistente; 404 per import di altro utente (nessun leakage).
"""

from datetime import UTC, date, datetime, timedelta
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
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.import_log import Import, ImportRow, ImportRowStatus, ImportStatus
from app.models.user import User
from app.models.user_token import UserTokenService

TEST_SECRET = "test-imports-read-integration-secret-xxxxxxxxxxxx"
TEST_ENCRYPT_KEY = "9efb0d60b1cc99a95e666c278d4999486959b52989f5a106803a1f3c62eae4c2"

USER_A_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_B_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

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
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def api(monkeypatch, db_session):
    monkeypatch.setattr(security_module, "settings", FAKE_SETTINGS)
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, db_session
    app.dependency_overrides.clear()


def _setup_users(db) -> None:
    db.add(User(id=USER_A_ID, email="user-a@example.com", name="User A"))
    db.add(User(id=USER_B_ID, email="user-b@example.com", name="User B"))
    db.commit()


def _seed_import(
    db,
    employee_id: UUID,
    *,
    created_at: datetime,
    period_start: date,
    period_end: date,
    status: ImportStatus,
    service: UserTokenService = UserTokenService.odoo,
    with_failed_row: bool = False,
) -> Import:
    rows = [
        ImportRow(
            row_number=1,
            connector_label=f"{service.value}-work",
            service=service,
            excel_project="Progetto Alpha",
            excel_task="Task Frontend",
            remote_project_id="1",
            remote_project_name="Alpha Remote",
            remote_task_id="101",
            remote_task_name="Frontend Remote",
            hours=8.0,
            status=ImportRowStatus.success,
            error_message=None,
        )
    ]
    if with_failed_row:
        rows.append(
            ImportRow(
                row_number=2,
                connector_label=f"{service.value}-work",
                service=service,
                excel_project="Progetto Beta",
                excel_task="Task Backend",
                hours=4.0,
                status=ImportRowStatus.failed,
                error_message="Errore applicativo",
            )
        )
    imp = Import(
        id=uuid4(),
        employee_id=employee_id,
        operator_id=None,
        status=status,
        period_start=period_start,
        period_end=period_end,
        total_rows=len(rows),
        success_rows=sum(1 for r in rows if r.status == ImportRowStatus.success),
        failed_rows=sum(1 for r in rows if r.status == ImportRowStatus.failed),
        created_at=created_at,
        rows=rows,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return imp


def test_list_returns_only_own_logs_ordered_desc(api):
    client, db = api
    _setup_users(db)
    base = datetime(2026, 6, 1, 12, 0, 0)
    older = _seed_import(
        db,
        USER_A_ID,
        created_at=base,
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
        status=ImportStatus.success,
    )
    newer = _seed_import(
        db,
        USER_A_ID,
        created_at=base + timedelta(days=10),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        status=ImportStatus.partial,
        with_failed_row=True,
    )
    # Log di un altro utente: NON deve comparire
    _seed_import(
        db,
        USER_B_ID,
        created_at=base + timedelta(days=20),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        status=ImportStatus.success,
    )

    r = client.get("/api/me/imports", cookies={"session": _make_session(USER_A_ID)})
    assert r.status_code == 200
    data = r.json()
    assert [item["id"] for item in data] == [str(newer.id), str(older.id)]
    assert data[0]["services"] == ["odoo"]
    assert data[0]["failed_rows"] == 1


def test_filter_by_status_and_period_and_service(api):
    client, db = api
    _setup_users(db)
    base = datetime(2026, 6, 1, 12, 0, 0)
    _seed_import(
        db,
        USER_A_ID,
        created_at=base,
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
        status=ImportStatus.success,
        service=UserTokenService.odoo,
    )
    jira_partial = _seed_import(
        db,
        USER_A_ID,
        created_at=base + timedelta(days=5),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        status=ImportStatus.partial,
        service=UserTokenService.jira,
        with_failed_row=True,
    )
    session = _make_session(USER_A_ID)

    # Filtro status
    r = client.get(
        "/api/me/imports", params={"status": "partial"}, cookies={"session": session}
    )
    assert [i["id"] for i in r.json()] == [str(jira_partial.id)]

    # Filtro service
    r = client.get(
        "/api/me/imports", params={"service": "jira"}, cookies={"session": session}
    )
    assert [i["id"] for i in r.json()] == [str(jira_partial.id)]

    # Filtro periodo: period_end >= 2026-06-01 seleziona solo il secondo
    r = client.get(
        "/api/me/imports",
        params={"period_from": "2026-06-01"},
        cookies={"session": session},
    )
    assert [i["id"] for i in r.json()] == [str(jira_partial.id)]


def test_detail_shows_rows_and_error_messages(api):
    client, db = api
    _setup_users(db)
    imp = _seed_import(
        db,
        USER_A_ID,
        created_at=datetime(2026, 6, 1, 12, 0, 0),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        status=ImportStatus.partial,
        with_failed_row=True,
    )

    r = client.get(
        f"/api/me/imports/{imp.id}", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == str(imp.id)
    assert len(data["rows"]) == 2
    ok_row = next(row for row in data["rows"] if row["status"] == "success")
    fail_row = next(row for row in data["rows"] if row["status"] == "failed")
    assert ok_row["error_message"] is None
    assert fail_row["error_message"] == "Errore applicativo"


def test_detail_404_when_not_found(api):
    client, db = api
    _setup_users(db)
    r = client.get(
        f"/api/me/imports/{uuid4()}", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 404


def test_detail_404_when_other_user(api):
    client, db = api
    _setup_users(db)
    imp = _seed_import(
        db,
        USER_B_ID,
        created_at=datetime(2026, 6, 1, 12, 0, 0),
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        status=ImportStatus.success,
    )
    # User A chiede il log di User B → 404 (stessa risposta di "inesistente")
    r = client.get(
        f"/api/me/imports/{imp.id}", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 404


def test_list_without_auth_returns_401(api):
    client, _ = api
    r = client.get("/api/me/imports")
    assert r.status_code == 401
