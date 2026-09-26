"""Interfaccia plug-in delle sorgenti di importazione.

Layer simmetrico a `app.adapters`, ma di verso opposto: un `TimesheetAdapter`
è una **destinazione** (dove le ore vengono scritte: Odoo, Jira), un
`TimesheetSource` è una **sorgente** (da dove vengono lette: Clockify).

Nessuno dei quattro metodi di `TimesheetAdapter` — validate/submit/
get_projects/get_tasks — esprime "scarica le voci di un periodo", da cui la
scelta di un secondo ABC invece di estendere il primo (ADR-008).

Le eccezioni e `ValidationResult` sono volutamente riusate da `app.adapters.base`:
così il mapping errore→HTTP già scritto per gli adapter
(`app.routers.adapters._map_adapter_error`) vale anche qui senza duplicazioni.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.adapters.base import (  # noqa: F401  (ri-esportate per i source concreti)
    AdapterAuthError,
    AdapterConnectionError,
    AdapterError,
    ServiceType,
    ValidationResult,
)


@dataclass
class SourceConfig:
    """Configurazione runtime di una sorgente, costruita da una riga user_tokens."""

    service: ServiceType
    secret: str  # decifrato in memoria, mai loggato né serializzato
    base_url: str | None = None
    account_identifier: str | None = None
    # Colonna JSONB user_tokens.config, validata dal catalogo dei tipi.
    config: dict = field(default_factory=dict)
    marker: str | None = None  # usato dallo stub E2E (E2E__OK / E2E__DOWN / ...)


@dataclass
class SourceRow:
    """Una voce scaricata da una sorgente.

    Stessa forma di una riga del foglio Excel dopo il normalizer client-side:
    il wizard può mostrarla in preview senza alcuna trasformazione aggiuntiva.
    """

    date: str  # YYYY-MM-DD
    project: str
    task: str
    hours: float
    notes: str | None = None


class TimesheetSource(ABC):
    @abstractmethod
    def validate(self, config: SourceConfig) -> ValidationResult:
        """Verifica raggiungibilità e credenziali della sorgente."""
        ...

    @abstractmethod
    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        """Scarica le voci del periodo [start, end], date in formato YYYY-MM-DD."""
        ...
