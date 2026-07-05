import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.routers import (
    adapters,
    auth,
    connectors,
    health,
    imports,
    mappings,
    reports,
    users,
)
from app.routers.imports import import_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # La guardia non negoziabile (ADR-003-B) vive ora nel validator di Settings
    # (app/core/config.py), che fallisce a import-time se E2E_TEST_MODE=true fuori
    # dall'allowlist di environment — quindi questo punto non è mai raggiunto in
    # un ambiente vietato. Qui resta solo l'osservabilità del flag.
    if settings.e2e_test_mode:
        logger.warning(
            "E2E_TEST_MODE attivo (environment=%s): superficie test-only montata "
            "(/api/_test/*). Atteso solo in CI/local/test.",
            settings.environment,
        )
    queue: asyncio.Queue = asyncio.Queue()
    app.state.import_queue = queue
    workers = [
        asyncio.create_task(import_worker(queue))
        for _ in range(settings.import_workers)
    ]
    yield
    await queue.join()
    for w in workers:
        w.cancel()


app = FastAPI(title="Timesheet Hub API", version="0.1.0", lifespan=lifespan)

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.api_router)
app.include_router(connectors.router, prefix="/api/me/connectors")
app.include_router(adapters.router)
app.include_router(mappings.router)
app.include_router(imports.router)
app.include_router(reports.router)

# Import lazy: il router test-only è incluso solo col flag attivo. Il modulo è
# fisicamente presente nell'immagine (COPY app/ wholesale), ma non viene registrato
# in produzione e la guardia del config ne impedisce comunque l'attivazione.
if settings.e2e_test_mode:
    from app.routers import e2e_test_router

    app.include_router(e2e_test_router.router, prefix="/api")

    from app.adapters import stub  # noqa: F401 — auto-registra StubAdapter nel registry
