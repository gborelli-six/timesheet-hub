from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings


def create_jwt(payload: dict, expires_hours: int = 8) -> str:
    now = datetime.now(UTC)
    data = {**payload, "iat": now, "exp": now + timedelta(hours=expires_hours)}
    return jwt.encode(data, settings.jwt_secret, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    # Propaga jwt.ExpiredSignatureError e jwt.InvalidTokenError al chiamante
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
