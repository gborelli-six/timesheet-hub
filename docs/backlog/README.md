# Backlog Timesheet Hub

> Aggiornato: 2026-06-28 — E1 completata; E2 completata; E3 completata (tutte 7 storie Done, STORY-023 docs); E4 dettagliata (MUI v7 + Mantis + claude.ai/design); E5 dettagliata (ADR-005); E6 dettagliata (parsing Excel & Normalizer)

Il backlog è effimero: le storie completate vengono rimosse dopo il merge su `main` e l'aggiornamento della documentazione permanente (ADR, spec, guide). I dati persistenti vivono in ADR/spec/test/codice, non qui.

Riferimenti: `docs/timesheet-hub-roadmap.md` · `docs/adr/ADR-001` · `docs/adr/ADR-002` · `docs/adr/ADR-003` · `docs/adr/ADR-004` · `docs/adr/ADR-005` · `docs/specs/002-tech-spec-auth-google.md` · `docs/specs/004-e2e-test-plan.md`

## Avanzamento per epica
| Epica | Done | In Progress | Todo | Blocked | Totale |
|---|---|---|---|---|---|
| E1 | 10 | 0 | 0 | 0 | 10 ✅ |
| E2 | 6 | 0 | 0 | 0 | 6 ✅ |
| E3 | 7 | 0 | 0 | 0 | 7 ✅ |
| E4 | 0 | 0 | 7 | 0 | 7 |
| E5 | 0 | 0 | 6 | 0 | 6 |
| E6 | 0 | 0 | 6 | 0 | 6 |

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

## E4 — Style guide & shell applicativa

Token visivi MUI v7 (palette, tipografia, spaziatura), configurazione `ThemeProvider`, shell Mantis con Header/SideNav/navigazione per-ruolo, LoginPage integrata con `AuthGuard` (E3), libreria componenti base. Sblocca tutte le epiche UI successive (E5–E10). Implementazione assistita da claude.ai/design — stack React 19 + MUI v7 + Mantis, desktop-only per v1.

Dettaglio storie: [`e4-stories.md`](e4-stories.md).

| Storia | Titolo | Tipo | Dipende da | Stato |
|---|---|---|---|---|
| STORY-024 | Design brief & token MUI — palette, tipografia, spaziatura | UX/UI | — | ⬜ Todo |
| STORY-025 | Configurazione tema MUI (`createTheme`, `ThemeProvider`) | Frontend | STORY-024 | ⬜ Todo |
| STORY-026 | Shell Mantis — Header, SideNav, menu e routing | Frontend | STORY-025 | ⬜ Todo |
| STORY-027 | LoginPage con MUI + integrazione AuthGuard | Frontend | STORY-025, STORY-022 | ⬜ Todo |
| STORY-028 | Wrapper componenti base (PageHeader, StatusBadge, LoadingOverlay, ConfirmDialog) | Frontend | STORY-025 | ⬜ Todo |
| STORY-029 | Test E2E — navigazione shell e flusso login/logout | E2E | STORY-026, STORY-027 | ⬜ Todo |
| STORY-030 | Documentazione E4 | Docs | STORY-025…STORY-029 | ⬜ Todo |

## E5 — Profilo & token utente

Gestione sicura delle credenziali dei connettori per-utente (identificativo in chiaro + segreto cifrato write-only). Decisioni in [`ADR-005`](../adr/ADR-005-connector-credentials-security.md). Prerequisito dell'import (E8); dipende da E3 (identità utente) ed E4 (shell UI).

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

Parsing client-side SheetJS, normalizzazione in `TimesheetEntry[]` con `ColumnMapping` configurabile (default hardcoded per v1; pannello di config in E10), preview con warning non bloccanti per righe anomale. Tutta la logica è frontend — nessuna tabella DB, nessun upload al server durante il parsing. Sblocca E8 (wizard orchestrazione end-to-end); dipende da E4 (componenti MUI) ed E3 (identità utente per i test E2E).

Dettaglio storie: [`e6-stories.md`](e6-stories.md).

| Storia | Titolo | Tipo | Dipende da | Stato |
|---|---|---|---|---|
| STORY-E6-1 | Design UX: step Upload & step Preview | UX/UI | E4 (STORY-030) | ⬜ Todo |
| STORY-E6-2 | Tipo `TimesheetEntry` e Normalizer | Frontend | STORY-E6-1 | ⬜ Todo |
| STORY-E6-3 | Componente `FileUpload` + parsing SheetJS | Frontend | STORY-E6-1 | ⬜ Todo |
| STORY-E6-4 | Componente `PreviewTable` con warning righe anomale | Frontend | STORY-E6-2, STORY-E6-3 | ⬜ Todo |
| STORY-E6-5 | Fixture Excel E2E + scenari E2E #6/#7/#8 | E2E | STORY-E6-3, STORY-E6-4 | ⬜ Todo |
| STORY-E6-6 | Documentazione E6 | Docs | STORY-E6-1…5 | ⬜ Todo |

## Prossime epiche
- **E6**: parsing Excel & Normalizer (prerequisito di E8) — da fare prima di E7/E8
- **E7/E8**: import wizard + adapter reali (Jira/Odoo/Linear/Asana) + dati E2E__ esercitati

## Note sullo scope E1
- L'E2E "verde" in E1 è uno **smoke infrastrutturale** (build & boot). Lo scenario #1 Auth/Smoke (P0) richiede JWT reali — dipende da E3.
- La guardia `E2E_TEST_MODE` (ADR-003-B) è implementata fail-closed in `backend/app/core/config.py` (model_validator, valutato a import-time). Review security-reviewer: PASS.
