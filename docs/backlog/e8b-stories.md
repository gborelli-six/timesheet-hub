# E8b — Connettore Jira (anticipato da E11)

> Epica creata 2026-07-02. Anticipa lo sviluppo del connettore Jira originariamente pianificato in E11. Inserita dopo E8a e prima di E9a nel percorso Employee MVP.
>
> **Dipende da**: E7 ✅ (architettura plug-in adapter, `ServiceType.jira` già nell'enum)
>
> **Blocca**: nulla (E9a può partire subito dopo)

## Storie

### STORY-E8b-1 — Implementazione `JiraAdapter` ✅ Done

**Stato**: Done

**Descrizione**: Implementare `JiraAdapter` in `backend/app/adapters/jira.py` seguendo l'interfaccia ABC `TimesheetAdapter`. Quattro metodi:

| Metodo | API Jira REST v3 |
|---|---|
| `validate` | `GET /rest/api/3/myself` |
| `get_projects` | `GET /rest/api/3/project/search?query={q}&maxResults={limit}` |
| `get_tasks` | `GET /rest/api/3/search?jql=project="{key}"...` |
| `submit` | `POST /rest/api/3/issue/{issueKey}/worklog` |

**Credenziali Jira** (da `AdapterConfig`):
- `config.base_url` → URL istanza Atlassian (es. `https://azienda.atlassian.net`)
- `config.params["user"]` → email account Atlassian (da `user_token.account_identifier`)
- `config.params["password"]` → API Token (da `user_token.secret_enc` decifrato)

**Auth**: Basic Auth = `base64(email:api_token)` nell'header `Authorization`.

**HTTP client**: `urllib.request` (stdlib, zero dipendenze aggiuntive).

**Gestione errori**:
- HTTP 401/403 → `AdapterAuthError` (propagato — router imposta `needs_reauth`)
- HTTP 5xx / OSError → `AdapterConnectionError` (propagato — router risponde 502)
- HTTP 4xx altri (es. 404 issue non trovata) → `AdapterError` → catturato come `RowError`

**Note implementative**:
- `get_projects`: usa `key` Jira come ID progetto (es. `"MYPROJ"`), non l'ID numerico interno
- `get_tasks`: usa `issue.key` come ID task (es. `"MYPROJ-1"`)
- `submit`: converte ore in secondi (`int(hours * 3600)`); note tradotte in ADF (Atlassian Document Format)
- `ServiceType.jira` già presente in `base.py` e nella migrazione `0003` — nessuna migrazione aggiuntiva necessaria

**File**: `backend/app/adapters/jira.py` (nuovo), `backend/app/adapters/__init__.py` (aggiunto import)

**Criterio di accettazione**: `adapter_registry.get(ServiceType.jira)` → `JiraAdapter`

---

### STORY-E8b-2 — Unit test `JiraAdapter` ✅ Done

**Stato**: Done

**Descrizione**: 18 unit test in `backend/tests/unit/test_jira_adapter.py`.

| # | Scenario |
|---|---|
| 1 | `validate` OK → `ValidationResult(ok=True)` |
| 2 | `validate` 401 → `ValidationResult(ok=False)` |
| 3 | `validate` OSError → `ValidationResult(ok=False)` |
| 4 | `get_projects` senza query → lista completa |
| 5 | `get_projects` con query → parametro incluso nell'URL |
| 6 | `get_projects` 401 → `AdapterAuthError` |
| 7 | `get_projects` OSError → `AdapterConnectionError` |
| 8 | `get_projects` limit 500 → cap a 200 |
| 9 | `get_tasks` senza query → lista issues |
| 10 | `get_tasks` con query → JQL aggiornato |
| 11 | `get_tasks` progetto senza issue → `[]` |
| 12 | `get_tasks` 403 → `AdapterAuthError` |
| 13 | `submit` 2 righe → `success_count=2`, POST chiamato 2 volte |
| 14 | `submit` task_id vuoto → `RowError`, urlopen non chiamato |
| 15 | `submit` note → body contiene ADF comment |
| 16 | `submit` 401 → `AdapterAuthError` propagato |
| 17 | `submit` 1.5h → `timeSpentSeconds=5400` |
| 18 | `JiraAdapter` registrato nel registry globale |

**File**: `backend/tests/unit/test_jira_adapter.py` (nuovo)

---

### STORY-E8b-3 — Estendi `StubAdapter` con dati Jira ✅ Done

**Stato**: Done

**Descrizione**: Aggiornare `backend/app/adapters/stub.py` per supportare `ServiceType.jira`:

- Aggiunta liste dati fissi `_PROJECTS_JIRA` e `_TASKS_JIRA` con ID in formato Jira (`PROJ-A`, `PROJ-A-1`, ecc.)
- `get_projects` e `get_tasks` differenziano tra odoo e jira tramite `config.service`
- `_maybe_register()` registra `StubAdapter` anche per `ServiceType.jira` quando `E2E_TEST_MODE=true`

**File**: `backend/app/adapters/stub.py` (modificato)

---

### STORY-E8b-4 — E2E smoke: wizard con connettore Jira stub

**Stato**: Done

**Descrizione**: Aggiungere scenario E2E in `e2e/tests/` che verifica il flusso wizard con un connettore Jira configurato come `E2E__OK`. Il seed deterministico deve creare un `user_token` di tipo `jira` per l'utente employee.

**Criterio di accettazione**:
- Wizard → Step Assegna connettori → autocomplete mostra `Jira Project Alpha` / `Jira Project Beta`
- Submit → risposta `success_count > 0`

**Agente**: e2e-playwright

---

### STORY-E8b-5 — Documentazione ADR-007 + guida adapter

**Stato**: Done

**Descrizione**: Aggiornare `docs/adr/ADR-007-adapter-plugin-architecture.md` §Conseguenze per annotare che `JiraAdapter` è implementato. Aggiornare `docs/guides/aggiungere-un-adapter.md` con note specifiche per REST API (a confronto con XML-RPC di Odoo).

**Agente**: docs-writer
