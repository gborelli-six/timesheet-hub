# Timesheet Hub — CLAUDE.md

Applicazione web interna (SPA + API) per centralizzare l'importazione di timesheet da backend eterogenei (Odoo, Jira, Linear, Asana) verso un unico flusso aziendale. Attori: Dipendente, HR Manager, Admin. Dominio Google richiesto: `sixfeetup.it`.

---

## Stack tecnologico

| Layer | Tecnologia | Versione |
|---|---|---|
| Frontend | React + Vite + TypeScript | 19 / 6 / 5.7 |
| UI | MUI v7 + Mantis | 7.0 |
| State | TanStack Query + React Router | 5.x / 7.x |
| Backend | FastAPI + uvicorn | ≥ 0.115 |
| ORM | SQLAlchemy 2 + Alembic | 2.x / 1.13 |
| DB | PostgreSQL (Railway managed) | 16 |
| Auth | Google OAuth 2.0 → JWT HS256 cookie | — |
| E2E | Playwright + TypeScript | ≥ 1.49 |
| Deploy | Railway Pro (nginx + frontend + backend) | — |
| CI | GitHub Actions (merge gate su `main`) | — |

---

## Struttura directory

```
.
├── backend/            # FastAPI — endpoint, ORM, migrazioni, RBAC
│   ├── app/
│   │   ├── core/       # config, security (JWT), rbac (require_role)
│   │   ├── models/     # SQLAlchemy models + TimestampMixin
│   │   ├── routers/    # auth, users, health, e2e_test_router
│   │   └── main.py
│   ├── alembic/        # migrazioni DB (versions/)
│   └── tests/          # unit/ e integration/
├── frontend/           # React 19 + Vite
│   └── src/
│       ├── components/ # componenti riusabili
│       ├── hooks/      # useAuth e altri hook
│       ├── lib/        # apiClient
│       └── pages/      # LoginPage, CallbackPage, ...
├── e2e/                # Playwright
│   ├── tests/          # scenari (auth.spec.ts, rbac.spec.ts, ...)
│   └── support/        # auth.ts helper, fixture
├── nginx/              # reverse proxy config + Dockerfile
├── docs/
│   ├── adr/            # Architecture Decision Records (ADR-001..005)
│   ├── specs/          # Specifiche tecniche (001..005)
│   ├── backlog/        # Storie attive per epica (README + e*-stories.md)
│   ├── guides/         # Guide utente e sviluppatore
│   └── timesheet-hub-roadmap.md
├── docker-compose.yml  # stack dev locale
├── Makefile            # comandi make (vedi sotto)
└── .claude/agents/     # definizioni agenti Conductor
```

---

## Agenti Conductor disponibili

| Agente | Ruolo | Quando usarlo |
|---|---|---|
| `software-architect` | ADR, contratti API, interfacce cross-layer | prima di ogni nuova epica o quando l'architettura è in discussione |
| `backend-fastapi` | endpoint REST, ORM, migrazioni Alembic, RBAC middleware | implementazione lato server |
| `frontend-react` | componenti React, shell Mantis, TanStack Query, SheetJS | implementazione lato client |
| `e2e-playwright` | scenari E2E, fixture deterministiche, stub adapter, storageState per ruolo | test end-to-end |
| `security-reviewer` | audit OAuth/JWT, cifratura AES-256-GCM, RBAC enforcement — **solo lettura** | prima di ogni merge che tocca auth, token, RBAC |
| `business-analyst` | analisi requisiti, criteri di accettazione, storie funzionali | definizione o chiarimento requisiti |
| `backlog-manager` | gestione `docs/backlog/`, scomposizione epiche in storie, supervisione flusso | popolare o aggiornare il backlog |
| `devops-railway` | Railway services, nginx, deploy, variabili d'ambiente, secret | infrastruttura e deploy |
| `integration-adapter` | interfaccia `TimesheetAdapter`, registry, adapter Odoo/Jira/Linear | architettura e implementazione adapter |
| `docs-writer` | ADR, spec tecniche, roadmap, guide utente | documentazione a fine epica o su modifica architetturale |

---

## Workflow epica standard

Ogni epica segue questa sequenza; alcuni step sono paralleli, altri bloccanti.

```
1. business-analyst     → analisi requisiti + criteri di accettazione
2. software-architect   → design contratti API / interfacce (blocca 3)
3. backlog-manager      → creazione storie in docs/backlog/e*-stories.md
4. backend-fastapi      → migrazioni Alembic + endpoint (parallelo con 5)
5. frontend-react       → componenti e pagine (parallelo con 4)
6. e2e-playwright       → scenari E2E smoke (blocca merge su main)
7. security-reviewer    → audit obbligatorio se epica tocca auth/token/RBAC
8. docs-writer          → ADR / spec / guide utente
```

**Definition of Done per ogni epica:**
- [ ] Codice implementato e revisionato
- [ ] Test unit/integration sul backend
- [ ] Test E2E smoke verdi in CI
- [ ] Documentazione tecnica aggiornata (ADR/spec se necessario)
- [ ] Guida utente completata (in `docs/guides/`)

---

## Convention e regole

### Alembic
- Naming file: `NNNN_descrizione_breve.py` (es. `0002_create_users.py`)
- `downgrade()` sempre implementato
- Mai distruggere dati senza `WARNING` esplicito nello script
- `ALTER TYPE ADD VALUE` per enum PostgreSQL va scritto a mano (non autogenerato)

### RBAC
```python
# Protezione endpoint
@router.get("/risorsa")
async def endpoint(current_user: CurrentUser = Depends(require_role([UserRole.hr, UserRole.admin]))):
    ...
```
- 3 ruoli: `employee` / `hr` / `admin`
- Ruolo codificato nel JWT payload come `role`
- `get_current_user()` legge il cookie `session` (httpOnly, SameSite=strict)

### Secrets management
- **Livello sistema** (Railway env vars): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `TOKEN_ENCRYPT_KEY`
- **Livello per-utente**: cifrati AES-256-GCM in tabella `user_tokens`, nonce random 96-bit per record, AAD = (user_id, service), decifrati solo in memoria al momento della chiamata esterna, mai loggati

### E2E — dati deterministici
I marcatori sui valori d'input determinano il comportamento dello stub adapter:
- `E2E__OK` — risposta di successo
- `E2E__FAIL` — errore applicativo dal backend esterno
- `E2E__EXPIRED` — token scaduto
- `E2E__DOWN` — backend esterno irraggiungibile

### E2E — autenticazione
- Auth bypass tramite `POST /api/_test/session` (attivo **solo** con `E2E_TEST_MODE=true`)
- `E2E_TEST_MODE=true` consentito solo in `ENVIRONMENT` ∈ `{ci, local, test}` (fail-closed a import-time)
- 3 storageState per ruolo: employee, hr, admin (generati da `e2e/tests/auth.setup.ts`)
- Selettori: sempre `data-testid`, mai classi CSS o testo visibile

### SQLAlchemy — naming constraint
- Index: `ix_<table>_<col>`
- Unique: `uq_<table>_<col>`
- Check: `ck_<table>_<condition>`
- Foreign key: `fk_<table>_<col>_<ref_table>`

### Commit e CI
- CI bloccante su `main`: backend (ruff + pytest) + frontend (eslint + tsc + build) + E2E smoke
- Deploy: Railway trigger nativo su git push (no GitHub Actions per build/deploy)
- Merge gate: GitHub Actions (`/.github/workflows/`) controlla solo qualità, non deploya

---

## Comandi utili

### Make (stack locale)
```bash
make up              # avvia stack in background
make down            # stop + rimuove container
make logs            # tail tutti i servizi
make migrate         # alembic upgrade head
make makemigration   # crea nuova migrazione Alembic
make seed            # seed E2E deterministico
make e2e             # stack in E2E mode (E2E_TEST_MODE=true)
make lint            # ruff + eslint
make format          # ruff format + prettier
```

### Backend
```bash
cd backend
uv run pytest                          # tutti i test
uv run pytest tests/unit/              # solo unit
uv run pytest tests/integration/       # solo integration
uv run ruff check .                    # lint
uv run ruff format --check .           # check format
uv run alembic upgrade head            # migra DB
uv run alembic revision --autogenerate -m "descrizione"
```

### Frontend
```bash
cd frontend
npm run dev          # vite dev server :5173
npm run build        # tsc + vite build
npm run lint         # eslint
npm run type-check   # tsc --noEmit
npm run format       # prettier --write .
```

### E2E
```bash
cd e2e
npx playwright test                    # tutti i test
npx playwright test --grep @smoke      # solo smoke
npx playwright test --grep "@smoke|@rbac"
npx playwright test --ui               # modalità interattiva
npx playwright show-report             # apri ultimo report
```

---

## Stato epiche

Ordine di rilascio **employee-first** (roadmap v0.5): 🏁 Employee MVP → 🏁 Admin → 🏁 HR.

| Epica | Stato | Storie | Descrizione | Dipende da |
|---|---|---|---|---|
| E1 | ✅ Done | 10 | Infrastruttura, CI, Docker, nginx, Playwright skeleton | — |
| E2 | ✅ Done | 6 | ORM, Alembic, RBAC middleware, TimestampMixin | — |
| E3 | ✅ Done | 7 | Google OAuth, JWT, cookie httpOnly, tabella `users` (ruolo `employee` di default) | E2 |
| E4 | ⬜ Todo | 7 | Design token MUI v7, Mantis shell (Header, SideNav, routing per-ruolo) | — |
| E5 | ⬜ Todo | 6 | Profilo & token utente, AES-256-GCM, tabella `user_tokens`, API write-only | E3, E4 |
| E6 | ⬜ Todo | 6 | Upload Excel, SheetJS parsing, `TimesheetEntry[]`, Normalizer | E4 |
| E7 | ⬜ Todo | TBD | Architettura plug-in adapter + adapter Odoo (JSON-RPC) + **seed config Odoo di default** | E5 |
| E8a | ⬜ Todo | TBD | Wizard importazione **Employee** (self-import, step 1–4, no Step 0) | E5, E6, E7 |
| E9a | ⬜ Todo | TBD | Log importazioni **Employee** (solo propri log + dettaglio) | E8a |
| — | 🏁 | — | **Milestone: Employee MVP** | — |
| E3bis | ⬜ Todo | TBD | Gestione ruoli (API assegnazione/promozione employee/hr/admin) | E3 |
| E10 | ⬜ Todo | TBD | Pannello Admin (UI utenti/ruoli su E3bis, backend config CRUD, mapping Excel) | E3bis, E8a |
| — | 🏁 | — | **Milestone: Admin** | — |
| E8b | ⬜ Todo | TBD | Wizard import — incremento **HR** (Step 0 selezione dipendente, `POST /imports?for=<email>`) | E8a, E3bis |
| E9b | ⬜ Todo | TBD | Log importazioni — incremento **HR** (vede tutti i log + filtri avanzati) | E9a, E3bis |
| — | 🏁 | — | **Milestone: HR** | — |
| E11 | ⬜ Todo | TBD | Adapter aggiuntivi (Jira, Linear, Asana — post-v1) | E7 |

**Prossima epica da implementare:** E4 (nessun blocco, può partire subito)

---

## Riferimenti chiave

| Documento | Path | Contenuto |
|---|---|---|
| Roadmap | `docs/timesheet-hub-roadmap.md` | Epiche E1-E11, dipendenze, Definition of Done |
| ADR-001 | `docs/adr/ADR-001-timesheet-hub.md` | Architettura generale, stack, auth, secrets |
| ADR-002 | `docs/adr/ADR-002-railway-infrastructure.md` | Railway, ambienti, deploy, CI gate |
| ADR-003 | `docs/adr/ADR-003-e2e-testing-playwright.md` | Strategia E2E, bypass auth, stub adapter |
| ADR-004 | `docs/adr/ADR-004-orm-conventions.md` | SQLAlchemy, Alembic, naming constraint, enum |
| ADR-005 | `docs/adr/ADR-005-connector-credentials-security.md` | AES-256-GCM, `user_tokens`, key_version |
| Spec funzionale | `docs/specs/001-functional-spec.md` | Attori, casi d'uso, flusso principale |
| Spec auth | `docs/specs/002-tech-spec-auth-google.md` | Flusso OAuth dettagliato, JWT payload |
| UX brief | `docs/specs/003-timesheet-hub-ux-brief.md` | Wireframe, layout, navigazione per ruolo |
| Piano E2E | `docs/specs/004-e2e-test-plan.md` | ~23 scenari P0-P3, convenzioni dati |
| Spec RBAC | `docs/specs/005-tech-spec-rbac.md` | Permessi per ruolo, enforcement pattern |
| Backlog | `docs/backlog/README.md` | Stato attuale storie, link ai file per epica |
| Agenti | `.claude/agents/` | Definizioni complete dei 10 agenti Conductor |
| Design | `https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87` | Progetto "Timesheet hub" su claude.ai/design — Design System, App Shell, Login screen |
| Claude Design MCP | `https://api.anthropic.com/v1/design/mcp` (auth: `/design-login`) | MCP per importare mockup dal progetto design — usare prima di implementare UI E4–E10 |
