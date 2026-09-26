# Guida: aggiungere un nuovo adapter o una nuova sorgente a Timesheet Hub

> Questa guida descrive i passi necessari per integrare un nuovo backend nell'architettura plug-in di Timesheet Hub. Ci sono due famiglie distinte:
>
> - **Adapter** (`app/adapters/`) — **destinazioni**: dove le ore vengono scritte (oggi Odoo e Jira). Decisioni architetturali: [ADR-007](../adr/ADR-007-adapter-plugin-architecture.md).
> - **Sorgenti** (`app/sources/`) — da dove le ore vengono **lette** (oggi Clockify). Decisioni architetturali: [ADR-008](../adr/ADR-008-import-sources.md).
>
> I due layer condividono `ServiceType`, la gerarchia di eccezioni (`AdapterError`/`AdapterAuthError`/`AdapterConnectionError`) e `ValidationResult`, tutti definiti in `backend/app/adapters/base.py`. Un nuovo servizio può essere solo destinazione, solo sorgente, o — in astratto — entrambi (in tal caso richiede un file in ciascuna delle due cartelle).

---

## Prerequisiti

- Familiarità con FastAPI e SQLAlchemy (pattern già in uso nel progetto).
- Accesso alla documentazione API del backend da integrare.
- Ambiente di sviluppo locale funzionante (`make up`).

Tutti gli import degli esempi sotto sono relativi al pacchetto Python `app`, la cui radice è `backend/` (non `backend.app`): quando esegui il backend, `backend/` è la directory di lavoro e `app` è il primo segmento del path di importazione.

---

## Parte 1 — Aggiungere un adapter (destinazione)

### Passo 1 — Aggiungere il valore a `ServiceType` e a `UserTokenService`

Il vocabolario dei servizi vive in **due** punti che devono restare sincronizzati (un test lo verifica: `test_catalog_matches_db_enum` in `backend/tests/unit/test_connector_types.py`):

1. `ServiceType` in `backend/app/adapters/base.py` — l'enum applicativo, condiviso da adapter e sorgenti:

   ```python
   class ServiceType(StrEnum):
       odoo     = "odoo"
       jira     = "jira"
       linear   = "linear"
       asana    = "asana"
       clockify = "clockify"
       nuovo    = "nuovo"   # ← aggiungi qui
   ```

2. `UserTokenService` in `backend/app/models/user_token.py` — l'enum che mappa il tipo nativo PostgreSQL `user_tokens_service_enum`:

   ```python
   class UserTokenService(StrEnum):
       jira     = "jira"
       odoo     = "odoo"
       linear   = "linear"
       asana    = "asana"
       clockify = "clockify"
       nuovo    = "nuovo"   # ← aggiungi qui, stesso valore di ServiceType
   ```

Poi crea una migrazione Alembic **scritta a mano** per aggiungere il valore all'enum del database — PostgreSQL non aggiunge valori enum autogenerando la revision, e `ALTER TYPE ... ADD VALUE` non può comunque essere eseguito ed usato nella stessa transazione (vedi `backend/alembic/versions/0012_add_clockify_to_service_enum.py` come esempio reale, incluso il downgrade distruttivo che va guardato prima di copiarlo):

```bash
cd backend
uv run alembic revision -m "add_nuovo_to_service_type_enum"
```

```python
def upgrade() -> None:
    op.execute("ALTER TYPE user_tokens_service_enum ADD VALUE IF NOT EXISTS 'nuovo'")
```

### Passo 2 — Aggiungere la spec al catalogo `app/connector_types.py`

Dall'epica E13 (`ADR-008-D`), ogni servizio in `ServiceType` **deve** avere una voce in `CONNECTOR_TYPES` (`backend/app/connector_types.py`): un test la richiede (`test_catalog_covers_every_service_type`) e un altro impedisce di dichiarare `available=True` senza un adapter o una sorgente registrata (`test_available_types_have_an_implementation`).

```python
ServiceType.nuovo: ConnectorTypeSpec(
    service=ServiceType.nuovo,
    label="Nuovo Backend",
    is_destination=True,          # is_source=True se stai aggiungendo una sorgente (Parte 2)
    secret_label="API token",
    requires_base_url=True,       # True se il servizio è self-hosted / ha un'istanza propria
    requires_account_identifier=True,
    account_identifier_label="Email",
    config_fields=(
        # eventuali campi specifici, es.:
        # ConfigField(key="workspace", label="Workspace", required=False),
    ),
),
```

Se il nuovo backend non è ancora implementato ma vuoi solo prenotarne il posto nell'enum, imposta `available=False`: comparirà nella UI ma disabilitato, come oggi per `linear` e `asana`.

### Passo 3 — Creare il file adapter

Crea `backend/app/adapters/nuovo.py`. Il file deve:

1. Importare le classi base e il registry da `app.adapters.base` / `app.adapters.registry` (non `backend.app...`).
2. Implementare tutti e quattro i metodi dell'ABC `TimesheetAdapter`.
3. Auto-registrarsi nel registry alla fine del file.

```python
from app.adapters.base import (
    AdapterAuthError,
    AdapterConfig,
    AdapterConnectionError,
    ImportResult,
    Project,
    RowError,
    ServiceType,
    Task,
    TimesheetAdapter,
    TimesheetEntry,
    ValidationResult,
)
from app.adapters.registry import adapter_registry


class NuovoAdapter(TimesheetAdapter):

    def validate(self, config: AdapterConfig) -> ValidationResult:
        """Verifica raggiungibilità e credenziali del backend."""
        try:
            # chiama l'endpoint di healthcheck / autenticazione del backend,
            # leggendo le credenziali da config.params (es. config.params["password"])
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
        """Invia le voci timesheet al backend.

        Il router (`app/routers/imports.py`) ha già filtrato `entries` prima di
        chiamare `submit`: ogni TimesheetEntry qui contiene già un solo
        ConnectorAssignment, quello relativo a QUESTO connettore. L'adapter non
        deve (e non può) filtrare per servizio: prende semplicemente il primo
        (e unico) assignment di ogni entry.
        """
        result = ImportResult(success_count=0, error_count=0)
        for i, entry in enumerate(entries):
            if not entry.connector_assignments:
                continue
            assignment = entry.connector_assignments[0]
            try:
                # chiamata API per questa riga, usando assignment.project_id /
                # assignment.task_id, entry.date, entry.hours, entry.note
                ...
                result.success_count += 1
            except Exception as exc:
                result.error_count += 1
                result.errors.append(RowError(row=i, message=str(exc)))
        return result

    def get_projects(
        self,
        config: AdapterConfig,
        query: str | None = None,
    ) -> list[Project]:
        """Recupera la lista dei progetti per l'autocomplete."""
        limit = min(config.params.get("limit", 50), 200)
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
        limit = min(config.params.get("limit", 50), 200)
        try:
            raw = ...
            return [Task(id=str(t["id"]), name=t["name"]) for t in raw]
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc


# auto-registrazione: eseguita all'import del modulo (vedi Passo 4)
adapter_registry.register(ServiceType.nuovo, NuovoAdapter)
```

**Regole importanti**:
- Non sollevare mai eccezioni generiche: usa sempre `AdapterAuthError`, `AdapterConnectionError` o `AdapterError` (la base, per errori applicativi non altrimenti classificabili — vedi `app/adapters/jira.py` per un esempio con tutte e tre).
- `AdapterConfig` ha i campi `service`, `base_url`, `marker` (usato solo dallo stub E2E) e `params: dict` — le credenziali e i parametri specifici del servizio (`user`, `password`, `db`, `limit`, ...) vivono tutti in `params`, non in campi dedicati.
- `RowError` ha i campi `row` (indice 0-based nella lista `entries` ricevuta da `submit`) e `message` — non `row_index`.
- Non restituire mai più di 200 risultati da `get_projects`/`get_tasks` (limite della UI di autocomplete).

### Passo 4 — Registrare l'adapter al boot

Apri `backend/app/adapters/__init__.py` e aggiungi l'import della classe (non del modulo con alias):

```python
from app.adapters.nuovo import NuovoAdapter  # noqa: F401
```

Questo è il pattern realmente in uso nel progetto (vedi lo stesso file per `JiraAdapter` e `OdooAdapter`): l'import ha il solo scopo di eseguire l'`adapter_registry.register(...)` in fondo a `nuovo.py`. `__init__.py` viene eseguito automaticamente non appena qualcosa importa un sotto-modulo di `app.adapters` (è quello che succede quando i router importano `app.adapters.registry`), quindi non serve nessun altro punto di bootstrap esplicito.

### Passo 5 — Scrivere gli unit test

Crea `backend/tests/unit/test_nuovo_adapter.py`. I mock devono coprire almeno:

| Scenario | Cosa mockare | Risultato atteso |
|---|---|---|
| `validate` OK | client → risposta valida | `ValidationResult(ok=True)` |
| `validate` credenziali errate | client → auth exception | `AdapterAuthError` |
| `validate` server down | client → network exception | `AdapterConnectionError` |
| `submit` 2 righe OK | client → creazione riuscita | `ImportResult(success_count=2, error_count=0)` |
| `submit` entry senza assignment | `connector_assignments == []` | riga ignorata, non inviata |
| `get_projects` senza query | client → lista | `list[Project]` completa |
| `get_projects` con query | client → lista filtrata | filtro applicato |
| `get_tasks` con `project_id` valido | client → lista | `list[Task]` |

Schema base di un test unitario (imports e nomi di campo reali):

```python
from unittest.mock import patch

import pytest

from app.adapters.base import AdapterConfig, ServiceType
from app.adapters.nuovo import NuovoAdapter


@pytest.fixture
def config() -> AdapterConfig:
    return AdapterConfig(
        service=ServiceType.nuovo,
        base_url="https://nuovo.example.com",
        params={"user": "test@example.com", "password": "test-token"},
    )


def test_validate_ok(config):
    adapter = NuovoAdapter()
    with patch("app.adapters.nuovo.SomeClient") as mock_client:
        mock_client.return_value.healthcheck.return_value = {"status": "ok"}
        result = adapter.validate(config)
    assert result.ok is True
```

### Passo 6 — Estendere lo stub E2E

Apri `backend/app/adapters/stub.py` e aggiungi dati fissi per il nuovo servizio (segui lo schema già in uso per `_PROJECTS`/`_TASKS` di Odoo e `_PROJECTS_JIRA`/`_TASKS_JIRA` di Jira):

```python
_PROJECTS_NUOVO: list[Project] = [
    Project(id="N1", name="Nuovo Progetto Alpha"),
]

_TASKS_NUOVO: dict[str, list[Task]] = {
    "N1": [Task(id="N101", name="Task Nuovo Frontend")],
}
```

Poi aggiungi un ramo `config.service == ServiceType.nuovo` in `get_projects`/`get_tasks` dello `StubAdapter`, sullo stesso modello del ramo già presente per Jira. Infine, se il nuovo servizio va sostituito in modalità E2E, aggiungi la sua registrazione in `_maybe_register()`:

```python
def _maybe_register(registry: AdapterRegistry = adapter_registry) -> None:
    if settings.e2e_test_mode:
        registry.register(ServiceType.odoo, StubAdapter)
        registry.register(ServiceType.jira, StubAdapter)
        registry.register(ServiceType.nuovo, StubAdapter)  # ← aggiungi qui
```

### Passo 7 — Verifica finale

```bash
cd backend
uv run pytest tests/unit/test_nuovo_adapter.py -v
uv run pytest tests/unit/ -v   # verifica regressioni, incluso test_connector_types.py
uv run ruff check .
```

Accertati che:
- `adapter_registry.get(ServiceType.nuovo)` ritorni `NuovoAdapter` dopo il boot dell'app.
- `test_available_types_have_an_implementation` (in `test_connector_types.py`) passi — fallisce se hai marcato il tipo `available=True` nel catalogo senza registrarlo da nessuna parte.
- I test E2E che usano lo `StubAdapter` non abbiano regressioni (`make e2e`).

---

## Parte 2 — Aggiungere una sorgente

Una **sorgente** legge le voci da un servizio esterno invece di scriverle. Il pattern è parallelo a quello degli adapter (stesso registry, stesse eccezioni), ma l'interfaccia è più piccola: due soli metodi. Decisioni di riferimento: [ADR-008](../adr/ADR-008-import-sources.md), contratti in [`008-clockify-source.md`](../specs/008-clockify-source.md).

### Passo 1 — `ServiceType` / `UserTokenService` / catalogo

Identico al Passo 1 e al Passo 2 della Parte 1: aggiungi il valore a `ServiceType` (`app/adapters/base.py`) e `UserTokenService` (`app/models/user_token.py`), scrivi la migrazione `ALTER TYPE ... ADD VALUE`, e aggiungi la voce al catalogo in `app/connector_types.py` con `is_source=True` (invece di `is_destination=True`):

```python
ServiceType.nuova_sorgente: ConnectorTypeSpec(
    service=ServiceType.nuova_sorgente,
    label="Nuova Sorgente",
    is_source=True,
    secret_label="API key",
    config_fields=(
        ConfigField(key="workspace_id", label="Workspace ID", required=False),
    ),
),
```

Se il servizio non richiede né `base_url` né `account_identifier` (caso comune per le sorgenti SaaS come Clockify), non impostare `requires_base_url`/`requires_account_identifier`: restano `False` di default.

### Passo 2 — Creare il file sorgente

Crea `backend/app/sources/nuova_sorgente.py`. Implementa `TimesheetSource` (`app/sources/base.py`), che espone solo due metodi:

```python
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


class NuovaSorgente(TimesheetSource):
    def validate(self, config: SourceConfig) -> ValidationResult:
        try:
            # verifica raggiungibilità/credenziali, usando config.secret e
            # config.config (il JSONB validato dal catalogo, es. workspace_id)
            ...
            return ValidationResult(ok=True)
        except SomeAuthException as exc:
            raise AdapterAuthError(str(exc)) from exc
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc

    def fetch_entries(
        self, start: str, end: str, config: SourceConfig
    ) -> list[SourceRow]:
        """start/end sono già in formato YYYY-MM-DD e già validati dal router
        (ordine e ampiezza del periodo) prima di arrivare qui."""
        try:
            raw = ...  # chiamata API
        except SomeNetworkException as exc:
            raise AdapterConnectionError(str(exc)) from exc
        return [
            SourceRow(
                date=r["date"],
                project=r["project"],
                task=r["task"],
                hours=round(r["seconds"] / 3600, 2),
                notes=r["notes"] or None,
            )
            for r in raw
        ]


source_registry.register(ServiceType.nuova_sorgente, NuovaSorgente)
```

**Regole importanti**:
- `SourceConfig` ha i campi `service`, `secret` (decifrato, mai loggato), `base_url`, `account_identifier`, `config: dict` (il JSONB validato dal catalogo) e `marker` (usato solo dallo stub E2E, popolato da `account_identifier`).
- `SourceRow` ha la stessa forma di una riga Excel normalizzata: `date`, `project`, `task`, `hours`, `notes`. Non aggiungere campi: è materiale di preview per il wizard, che deve restare agnostico rispetto alla sorgente (`ADR-008-C`).
- Se la libreria del servizio esterno ha una propria gerarchia di eccezioni, centralizza la traduzione in un unico metodo privato (`_map_error`), sul modello di `ClockifySource._map_error()` in `app/sources/clockify.py`: è l'unico punto che deve conoscere gli errori della libreria.

### Passo 3 — Registrare la sorgente al boot

Apri `backend/app/sources/__init__.py` e aggiungi:

```python
from app.sources.nuova_sorgente import NuovaSorgente  # noqa: F401
```

Stesso meccanismo di auto-registrazione degli adapter (Parte 1, Passo 4).

### Passo 4 — Unit test

Crea `backend/tests/unit/test_nuova_sorgente.py` seguendo lo schema di `backend/tests/unit/test_clockify_source.py`: nessuna chiamata di rete, un doppio del client che registra gli argomenti o solleva l'eccezione voluta, e una tabella parametrizzata che verifica la traduzione di ogni eccezione della libreria nella gerarchia `AdapterError`/`AdapterAuthError`/`AdapterConnectionError`.

### Passo 5 — Stub E2E

Apri `backend/app/sources/stub.py`. Se il nuovo servizio va sostituito in E2E, aggiungi righe fisse dedicate o riusa `_ROWS` esistente, e aggiungi la registrazione in `_maybe_register()`:

```python
def _maybe_register(registry: SourceRegistry = source_registry) -> None:
    if settings.e2e_test_mode:
        registry.register(ServiceType.clockify, StubSource)
        registry.register(ServiceType.nuova_sorgente, StubSource)  # ← aggiungi qui
```

Il marker E2E (`E2E__OK` / `E2E__FAIL` / `E2E__EXPIRED` / `E2E__DOWN`) arriva da `SourceConfig.marker`, popolato dal router da `user_tokens.account_identifier`: il seed E2E deve valorizzare quel campo sul connettore di test, altrimenti gli scenari di errore non si attivano.

### Passo 6 — Verifica finale

```bash
cd backend
uv run pytest tests/unit/test_nuova_sorgente.py -v
uv run pytest tests/unit/ -v
uv run ruff check .
```

Accertati che `source_registry.get(ServiceType.nuova_sorgente)` ritorni la classe attesa dopo il boot, e che `test_available_types_have_an_implementation` continui a passare.

---

## Note per adapter/sorgenti REST (confronto con XML-RPC Odoo)

Il pattern vale sia per XML-RPC (Odoo) sia per REST/JSON (Jira, Clockify). Le differenze principali tra i due stili HTTP visti nel progetto:

| Aspetto | Odoo XML-RPC | Jira REST |
|---|---|---|
| HTTP lib | `xmlrpc.client` stdlib | `urllib.request` stdlib |
| Auth | Multi-step: `authenticate()` → uid poi in ogni call | Header-based: `base64(email:api_token)` |
| Parametri config | `config.params["db"/"user"/"password"]` | `config.params["user"/"password"]` |
| Formato risposta | Deserializzazione automatica XML-RPC | Parsing JSON manuale |
| Errore auth | UID falso → `AdapterAuthError` | HTTP 401/403 → `AdapterAuthError` |
| Errore connessione | `OSError`, `socket.timeout`, `xmlrpc.client.ProtocolError` | `OSError`, HTTP ≥ 500 |

`ClockifySource` (sorgente, non adapter) usa invece la libreria `clockify-timesheet` (PyPI, `requests` sotto il cofano): vedi [`008-clockify-source.md`](../specs/008-clockify-source.md) per il dettaglio del mapping errori.

### Auth REST: pattern in uso in `JiraAdapter`

```python
import base64

def _auth_header(self, config: AdapterConfig) -> str:
    email = config.params.get("user", "")
    token = config.params.get("password", "")
    encoded = base64.b64encode(f"{email}:{token}".encode()).decode()
    return f"Basic {encoded}"
```

Riferimento implementazione completa: `backend/app/adapters/jira.py`.

---

## Riepilogo file modificati

**Adapter (destinazione):**

| File | Azione |
|---|---|
| `backend/app/adapters/base.py` | aggiungi valore a `ServiceType` |
| `backend/app/models/user_token.py` | aggiungi lo stesso valore a `UserTokenService` |
| `backend/alembic/versions/NNNN_add_nuovo_to_service_enum.py` | **nuovo file** — `ALTER TYPE ... ADD VALUE` |
| `backend/app/connector_types.py` | aggiungi la `ConnectorTypeSpec` con `is_destination=True` |
| `backend/app/adapters/nuovo.py` | **nuovo file** — implementazione adapter |
| `backend/app/adapters/__init__.py` | aggiungi `from app.adapters.nuovo import NuovoAdapter  # noqa: F401` |
| `backend/app/adapters/stub.py` | dati fissi + case + registrazione E2E |
| `backend/tests/unit/test_nuovo_adapter.py` | **nuovo file** — unit test |

**Sorgente:**

| File | Azione |
|---|---|
| `backend/app/adapters/base.py` | aggiungi valore a `ServiceType` (stesso enum condiviso) |
| `backend/app/models/user_token.py` | aggiungi lo stesso valore a `UserTokenService` |
| `backend/alembic/versions/NNNN_add_nuova_sorgente_to_service_enum.py` | **nuovo file** — `ALTER TYPE ... ADD VALUE` |
| `backend/app/connector_types.py` | aggiungi la `ConnectorTypeSpec` con `is_source=True` |
| `backend/app/sources/nuova_sorgente.py` | **nuovo file** — implementazione sorgente |
| `backend/app/sources/__init__.py` | aggiungi `from app.sources.nuova_sorgente import NuovaSorgente  # noqa: F401` |
| `backend/app/sources/stub.py` | dati fissi (o riuso) + registrazione E2E |
| `backend/tests/unit/test_nuova_sorgente.py` | **nuovo file** — unit test |
