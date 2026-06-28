import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.routers import auth, health, users

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
    yield


app = FastAPI(title="Timesheet Hub API", version="0.1.0", lifespan=lifespan)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(auth.router, prefix="/api")
app.include_router(users.api_router)

# Import lazy: il router test-only è incluso solo col flag attivo. Il modulo è
# fisicamente presente nell'immagine (COPY app/ wholesale), ma non viene registrato
# in produzione e la guardia del config ne impedisce comunque l'attivazione.
if settings.e2e_test_mode:
    from app.routers import e2e_test_router

    app.include_router(e2e_test_router.router, prefix="/api")
