"""
Rotte test-only — attive SOLO se E2E_TEST_MODE=true (ADR-003-B).
Questo modulo non viene importato se il flag è assente.

POST /_test/session — emette JWT HS256 per il ruolo richiesto (STORY-015).
POST /_test/reset   — stub 501 in E2, funzionale in E3.
"""

import jwt
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.rbac import UserRole

router = APIRouter(prefix="/_test", tags=["e2e-test-only"])


class TestSessionRequest(BaseModel):
    email: str
    role: UserRole


@router.post("/session")
async def create_test_session(body: TestSessionRequest) -> JSONResponse:
    """
    Emette un JWT HS256 bypassando OAuth Google.
    Accetta: {"email": "..@sixfeetup.it", "role": "employee|hr|admin"}
    """
    token = jwt.encode(
        {"email": body.email, "role": body.role},
        settings.jwt_secret,
        algorithm="HS256",
    )
    return JSONResponse({"token": token})


@router.post("/reset")
async def reset_test_data() -> JSONResponse:
    """
    Azzera imports e user_tokens lasciando intatto il seed deterministico.
    Stub in E1 — implementato in E3.
    """
    return JSONResponse(
        status_code=501,
        content={"detail": "Not implemented — disponibile in E3"},
    )
