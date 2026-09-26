"""Unit test di ClockifySource.

Nessuna chiamata di rete: `ClockifyClient` è sostituito da un doppio che
registra gli argomenti ricevuti o solleva l'eccezione voluta. Quello che si
verifica qui è il contratto fra la libreria `clockify-timesheet` e il resto
dell'applicazione: conversione delle unità e traduzione degli errori.
"""

import pytest
from clockify_timesheet import (
    ClockifyAuthError,
    ClockifyConnectionError,
    ClockifyError,
)

import app.sources.clockify as clockify_module
from app.sources.base import (
    AdapterAuthError,
    AdapterConnectionError,
    AdapterError,
    ServiceType,
    SourceConfig,
)
from app.sources.clockify import ClockifySource


# Una voce Clockify grezza come la restituisce il report dettagliato.
def _entry(start: str, project: str, task: str, seconds: int, note: str = "") -> dict:
    return {
        "timeInterval": {"start": start, "duration": seconds},
        "projectName": project,
        "taskName": task,
        "description": note,
    }


class FakeClient:
    """Doppio di ClockifyClient: registra le chiamate o solleva `raises`."""

    def __init__(self, entries=None, raises: Exception | None = None):
        self._entries = entries or []
        self._raises = raises
        self.fetch_calls: list[tuple] = []
        self.api_key: str | None = None

    def get_current_user(self) -> dict:
        if self._raises:
            raise self._raises
        return {"email": "alice@sixfeetup.it"}

    def fetch_entries(self, start, end):
        self.fetch_calls.append((start, end))
        if self._raises:
            raise self._raises
        return self._entries


@pytest.fixture
def config() -> SourceConfig:
    return SourceConfig(service=ServiceType.clockify, secret="api-key-123")


def _patch_client(monkeypatch, fake: FakeClient) -> None:
    def factory(api_key=None, **kwargs):
        fake.api_key = api_key
        return fake

    monkeypatch.setattr(clockify_module, "ClockifyClient", factory)


# ── Conversione delle voci ─────────────────────────────────────────────────────


def test_seconds_are_converted_to_hours(monkeypatch, config) -> None:
    fake = FakeClient(
        entries=[_entry("2026-06-01T09:00:00Z", "Alfa", "Sviluppo", 27000, "refactor")]
    )
    _patch_client(monkeypatch, fake)

    rows = ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert len(rows) == 1
    assert rows[0].date == "2026-06-01"
    assert rows[0].project == "Alfa"
    assert rows[0].task == "Sviluppo"
    assert rows[0].hours == 7.5  # 27000s
    assert rows[0].notes == "refactor"


def test_hours_are_rounded_to_two_decimals(monkeypatch, config) -> None:
    # 100 secondi = 0.0277... ore
    fake = FakeClient(entries=[_entry("2026-06-01T09:00:00Z", "Alfa", "T", 100)])
    _patch_client(monkeypatch, fake)

    rows = ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert rows[0].hours == 0.03


def test_empty_note_becomes_none(monkeypatch, config) -> None:
    fake = FakeClient(entries=[_entry("2026-06-01T09:00:00Z", "Alfa", "T", 3600, "")])
    _patch_client(monkeypatch, fake)

    rows = ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert rows[0].notes is None


def test_entries_sharing_date_project_task_and_note_are_aggregated(
    monkeypatch, config
) -> None:
    """È il comportamento di group_entries_flat: la granularità di una riga Excel."""
    fake = FakeClient(
        entries=[
            _entry("2026-06-01T09:00:00Z", "Alfa", "Sviluppo", 3600, "stessa nota"),
            _entry("2026-06-01T14:00:00Z", "Alfa", "Sviluppo", 1800, "stessa nota"),
            _entry("2026-06-01T16:00:00Z", "Alfa", "Sviluppo", 3600, "nota diversa"),
        ]
    )
    _patch_client(monkeypatch, fake)

    rows = ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert len(rows) == 2
    by_note = {r.notes: r.hours for r in rows}
    assert by_note["stessa nota"] == 1.5
    assert by_note["nota diversa"] == 1.0


def test_no_entries_returns_empty_list(monkeypatch, config) -> None:
    _patch_client(monkeypatch, FakeClient(entries=[]))

    assert ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config) == []


# ── Passaggio dei parametri alla libreria ──────────────────────────────────────


def test_dates_are_passed_as_clockify_iso_range(monkeypatch, config) -> None:
    fake = FakeClient()
    _patch_client(monkeypatch, fake)

    ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    start, end = fake.fetch_calls[0]
    assert start == "2026-06-01T00:00:00.000Z"
    assert end == "2026-06-30T23:59:59.999Z"


def test_api_key_is_always_passed_explicitly(monkeypatch, config) -> None:
    """Senza api_key esplicita la libreria leggerebbe CLOCKIFY_API_KEY dall'ambiente,
    usando una credenziale di sistema al posto di quella dell'utente."""
    monkeypatch.setenv("CLOCKIFY_API_KEY", "chiave-di-sistema-da-non-usare")
    fake = FakeClient()
    _patch_client(monkeypatch, fake)

    ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert fake.api_key == "api-key-123"


# ── Traduzione degli errori ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raised", "expected"),
    [
        (ClockifyAuthError("401"), AdapterAuthError),
        (ClockifyConnectionError("timeout"), AdapterConnectionError),
        (ClockifyError("boom"), AdapterError),
        (RuntimeError("imprevisto"), AdapterError),
    ],
)
def test_library_errors_are_mapped_to_adapter_hierarchy(
    monkeypatch, config, raised, expected
) -> None:
    _patch_client(monkeypatch, FakeClient(raises=raised))

    with pytest.raises(expected):
        ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)


def test_auth_error_is_not_swallowed_as_generic(monkeypatch, config) -> None:
    """AdapterAuthError → 409 needs_reauth, AdapterError → 502: non vanno confusi."""
    _patch_client(monkeypatch, FakeClient(raises=ClockifyAuthError("401")))

    with pytest.raises(AdapterAuthError):
        ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)


def test_invalid_date_order_raises_adapter_error(monkeypatch, config) -> None:
    _patch_client(monkeypatch, FakeClient())

    with pytest.raises(AdapterError):
        ClockifySource().fetch_entries("2026-06-30", "2026-06-01", config)


def test_secret_never_appears_in_error_message(monkeypatch, config) -> None:
    _patch_client(monkeypatch, FakeClient(raises=ClockifyAuthError("HTTP 401")))

    with pytest.raises(AdapterAuthError) as exc:
        ClockifySource().fetch_entries("2026-06-01", "2026-06-30", config)

    assert "api-key-123" not in str(exc.value)


# ── validate ───────────────────────────────────────────────────────────────────


def test_validate_ok_returns_account_email(monkeypatch, config) -> None:
    _patch_client(monkeypatch, FakeClient())

    result = ClockifySource().validate(config)

    assert result.ok is True
    assert result.message == "alice@sixfeetup.it"


def test_validate_maps_auth_error(monkeypatch, config) -> None:
    _patch_client(monkeypatch, FakeClient(raises=ClockifyAuthError("401")))

    with pytest.raises(AdapterAuthError):
        ClockifySource().validate(config)
