"""
Test di integrazione per GET /api/me/reports/hours.

Verifica: granularità massima, aggregazione SUM/COUNT, filtri (period_from/to,
service, connector_label, project, task), esclusione righe failed, gestione
entry_date=null, isolamento per utente.
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

TEST_SECRET = "test-reports-integration-secret-xxxxxxxxxxxx"
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


def _make_import(db, employee_id: UUID, rows: list[ImportRow]) -> Import:
    imp = Import(
        id=uuid4(),
        employee_id=employee_id,
        operator_id=None,
        status=ImportStatus.success,
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        total_rows=len(rows),
        success_rows=sum(1 for r in rows if r.status == ImportRowStatus.success),
        failed_rows=sum(1 for r in rows if r.status == ImportRowStatus.failed),
        created_at=datetime(2026, 6, 15, 10, 0, 0),
        rows=rows,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return imp


def _row(
    *,
    excel_project: str = "Progetto Alpha",
    excel_task: str = "Task Frontend",
    connector_label: str = "odoo-work",
    service: UserTokenService = UserTokenService.odoo,
    hours: float = 8.0,
    entry_date: date | None = date(2026, 6, 10),
    status: ImportRowStatus = ImportRowStatus.success,
    row_number: int = 1,
) -> ImportRow:
    return ImportRow(
        row_number=row_number,
        connector_label=connector_label,
        service=service,
        excel_project=excel_project,
        excel_task=excel_task,
        hours=hours,
        entry_date=entry_date,
        status=status,
        error_message=None,
    )


# ---------------------------------------------------------------------------
# Test principali
# ---------------------------------------------------------------------------


def test_returns_own_rows_grouped(api):
    """Le righe success dell'utente vengono aggregate correttamente."""
    client, db = api
    _setup_users(db)
    # 2 righe stessa combinazione (stesso gruppo) → total_hours=10, row_count=2
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=6.0, row_number=1),
            _row(hours=4.0, row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["total_hours"] == 10.0
    assert data["rows"][0]["row_count"] == 2
    assert data["rows"][0]["excel_project"] == "Progetto Alpha"
    assert data["grand_total_hours"] == 10.0


def test_excludes_failed_rows(api):
    """Le righe con status=failed non compaiono nel report."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=8.0, status=ImportRowStatus.success, row_number=1),
            _row(
                hours=4.0,
                status=ImportRowStatus.failed,
                excel_project="Progetto Beta",
                row_number=2,
            ),
        ],
    )

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["excel_project"] == "Progetto Alpha"
    assert data["grand_total_hours"] == 8.0


def test_isolation_from_other_user(api):
    """I dati di un altro utente non compaiono."""
    client, db = api
    _setup_users(db)
    # Solo import di B
    _make_import(db, USER_B_ID, rows=[_row(hours=8.0)])

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["rows"] == []
    assert data["grand_total_hours"] == 0.0


def test_filter_period_from(api):
    """period_from filtra su entry_date >= period_from."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=8.0, entry_date=date(2026, 6, 5), row_number=1),
            _row(hours=4.0, entry_date=date(2026, 6, 15), row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"period_from": "2026-06-10"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["entry_date"] == "2026-06-15"
    assert data["grand_total_hours"] == 4.0


def test_filter_period_to(api):
    """period_to filtra su entry_date <= period_to."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=8.0, entry_date=date(2026, 6, 5), row_number=1),
            _row(hours=4.0, entry_date=date(2026, 6, 25), row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"period_to": "2026-06-10"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["entry_date"] == "2026-06-05"
    assert data["grand_total_hours"] == 8.0


def test_filter_service(api):
    """Il filtro service esclude righe di altri servizi."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(
                service=UserTokenService.odoo,
                connector_label="odoo-work",
                hours=8.0,
                row_number=1,
            ),
            _row(
                service=UserTokenService.jira,
                connector_label="jira-work",
                hours=4.0,
                row_number=2,
            ),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"service": "jira"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["service"] == "jira"
    assert data["grand_total_hours"] == 4.0


def test_filter_connector_label(api):
    """Il filtro connector_label esclude righe di altri connettori."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(connector_label="odoo-lavoro", hours=8.0, row_number=1),
            _row(connector_label="odoo-demo", hours=3.0, row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"connector_label": "odoo-lavoro"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["connector_label"] == "odoo-lavoro"
    assert data["grand_total_hours"] == 8.0


def test_filter_project(api):
    """Il filtro project filtra su excel_project."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(excel_project="Alpha", hours=8.0, row_number=1),
            _row(excel_project="Beta", hours=4.0, row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"project": "Alpha"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["excel_project"] == "Alpha"


def test_filter_task(api):
    """Il filtro task filtra su excel_task."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(excel_task="Frontend", hours=8.0, row_number=1),
            _row(excel_task="Backend", hours=4.0, row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"task": "Frontend"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["excel_task"] == "Frontend"


def test_entry_date_null_included_without_filter(api):
    """Le righe con entry_date=null compaiono quando non c'è filtro periodo."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=8.0, entry_date=None, row_number=1),
        ],
    )

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["entry_date"] is None
    assert data["grand_total_hours"] == 8.0


def test_entry_date_null_excluded_with_period_filter(api):
    """Le righe con entry_date=null vengono escluse se è attivo un filtro periodo."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(hours=8.0, entry_date=None, row_number=1),
            _row(hours=4.0, entry_date=date(2026, 6, 15), row_number=2),
        ],
    )

    r = client.get(
        "/api/me/reports/hours",
        params={"period_from": "2026-06-01"},
        cookies={"session": _make_session(USER_A_ID)},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["entry_date"] == "2026-06-15"
    assert data["grand_total_hours"] == 4.0


def test_grand_total_hours(api):
    """grand_total_hours è la somma di tutti i total_hours restituiti."""
    client, db = api
    _setup_users(db)
    _make_import(
        db,
        USER_A_ID,
        rows=[
            _row(excel_project="Alpha", excel_task="T1", hours=3.0, row_number=1),
            _row(excel_project="Beta", excel_task="T2", hours=5.0, row_number=2),
            _row(excel_project="Gamma", excel_task="T3", hours=2.5, row_number=3),
        ],
    )

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["grand_total_hours"] == pytest.approx(10.5)


def test_multiple_imports_aggregated(api):
    """Righe provenienti da import diverse vengono aggregate insieme."""
    client, db = api
    _setup_users(db)
    # Stessa combinazione in due import separate → devono sommarsi
    _make_import(db, USER_A_ID, rows=[_row(hours=4.0, row_number=1)])
    _make_import(db, USER_A_ID, rows=[_row(hours=6.0, row_number=1)])

    r = client.get(
        "/api/me/reports/hours", cookies={"session": _make_session(USER_A_ID)}
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) == 1
    assert data["rows"][0]["total_hours"] == 10.0
    assert data["rows"][0]["row_count"] == 2


def test_requires_auth(api):
    """Senza cookie di sessione risponde 401."""
    client, _db = api
    r = client.get("/api/me/reports/hours")
    assert r.status_code == 401
