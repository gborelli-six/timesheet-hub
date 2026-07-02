from types import SimpleNamespace
from typing import Annotated
from uuid import uuid4

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import app.core.security as security_module
from app.core.rbac import CurrentUser, require_role

TEST_SECRET = "test-rbac-secret-for-unit-tests-xxxxxxxxxxxxxxxx"  # 32+ byte


def _make_token(
    email: str = "user@example.com",
    role: str = "employee",
    expired: bool = False,
    secret: str = TEST_SECRET,
) -> str:
    payload: dict = {"sub": str(uuid4()), "email": email, "role": role}
    if expired:
        payload["exp"] = 1  # Unix epoch 1 → sempre scaduto
    return jwt.encode(payload, secret, algorithm="HS256")


_app = FastAPI()

_EmpDep = Annotated[CurrentUser, Depends(require_role(["employee"]))]
_HrDep = Annotated[CurrentUser, Depends(require_role(["hr", "admin"]))]


@_app.get("/emp")
def _emp(user: _EmpDep):
    return {"email": user.email, "role": user.role}


@_app.get("/hr")
def _hr(user: _HrDep):
    return {"ok": True}


@pytest.fixture()
def client(monkeypatch):
    fake_settings = SimpleNamespace(jwt_secret=TEST_SECRET)
    monkeypatch.setattr(security_module, "settings", fake_settings)
    with TestClient(_app, raise_server_exceptions=False) as c:
        yield c


def test_get_current_user_valid_token(client):
    token = _make_token(email="alice@example.com", role="employee")
    r = client.get("/emp", cookies={"session": token})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"
    assert r.json()["role"] == "employee"


def test_get_current_user_missing_token(client):
    r = client.get("/emp")
    assert r.status_code == 401


def test_get_current_user_invalid_token(client):
    r = client.get("/emp", cookies={"session": "not.a.jwt"})
    assert r.status_code == 401


def test_get_current_user_expired_token(client):
    token = _make_token(expired=True)
    r = client.get("/emp", cookies={"session": token})
    assert r.status_code == 401


def test_require_role_allowed(client):
    token = _make_token(role="employee")
    r = client.get("/emp", cookies={"session": token})
    assert r.status_code == 200


def test_require_role_forbidden(client):
    token = _make_token(role="employee")
    r = client.get("/hr", cookies={"session": token})
    assert r.status_code == 403
