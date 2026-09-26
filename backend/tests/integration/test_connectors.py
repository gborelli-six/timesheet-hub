"""
Test di integrazione per /api/me/connectors.

Usa SQLite in-memory (StaticPool) per verificare operazioni CRUD reali, inclusa la
persistenza del segreto cifrato con AAD = connector_id (UUID record), l'isolamento tra
utenti e la coesistenza di più connettori dello stesso servizio con label diverse.
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
import app.models  # noqa: F401 — registra User e UserToken in Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user_token import UserToken

TEST_SECRET = "test-connectors-integration-secret-xxxxxxxxxxxxxxxxxxx"
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
    # StaticPool garantisce che tutte le connessioni usino la stessa DB in-memory
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


# ── Autenticazione ─────────────────────────────────────────────────────────────


def test_get_without_auth_returns_401(api):
    client, _ = api
    r = client.get("/api/me/connectors/")
    assert r.status_code == 401


def test_put_without_auth_returns_401(api):
    client, _ = api
    r = client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo", "config": {"db_name": "testdb"}, "secret": "s"},
    )
    assert r.status_code == 401


def test_delete_without_auth_returns_401(api):
    client, _ = api
    r = client.delete("/api/me/connectors/odoo")
    assert r.status_code == 401


# ── GET ────────────────────────────────────────────────────────────────────────


def test_get_returns_empty_list_when_no_connectors(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.get("/api/me/connectors/", cookies={"session": token})
    assert r.status_code == 200
    assert r.json() == []


# ── PUT — creazione ────────────────────────────────────────────────────────────


def test_put_creates_connector(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "account_identifier": "alice@example.com",
            "base_url": "https://odoo.example.com",
            "secret": "my-api-key",
        },
        cookies={"session": token},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "odoo"
    assert body["service"] == "odoo"
    assert body["account_identifier"] == "alice@example.com"
    assert body["base_url"] == "https://odoo.example.com"
    assert body["configured"] is True
    assert body["updated_at"] is not None


def test_put_without_service_on_new_connector_returns_422(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.put(
        "/api/me/connectors/odoo",
        json={"secret": "s"},
        cookies={"session": token},
    )
    assert r.status_code == 422


def test_put_without_secret_on_new_connector_returns_422(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo"},
        cookies={"session": token},
    )
    assert r.status_code == 422


def test_put_secret_max_length_4096(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    long_secret = "x" * 4097
    r = client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "secret": long_secret,
        },
        cookies={"session": token},
    )
    assert r.status_code == 422


# ── Sicurezza: il segreto non compare mai nelle risposte ───────────────────────


def test_secret_never_in_get_response(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    secret_value = "super-secret-api-key-do-not-leak"
    client.put(
        "/api/me/connectors/jira",
        json={"service": "jira", "secret": secret_value},
        cookies={"session": token},
    )
    r = client.get("/api/me/connectors/", cookies={"session": token})
    assert r.status_code == 200
    response_text = r.text
    assert secret_value not in response_text
    assert "secret" not in r.json()[0]


def test_secret_never_in_put_response(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    secret_value = "super-secret-api-key-do-not-leak"
    r = client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "secret": secret_value,
        },
        cookies={"session": token},
    )
    assert r.status_code == 200
    assert secret_value not in r.text
    assert "secret" not in r.json()


# ── PUT — aggiornamento ────────────────────────────────────────────────────────


def test_put_without_secret_preserves_encrypted_value(api):
    client, db = api
    token = _make_session(USER_A_ID)

    client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "account_identifier": "alice@example.com",
            "secret": "original-secret",
        },
        cookies={"session": token},
    )
    original_row = (
        db.query(UserToken)
        .filter(UserToken.user_id == USER_A_ID, UserToken.label == "odoo")
        .first()
    )
    original_enc = original_row.secret_enc
    original_nonce = original_row.nonce

    r = client.put(
        "/api/me/connectors/odoo",
        json={"account_identifier": "alice-updated@example.com"},
        cookies={"session": token},
    )
    assert r.status_code == 200
    assert r.json()["account_identifier"] == "alice-updated@example.com"

    db.expire_all()
    updated_row = (
        db.query(UserToken)
        .filter(UserToken.user_id == USER_A_ID, UserToken.label == "odoo")
        .first()
    )
    assert updated_row.secret_enc == original_enc
    assert updated_row.nonce == original_nonce


def test_put_with_new_secret_generates_new_nonce(api):
    client, db = api
    token = _make_session(USER_A_ID)

    client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "secret": "first-secret",
        },
        cookies={"session": token},
    )
    row_first = (
        db.query(UserToken)
        .filter(UserToken.user_id == USER_A_ID, UserToken.label == "odoo")
        .first()
    )
    nonce_first = row_first.nonce
    enc_first = row_first.secret_enc

    client.put(
        "/api/me/connectors/odoo",
        json={"secret": "second-secret"},
        cookies={"session": token},
    )
    db.expire_all()
    row_second = (
        db.query(UserToken)
        .filter(UserToken.user_id == USER_A_ID, UserToken.label == "odoo")
        .first()
    )
    assert row_second.nonce != nonce_first
    assert row_second.secret_enc != enc_first


def test_put_updates_base_url(api):
    client, _ = api
    token = _make_session(USER_A_ID)

    client.put(
        "/api/me/connectors/odoo",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "secret": "s",
            "base_url": "https://v1.example.com",
        },
        cookies={"session": token},
    )
    r = client.put(
        "/api/me/connectors/odoo",
        json={"base_url": "https://v2.example.com"},
        cookies={"session": token},
    )
    assert r.status_code == 200
    assert r.json()["base_url"] == "https://v2.example.com"


# ── DELETE ─────────────────────────────────────────────────────────────────────


def test_delete_removes_connector(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo", "config": {"db_name": "testdb"}, "secret": "s"},
        cookies={"session": token},
    )
    r = client.delete("/api/me/connectors/odoo", cookies={"session": token})
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    r2 = client.get("/api/me/connectors/", cookies={"session": token})
    labels = [c["label"] for c in r2.json()]
    assert "odoo" not in labels


def test_delete_nonexistent_returns_404(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.delete("/api/me/connectors/jira", cookies={"session": token})
    assert r.status_code == 404


# ── GET dopo PUT restituisce il connettore ──────────────────────────────────────


def test_get_after_put_returns_connector(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    client.put(
        "/api/me/connectors/jira",
        json={"service": "jira", "account_identifier": "alice", "secret": "lk"},
        cookies={"session": token},
    )
    r = client.get("/api/me/connectors/", cookies={"session": token})
    assert r.status_code == 200
    connectors = r.json()
    assert len(connectors) == 1
    assert connectors[0]["label"] == "jira"
    assert connectors[0]["service"] == "jira"
    assert connectors[0]["account_identifier"] == "alice"
    assert connectors[0]["configured"] is True


# ── Label custom: più connettori dello stesso servizio ─────────────────────────


def test_same_service_different_labels_coexist(api):
    client, _ = api
    token = _make_session(USER_A_ID)

    client.put(
        "/api/me/connectors/jira-azienda",
        json={"service": "jira", "secret": "key-az", "account_identifier": "alice-az"},
        cookies={"session": token},
    )
    client.put(
        "/api/me/connectors/jira-cliente",
        json={"service": "jira", "secret": "key-cl", "account_identifier": "alice-cl"},
        cookies={"session": token},
    )

    r = client.get("/api/me/connectors/", cookies={"session": token})
    assert r.status_code == 200
    connectors = r.json()
    assert len(connectors) == 2
    labels = {c["label"] for c in connectors}
    assert labels == {"jira-azienda", "jira-cliente"}
    for c in connectors:
        assert c["service"] == "jira"


def test_delete_one_label_leaves_other_intact(api):
    client, _ = api
    token = _make_session(USER_A_ID)

    client.put(
        "/api/me/connectors/jira-azienda",
        json={"service": "jira", "secret": "key-az"},
        cookies={"session": token},
    )
    client.put(
        "/api/me/connectors/jira-cliente",
        json={"service": "jira", "secret": "key-cl"},
        cookies={"session": token},
    )

    client.delete("/api/me/connectors/jira-azienda", cookies={"session": token})

    r = client.get("/api/me/connectors/", cookies={"session": token})
    assert len(r.json()) == 1
    assert r.json()[0]["label"] == "jira-cliente"


# ── Isolamento utenti ──────────────────────────────────────────────────────────


def test_user_cannot_see_other_users_connectors(api):
    client, _ = api
    token_a = _make_session(USER_A_ID)
    token_b = _make_session(USER_B_ID)

    client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo", "config": {"db_name": "testdb"}, "secret": "a-secret"},
        cookies={"session": token_a},
    )

    r = client.get("/api/me/connectors/", cookies={"session": token_b})
    assert r.status_code == 200
    assert r.json() == []


def test_user_cannot_delete_other_users_connector(api):
    client, _ = api
    token_a = _make_session(USER_A_ID)
    token_b = _make_session(USER_B_ID)

    client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo", "config": {"db_name": "testdb"}, "secret": "a-secret"},
        cookies={"session": token_a},
    )

    r = client.delete("/api/me/connectors/odoo", cookies={"session": token_b})
    assert r.status_code == 404


def test_users_connectors_are_independent(api):
    client, _ = api
    token_a = _make_session(USER_A_ID)
    token_b = _make_session(USER_B_ID)

    client.put(
        "/api/me/connectors/jira",
        json={"service": "jira", "account_identifier": "alice", "secret": "a-jira"},
        cookies={"session": token_a},
    )
    client.put(
        "/api/me/connectors/jira",
        json={"service": "jira", "account_identifier": "bob", "secret": "b-jira"},
        cookies={"session": token_b},
    )

    r_a = client.get("/api/me/connectors/", cookies={"session": token_a})
    r_b = client.get("/api/me/connectors/", cookies={"session": token_b})

    assert r_a.json()[0]["account_identifier"] == "alice"
    assert r_b.json()[0]["account_identifier"] == "bob"


# ── needs_reauth ───────────────────────────────────────────────────────────────


def test_get_includes_needs_reauth_false_by_default(api):
    client, db = api
    session_a = _make_session(USER_A_ID)

    # Crea connettore
    r = client.put(
        "/api/me/connectors/Test%20Jira",
        json={
            "service": "jira",
            "account_identifier": "user@example.com",
            "secret": "tok123",
        },
        cookies={"session": session_a},
    )
    assert r.status_code == 200

    # GET lista: needs_reauth deve essere False
    r = client.get("/api/me/connectors/", cookies={"session": session_a})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["needs_reauth"] is False


def test_put_with_secret_resets_needs_reauth(api):
    client, db = api
    session_a = _make_session(USER_A_ID)

    # Crea connettore
    r = client.put(
        "/api/me/connectors/Odoo%20Prod",
        json={
            "service": "odoo",
            "config": {"db_name": "testdb"},
            "account_identifier": "admin",
            "secret": "oldtoken",
            "base_url": "https://odoo.example.com",
        },
        cookies={"session": session_a},
    )
    assert r.status_code == 200

    # Imposta needs_reauth=True direttamente via DB (simula E8 che riceve 401)
    token = db.query(UserToken).filter(UserToken.label == "Odoo Prod").first()
    token.needs_reauth = True
    db.commit()

    # Verifica che il GET lo riporta
    r = client.get("/api/me/connectors/", cookies={"session": session_a})
    assert r.json()[0]["needs_reauth"] is True

    # PUT con nuovo segreto → deve resettare needs_reauth a False
    r = client.put(
        "/api/me/connectors/Odoo%20Prod",
        json={"secret": "newtoken"},
        cookies={"session": session_a},
    )
    assert r.status_code == 200
    assert r.json()["needs_reauth"] is False

    # Verifica anche in DB
    db.refresh(token)
    assert token.needs_reauth is False
