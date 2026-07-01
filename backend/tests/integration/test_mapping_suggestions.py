"""
Test di integrazione per POST /api/me/mapping-suggestions.

Verifica: nessun match → liste vuote; match dopo insert → suggerimento corretto;
connettore eliminato → filtrato; normalizzazione (spazi/maiuscole) → match.
"""

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
from app.core.security import encrypt_secret
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.connector_row_mapping import ConnectorRowMapping
from app.models.user import User
from app.models.user_token import UserToken, UserTokenService

TEST_SECRET = "test-mappings-integration-secret-xxxxxxxxxxxxxxxxxx"
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


def _setup_user(db) -> User:
    user = User(id=USER_A_ID, email="user-a@example.com", name="User A")
    db.add(user)
    db.commit()
    return user


def _add_token(db, user_id: UUID, label: str) -> UserToken:
    connector_id = uuid4()
    secret_enc, nonce, key_version = encrypt_secret(
        "test-secret", str(user_id), str(connector_id)
    )
    token = UserToken(
        id=connector_id,
        user_id=user_id,
        service=UserTokenService.odoo,
        label=label,
        secret_enc=secret_enc,
        nonce=nonce,
        key_version=key_version,
    )
    db.add(token)
    db.commit()
    return token


def _add_mapping(
    db,
    user_id: UUID,
    excel_project: str,
    excel_task: str,
    connector_label: str,
    remote_project_id: str = "1",
    remote_project_name: str = "Proj Remote",
    remote_task_id: str = "101",
    remote_task_name: str = "Task Remote",
    last_used_at: datetime | None = None,
) -> ConnectorRowMapping:
    m = ConnectorRowMapping(
        user_id=user_id,
        excel_project=excel_project,
        excel_task=excel_task,
        connector_label=connector_label,
        remote_project_id=remote_project_id,
        remote_project_name=remote_project_name,
        remote_task_id=remote_task_id,
        remote_task_name=remote_task_name,
        last_used_at=last_used_at or datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(m)
    db.commit()
    return m


def _post_suggestions(client, session_cookie, rows):
    return client.post(
        "/api/me/mapping-suggestions",
        json={"rows": rows},
        cookies={"session": session_cookie},
    )


# ── Test ───────────────────────────────────────────────────────────────────────


def test_no_match_returns_empty_lists(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-work")
    session = _make_session(USER_A_ID)

    r = _post_suggestions(
        client,
        session,
        [{"excel_project": "Progetto Alpha", "excel_task": "Task Frontend"}],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["suggestions"] == [[]]


def test_match_after_insert_returns_suggestion(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-work")
    # Simulazione di una prima submit: insert diretto in DB
    _add_mapping(
        db,
        USER_A_ID,
        excel_project="progetto alpha",  # normalizzato
        excel_task="task frontend",
        connector_label="odoo-work",
        remote_project_id="1",
        remote_project_name="Alpha Remote",
        remote_task_id="101",
        remote_task_name="Frontend Remote",
    )
    session = _make_session(USER_A_ID)

    r = _post_suggestions(
        client,
        session,
        [{"excel_project": "Progetto Alpha", "excel_task": "Task Frontend"}],
    )
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert len(suggestions) == 1
    assert len(suggestions[0]) == 1
    s = suggestions[0][0]
    assert s["connector_label"] == "odoo-work"
    assert s["remote_project_id"] == "1"
    assert s["remote_task_id"] == "101"
    assert s["suggested"] is True


def test_deleted_connector_filtered_out(api):
    client, db = api
    _setup_user(db)
    # Connettore "odoo-old" NON viene creato tra i token attivi
    _add_mapping(
        db,
        USER_A_ID,
        excel_project="progetto alpha",
        excel_task="task frontend",
        connector_label="odoo-old",
    )
    session = _make_session(USER_A_ID)

    r = _post_suggestions(
        client,
        session,
        [{"excel_project": "Progetto Alpha", "excel_task": "Task Frontend"}],
    )
    assert r.status_code == 200
    assert r.json()["suggestions"] == [[]]


def test_normalization_spaces_and_case(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-work")
    _add_mapping(
        db,
        USER_A_ID,
        excel_project="progetto alpha",
        excel_task="task frontend",
        connector_label="odoo-work",
    )
    session = _make_session(USER_A_ID)

    # Richiesta con maiuscole e spazi extra → deve matchare
    r = _post_suggestions(
        client,
        session,
        [{"excel_project": "  PROGETTO   ALPHA  ", "excel_task": "  Task  FRONTEND  "}],
    )
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert len(suggestions[0]) == 1
    assert suggestions[0][0]["connector_label"] == "odoo-work"


def test_multiple_rows_independent_results(api):
    client, db = api
    _setup_user(db)
    _add_token(db, USER_A_ID, "odoo-work")
    _add_mapping(
        db,
        USER_A_ID,
        excel_project="progetto alpha",
        excel_task="task frontend",
        connector_label="odoo-work",
    )
    session = _make_session(USER_A_ID)

    r = _post_suggestions(
        client,
        session,
        [
            {"excel_project": "Progetto Alpha", "excel_task": "Task Frontend"},
            {"excel_project": "Progetto Beta", "excel_task": "Task Design"},
        ],
    )
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert len(suggestions) == 2
    assert len(suggestions[0]) == 1  # match
    assert len(suggestions[1]) == 0  # nessun match


def test_without_auth_returns_401(api):
    client, _ = api
    r = client.post(
        "/api/me/mapping-suggestions",
        json={"rows": [{"excel_project": "X", "excel_task": "Y"}]},
    )
    assert r.status_code == 401
