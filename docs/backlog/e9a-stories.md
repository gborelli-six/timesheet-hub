# E9a — Log delle importazioni (Employee): dettaglio storie

> Epica **read-side**: l'Employee consulta i **propri** log di importazione (lista con filtri) e apre il **dettaglio per riga** con i messaggi d'errore delle righe fallite. Dipende da E8a (che esegue le importazioni e possiede la tabella `imports`). Vista di **tutti** i log, filtro per dipendente e filtri avanzati sono fuori scope: appartengono a **E9b**.
>
> **Nota sugli ID**: gli ID `STORY-E9a-N` sono provvisori; assegnare i numeri definitivi (globali, progressivi) all'inserimento in sprint.
>
> **Scope**: E9a NON crea tabelle né migrazioni. Sono coperti solo endpoint di lettura (`GET`), UI e E2E, sul contratto schema fornito da E8a (vedi prerequisito sotto).

---

## Prerequisito — contratto schema fornito da E8a (assunto, non creato qui)

La **creazione** di queste tabelle e delle relative migrazioni Alembic appartiene a **E8a** (storie del wizard, dettagliate just-in-time). E9a assume il contratto seguente e lo legge in sola lettura. Se lo schema effettivo di E8a diverge, allineare le storie E9a-1/E9a-2 al momento dell'implementazione.

**`imports`** (header di un'importazione):

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID | PK |
| `employee_id` | UUID FK → `users.id` | dipendente di riferimento del timesheet |
| `operator_id` | UUID FK → `users.id` nullable | NULL se self-import; valorizzato da E8b/HR (import per conto terzi) |
| `status` | enum `success` \| `partial` \| `failed` | esito complessivo |
| `period_start` / `period_end` | date | periodo del timesheet |
| `total_rows` / `success_rows` / `failed_rows` | int | conteggi |
| `created_at` / `updated_at` | timestamp | `TimestampMixin` |

**`import_rows`** (dettaglio per riga importata):

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID | PK |
| `import_id` | UUID FK → `imports.id` | `ondelete=CASCADE` |
| `connector_label` | String | connettore usato (ref logico a `user_tokens.label`) |
| `service` | enum `odoo` \| `jira` \| `linear` \| `asana` | backend |
| `excel_project` / `excel_task` | String | dati originali dell'Excel |
| `remote_project_id` / `remote_project_name` | String | progetto sul sistema remoto |
| `remote_task_id` / `remote_task_name` | String | task sul sistema remoto |
| `hours` | float | ore rendicontate |
| `status` | enum `success` \| `failed` | esito della singola riga |
| `error_message` | String nullable | valorizzato per le righe fallite |
| `created_at` / `updated_at` | timestamp | `TimestampMixin` |

Il "backend coinvolto" usato dai filtri di lista è derivabile dai `service`/`connector_label` delle `import_rows` (oppure denormalizzato su `imports`, a scelta di E8a; E9a lo consuma come read-only). Vincoli e naming secondo [`ADR-004`](../adr/ADR-004-orm-conventions.md).

---

## STORY-E9a-1 — Endpoint lista log propri (`GET /api/me/imports`)

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: E8a (tabelle `imports`/`import_rows`)

**Obiettivo**: l'Employee ottiene l'elenco delle **proprie** importazioni, filtrabile per periodo, backend ed esito, per popolare la lista dei log.

**Criteri di accettazione**:
- `backend/app/routers/imports.py` (nuovo, registrato in `app/main.py`): `GET /api/me/imports` → `200 [ImportLogSummary]` con `require_role([UserRole.employee, UserRole.hr, UserRole.admin])`; il risultato è **sempre** filtrato su `employee_id == current_user.id` (un Employee non vede mai log altrui — la vista di tutti i log è E9b).
- Filtri query opzionali: `period_from`/`period_to` (su `period_start`/`period_end`), `service` (backend), `status` (`success|partial|failed`); ordinamento `created_at` discendente.
- Schema Pydantic `ImportLogSummary`: `id`, `period_start`, `period_end`, `status`, `total_rows`, `success_rows`, `failed_rows`, `services` (lista backend coinvolti), `created_at`.
- Nessuna paginazione aggressiva (dataset modesto, UX brief §3.4); eventuale `limit` di sicurezza documentato.
- Aggiornare la tabella permessi in `docs/specs/005-tech-spec-rbac.md` con la nuova rotta.
- `backend/tests/integration/test_imports_list.py`: lista dei propri import (ordinata desc); ciascun filtro (periodo/backend/esito); log di **altro** utente non compare; lista vuota → `200 []`.

---

## STORY-E9a-2 — Endpoint dettaglio log proprio (`GET /api/me/imports/{import_id}`)

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-E9a-1

**Obiettivo**: l'Employee apre il dettaglio di una propria importazione con tutte le righe e i messaggi d'errore delle righe fallite.

**Criteri di accettazione**:
- `GET /api/me/imports/{import_id}` → `200 ImportLogDetail`: header (campi di `ImportLogSummary`) + `rows: ImportRow[]` letti da `import_rows`, con `error_message` valorizzato sulle righe `failed`.
- Schema Pydantic `ImportRow`: `connector_label`, `service`, `excel_project`, `excel_task`, `remote_project_name`, `remote_task_name`, `hours`, `status`, `error_message`.
- `404` se l'import non esiste **oppure** se `employee_id != current_user.id` — stessa risposta nei due casi, nessun leakage cross-utente (mai `403` che riveli l'esistenza).
- `backend/tests/integration/test_imports_detail.py`: dettaglio con righe miste success/failed (messaggi errore presenti solo sulle failed); `404` per `import_id` inesistente; `404` per import di **altro** utente.

---

## STORY-E9a-3 — Tipi TypeScript + hook dati (TanStack Query)

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E9a-1, STORY-E9a-2

**Obiettivo**: il frontend dispone dei tipi e degli hook per leggere lista e dettaglio dei log, con gestione di loading/errore.

**Criteri di accettazione**:
- Tipi in `frontend/src/lib/timesheet/types.ts` (o nuovo modulo `log/types.ts`): `ImportLogSummary`, `ImportLogDetail`, `ImportRow`, enum stato (`success|partial|failed`, `success|failed`), tipo filtri (`period_from`, `period_to`, `service`, `status`).
- `frontend/src/hooks/useImports.ts`: `useImports(filters)` (lista) e `useImportDetail(id)` (dettaglio) via `apiClient` e TanStack Query, sul pattern di `frontend/src/hooks/useConnectors.ts`; query key che include i filtri; stati `isLoading`/`isError` esposti.
- Test unit (Testing Library + mock `apiClient`/MSW): fetch ok popola i dati; risposta di errore → stato error; cambio filtri → nuova query key.

---

## STORY-E9a-4 — LogPage: lista + filtri

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E9a-3

**Obiettivo**: la pagina `/log` (oggi stub) mostra la tabella dei propri log con i filtri periodo/backend/esito.

**Criteri di accettazione**:
- Implementa `frontend/src/pages/LogPage.tsx` (attualmente solo header): tabella con colonne **data**, **backend**, **righe ok/fail**, **esito** (riuso `StatusBadge` da `frontend/src/components/ui/`), coerente con UX brief §3.4.
- Controlli di filtro: periodo (`period_from`/`period_to`), backend (`service`), esito (`status`), collegati a `useImports`.
- Stati gestiti: loading (skeleton/overlay), vuoto ("nessuna importazione"), errore; `data-testid` su tabella, righe e controlli filtro (mai selettori CSS/testo).
- Click su una riga naviga al dettaglio (rotta di STORY-E9a-5).
- Test unit (Testing Library): rendering lista da hook mockato; interazione filtro aggiorna i parametri; stato vuoto ed errore.

---

## STORY-E9a-5 — Dettaglio importazione + aggancio dal wizard

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E9a-3, STORY-E9a-4

**Obiettivo**: dalla lista (e dal risultato del wizard) l'Employee apre il dettaglio di un'importazione e vede gli errori per riga.

**Criteri di accettazione**:
- Vista dettaglio su rotta `/log/:id` (registrata in `frontend/src/App.tsx`) che usa `useImportDetail`: sezione metadati (periodo, esito, conteggi) + tabella `import_rows` con progetto/task (Excel e remoto), ore, stato e **messaggio d'errore** per le righe fallite.
- Predispone il "Link al log dettagliato dell'importazione appena eseguita" citato in UX brief Step 4: rotta e componente pronti per l'aggancio da E8a (senza duplicare né implementare il wizard).
- Stati loading/errore/`404` (import non proprio → messaggio "non trovato"); `data-testid` su contenitore dettaglio e righe.
- Test unit: rendering dettaglio con righe miste → messaggi d'errore visibili solo sulle righe fallite; navigazione da lista a dettaglio.

---

## STORY-E9a-6 — E2E: log consultabile + RBAC "solo i propri log"

- **Stato**: ⬜ Todo
- **Tipo**: E2E
- **Dipende da**: STORY-E9a-4, STORY-E9a-5, E8a (submit importazione)

**Obiettivo**: gli scenari end-to-end del log Employee sono verdi in CI.

**Criteri di accettazione**:
- **Scenario #13** ([`004-e2e-test-plan.md`](../specs/004-e2e-test-plan.md)): un'importazione con una riga `E2E__FAIL` genera un log **immediatamente consultabile**; il dettaglio mostra il messaggio d'errore della riga fallita.
- **Scenario #15**: con `storageState` Employee, la lista dei log mostra **solo** i propri log (un log seedato per un altro utente non compare).
- Fixture/seed deterministici (marcatori `E2E__`); selettori `data-testid`; nessuna dipendenza da ordine di esecuzione.
- Verde in `npx playwright test` (smoke incluso nel gate di merge su `main`).

---

## STORY-E9a-7 — Documentazione (Definition of Done)

- **Stato**: ⬜ Todo
- **Tipo**: Documentazione
- **Dipende da**: STORY-E9a-4, STORY-E9a-5

**Obiettivo**: la documentazione funzionale e utente riflette la vista log dell'Employee.

**Criteri di accettazione**:
- Guida utente `docs/guides/log-importazioni.md` (ruolo Employee): come consultare lo storico, leggere gli esiti e il dettaglio errori.
- Aggiornare `docs/specs/001-functional-spec.md` (§log) e `docs/specs/003-timesheet-hub-ux-brief.md` §3.4 se emergono scostamenti dall'implementazione.
- Confermare/aggiornare la tabella permessi in `docs/specs/005-tech-spec-rbac.md` con le rotte `GET /api/me/imports` e `GET /api/me/imports/{id}`.
