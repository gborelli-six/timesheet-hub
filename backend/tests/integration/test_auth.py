from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

import app.core.security as security_module
import app.routers.auth as auth_module
from app.main import app

TEST_SECRET = "test-auth-integration-secret-xxxxxxxxxxxxxxxxxxxxxxxx"  # 32+ byte


def _make_session_cookie(
    email: str = "alice@sixfeetup.it",
    role: str = "employee",
    secret: str = TEST_SECRET,
) -> str:
    now = datetime.now(timezone.utc)
    return pyjwt.encode(
        {"sub": "user-123", "email": email, "role": role, "iat": now, "exp": now + timedelta(hours=8)},
        secret,
        algorithm="HS256",
    )


@pytest.fixture()
def auth_client(monkeypatch):
    fake = SimpleNamespace(
        jwt_secret=TEST_SECRET,
        google_client_id="fake-client-id",
        google_client_secret="fake-client-secret",
        google_redirect_uri="http://localhost/cb",
    )
    monkeypatch.setattr(security_module, "settings", fake)
    monkeypatch.setattr(auth_module, "settings", fake)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_callback_success(auth_client):
    mock_http_resp = MagicMock(ok=True)
    mock_http_resp.json.return_value = {"id_token": "fake.id.token"}

    fake_user = MagicMock()
    fake_user.id = "user-uuid-123"
    fake_user.email = "alice@sixfeetup.it"
    fake_user.role = "employee"

    with (
        patch("app.routers.auth.http_requests.post", return_value=mock_http_resp),
        patch(
            "app.routers.auth.google_id_token.verify_oauth2_token",
            return_value={"email": "alice@sixfeetup.it", "name": "Alice", "hd": "sixfeetup.it"},
        ),
        patch("app.routers.auth.upsert_user", return_value=fake_user),
    ):
        r = auth_client.post(
            "/api/auth/callback",
            json={"code": "fake-code", "state": "fake-state"},
            cookies={"oauth_state": "fake-state"},
        )

    assert r.status_code == 200
    assert "session" in r.cookies


def test_callback_state_mismatch(auth_client):
    # Anti-CSRF: state nel body diverso dal cookie -> rifiutato prima di
    # contattare Google.
    r = auth_client.post(
        "/api/auth/callback",
        json={"code": "fake-code", "state": "attacker-state"},
        cookies={"oauth_state": "victim-state"},
    )
    assert r.status_code == 400


def test_callback_state_missing_cookie(auth_client):
    # Anti-CSRF: senza cookie oauth_state il callback è rifiutato.
    r = auth_client.post(
        "/api/auth/callback",
        json={"code": "fake-code", "state": "any-state"},
    )
    assert r.status_code == 400


def test_callback_wrong_domain(auth_client):
    mock_http_resp = MagicMock(ok=True)
    mock_http_resp.json.return_value = {"id_token": "fake.id.token"}

    with (
        patch("app.routers.auth.http_requests.post", return_value=mock_http_resp),
        patch(
            "app.routers.auth.google_id_token.verify_oauth2_token",
            return_value={"email": "alice@gmail.com", "name": "Alice", "hd": "gmail.com"},
        ),
    ):
        r = auth_client.post(
            "/api/auth/callback",
            json={"code": "fake-code", "state": "fake-state"},
            cookies={"oauth_state": "fake-state"},
        )

    assert r.status_code == 403


def test_me_with_valid_cookie(auth_client):
    token = _make_session_cookie()
    r = auth_client.get("/api/me", cookies={"session": token})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@sixfeetup.it"
    assert r.json()["role"] == "employee"


def test_me_without_cookie(auth_client):
    r = auth_client.get("/api/me")
    assert r.status_code == 401


def test_logout(auth_client):
    token = _make_session_cookie()
    r = auth_client.get("/api/auth/logout", cookies={"session": token}, follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"] == "/login"
    set_cookie = r.headers.get("set-cookie", "")
    assert "session" in set_cookie
    assert "max-age=0" in set_cookie.lower() or 'max-age="0"' in set_cookie.lower() or "expires=" in set_cookie.lower()
