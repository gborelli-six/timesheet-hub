"""Test di integrazione per GET /api/connector-types.

Il catalogo alimenta il form dinamico di configurazione e lo Step 0 del wizard:
se la forma della risposta cambia, il frontend smette di sapere quali campi
mostrare e quali connettori sono sorgenti.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

import app.core.security as security_module
from app.main import app

TEST_SECRET = "test-connector-types-secret-xxxxxxxxxxxxxxxxxxxxxxxx"
USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

FAKE_SETTINGS = SimpleNamespace(jwt_secret=TEST_SECRET, token_encrypt_key="")


def _make_session(user_id: UUID = USER_ID, role: str = "employee") -> str:
    now = datetime.now(UTC)
    return pyjwt.encode(
        {
            "sub": str(user_id),
            "email": "alice@example.com",
            "role": role,
            "iat": now,
            "exp": now + timedelta(hours=8),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(security_module, "settings", FAKE_SETTINGS)
    with TestClient(app) as c:
        yield c


def _by_service(payload: list[dict]) -> dict[str, dict]:
    return {item["service"]: item for item in payload}


def test_requires_authentication(client):
    assert client.get("/api/connector-types").status_code == 401


def test_lists_every_service(client):
    r = client.get("/api/connector-types", cookies={"session": _make_session()})

    assert r.status_code == 200
    types = _by_service(r.json())
    assert set(types) == {"odoo", "jira", "clockify", "linear", "asana"}


def test_clockify_is_declared_a_source_with_no_extra_config(client):
    r = client.get("/api/connector-types", cookies={"session": _make_session()})

    clockify = _by_service(r.json())["clockify"]
    assert clockify["is_source"] is True
    assert clockify["is_destination"] is False
    assert clockify["available"] is True
    assert clockify["secret_label"] == "API key"
    assert clockify["config_fields"] == []


def test_odoo_declares_db_name_as_required(client):
    r = client.get("/api/connector-types", cookies={"session": _make_session()})

    odoo = _by_service(r.json())["odoo"]
    assert odoo["is_destination"] is True
    assert odoo["is_source"] is False
    fields = {f["key"]: f for f in odoo["config_fields"]}
    assert fields["db_name"]["required"] is True


def test_unimplemented_services_are_marked_unavailable(client):
    r = client.get("/api/connector-types", cookies={"session": _make_session()})

    types = _by_service(r.json())
    assert types["linear"]["available"] is False
    assert types["asana"]["available"] is False
    assert types["jira"]["available"] is True


def test_every_entry_exposes_the_full_shape(client):
    r = client.get("/api/connector-types", cookies={"session": _make_session()})

    expected = {
        "service",
        "label",
        "is_source",
        "is_destination",
        "available",
        "secret_label",
        "secret_help",
        "requires_base_url",
        "requires_account_identifier",
        "account_identifier_label",
        "config_fields",
    }
    for item in r.json():
        assert set(item) == expected
