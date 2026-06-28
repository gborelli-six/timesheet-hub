"""
Rotte test-only — attive SOLO se E2E_TEST_MODE=true (ADR-003-B).
Questo modulo non viene importato se il flag è assente.

POST /_test/session — emette JWT HS256 per il ruolo richiesto (STORY-020).
POST /_test/reset   — stub 501 in E2, funzionale in E3.
"""

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.rbac import UserRole
from app.core.security import create_jwt

router = APIRouter(prefix="/_test", tags=["e2e-test-only"])


class TestSessionRequest(BaseModel):
    email: str
    role: UserRole


@router.post("/session")
async def create_test_session(body: TestSessionRequest, response: Response) -> dict:
    """
    Emette un JWT HS256 bypassando OAuth Google e lo imposta come cookie session.
    Identico al comportamento di POST /api/auth/callback.
    Accetta: {"email": "..@sixfeetup.it", "role": "employee|hr|admin"}
    """
    token = create_jwt(
        {"sub": f"test-{body.role}", "email": body.email, "role": body.role}
    )
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=28800,
        path="/",
    )
    return {"ok": True}


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
