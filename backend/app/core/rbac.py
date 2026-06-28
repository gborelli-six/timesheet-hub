from enum import StrEnum
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import decode_jwt


class UserRole(StrEnum):
    employee = "employee"
    hr = "hr"
    admin = "admin"


class CurrentUser(BaseModel):
    email: str
    role: UserRole


def get_current_user(
    session: Annotated[str | None, Cookie()] = None,
) -> CurrentUser:
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token",
        )
    try:
        payload = decode_jwt(session)
        return CurrentUser(email=payload["email"], role=payload["role"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing token",
        ) from exc


def require_role(roles: list[str]):
    def _check(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check
