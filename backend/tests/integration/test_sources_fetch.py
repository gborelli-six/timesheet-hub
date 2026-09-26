"""Test di integrazione per POST /api/me/sources/{label}/fetch.

Usa SQLite in-memory e una sorgente finta registrata nel registry, così il
percorso esercitato è quello reale — RBAC, lookup del connettore, decifratura
del segreto, mapping degli errori — senza toccare la rete.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.security as security_module
import app.models  # noqa: F401 — registra User e UserToken in Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.sources.base import (
    AdapterAuthError,
    AdapterConnectionError,
    AdapterError,
    ServiceType,
    SourceConfig,
    SourceRow,
    TimesheetSource,
    ValidationResult,
)
from app.sources.registry import source_registry

TEST_SECRET = "test-sources-integration-secret-xxxxxxxxxxxxxxxxxxxx"
TEST_ENCRYPT_KEY = "9efb0d60b1cc99a95e666c278d4999486959b52989f5a106803a1f3c62eae4c2"

USER_A_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_B_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

CLOCKIFY_SECRET = "clockify-api-key-do-not-leak"

FAKE_SETTINGS = SimpleNamespace(
    jwt_secret=TEST_SECRET,
    token_encrypt_key=TEST_ENCRYPT_KEY,
)


def _make_session(user_id: UUID, role: str = "employee") -> str:
    now = datetime.now(UTC)
    return pyjwt.encode(
        {
            "sub": str(user_id),
            "email": f"{str(user_id)[:8]}@example.com",
            "role": role,
            "iat": now,
            "exp": now + timedelta(hours=8),
        },
        TEST_SECRET,
        algorithm="HS256",
    )


class FakeSource(TimesheetSource):
    """Sorgente controllabile dal test: registra la config ricevuta o solleva."""

    raises: Exception | None = None
    seen: list[tuple[str, str, SourceConfig]] = []

    def validate(self, config: SourceConfig) -> ValidationResult:
        return ValidationResult(ok=True)

    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        FakeSource.seen.append((start, end, config))
        if FakeSource.raises:
            raise FakeSource.raises
        return [
            SourceRow(
                date="2026-06-01",
                project="Alfa",
                task="Sviluppo",
                hours=7.5,
                notes="refactor",
            ),
            SourceRow(
                date="2026-06-02", project="Beta", task="Design", hours=2.0, notes=None
            ),
        ]


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def api(monkeypatch, db_session):
    monkeypatch.setattr(security_module, "settings", FAKE_SETTINGS)
    app.dependency_overrides[get_db] = lambda: db_session

    FakeSource.raises = None
    FakeSource.seen = []
    original = source_registry.get(ServiceType.clockify)
    source_registry.register(ServiceType.clockify, FakeSource)

    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, db_session

    source_registry.register(ServiceType.clockify, original)
    app.dependency_overrides.clear()


def _create_clockify_connector(client, token: str, label: str = "clockify", **extra):
    body = {"service": "clockify", "secret": CLOCKIFY_SECRET, **extra}
    r = client.put(f"/api/me/connectors/{label}", json=body, cookies={"session": token})
    assert r.status_code == 200, r.text
    return r


def _fetch(client, token, label="clockify", start="2026-06-01", end="2026-06-30"):
    return client.post(
        f"/api/me/sources/{label}/fetch",
        json={"start": start, "end": end},
        cookies={"session": token},
    )


# ── Autenticazione e isolamento ────────────────────────────────────────────────


def test_fetch_without_auth_returns_401(api):
    client, _ = api
    r = client.post(
        "/api/me/sources/clockify/fetch",
        json={"start": "2026-06-01", "end": "2026-06-30"},
    )
    assert r.status_code == 401


def test_fetch_unknown_label_returns_404(api):
    client, _ = api
    r = _fetch(client, _make_session(USER_A_ID), label="inesistente")
    assert r.status_code == 404


def test_fetch_other_users_connector_returns_404(api):
    """Stesso 404 di un label inesistente: non si rivela l'esistenza altrui."""
    client, _ = api
    _create_clockify_connector(client, _make_session(USER_A_ID))

    r = _fetch(client, _make_session(USER_B_ID))

    assert r.status_code == 404


# ── Percorso felice ────────────────────────────────────────────────────────────


def test_fetch_returns_rows(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    r = _fetch(client, token)

    assert r.status_code == 200
    rows = r.json()["rows"]
    assert len(rows) == 2
    assert rows[0] == {
        "date": "2026-06-01",
        "project": "Alfa",
        "task": "Sviluppo",
        "hours": 7.5,
        "notes": "refactor",
    }
    assert rows[1]["notes"] is None


def test_decrypted_secret_reaches_the_source(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    _fetch(client, token)

    _, _, config = FakeSource.seen[0]
    assert config.secret == CLOCKIFY_SECRET


def test_marker_reaches_the_source(api):
    """Il marker E2E arriva dall'account_identifier."""
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(
        client,
        token,
        account_identifier="E2E__OK",
    )

    _fetch(client, token)

    _, _, config = FakeSource.seen[0]
    assert config.config == {}
    assert config.marker == "E2E__OK"
    assert config.service == ServiceType.clockify


def test_requested_period_reaches_the_source(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    _fetch(client, token, start="2026-03-01", end="2026-03-31")

    start, end, _ = FakeSource.seen[0]
    assert (start, end) == ("2026-03-01", "2026-03-31")


def test_secret_never_appears_in_response(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    r = _fetch(client, token)

    assert CLOCKIFY_SECRET not in r.text


# ── Validazione del periodo ────────────────────────────────────────────────────


def test_inverted_period_returns_422(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    r = _fetch(client, token, start="2026-06-30", end="2026-06-01")

    assert r.status_code == 422
    assert not FakeSource.seen  # la sorgente non viene nemmeno interrogata


def test_period_longer_than_a_year_returns_422(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    r = _fetch(client, token, start="2020-01-01", end="2026-01-01")

    assert r.status_code == 422
    assert not FakeSource.seen


def test_malformed_date_returns_422(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)

    r = _fetch(client, token, start="01/06/2026", end="2026-06-30")

    assert r.status_code == 422


# ── Mapping degli errori della sorgente ────────────────────────────────────────


def test_auth_error_returns_409_needs_reauth(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)
    FakeSource.raises = AdapterAuthError("credenziali scadute")

    r = _fetch(client, token)

    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "needs_reauth"


def test_connection_error_returns_502_backend_unavailable(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)
    FakeSource.raises = AdapterConnectionError("sorgente irraggiungibile")

    r = _fetch(client, token)

    assert r.status_code == 502
    assert r.json()["detail"]["code"] == "backend_unavailable"


def test_generic_adapter_error_returns_502(api):
    client, _ = api
    token = _make_session(USER_A_ID)
    _create_clockify_connector(client, token)
    FakeSource.raises = AdapterError("errore applicativo")

    r = _fetch(client, token)

    assert r.status_code == 502


# ── Un connettore di destinazione non è una sorgente ───────────────────────────


def test_destination_connector_cannot_be_fetched(api):
    """Odoo ha un adapter ma nessuna sorgente registrata: 422, non 500."""
    client, _ = api
    token = _make_session(USER_A_ID)
    r = client.put(
        "/api/me/connectors/odoo",
        json={"service": "odoo", "secret": "s", "config": {"db_name": "prod"}},
        cookies={"session": token},
    )
    assert r.status_code == 200

    r = _fetch(client, token, label="odoo")

    assert r.status_code == 422
    assert "sorgente" in r.json()["detail"]
