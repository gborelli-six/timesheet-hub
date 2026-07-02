from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

import app.core.security as security_module
from app.main import app

TEST_SECRET = "test-rbac-secret-for-integration-tests-xxxxxxxxxx"  # 32+ byte


def _make_token(
    email: str = "user@example.com",
    role: str = "employee",
    expired: bool = False,
) -> str:
    payload: dict = {"sub": str(uuid4()), "email": email, "role": role}
    if expired:
        payload["exp"] = 1  # Unix epoch 1 → sempre scaduto
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture()
def rbac_client(monkeypatch):
    fake_settings = SimpleNamespace(jwt_secret=TEST_SECRET)
    monkeypatch.setattr(security_module, "settings", fake_settings)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_no_token_returns_401(rbac_client):
    r = rbac_client.get("/api/users/me")
    assert r.status_code == 401


def test_malformed_token_returns_401(rbac_client):
    r = rbac_client.get("/api/users/me", cookies={"session": "not.a.jwt"})
    assert r.status_code == 401


def test_expired_token_returns_401(rbac_client):
    token = _make_token(expired=True)
    r = rbac_client.get("/api/users/me", cookies={"session": token})
    assert r.status_code == 401


def test_insufficient_role_returns_403(rbac_client):
    token = _make_token(role="employee")
    r = rbac_client.get("/api/users/hr-only", cookies={"session": token})
    assert r.status_code == 403


def test_authorized_role_returns_200(rbac_client):
    token = _make_token(email="alice@example.com", role="employee")
    r = rbac_client.get("/api/users/me", cookies={"session": token})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"
    assert r.json()["role"] == "employee"
