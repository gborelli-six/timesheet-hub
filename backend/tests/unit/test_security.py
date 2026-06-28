from types import SimpleNamespace

import jwt
import pytest

import app.core.security as security_module
from app.core.security import create_jwt, decode_jwt

TEST_SECRET = "test-security-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 32+ byte


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    monkeypatch.setattr(security_module, "settings", SimpleNamespace(jwt_secret=TEST_SECRET))


def test_jwt_round_trip():
    payload = {"sub": "user-123", "email": "alice@sixfeetup.it", "role": "employee"}
    token = create_jwt(payload)
    decoded = decode_jwt(token)
    assert decoded["sub"] == payload["sub"]
    assert decoded["email"] == payload["email"]
    assert decoded["role"] == payload["role"]


def test_expired_token_raises():
    token = jwt.encode(
        {"email": "alice@sixfeetup.it", "role": "employee", "exp": 1},
        TEST_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_jwt(token)


def test_tampered_signature_raises():
    payload = {"sub": "user-123", "email": "alice@sixfeetup.it", "role": "employee"}
    token = create_jwt(payload)
    header, body, _ = token.split(".")
    tampered = f"{header}.{body}.invalidsignatureXXXXXXXXXXXXX"
    with pytest.raises(jwt.InvalidTokenError):
        decode_jwt(tampered)
