# Backlog Timesheet Hub

> Aggiornato: 2026-06-27 — E1 completata, storie rimosse

Il backlog è effimero: le storie completate vengono rimosse dopo il merge su `main` e l'aggiornamento della documentazione permanente (ADR, spec, guide). I dati persistenti vivono in ADR/spec/test/codice, non qui.

Riferimenti: `docs/timesheet-hub-roadmap.md` · `docs/adr/ADR-001` · `docs/adr/ADR-002` · `docs/adr/ADR-003` · `docs/specs/002-tech-spec-auth-google.md` · `docs/specs/004-e2e-test-plan.md`

## Avanzamento per epica
| Epica | Done | In Progress | Todo | Blocked | Totale |
|---|---|---|---|---|---|
| E1 | 10 | 0 | 0 | 0 | 10 ✅ |

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

## Prossime epiche
- **E2**: autenticazione Google OAuth (STORY-0xx — da definire)
- **E3**: auth E2E reale — `POST /api/_test/session`, `loginAs` funzionale, `storageState` per-ruolo
- **E7/E8**: import wizard + adapter reali (Jira/Odoo/Linear/Asana) + dati E2E__ esercitati

## Note sullo scope E1
- L'E2E "verde" in E1 è uno **smoke infrastrutturale** (build & boot). Lo scenario #1 Auth/Smoke (P0) richiede JWT reali — dipende da E3.
- La guardia `E2E_TEST_MODE` (ADR-003-B) è implementata fail-closed in `backend/app/core/config.py` (model_validator, valutato a import-time). Review security-reviewer: PASS.
