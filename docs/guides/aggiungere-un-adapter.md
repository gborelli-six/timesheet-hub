# Guida: aggiungere un nuovo adapter a Timesheet Hub

> Questa guida descrive i passi necessari per integrare un nuovo backend (es. Jira, Linear, Asana) nell'architettura plug-in degli adapter. Per le decisioni architetturali di riferimento, vedere [ADR-007](../adr/ADR-007-adapter-plugin-architecture.md).

---

## Prerequisiti

- Familiarità con FastAPI e SQLAlchemy (pattern già in uso nel progetto).
- Accesso alla documentazione API del backend da integrare.
- Ambiente di sviluppo locale funzionante (`make up`).

---

## Passo 1 — Aggiungere il valore al `ServiceType`

Apri `backend/app/adapters/base.py` e aggiungi il nuovo servizio all'enum:

```python
class ServiceType(StrEnum):
    odoo   = "odoo"
    jira   = "jira"
    linear = "linear"
    asana  = "asana"
    nuovo  = "nuovo"   # ← aggiungi qui
```

L'enum è dichiarato in `backend/app/adapters/base.py`. Dopo la modifica, crea una migrazione Alembic per aggiungere il valore all'enum del DB (PostgreSQL non aggiunge valori enum automaticamente — vedi `ADR-004-B`):

```bash
cd backend
uv run alembic revision -m "add_nuovo_to_service_type_enum"
# poi scrivi il corpo della migrazione a mano con ALTER TYPE ... ADD VALUE
```

---

## Passo 2 — Creare il file adapter

Crea `backend/app/adapters/nuovo.py`. Il file deve:

1. Importare le classi base e il registry.
2. Implementare tutti e quattro i metodi dell'ABC.
3. Auto-registrarsi nel registry alla fine del file.

```python
from __future__ import annotations

from backend.app.adapters.base import (
    AdapterConfig,
    AdapterAuthError,
    AdapterConnectionError,
    AdapterError,
    ImportResult,
    Project,
    RowError,
    ServiceType,
    Task,
    TimesheetAdapter,
    TimesheetEntry,
    ValidationResult,
)
from backend.app.adapters.registry import adapter_registry


class NuovoAdapter(TimesheetAdapter):

    def validate(self, config: AdapterConfig) -> ValidationResult:
        """Verifica raggiungibilità e credenziali del backend."""
        try:
            # chiama l'endpoint di healthcheck / autenticazione del backend
            ...
            return ValidationResult(ok=True)
        except SomeAuthException as exc:
            raise AdapterAuthError(str(exc)) from exc
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc

    def submit(
        self,
        entries: list[TimesheetEntry],
        config: AdapterConfig,
    ) -> ImportResult:
        """Invia le voci timesheet al backend."""
        success, errors = 0, []
        for entry in entries:
            # filtra solo le righe con assignment per questo servizio
            assignments = [
                a for a in entry.connector_assignments
                if a.service_type == ServiceType.nuovo
            ]
            if not assignments:
                continue
            try:
                # chiamata API per ogni riga
                ...
                success += 1
            except Exception as exc:
                errors.append(RowError(row_index=entry.row_index, message=str(exc)))
        return ImportResult(
            success_count=success,
            error_count=len(errors),
            errors=errors,
        )

    def get_projects(
        self,
        config: AdapterConfig,
        query: str | None = None,
    ) -> list[Project]:
        """Recupera la lista dei progetti per l'autocomplete."""
        limit = min(int(config.params.get("limit", 50)), 200)
        try:
            # chiamata API al backend
            raw = ...
            return [Project(id=str(p["id"]), name=p["name"]) for p in raw]
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc

    def get_tasks(
        self,
        project_id: str,
        config: AdapterConfig,
        query: str | None = None,
    ) -> list[Task]:
        """Recupera i task di un progetto per l'autocomplete."""
        limit = min(int(config.params.get("limit", 50)), 200)
        try:
            raw = ...
            return [Task(id=str(t["id"]), name=t["name"]) for t in raw]
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc


# auto-registrazione: questo import è sufficiente perché l'adapter sia disponibile
adapter_registry.register(ServiceType.nuovo, NuovoAdapter)
```

**Regole importanti**:
- Non sollevare mai eccezioni generiche: usa sempre `AdapterAuthError`, `AdapterConnectionError` o `AdapterError`.
- `submit` deve filtrare le entry per servizio: la stessa riga può avere assignment su più connettori; l'adapter gestisce solo i suoi.
- Non restituire mai più di 200 risultati da `get_projects`/`get_tasks` (limite della UI di autocomplete).

---

## Passo 3 — Esportare dal pacchetto `adapters`

Apri `backend/app/adapters/__init__.py` e aggiungi l'import del nuovo modulo, così il registry viene popolato al boot di FastAPI:

```python
from backend.app.adapters import nuovo as _nuovo_adapter  # noqa: F401
```

L'alias `_nuovo_adapter` con `noqa: F401` è il pattern adottato nel progetto per gli import con solo effetti collaterali (registrazione nel registry).

---

## Passo 4 — Scrivere gli unit test

Crea `backend/tests/unit/test_nuovo_adapter.py`. I mock devono coprire:

| Scenario | Cosa mockare | Risultato atteso |
|---|---|---|
| `validate` OK | client → risposta valida | `ValidationResult(ok=True)` |
| `validate` credenziali errate | client → auth exception | `AdapterAuthError` |
| `validate` server down | client → network exception | `AdapterConnectionError` |
| `submit` 2 righe OK | client → creazione riuscita | `ImportResult(success_count=2, error_count=0)` |
| `submit` riga non per questo servizio | entry senza assignment `nuovo` | riga ignorata, non inviata |
| `get_projects` senza query | client → lista | `list[Project]` completa |
| `get_projects` con query | client → lista filtrata | filtro applicato |
| `get_tasks` con `project_id` valido | client → lista | `list[Task]` |
| `get_tasks` con `project_id` inesistente | client → lista vuota | `[]` |

Schema base di un test unitario:

```python
from unittest.mock import MagicMock, patch

import pytest

from backend.app.adapters.nuovo import NuovoAdapter
from backend.app.adapters.base import AdapterConfig, ServiceType


@pytest.fixture
def config() -> AdapterConfig:
    return AdapterConfig(
        service_type=ServiceType.nuovo,
        base_url="https://nuovo.example.com",
        credentials={"api_token": "test-token"},
    )


def test_validate_ok(config):
    adapter = NuovoAdapter()
    with patch("backend.app.adapters.nuovo.SomeClient") as mock_client:
        mock_client.return_value.healthcheck.return_value = {"status": "ok"}
        result = adapter.validate(config)
    assert result.ok is True
```

---

## Passo 5 — Estendere lo stub E2E

Apri `backend/app/adapters/stub.py` e aggiungi dati fissi per il nuovo servizio:

```python
_PROJECTS_NUOVO: list[dict] = [
    {"id": "N1", "name": "Nuovo Progetto Alpha"},
    {"id": "N2", "name": "Nuovo Progetto Beta"},
]

_TASKS_NUOVO: dict[str, list[dict]] = {
    "N1": [{"id": "N101", "name": "Task Nuovo Frontend"}],
    "N2": [{"id": "N201", "name": "Task Nuovo Design"}],
}
```

Poi aggiungi un case nel metodo `get_projects` e `get_tasks` dello `StubAdapter` per `ServiceType.nuovo`, seguendo il pattern già in uso per `ServiceType.odoo`.

Aggiungi anche `_maybe_register()` per la sovrascrittura del registry quando `E2E_TEST_MODE=true`.

---

## Passo 6 — Verifica finale

```bash
# unit test del nuovo adapter
cd backend
uv run pytest tests/unit/test_nuovo_adapter.py -v

# tutti i test unit (verifica regressioni)
uv run pytest tests/unit/ -v

# lint e type check
uv run ruff check .
uv run mypy app/adapters/nuovo.py
```

Accertati che:
- `adapter_registry.get(ServiceType.nuovo)` ritorni `NuovoAdapter` dopo il boot
- I test E2E che usano lo StubAdapter non abbiano regressioni (`make e2e`)

---

## Riepilogo file modificati

| File | Azione |
|---|---|
| `backend/app/adapters/base.py` | aggiungi valore a `ServiceType` |
| `backend/app/adapters/nuovo.py` | **nuovo file** — implementazione adapter |
| `backend/app/adapters/__init__.py` | aggiungi import del nuovo modulo |
| `backend/app/adapters/stub.py` | aggiungi dati fissi e case per il nuovo servizio |
| `backend/tests/unit/test_nuovo_adapter.py` | **nuovo file** — unit test |
