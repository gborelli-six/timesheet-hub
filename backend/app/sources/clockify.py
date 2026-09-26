"""Sorgente Clockify, costruita sulla libreria `clockify-timesheet` (PyPI).

La libreria espone già:

- un timeout di default (5s connect / 30s read) su ogni chiamata HTTP;
- una gerarchia di eccezioni propria, disaccoppiata da `requests` e dalle API
  Clockify, che mappa uno-a-uno sulla nostra.

`_map_error` è quindi l'unico punto di questo progetto che conosce gli errori
della libreria: se la sua superficie cambia, si tocca solo qui.
"""

from clockify_timesheet import (
    ClockifyAuthError,
    ClockifyClient,
    ClockifyConnectionError,
    ClockifyError,
    group_entries_flat,
)
from clockify_timesheet.utils import validate_dates

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

_SECONDS_PER_HOUR = 3600


class ClockifySource(TimesheetSource):
    def validate(self, config: SourceConfig) -> ValidationResult:
        client = self._client(config)
        try:
            user = client.get_current_user()
        except Exception as exc:
            raise self._map_error(exc) from exc
        return ValidationResult(ok=True, message=user.get("email"))

    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        try:
            start_iso, end_iso = validate_dates(start, end)
        except ValueError as exc:
            # Il router valida già formato e ordine delle date: qui è una rete
            # di sicurezza, non un percorso atteso.
            raise AdapterError(str(exc)) from exc

        client = self._client(config)

        try:
            entries = client.fetch_entries(start_iso, end_iso)
        except Exception as exc:
            raise self._map_error(exc) from exc

        # group_entries_flat aggrega per (date, project, task, note) e restituisce
        # già la data in YYYY-MM-DD: è esattamente la granularità di una riga del
        # foglio Excel, quindi non serve alcuna normalizzazione ulteriore.
        return [
            SourceRow(
                date=row["date"],
                project=row["project"],
                task=row["task"],
                hours=round(row["seconds"] / _SECONDS_PER_HOUR, 2),
                notes=row["notes"] or None,
            )
            for row in group_entries_flat(entries)
        ]

    def _client(self, config: SourceConfig) -> ClockifyClient:
        # api_key sempre esplicita: il costruttore della libreria ricadrebbe
        # altrimenti su os.environ["CLOCKIFY_API_KEY"], leggendo una credenziale
        # di sistema al posto di quella dell'utente.
        return ClockifyClient(api_key=config.secret)

    @staticmethod
    def _map_error(exc: Exception) -> AdapterError:
        if isinstance(exc, ClockifyAuthError):
            return AdapterAuthError(str(exc))
        if isinstance(exc, ClockifyConnectionError):
            return AdapterConnectionError(str(exc))
        if isinstance(exc, ClockifyError):
            return AdapterError(str(exc))
        return AdapterError(f"Errore imprevisto da Clockify: {exc}")


source_registry.register(ServiceType.clockify, ClockifySource)
