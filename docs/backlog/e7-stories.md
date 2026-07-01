# E7 — Architettura plug-in + adapter Odoo: dettaglio storie

> Epica che introduce l'**architettura a plug-in per gli adapter** e l'implementazione dell'**adapter Odoo** (JSON-RPC). Fornisce a E8a l'interfaccia `TimesheetAdapter`, il registry, i metodi `getProjects`/`getTasks` per l'autocomplete live e lo stub deterministico E2E. I connettori sono esclusivamente per-utente via `user_tokens` (E5); non esiste configurazione di sistema condivisa. Dipende da E2 (ORM/Alembic) ed E5 (credenziali per-utente AES-256-GCM).
>
> **Nota sugli ID**: gli ID `STORY-E7-N` sono provvisori; assegnare i numeri definitivi all'inserimento in sprint.
>
> **Confine E7 / E8a**: E7 implementa il layer adapter (interfaccia, registry, OdooAdapter, stub E2E). I REST endpoint `GET /api/adapters/{label}/projects` e `.../tasks` che espongono i metodi al frontend sono in **STORY-E8a-2**, che dipende da E7.

---

## STORY-E7-1 — Interfaccia `TimesheetAdapter` + registry + tipi condivisi

- **Stato**: ✅ Done
- **Tipo**: Backend / Architettura
- **Dipende da**: —

**Obiettivo**: esiste l'interfaccia ABC dell'adapter e il registry plug-in; ogni adapter futuro implementa il contratto senza toccare il codice esistente.

**Criteri di accettazione**:
- `backend/app/adapters/base.py`: classe astratta `TimesheetAdapter(ABC)` con i metodi:
  - `validate(config: AdapterConfig) -> ValidationResult`
  - `submit(entries: list[TimesheetEntry], config: AdapterConfig) -> ImportResult`
  - `get_projects(query: str | None = None) -> list[Project]`
  - `get_tasks(project_id: str, query: str | None = None) -> list[Task]`
- Tipi condivisi nello stesso modulo: `Project(id: str, name: str)`, `Task(id: str, name: str)`, `AdapterConfig`, `ImportResult(success_count, error_count, errors: list[RowError])`, `ValidationResult(ok: bool, message: str | None)`.
- `backend/app/adapters/registry.py`: `AdapterRegistry` con `register(service: ServiceType, adapter_class: type[TimesheetAdapter])` e `get(service: ServiceType) -> type[TimesheetAdapter]`; `get()` solleva `KeyError` se il servizio non è registrato.
- `backend/app/adapters/__init__.py`: esporta `TimesheetAdapter`, `AdapterRegistry`, tipi condivisi.
- `backend/tests/unit/test_adapter_registry.py`: registrazione, recupero, `KeyError` su servizio sconosciuto, impossibilità di registrare un non-`TimesheetAdapter`.

---

## STORY-E7-2 — ~~Tabella `backend_configs`~~ (rimossa)

- **Stato**: ❌ Rimossa
- **Motivo**: i connettori sono esclusivamente per-utente via `user_tokens` (E5). Non esiste configurazione di sistema condivisa; `backend_configs`, le migrazioni `0005`/`0006` e i test correlati sono stati eliminati.

---

## STORY-E7-3 — Adapter Odoo: autenticazione + `submit` + `validate`

- **Stato**: ✅ Done
- **Tipo**: Backend
- **Dipende da**: STORY-E7-1

**Obiettivo**: l'adapter Odoo può autenticarsi, verificare la raggiungibilità del server e inviare le voci timesheet sul modulo `hr_timesheet` di Odoo tramite JSON-RPC.

**Criteri di accettazione**:
- `backend/app/adapters/odoo.py`: `OdooAdapter(TimesheetAdapter)`.
- Client JSON-RPC Odoo via `xmlrpc.client` (stdlib): endpoint `/xmlrpc/2/common` (autenticazione) e `/xmlrpc/2/object` (esecuzione metodi).
- `validate(config)`: chiama `common.authenticate(db, user, password, {})` e restituisce `ValidationResult(ok=True)` se l'uid è valido; `ValidationResult(ok=False, message=...)` in caso di credenziali errate o server irraggiungibile.
- `submit(entries, config)`: per ogni `TimesheetEntry` con almeno un `ConnectorAssignment` sul servizio Odoo, chiama `object.execute_kw('account.analytic.line', 'create', [...])` con i campi `date`, `project_id`, `task_id`, `unit_amount` (ore), `name` (note). Restituisce `ImportResult` con conteggi e lista degli errori per riga.
- Eccezioni tipizzate: `AdapterAuthError` (credenziali scadute/errate → il chiamante imposta `needs_reauth`), `AdapterConnectionError` (server irraggiungibile), `AdapterError` (generico).
- `OdooAdapter` si auto-registra nel registry globale su import del modulo.
- `backend/tests/unit/test_odoo_adapter.py`: mock `xmlrpc.client.ServerProxy`; `validate` OK, `validate` credenziali errate, `submit` 2 righe OK, `submit` con riga Odoo e riga non-Odoo (solo quella Odoo viene inviata), `AdapterConnectionError` su timeout.

---

## STORY-E7-4 — Adapter Odoo: `getProjects` + `getTasks`

- **Stato**: ✅ Done
- **Tipo**: Backend
- **Dipende da**: STORY-E7-3

**Obiettivo**: l'adapter Odoo espone la lista dei progetti e dei task del sistema remoto, con filtro per query testuale, per alimentare l'autocomplete live del wizard (E8a).

**Criteri di accettazione**:
- `get_projects(query=None)`: chiama `object.execute_kw('project.project', 'search_read', [[['active', '=', True]]], {'fields': ['id', 'name'], 'limit': 50})`; se `query` è presente aggiunge il dominio `['name', 'ilike', query]`. Restituisce `list[Project]`.
- `get_tasks(project_id, query=None)`: chiama `search_read` su `project.task` con dominio `[['project_id', '=', int(project_id)], ['active', '=', True]]` e, se presente, `['name', 'ilike', query]`. Restituisce `list[Task]`.
- `limit` parametrizzabile via `AdapterConfig` (default 50); mai restituire più di 200 risultati.
- `backend/tests/unit/test_odoo_adapter.py` (integrazione con i test esistenti di E7-3): mock `execute_kw`; `get_projects` senza query → lista completa; `get_projects` con query → ilike applicato; `get_tasks` con `project_id` corretto; `get_tasks` con `project_id` inesistente → lista vuota; `AdapterConnectionError` su timeout.

---

## STORY-E7-5 — Stub adapter E2E (estende skeleton E1)

- **Stato**: ✅ Done
- **Tipo**: Backend / E2E infra
- **Dipende da**: STORY-E7-1

**Obiettivo**: lo stub adapter deterministico usato nei test E2E gestisce i marcatori `E2E__OK / E2E__EXPIRED / E2E__DOWN` anche per `getProjects` e `getTasks`, permettendo a E8a di scrivere scenari Playwright sull'autocomplete senza un Odoo reale.

**Criteri di accettazione**:
- `backend/app/adapters/stub.py`: `StubAdapter(TimesheetAdapter)`, attivo solo quando `E2E_TEST_MODE=true` (import-time guard identica alla guardia di E1).
- `validate(config)`: legge `config.marker`; `E2E__OK` → `ValidationResult(ok=True)`; `E2E__EXPIRED` → solleva `AdapterAuthError`; `E2E__DOWN` → solleva `AdapterConnectionError`.
- `submit(entries, config)`: `E2E__OK` → tutte le righe successo; `E2E__FAIL` → tutte le righe fallite con errore applicativo; `E2E__DOWN` → `AdapterConnectionError`.
- `get_projects(query=None)`: `E2E__OK` → lista fissa `[{id:"1", name:"Progetto Alpha"}, {id:"2", name:"Progetto Beta"}]`, filtrata per `query` se presente (startswith case-insensitive); `E2E__DOWN` → `AdapterConnectionError`; `E2E__EXPIRED` → `AdapterAuthError`.
- `get_tasks(project_id, query=None)`: `E2E__OK` → lista fissa per `project_id` (es. `"1"` → `[{id:"101", name:"Task Frontend"}, {id:"102", name:"Task Backend"}]`; `"2"` → `[{id:"201", name:"Task Design"}]`); comportamento errori identico a `get_projects`.
- `StubAdapter` si registra nel registry globale all'import, sovrascrivendo l'adapter reale, solo se `E2E_TEST_MODE=true`.
- `backend/tests/unit/test_stub_adapter.py`: tutti i marcatori per tutti i metodi; guard `E2E_TEST_MODE=false` → `StubAdapter` non registrato.

---

## STORY-E7-6 — ~~Seed config Odoo di default~~ (rimossa)

- **Stato**: ❌ Rimossa
- **Motivo**: non necessaria — l'architettura è per-utente; l'MVP employee usa le credenziali Odoo dell'utente già in `user_tokens`. Rimossa insieme a STORY-E7-2.

---

## STORY-E7-7 — ADR-007 + documentazione adapter

- **Stato**: ✅ Done
- **Tipo**: Documentazione
- **Dipende da**: STORY-E7-1 … STORY-E7-6

**Obiettivo**: l'architettura plug-in è documentata in un ADR; uno sviluppatore può aggiungere un nuovo adapter seguendo la guida senza leggere il codice esistente.

**Criteri di accettazione**:
- `docs/adr/ADR-007-adapter-plugin-architecture.md`: decisione sull'interfaccia ABC + registry, motivazione (estendibilità senza modificare il core), pattern di gestione errori (`AdapterAuthError` / `AdapterConnectionError` / `AdapterError`), scelta JSON-RPC xmlrpc.client per Odoo (zero dipendenze esterne), strategia stub E2E (guard `E2E_TEST_MODE`, sovrascrittura registry).
- `docs/guides/aggiungere-un-adapter.md`: guida step-by-step (creare `adapters/new_service.py`, implementare i 4 metodi dell'ABC, auto-registrazione nel registry, scrivere unit tests con mock, estendere lo stub E2E con i marcatori).
- `docs/specs/001-functional-spec.md` §"Backend supportati": aggiornamento con nota sull'architettura plug-in e rimando ad ADR-007.
- `docs/backlog/README.md`: riga E7 aggiornata a 7 storie Done (al completamento dell'epica).
