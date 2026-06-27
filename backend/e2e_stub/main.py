"""
Stub HTTP per adapter esterni — ADR-003-D.
Singolo file, stesso linguaggio del backend (Python/FastAPI).
Pilotato dai marcatori E2E__ presenti nel payload della request.

Marcatori (ADR-003-D):
  E2E__OK       → 200 successo (default se nessun marcatore)
  E2E__FAIL     → 207 parziale (una riga rifiutata)
  E2E__EXPIRED  → 401 token scaduto
  E2E__DOWN     → 503 servizio non disponibile

Avviato come servizio separato (profile e2e) su porta 9000.
Le rotte esatte saranno allineate agli adapter reali in E7/E8.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="E2E Adapter Stub", version="0.1.0")

_MARKER_DOWN = "E2E__DOWN"
_MARKER_EXPIRED = "E2E__EXPIRED"
_MARKER_FAIL = "E2E__FAIL"


async def _body_str(request: Request) -> str:
    body = await request.body()
    try:
        return body.decode("utf-8")
    except Exception:
        return ""


def _stub_response(payload: str) -> JSONResponse:
    """Priorità: DOWN > EXPIRED > FAIL > OK."""
    if _MARKER_DOWN in payload:
        return JSONResponse(
            status_code=503, content={"error": "Service unavailable (E2E__DOWN)"}
        )
    if _MARKER_EXPIRED in payload:
        return JSONResponse(
            status_code=401, content={"error": "Token expired (E2E__EXPIRED)"}
        )
    if _MARKER_FAIL in payload:
        return JSONResponse(
            status_code=207,
            content={
                "results": [
                    {"status": "success", "id": "ok-1"},
                    {
                        "status": "error",
                        "id": "E2E__FAIL-row",
                        "message": "Row rejected (E2E__FAIL)",
                    },
                ]
            },
        )
    return JSONResponse(
        status_code=200, content={"id": "stub-created", "status": "success"}
    )


# --- Jira ---
@app.post("/jira/rest/api/3/issue/{issue_key}/worklog")
async def jira_issue_worklog(issue_key: str, request: Request) -> JSONResponse:
    return _stub_response(f"{issue_key} {await _body_str(request)}")


@app.post("/jira/rest/api/3/worklog")
async def jira_worklog(request: Request) -> JSONResponse:
    return _stub_response(await _body_str(request))


# --- Odoo ---
@app.post("/odoo/jsonrpc")
async def odoo_jsonrpc(request: Request) -> JSONResponse:
    return _stub_response(await _body_str(request))


# --- Linear ---
@app.post("/linear/graphql")
async def linear_graphql(request: Request) -> JSONResponse:
    return _stub_response(await _body_str(request))


# --- Asana ---
@app.post("/asana/tasks")
async def asana_tasks(request: Request) -> JSONResponse:
    return _stub_response(await _body_str(request))


@app.post("/asana/tasks/{task_id}/stories")
async def asana_task_stories(task_id: str, request: Request) -> JSONResponse:
    return _stub_response(f"{task_id} {await _body_str(request)}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "adapter-stub"}
