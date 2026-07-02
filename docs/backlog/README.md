# Backlog Timesheet Hub

> Aggiornato: 2026-07-02 — E1/E2/E3/E4/E5/E6/E7/E8a completate; E9a **ri-dettagliata**: 8 storie Todo in [`e9a-stories.md`](e9a-stories.md). **Riconciliazione**: E8a è stata chiusa senza persistere i log (`POST /imports` effimero, nessuna tabella `imports`); E9a **assorbe la persistenza** (possiede `imports`/`import_rows` + migrazione + scrittura alla submit) e non è più solo-lettura. **Riprioritizzazione employee-first** (roadmap v0.5): rilascio in ordine 🏁 Employee MVP → 🏁 Admin → 🏁 HR. Wizard e log spezzati in E8a/E9a (employee) ed E8b/E9b (HR); nuova epica E3bis (gestione ruoli). **Nuovo requisito**: assegnazione **multi-connettore per riga** + suggerimenti da storico (spec [`007`](../specs/007-multi-connector-row-mapping.md)) — predisposto in E6 (modello dati), dettagliato in E8a; pannello per-utente delle mappature → nuova epica post-MVP **E12**.

Il backlog è effimero: le storie completate vengono rimosse dopo il merge su `main` e l'aggiornamento della documentazione permanente (ADR, spec, guide). I dati persistenti vivono in ADR/spec/test/codice, non qui.

Riferimenti: `docs/timesheet-hub-roadmap.md` · `docs/adr/ADR-001` · `docs/adr/ADR-002` · `docs/adr/ADR-003` · `docs/adr/ADR-004` · `docs/adr/ADR-005` · `docs/specs/002-tech-spec-auth-google.md` · `docs/specs/004-e2e-test-plan.md`

## Avanzamento per epica

Ordine di rilascio **employee-first** (vedi `docs/timesheet-hub-roadmap.md` v0.5): E4 → E5 → E6 → E7 → **E8a** → **E9a** [🏁 Employee MVP] → **E3bis** → E10 [🏁 Admin] → **E8b** → **E9b** [🏁 HR] → E11.

| Epica | Done | In Progress | Todo | Blocked | Totale | Note |
|---|---|---|---|---|---|---|
| E1 | 10 | 0 | 0 | 0 | 10 ✅ | |
| E2 | 6 | 0 | 0 | 0 | 6 ✅ | |
| E3 | 7 | 0 | 0 | 0 | 7 ✅ | |
| E4 | 7 | 0 | 0 | 0 | 7 ✅ | shell — completata |
| E5 | 6 | 0 | 0 | 0 | 6 ✅ | profilo/token — completata |
| E6 | 6 | 0 | 0 | 0 | 6 ✅ | parsing Excel — completata |
| E7 | 7 | 0 | 0 | 0 | 7 ✅ | architettura plug-in + adapter Odoo — completata |
| E8a | 6 | 0 | 0 | 0 | 6 ✅ | wizard employee — completata |
| E9a | 0 | 0 | 8 | 0 | 8 | log employee (persistenza + read) — storie in [`e9a-stories.md`](e9a-stories.md) |
| E3bis | 0 | 0 | TBD | 0 | TBD | gestione ruoli — storie just-in-time |
| E10 | 0 | 0 | TBD | 0 | TBD | pannello Admin — storie just-in-time |
| E8b | 0 | 0 | TBD | 0 | TBD | wizard HR — storie just-in-time |
| E9b | 0 | 0 | TBD | 0 | TBD | log HR — storie just-in-time |
| E11 | 0 | 0 | TBD | 0 | TBD | adapter aggiuntivi — post-v1 |
| E12 | 0 | 0 | TBD | 0 | TBD | pannello per-utente mappature riga↔connettore — post-v1 |

## E1 — Completata

Tutte le 10 storie di E1 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-001: ADR-002 aggiornato, `.gitignore` root
- STORY-002: `backend/` scaffold FastAPI + uv
- STORY-003: `frontend/` scaffold Vite + React + TS
- STORY-004: `nginx/` reverse proxy single-origin
- STORY-005: `docker-compose.yml`, `.env.example`, `Makefile`, `README.md`
- STORY-006: `railway.json` per servizio (Docker builder + pre-deploy migrate)
- STORY-007: ruff, eslint flat, prettier, pre-commit
- STORY-008: `e2e/` skeleton Playwright (config, fixtures E2E__, stub adapter, guardia E2E_TEST_MODE)
- STORY-009: `.github/workflows/` CI (backend/frontend/e2e smoke gate su main)
- STORY-010: `docs/guides/` skeleton (railway-deployment + local-development)

## E2 — Completata

Tutte le 6 storie di E2 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-011: `backend/app/db/mixins.py` (TimestampMixin), `backend/tests/unit/test_timestamp_mixin.py`
- STORY-012: `backend/alembic/versions/0001_init_baseline.py`, `docs/guides/local-development.md` §7 workflow Alembic
- STORY-013: `backend/app/core/rbac.py` (`CurrentUser`, `require_role`), router aggiornati
- STORY-014: `backend/tests/integration/test_rbac_integration.py`, `backend/tests/unit/test_rbac.py`
- STORY-015: `e2e/tests/rbac.spec.ts`
- STORY-016: `docs/adr/ADR-004-orm-conventions.md`, `docs/specs/005-tech-spec-rbac.md`

## E3 — Completata

Tutte le 7 storie di E3 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-017: `backend/app/models/user.py`, `backend/alembic/versions/0002_create_users.py`
- STORY-018: `backend/app/core/security.py` (`create_jwt`/`decode_jwt`), `backend/app/core/rbac.py`
- STORY-019: `backend/app/routers/auth.py`, `backend/app/routers/users.py` (`GET /api/me`)
- STORY-020: `backend/app/routers/e2e_test_router.py`, `e2e/tests/auth.spec.ts`, `e2e/fixtures/storageState/`
- STORY-021: `backend/tests/unit/test_security.py`, `backend/tests/unit/test_user_model.py`, `backend/tests/integration/test_auth.py`
- STORY-022: `frontend/src/lib/apiClient.ts`, `frontend/src/hooks/useAuth.ts`, `frontend/src/components/AuthGuard.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/CallbackPage.tsx`
- STORY-023: `docs/specs/002-tech-spec-auth-google.md`, `docs/guides/accesso-e-login.md`

## E4 — Completata

Tutte le 7 storie di E4 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-024: `docs/specs/004-design-tokens.md` (palette, tipografia, spaziatura MUI v7)
- STORY-025: `frontend/src/theme/index.ts` (`createTheme`, `ThemeProvider`)
- STORY-026: `frontend/src/components/shell/AppShell.tsx` (Header, SideNav, routing per-ruolo)
- STORY-027: `frontend/src/pages/LoginPage.tsx` (MUI + AuthGuard)
- STORY-028: `frontend/src/components/ui/` (PageHeader, StatusBadge, LoadingOverlay, ConfirmDialog)
- STORY-029: `e2e/tests/shell.spec.ts` (navigazione shell e flusso login/logout)
- STORY-030: `docs/guides/navigazione-e-interfaccia.md`

## E5 — Completata

Tutte le 6 storie di E5 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-E5-1: `backend/app/core/security.py` (`encrypt_secret`/`decrypt_secret`), `backend/tests/unit/test_security.py`
- STORY-E5-2: `backend/app/models/user_token.py`, `backend/alembic/versions/0003_create_user_tokens.py`
- STORY-E5-3: `backend/app/routers/connectors.py` (`GET|PUT|DELETE /api/me/connectors`), `backend/tests/integration/test_connectors.py`
- STORY-E5-4: `frontend/src/pages/ProfilePage.tsx`, `frontend/src/hooks/useConnectors.ts`, `frontend/src/components/connectors/`
- STORY-E5-5: `backend/alembic/versions/0004_add_needs_reauth_to_user_tokens.py`, `needs_reauth` su modello e router, badge "Da aggiornare" in `ConnectorRow.tsx`
- STORY-E5-6: `docs/adr/ADR-001-timesheet-hub.md` §H aggiornata, `docs/specs/001-functional-spec.md` §connettori aggiornata, `docs/guides/configurare-i-connettori.md`

## E6 — Completata

Tutte le 6 storie di E6 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-E6-1: `docs/specs/003-timesheet-hub-ux-brief.md` §Step 1 e §Step 2 aggiornati (stati visivi FileUpload, layout PreviewTable, lista WarningType)
- STORY-E6-2: `frontend/src/lib/timesheet/types.ts` (`TimesheetEntry`, `ConnectorAssignment`, `ColumnMapping`, `DEFAULT_COLUMN_MAPPING`, `RowWarning`, `WarningType`), `frontend/src/lib/timesheet/normalizer.test.ts`
- STORY-E6-3: `frontend/src/components/FileUpload/FileUpload.tsx`, parsing SheetJS + validazione formato/dimensione
- STORY-E6-4: `frontend/src/components/PreviewTable/PreviewTable.tsx`, evidenziazione righe anomale, badge riepilogativo, colonna connettori placeholder
- STORY-E6-5: `e2e/fixtures/` (wrong-format.xlsx, anomalie.xlsx), `e2e/tests/excel-upload.spec.ts` (scenari #6/#7/#8)
- STORY-E6-6: `docs/specs/006-excel-parsing.md`, `docs/guides/excel-upload.md`, `docs/specs/001-functional-spec.md` §Parsing Excel aggiornata

## E7 — Completata

Tutte le 7 storie di E7 sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-E7-1: `backend/app/adapters/base.py` (interfaccia ABC `TimesheetAdapter`, tipi condivisi `Project`/`Task`/`AdapterConfig`/`ImportResult`/`ValidationResult`), `backend/app/adapters/registry.py` (`AdapterRegistry`), `backend/app/adapters/__init__.py`, `backend/tests/unit/test_adapter_registry.py`
- STORY-E7-2: rimossa — `backend_configs` eliminata (i connettori sono esclusivamente per-utente via `user_tokens`)
- STORY-E7-3: `backend/app/adapters/odoo.py` (`OdooAdapter.validate` + `submit`, eccezioni `AdapterAuthError`/`AdapterConnectionError`/`AdapterError`), `backend/tests/unit/test_odoo_adapter.py`
- STORY-E7-4: `backend/app/adapters/odoo.py` (esteso con `get_projects` + `get_tasks` via `search_read` JSON-RPC)
- STORY-E7-5: `backend/app/adapters/stub.py` (`StubAdapter` con marcatori `E2E__OK`/`E2E__FAIL`/`E2E__EXPIRED`/`E2E__DOWN` per tutti i metodi), `backend/tests/unit/test_stub_adapter.py`
- STORY-E7-6: rimossa — seed config Odoo non necessario (architettura per-utente)
- STORY-E7-7: `docs/adr/ADR-007-adapter-plugin-architecture.md`, `docs/guides/aggiungere-un-adapter.md`, `docs/specs/001-functional-spec.md` §"Backend supportati" aggiornata

## E8a — Completata

Tutte le 6 storie di E8a sono Done e rimosse dal backlog.

Storia → documentazione permanente:
- STORY-E8a-1: `backend/app/models/connector_row_mapping.py`, `backend/alembic/versions/0005_create_connector_row_mappings.py`, `backend/tests/unit/test_connector_row_mapping_model.py`
- STORY-E8a-2: `backend/app/routers/adapters.py` (`GET /api/adapters/{label}/projects` + `.../tasks`), `backend/tests/integration/test_adapter_autocomplete.py`
- STORY-E8a-3: `backend/app/routers/mappings.py` (`POST /api/me/mapping-suggestions` + upsert alla submit), `backend/tests/integration/test_mapping_suggestions.py`
- STORY-E8a-4: `frontend/src/components/AssignModal/` (modal multi-connettore + autocomplete MUI), `frontend/src/hooks/useAdapterAutocomplete.ts`
- STORY-E8a-5: `frontend/src/pages/ImportPage.tsx` (integrazione suggerimenti), `frontend/src/hooks/useMappingSuggestions.ts`, chip "Suggerito" in `PreviewTable.tsx`
- STORY-E8a-6: `e2e/tests/import-suggestions.spec.ts`

> **Nota di riconciliazione**: E8a è stata chiusa **senza persistere i log di importazione** — `POST /api/me/imports` (`backend/app/routers/imports.py`) esegue il submit sugli adapter e restituisce i risultati solo nella response HTTP (nessuna tabella `imports`/`import_rows`, nessun endpoint `GET`). La roadmap v0.5 assegnava `imports` a E8a; la persistenza mancante è **assorbita da E9a** (vedi sotto).

## E9a — In corso (storie Todo)

8 storie dettagliate in [`e9a-stories.md`](e9a-stories.md), tutte ⬜ Todo. Dipende da E8a (✅). **Scope aggiornato**: E9a non è più solo-lettura — possiede i modelli `imports`/`import_rows`, la migrazione e la scrittura del log dentro `POST /imports`, oltre a lista, dettaglio, UI ed E2E.

| ID | Titolo | Tipo | Stato |
|---|---|---|---|
| STORY-E9a-1 | Modelli `imports` + `import_rows` + migrazione Alembic | Backend | ⬜ Todo |
| STORY-E9a-2 | Persistenza del log alla submit + `import_id` nella response | Backend | ⬜ Todo |
| STORY-E9a-3 | Endpoint lista + dettaglio log propri (`GET /api/me/imports` + `/{id}`) | Backend | ⬜ Todo |
| STORY-E9a-4 | Tipi TypeScript + hook dati (TanStack Query) | Frontend | ⬜ Todo |
| STORY-E9a-5 | LogPage: lista + filtri | Frontend | ⬜ Todo |
| STORY-E9a-6 | Dettaglio importazione + aggancio bottone "Log dettagliato" | Frontend | ⬜ Todo |
| STORY-E9a-7 | E2E: log consultabile + RBAC "solo i propri log" | E2E | ⬜ Todo |
| STORY-E9a-8 | Documentazione (Definition of Done) | Docs | ⬜ Todo |

## Prossima epica da implementare
**E9a** (log importazioni Employee) — E8a completata. Dipende da E8a (✅), nessun blocco. Include la persistenza del log non realizzata in E8a.

## Roadmap epiche successive (storie da scrivere just-in-time)
Le epiche E3bis, E10, E8b, E9b non hanno ancora file storie: si dettagliano al momento dell'inserimento in sprint, nell'ordine di rilascio sopra.

- **Numerazione storie**: gli `STORY-NNN` sono globali e progressivi. E4 termina a **STORY-030**; E5/E6/E7 hanno ID provvisori (`STORY-E5-N`/`STORY-E6-N`/`STORY-E7-N`) da fissare in sequenza al commit in sprint. Le epiche successive riprendono da lì.
- **Fase Employee** (🏁 MVP): E8a (wizard self-import + assegnazione multi-connettore per riga con suggerimenti) · **E8b** (connettore Jira, anticipato da E11) · E9a (log propri).
- **Fase Admin** (🏁): E3bis (gestione ruoli, backend identità) · E10 (pannello Admin UI: utenti/ruoli, CRUD backend, mapping Excel).
- **Fase HR** (🏁): E8b (Step 0 selezione dipendente + `POST /imports?for=`) · E9b (vista di tutti i log + filtri avanzati).
- **Post-v1**: E11 (adapter Jira/Linear/Asana) · E12 (pannello per-utente per modificare le mappature riga↔connettore preimpostate).

## Note sullo scope E1
- L'E2E "verde" in E1 è uno **smoke infrastrutturale** (build & boot). Lo scenario #1 Auth/Smoke (P0) richiede JWT reali — dipende da E3.
- La guardia `E2E_TEST_MODE` (ADR-003-B) è implementata fail-closed in `backend/app/core/config.py` (model_validator, valutato a import-time). Review security-reviewer: PASS.
