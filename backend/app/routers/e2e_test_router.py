"""
Rotte test-only — attive SOLO se E2E_TEST_MODE=true (ADR-003-B).
Questo modulo non viene importato se il flag è assente.

POST /_test/session — stub 501 in E1, funzionale in E3.
POST /_test/reset   — stub 501 in E1, funzionale in E3.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/_test", tags=["e2e-test-only"])


@router.post("/session")
async def create_test_session() -> JSONResponse:
    """
    Emette un cookie JWT di sessione bypassando OAuth Google.
    Accetta: {"email": "..@sixfeetup.it", "role": "employee|hr|admin"}
    Stub in E1 — implementato in E3.
    """
    return JSONResponse(
        status_code=501,
        content={"detail": "Not implemented — disponibile in E3"},
    )


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
