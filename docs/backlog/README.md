# Backlog Timesheet Hub

> Aggiornato: 2026-06-29 — E1/E2/E3/E4 completate; E5/E6 dettagliate. **Riprioritizzazione employee-first** (roadmap v0.5): rilascio in ordine 🏁 Employee MVP → 🏁 Admin → 🏁 HR. Wizard e log spezzati in E8a/E9a (employee) ed E8b/E9b (HR); nuova epica E3bis (gestione ruoli); seed config Odoo in E7.

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
| E5 | 0 | 0 | 6 | 0 | 6 | profilo/token — dettagliata |
| E6 | 0 | 0 | 6 | 0 | 6 | parsing Excel — dettagliata |
| E7 | 0 | 0 | TBD | 0 | TBD | adapter Odoo + seed config — storie just-in-time |
| E8a | 0 | 0 | TBD | 0 | TBD | wizard employee — storie just-in-time |
| E9a | 0 | 0 | TBD | 0 | TBD | log employee — storie just-in-time |
| E3bis | 0 | 0 | TBD | 0 | TBD | gestione ruoli — storie just-in-time |
| E10 | 0 | 0 | TBD | 0 | TBD | pannello Admin — storie just-in-time |
| E8b | 0 | 0 | TBD | 0 | TBD | wizard HR — storie just-in-time |
| E9b | 0 | 0 | TBD | 0 | TBD | log HR — storie just-in-time |
| E11 | 0 | 0 | TBD | 0 | TBD | adapter aggiuntivi — post-v1 |

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

## E5 — Profilo & token utente

Gestione sicura delle credenziali dei connettori per-utente (identificativo in chiaro + segreto cifrato write-only). Decisioni in [`ADR-005`](../adr/ADR-005-connector-credentials-security.md). Prerequisito dell'import (E8a); dipende da E3 (identità utente) ed E4 (shell UI).

Dettaglio storie: [`e5-stories.md`](e5-stories.md) — ID `STORY-E5-N` provvisori, da rinumerare in sequenza globale all'inserimento in sprint.

| Storia | Titolo | Tipo | Dipende da | Stato |
|---|---|---|---|---|
| STORY-E5-1 | Modulo cifratura segreti (`encrypt_secret`/`decrypt_secret`) | Backend | — | ⬜ Todo |
| STORY-E5-2 | Modello `UserToken` + migrazione Alembic | Backend | STORY-E5-1, STORY-012 | ⬜ Todo |
| STORY-E5-3 | API connettori write-only (GET/PUT/DELETE) | Backend | STORY-E5-2 | ⬜ Todo |
| STORY-E5-4 | UI profilo connettori | Frontend | STORY-E5-3 | ⬜ Todo |
| STORY-E5-5 | Stato "token da aggiornare" su errore auth | Backend + Frontend | STORY-E5-3 | ⬜ Todo |
| STORY-E5-6 | Documentazione E5 | Docs | STORY-E5-1…5 | ⬜ Todo |

## E6 — Parsing Excel & Normalizer

Parsing client-side SheetJS, normalizzazione in `TimesheetEntry[]` con `ColumnMapping` configurabile (default hardcoded per v1; pannello di config in E10), preview con warning non bloccanti per righe anomale. Tutta la logica è frontend — nessuna tabella DB, nessun upload al server durante il parsing. Sblocca E8a (wizard orchestrazione end-to-end); dipende da E4 (componenti MUI) ed E3 (identità utente per i test E2E).

Dettaglio storie: [`e6-stories.md`](e6-stories.md).

| Storia | Titolo | Tipo | Dipende da | Stato |
|---|---|---|---|---|
| STORY-E6-1 | Design UX: step Upload & step Preview | UX/UI | E4 (STORY-030) | ⬜ Todo |
| STORY-E6-2 | Tipo `TimesheetEntry` e Normalizer | Frontend | STORY-E6-1 | ⬜ Todo |
| STORY-E6-3 | Componente `FileUpload` + parsing SheetJS | Frontend | STORY-E6-1 | ⬜ Todo |
| STORY-E6-4 | Componente `PreviewTable` con warning righe anomale | Frontend | STORY-E6-2, STORY-E6-3 | ⬜ Todo |
| STORY-E6-5 | Fixture Excel E2E + scenari E2E #6/#7/#8 | E2E | STORY-E6-3, STORY-E6-4 | ⬜ Todo |
| STORY-E6-6 | Documentazione E6 | Docs | STORY-E6-1…5 | ⬜ Todo |

## Prossima epica da implementare
**E5** (profilo & token utente) — E4 completata. Dipende da E3 (✅) ed E4 (✅), nessun blocco.

## Roadmap epiche successive (storie da scrivere just-in-time)
Le epiche E7, E8a, E9a, E3bis, E10, E8b, E9b non hanno ancora file storie: si dettagliano al momento dell'inserimento in sprint, nell'ordine di rilascio sopra.

- **Numerazione storie**: gli `STORY-NNN` sono globali e progressivi. E4 termina a **STORY-030**; E5/E6 hanno ID provvisori (`STORY-E5-N`/`STORY-E6-N`) da fissare in sequenza al commit in sprint. Le epiche successive riprendono da lì.
- **Fase Employee** (🏁 MVP): E7 (adapter Odoo + seed config Odoo) · E8a (wizard self-import) · E9a (log propri).
- **Fase Admin** (🏁): E3bis (gestione ruoli, backend identità) · E10 (pannello Admin UI: utenti/ruoli, CRUD backend, mapping Excel).
- **Fase HR** (🏁): E8b (Step 0 selezione dipendente + `POST /imports?for=`) · E9b (vista di tutti i log + filtri avanzati).
- **Post-v1**: E11 (adapter Jira/Linear/Asana).

## Note sullo scope E1
- L'E2E "verde" in E1 è uno **smoke infrastrutturale** (build & boot). Lo scenario #1 Auth/Smoke (P0) richiede JWT reali — dipende da E3.
- La guardia `E2E_TEST_MODE` (ADR-003-B) è implementata fail-closed in `backend/app/core/config.py` (model_validator, valutato a import-time). Review security-reviewer: PASS.
