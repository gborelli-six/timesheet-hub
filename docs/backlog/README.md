# Backlog Timesheet Hub

> Aggiornato: 2026-06-28 — E1 completata; E2 completata; E3 dettagliata (002-tech-spec-auth-google); E4 dettagliata (MUI v7 + Mantis + claude.ai/design); E5 dettagliata (ADR-005)

Il backlog è effimero: le storie completate vengono rimosse dopo il merge su `main` e l'aggiornamento della documentazione permanente (ADR, spec, guide). I dati persistenti vivono in ADR/spec/test/codice, non qui.

Riferimenti: `docs/timesheet-hub-roadmap.md` · `docs/adr/ADR-001` · `docs/adr/ADR-002` · `docs/adr/ADR-003` · `docs/adr/ADR-004` · `docs/adr/ADR-005` · `docs/specs/002-tech-spec-auth-google.md` · `docs/specs/004-e2e-test-plan.md`

## Avanzamento per epica
| Epica | Done | In Progress | Todo | Blocked | Totale |
|---|---|---|---|---|---|
| E1 | 10 | 0 | 0 | 0 | 10 ✅ |
| E2 | 6 | 0 | 0 | 0 | 6 ✅ |
| E3 | 0 | 0 | 7 | 0 | 7 |
| E4 | 0 | 0 | 7 | 0 | 7 |
| E5 | 0 | 0 | 6 | 0 | 6 |

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

## E3 — Autenticazione & identità

Flusso Google OAuth completo (`hd=sixfeetup.it`), JWT HS256 con claim `role`, cookie di sessione `httpOnly/SameSite=Strict` (8h). Crea e possiede la tabella `users`, sorgente dell'identità per tutti gli endpoint. Riusa lo scaffolding di E2 (`TimestampMixin`, workflow Alembic, `require_role`/`get_current_user`). Prerequisito di E5 (identità utente) e dello scenario #1 Auth/Smoke (P0) E2E.

Dettaglio storie: [`e3-stories.md`](e3-stories.md).

| Storia | Titolo | Tipo | Dipende da | Stato |
|---|---|---|---|---|
| STORY-017 | Modello `User` + migrazione `0002_create_users` | Backend | STORY-012 | ⬜ Todo |
| STORY-018 | JWT reale (`create_jwt`/`decode_jwt`) + `get_current_user` da cookie | Backend | STORY-013, STORY-017 | ⬜ Todo |
| STORY-019 | Router OAuth (`/login`, `/callback`, `/logout`) + `GET /api/me` | Backend | STORY-017, STORY-018 | ⬜ Todo |
| STORY-020 | Endpoint test-only `POST /api/_test/session` + E2E storageState per-ruolo | Backend + E2E | STORY-019 | ⬜ Todo |
| STORY-021 | Test integrazione & unit E3 | Test | STORY-017, STORY-018, STORY-019 | ⬜ Todo |
| STORY-022 | Frontend auth (LoginPage, CallbackPage, useAuth, AuthGuard, apiClient) | Frontend | STORY-019 | ⬜ Todo |
| STORY-023 | Documentazione funzionale E3 | Docs | STORY-017…022 | ⬜ Todo |

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

## Prossime epiche
- **E7/E8**: import wizard + adapter reali (Jira/Odoo/Linear/Asana) + dati E2E__ esercitati

## Note sullo scope E1
- L'E2E "verde" in E1 è uno **smoke infrastrutturale** (build & boot). Lo scenario #1 Auth/Smoke (P0) richiede JWT reali — dipende da E3.
- La guardia `E2E_TEST_MODE` (ADR-003-B) è implementata fail-closed in `backend/app/core/config.py` (model_validator, valutato a import-time). Review security-reviewer: PASS.
