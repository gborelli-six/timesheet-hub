# ADR-007 — Architettura plug-in degli adapter

- **Stato**: Accettato
- **Data**: 2026-07-01
- **Contesto**: E7 (Architettura adapter + Odoo)

---

## Problema

Timesheet Hub deve inviare le voci timesheet a backend eterogenei (Odoo, Jira, Linear, Asana) e recuperare da essi le liste di progetti e task per l'autocomplete del wizard. I backend sono funzionalmente diversi (JSON-RPC, REST, GraphQL) ma logicamente equivalenti dal punto di vista dell'applicazione: ogni adapter riceve le stesse informazioni in ingresso e produce gli stessi tipi in uscita.

Requisiti:
- Aggiungere un nuovo backend non deve richiedere modifiche al core applicativo.
- Il layer adapter deve essere sostituibile in fase di test E2E senza un backend reale.
- La gestione degli errori deve essere tipizzata: autenticazione scaduta, server irraggiungibile e errori applicativi sono casi distinti e richiedono risposte diverse.

---

## Decisioni

### ADR-007-A — Interfaccia ABC `TimesheetAdapter`

**Decisione**: ogni adapter implementa la classe astratta `TimesheetAdapter(ABC)` definita in `backend/app/adapters/base.py`. Il contratto espone esattamente quattro metodi:

| Metodo | Firma | Responsabilità |
|---|---|---|
| `validate` | `(config: AdapterConfig) → ValidationResult` | Verifica raggiungibilità e credenziali del backend |
| `submit` | `(entries: list[TimesheetEntry], config: AdapterConfig) → ImportResult` | Invia le voci timesheet al backend |
| `get_projects` | `(config: AdapterConfig, query: str \| None) → list[Project]` | Recupera i progetti per l'autocomplete |
| `get_tasks` | `(project_id: str, config: AdapterConfig, query: str \| None) → list[Task]` | Recupera i task di un progetto per l'autocomplete |

**Tipi condivisi** (stesso modulo):

- `Project(id: str, name: str)` e `Task(id: str, name: str)` — DTO di risposta
- `AdapterConfig` — configurazione runtime (service_type, base_url, credenziali decifrate, marker E2E, params extra)
- `ImportResult(success_count: int, error_count: int, errors: list[RowError])` — esito dell'import
- `ValidationResult(ok: bool, message: str | None)` — esito della validazione
- `RowError(row_index: int, message: str)` — dettaglio errore per riga

**Gerarchia delle eccezioni**:

```
AdapterError                 # generico, catturabile come fallback
├── AdapterAuthError         # credenziali scadute o errate → il chiamante imposta needs_reauth
└── AdapterConnectionError   # backend irraggiungibile (timeout, DNS, rete)
```

**Alternative considerate**:
- *Protocollo duck-typing*: nessun ABC, solo convenzione. Scartato: errori di firma scoperti a runtime anziché a import-time.
- *Plugin di terze parti via entry_points*: flessibile per ecosistemi open-source. Scartato: overhead non giustificato per un tool interno con un numero di adapter noto e limitato.

**Motivazione**: l'ABC rende obbligatoria l'implementazione di tutti i metodi — `mypy` e `pytest` rilevano immediatamente un adapter incompleto. La gerarchia di eccezioni consente al layer chiamante di reagire diversamente a un token scaduto (propone re-auth) rispetto a un server down (propone retry), senza inspezionare messaggi di errore in stringa.

---

### ADR-007-B — Registry plug-in (`AdapterRegistry`)

**Decisione**: `AdapterRegistry` (in `backend/app/adapters/registry.py`) mantiene un dizionario `ServiceType → type[TimesheetAdapter]`. L'istanza globale `adapter_registry` è un singleton di modulo. Ogni adapter si auto-registra in fondo al proprio file all'import:

```python
adapter_registry.register(ServiceType.odoo, OdooAdapter)
```

Il chiamante recupera la classe via `adapter_registry.get(service)` e la istanzia con la config a runtime. Se il servizio non è registrato, `get()` solleva `KeyError`.

**Comportamento di `register()`**:
- Rifiuta qualsiasi classe che non sia sottoclasse di `TimesheetAdapter` (solleva `TypeError`).
- Sovrascrive silenziosamente un adapter già registrato per lo stesso servizio — comportamento sfruttato dallo `StubAdapter` in modalità E2E.

**Alternative considerate**:
- *Factory function centralizzata con `if/elif` sul service type*: semplice ma richiede modifica ad ogni nuovo adapter. Scartato.
- *Registry in config YAML*: configurabile senza codice. Scartato: introduce complessità (parsing, validazione) non giustificata per un numero di adapter noto.

**Motivazione**: il pattern Registry sposta la dipendenza dall'accoppiamento statico (factory) a un accoppiamento a runtime mediato da un nome simbolico. Aggiungere un nuovo adapter non tocca nessun file esistente: basta importare il modulo nel punto di bootstrap (o usare l'auto-registrazione).

---

### ADR-007-C — Client JSON-RPC Odoo via `xmlrpc.client` stdlib

**Decisione**: `OdooAdapter` (`backend/app/adapters/odoo.py`) usa esclusivamente `xmlrpc.client` dalla libreria standard Python. Nessuna dipendenza esterna aggiuntiva.

- Autenticazione: `ServerProxy(f"{base_url}/xmlrpc/2/common").authenticate(db, user, password, {})`
- Chiamate modello: `ServerProxy(f"{base_url}/xmlrpc/2/object").execute_kw(model, method, args, kwargs)`
- Modelli usati: `project.project` (progetti), `project.task` (task), `account.analytic.line` (timesheet)
- Campi scritti su `account.analytic.line`: `date`, `project_id`, `task_id`, `unit_amount` (ore), `name` (note)
- Limit di ricerca: parametrizzabile via `AdapterConfig.params['limit']`, default 50, massimo 200

**Gestione errori Odoo**:

| Condizione | Eccezione sollevata |
|---|---|
| UID non valido (credenziali errate) | `AdapterAuthError` |
| `OSError`, `socket.timeout`, `xmlrpc.client.ProtocolError` | `AdapterConnectionError` |
| Errore applicativo Odoo (fault XML-RPC) | `AdapterError` con messaggio |

**Alternative considerate**:
- *`odoorpc` / `erppeek`*: client Odoo di terze parti più ergonomici. Scartati: dipendenze esterne non necessarie; `xmlrpc.client` è sufficiente per le chiamate richieste e garantisce zero conflitti di versione.
- *Chiamate HTTP raw via `httpx`*: massima flessibilità. Scartato: `xmlrpc.client` gestisce il protocollo XML-RPC e la serializzazione senza codice custom.

**Motivazione**: zero dipendenze aggiuntive per il client Odoo → nessun rischio di conflitto con il resto del progetto; `xmlrpc.client` è stabile e coperto dalla suite di test stdlib.

---

### ADR-007-D — Stub adapter E2E deterministico

**Decisione**: `StubAdapter` (`backend/app/adapters/stub.py`) implementa `TimesheetAdapter` con comportamento controllato da un marker stringa in `AdapterConfig.marker`. I marcatori supportati:

| Marker | `validate` | `submit` | `get_projects` / `get_tasks` |
|---|---|---|---|
| `E2E__OK` | `ValidationResult(ok=True)` | tutte le righe OK | lista fissa hardcoded |
| `E2E__FAIL` | — | tutte le righe in errore | — |
| `E2E__EXPIRED` | `AdapterAuthError` | — | `AdapterAuthError` |
| `E2E__DOWN` | `AdapterConnectionError` | `AdapterConnectionError` | `AdapterConnectionError` |

Dati fissi per `E2E__OK`:
- Progetti: `[{id:"1", name:"Progetto Alpha"}, {id:"2", name:"Progetto Beta"}]`
- Task progetto 1: `[{id:"101", name:"Task Frontend"}, {id:"102", name:"Task Backend"}]`
- Task progetto 2: `[{id:"201", name:"Task Design"}]`

**Guard di attivazione**: `StubAdapter` si importa e si registra nel registry **solo** se `E2E_TEST_MODE=true` (variabile d'ambiente). L'env var è verificata a import-time dalla config FastAPI con `model_validator` fail-closed (`ADR-003-B`). In produzione il modulo non esegue alcun effetto collaterale.

**Sovrascrittura del registry**: quando attivo, `StubAdapter` sovrascrive `OdooAdapter` per `ServiceType.odoo`. Il comportamento di sovrascrittura del registry (ADR-007-B) è il meccanismo intenzionale.

**Motivazione**: i test E2E Playwright non dipendono da un'istanza Odoo reale → esecuzione deterministica e veloce in CI. Lo StubAdapter è la single source of truth per tutti gli scenari E2E dell'adapter layer; i test Playwright possono cambiare scenario cambiando il marker nel seed deterministico.

---

## Conseguenze

**Positive**:
- Aggiungere un adapter per Jira, Linear o Asana (E11) richiede un solo file nuovo — nessuna modifica al core.
- La gerarchia di eccezioni consente una UX distinta per token scaduto vs. server down.
- Lo StubAdapter rende i test E2E completamente indipendenti dai backend reali.
- Zero dipendenze aggiuntive per il client Odoo.

**Negative / trade-off accettati**:
- `xmlrpc.client` è sincrono: le chiamate Odoo bloccano il thread. Accettabile perché `submit` e le query autocomplete sono invocate in background task FastAPI, non nel thread della request.
- Il registry globale è un singleton di modulo: in test non-E2E va ripulito tra un test e l'altro se si testano più adapter. Mitigato dai test unitari che mockano il registry direttamente.
- Lo StubAdapter supporta un sottoinsieme fisso di scenari: se emergono nuovi casi limite E2E, i dati hardcoded vanno aggiornati manualmente.

---

## Riferimenti

- `ADR-001-H` — Credenziali di sistema (due livelli: per-utente e di sistema)
- `ADR-003-B` — Guard `E2E_TEST_MODE` fail-closed
- `ADR-004` — Naming constraint ORM, convenzioni enum
- `ADR-005` — Cifratura AES-256-GCM; helper `encrypt_secret`/`decrypt_secret`
- `docs/guides/aggiungere-un-adapter.md` — Guida operativa per nuovi adapter
