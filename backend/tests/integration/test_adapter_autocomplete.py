"""
Test di integrazione per GET /api/adapters/{label}/projects e .../tasks.

Usa SQLite in-memory con StubAdapter registrato direttamente nel registry.
I marcatori E2E vengono iniettati nell'account_identifier del token.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.security as security_module
import app.models  # noqa: F401 — registra tutti i modelli in Base.metadata
from app.adapters.base import ServiceType
from app.adapters.registry import adapter_registry
from app.adapters.stub import StubAdapter
from app.core.security import encrypt_secret
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.models.user_token import UserToken, UserTokenService

TEST_SECRET = "test-adapters-integration-secret-xxxxxxxxxxxxxxxxxx"
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


def _create_token(
    db,
    user_id: UUID,
    label: str,
    marker: str | None = None,
) -> UserToken:
    """Crea un UserToken con secret cifrato. marker → account_identifier (E2E)."""
    secret_enc, nonce, key_version = encrypt_secret(
        "test-secret-value", str(user_id), "placeholder"
    )
    # La cifratura usa connector_id; creiamo con id fisso per semplicità
    from uuid import uuid4

    connector_id = uuid4()
    secret_enc, nonce, key_version = encrypt_secret(
        "test-secret-value", str(user_id), str(connector_id)
    )
    token = UserToken(
        id=connector_id,
        user_id=user_id,
        service=UserTokenService.odoo,
        label=label,
        account_identifier=marker,
        base_url="http://stub.local",
        secret_enc=secret_enc,
        nonce=nonce,
        key_version=key_version,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


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
    # Inietta StubAdapter nel registry senza alterare lo stato globale
    monkeypatch.setitem(adapter_registry._registry, ServiceType.odoo, StubAdapter)
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c, db_session
    app.dependency_overrides.clear()


def _setup_users(db) -> tuple[User, User]:
    user_a = User(id=USER_A_ID, email="user-a@example.com", name="User A")
    user_b = User(id=USER_B_ID, email="user-b@example.com", name="User B")
    db.add_all([user_a, user_b])
    db.commit()
    return user_a, user_b


# ── GET /projects ──────────────────────────────────────────────────────────────


def test_get_projects_ok(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-ok", marker=None)
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-ok/projects",
        cookies={"session": session},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "id" in data[0]
    assert "name" in data[0]


def test_get_projects_with_query_filter(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-ok", marker=None)
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-ok/projects?query=Alpha",
        cookies={"session": session},
    )
    assert r.status_code == 200
    data = r.json()
    assert all("alpha" in item["name"].lower() for item in data)


def test_get_projects_connector_not_found_returns_404(api):
    client, db = api
    _setup_users(db)
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/non-esistente/projects",
        cookies={"session": session},
    )
    assert r.status_code == 404


def test_get_projects_other_user_connector_returns_404(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_B_ID, "odoo-ok", marker=None)
    # User A tenta di accedere al connettore di User B
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-ok/projects",
        cookies={"session": session},
    )
    assert r.status_code == 404


def test_get_projects_backend_down_returns_502(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-down", marker="E2E__DOWN")
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-down/projects",
        cookies={"session": session},
    )
    assert r.status_code == 502


def test_get_projects_without_auth_returns_401(api):
    client, _ = api
    r = client.get("/api/adapters/odoo-ok/projects")
    assert r.status_code == 401


# ── GET /projects/{project_id}/tasks ──────────────────────────────────────────


def test_get_tasks_ok(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-ok", marker=None)
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-ok/projects/1/tasks",
        cookies={"session": session},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "id" in data[0]
    assert "name" in data[0]


def test_get_tasks_unknown_project_returns_empty(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-ok", marker=None)
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-ok/projects/999/tasks",
        cookies={"session": session},
    )
    assert r.status_code == 200
    assert r.json() == []


def test_get_tasks_backend_down_returns_502(api):
    client, db = api
    _setup_users(db)
    _create_token(db, USER_A_ID, "odoo-down", marker="E2E__DOWN")
    session = _make_session(USER_A_ID)

    r = client.get(
        "/api/adapters/odoo-down/projects/1/tasks",
        cookies={"session": session},
    )
    assert r.status_code == 502
