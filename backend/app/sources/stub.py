"""Sorgente deterministica per i test E2E. Attiva solo con E2E_TEST_MODE=true.

Gemella di app/adapters/stub.py e con gli stessi marcatori: il comportamento è
scelto dal marker in `SourceConfig.marker`, che il router popola da
`user_tokens.account_identifier`. Il seed E2E deve quindi valorizzare quel
campo, altrimenti gli scenari di errore non si attivano.
"""

from app.core.config import settings
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
from app.sources.registry import SourceRegistry, source_registry

# Righe fisse: i progetti/task corrispondono a quelli di StubAdapter, così uno
# scenario E2E può scaricare da qui e assegnare su un connettore stub senza
# dati intermedi.
_ROWS: list[SourceRow] = [
    SourceRow(
        date="2026-06-01",
        project="Progetto Alpha",
        task="Task Frontend",
        hours=7.5,
        notes="Stub: sviluppo interfaccia",
    ),
    SourceRow(
        date="2026-06-02",
        project="Progetto Alpha",
        task="Task Backend",
        hours=4.0,
        notes="Stub: endpoint import",
    ),
    SourceRow(
        date="2026-06-03",
        project="Progetto Beta",
        task="Task Design",
        hours=2.25,
        notes=None,
    ),
]


class StubSource(TimesheetSource):
    def validate(self, config: SourceConfig) -> ValidationResult:
        self._raise_for_marker(config)
        return ValidationResult(ok=True)

    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        self._raise_for_marker(config)
        if "E2E__FAIL" in (config.marker or ""):
            raise AdapterError("Stub: errore applicativo dalla sorgente")
        # Le righe sono filtrate sul periodo richiesto: uno scenario può
        # verificare che la selezione delle date arrivi davvero alla sorgente.
        return [row for row in _ROWS if start <= row.date <= end]

    @staticmethod
    def _raise_for_marker(config: SourceConfig) -> None:
        marker = config.marker or ""
        if "E2E__DOWN" in marker:
            raise AdapterConnectionError("Stub: sorgente non raggiungibile")
        if "E2E__EXPIRED" in marker:
            raise AdapterAuthError("Stub: credenziali scadute")


def _maybe_register(registry: SourceRegistry = source_registry) -> None:
    """Registra StubSource nel registry se E2E_TEST_MODE è attivo."""
    if settings.e2e_test_mode:
        registry.register(ServiceType.clockify, StubSource)


_maybe_register()
