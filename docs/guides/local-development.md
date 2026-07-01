# Guida allo sviluppo locale — Timesheet Hub

> Aggiornato: E3 (STORY-008). Google OAuth, JWT, tabella `users`.
> Riferimenti: ADR-001 · ADR-002 · ADR-003 · ADR-004 · `docs/timesheet-hub-roadmap.md`

## Introduzione

Questa guida descrive come avviare e sviluppare Timesheet Hub in locale. Lo stack gira interamente in Docker via `docker-compose`, usando lo **stesso PostgreSQL** di CI e produzione (ADR-003-C): backend FastAPI (gestito con **uv**), frontend Vite + React + TypeScript (gestito con **npm**), e nginx opzionale come reverse proxy single-origin.

## Indice
1. Prerequisiti
2. Setup iniziale (.env)
3. Avviare lo stack (docker-compose + Makefile)
4. Backend (FastAPI + uv)
5. Frontend (Vite + React + npm)
6. Proxy `/api` e single-origin
7. Migrazioni database (Alembic)
8. Qualità del codice: lint, format, pre-commit
9. Test (unit, integration, E2E)
10. Seed dei dati
11. Troubleshooting

## 1. Prerequisiti

- **Docker** 24+ e **Docker Compose** v2 (`docker compose` senza trattino)
- **make**
- Opzionale (per IDE/editor fuori container): **uv** (backend) e **Node.js** 20+ / **npm** (frontend)

## 2. Setup iniziale (.env)

Il progetto ha **tre** file `.env.example`, uno per modalità di avvio:

| File | Usato da | Quando copiarlo |
|---|---|---|
| `.env.example` (root) | `docker-compose.yml` | **Sempre** — è il punto di partenza per `make up` |
| `backend/.env.example` | FastAPI via pydantic-settings | Solo se si avvia il backend **fuori Docker** (es. `uv run uvicorn ...` nella cartella `backend/`) |
| `frontend/.env.example` | Vite | Solo se si avvia il frontend **fuori Docker** (es. `npm run dev` nella cartella `frontend/`) |

### Caso tipico: stack Docker completo

```bash
cp .env.example .env
# Editare .env: aggiungere JWT_SECRET, TOKEN_ENCRYPT_KEY, VITE_GOOGLE_CLIENT_ID
make up
```

Variabili nel `.env` (root):

| Variabile | Default dev | Note |
|---|---|---|
| `POSTGRES_USER` | `postgres` | Utente DB Postgres |
| `POSTGRES_PASSWORD` | `postgres` | Password DB (solo locale) |
| `POSTGRES_DB` | `timesheet_hub` | Nome database |
| `JWT_SECRET` | *(da impostare)* | Qualsiasi stringa in dev; in prod: Railway Secret |
| `TOKEN_ENCRYPT_KEY` | *(da impostare)* | Chiave AES-256-GCM per token utente; in prod: Railway Secret |
| `ENVIRONMENT` | `local` | Determina se `E2E_TEST_MODE=true` è lecito (ADR-003-B) |
| `E2E_TEST_MODE` | `false` | Impostare `true` solo per `make e2e`; mai in prod |
| `VITE_GOOGLE_CLIENT_ID` | *(da impostare da E3)* | Client ID pubblico GCP (non è un secret) |

### Caso alternativo: backend standalone (senza Docker)

```bash
cp backend/.env.example backend/.env
# Editare backend/.env: DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPT_KEY,
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
cd backend && uv run uvicorn app.main:app --reload
```

`backend/.env` contiene anche le credenziali OAuth complete (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) che nel root `.env` non sono presenti perché il container backend le riceve via environment da Railway in produzione.

### Caso alternativo: frontend standalone (senza Docker)

```bash
cp frontend/.env.example frontend/.env
# Editare frontend/.env: VITE_GOOGLE_CLIENT_ID
cd frontend && npm run dev
```

`frontend/.env` espone solo variabili `VITE_*` (incluse nel bundle client-side); non inserire mai secret qui. `VITE_API_BASE_URL` è commentata: in sviluppo il proxy Vite → `/api` è già configurato in `vite.config.ts`, in produzione si usano path relativi.

## 3. Avviare lo stack (docker-compose + Makefile)

Comandi principali (da root del progetto):

```bash
make up          # Avvia postgres + backend + frontend in background
make down        # Ferma e rimuove i container
make logs        # Segue i log di tutti i servizi
```

Nginx reverse proxy è **opzionale** via profilo:

```bash
docker compose --profile proxy up    # include nginx sulla porta 80
```

### Porte locali

| Servizio | Porta | URL |
|---|---|---|
| Frontend (Vite HMR) | 5173 | http://localhost:5173 |
| Backend (uvicorn) | 8000 | http://localhost:8000/health |
| PostgreSQL | 5432 | `postgres://postgres:postgres@localhost:5432/timesheet_hub` |
| Nginx (solo `--profile proxy`) | 80 | http://localhost |

### Altri comandi Makefile

```bash
make migrate         # Applica alembic upgrade head
make makemigration   # Genera nuova revision Alembic (autogenerate)
make test-backend    # Esegue pytest nel container backend
make test-frontend   # Esegue i test frontend
make e2e             # Esegue Playwright (richiede E2E_TEST_MODE=true)
make lint            # Ruff (backend) + ESLint (frontend)
make format          # Ruff format (backend) + Prettier (frontend)
make seed            # Seed deterministico per E2E (placeholder in E1)
```

## 4. Backend (FastAPI + uv)

- Gestione dipendenze con **uv** (`uv sync --frozen`); lockfile `uv.lock` versionato.
- In dev: `uvicorn --reload` con bind mount della cartella `app/` per hot-reload (STORY-002/005).
- Endpoint attivi in E1: `GET /health` → `{"status": "ok"}`.

### Struttura `backend/app/`

```
app/
├── main.py              # App FastAPI + include_router
├── dependencies.py      # Dependency injection (E3+)
├── core/
│   ├── config.py        # Settings (pydantic-settings, legge .env)
│   ├── logging.py       # Configurazione logging
│   └── security.py      # JWT + cifratura token (stub, E3)
├── db/
│   ├── base.py          # DeclarativeBase SQLAlchemy
│   ├── conventions.py   # Naming convention FK/IX
│   └── session.py       # Engine + SessionLocal
├── models/              # Modelli SQLAlchemy (user.py placeholder, E3)
├── schemas/             # Pydantic schemas (E3+)
├── routers/
│   ├── health.py        # GET /health
│   ├── auth.py          # OAuth flow (E3)
│   └── users.py         # Endpoints utente (E3+)
└── adapters/            # Adapter Jira/Odoo/Linear/Asana (E5+)
```

### Comandi utili

```bash
# Eseguire un comando nel container backend attivo
docker compose exec backend uv run pytest
docker compose exec backend uv run alembic history
docker compose exec backend uv run python -c "from app.core.config import settings; print(settings)"
```

## 5. Frontend (Vite + React + npm)

- Gestione dipendenze con **npm** (`npm ci`); lockfile `package-lock.json` versionato.
- Dev server Vite con HMR su porta 5173; `node_modules` in anonymous volume per performance (STORY-003/005).
- Alias `@` → `src/` configurato in `vite.config.ts`.

### Struttura `frontend/src/`

```
src/
├── App.tsx              # Router React Router v7
├── main.tsx             # Entrypoint React + QueryClientProvider
├── api/                 # Client HTTP (E3+)
├── components/          # Componenti riutilizzabili (E4+)
├── hooks/
│   └── useStub.ts       # Hook stub per modalità E2E (ADR-003-D)
├── lib/
│   └── queryClient.ts   # TanStack Query client
├── pages/
│   └── IndexPage.tsx    # Pagina placeholder E1
├── themes/
│   └── index.ts         # MUI theme (light)
└── types/               # Tipi TypeScript condivisi (E3+)
```

### Comandi npm

```bash
npm run dev          # Dev server Vite (già avviato via docker compose)
npm run build        # TypeScript check + bundle produzione
npm run lint         # ESLint flat config
npm run format       # Prettier
npm run type-check   # tsc --noEmit
```

## 6. Proxy `/api` e single-origin

In dev esistono due modalità:

**Modalità Vite (predefinita)** — il Vite dev server inoltra automaticamente `/api/*` → `http://backend:8000` (configurato in `vite.config.ts`). Il prefisso `/api` viene **conservato** (il backend riceve `/api/...`). Adatta per sviluppo quotidiano: nessuna configurazione aggiuntiva.

**Modalità nginx** (`--profile proxy`) — nginx gestisce il routing su porta 80, strippando `/api` → backend:8000 e `/` → frontend:3000. Replica il comportamento esatto di produzione (ADR-001-E). Usare quando si vuole testare il routing single-origin reale o il comportamento dei cookie `SameSite=Strict` (ADR-001-F).

## 7. Migrazioni database (Alembic)

### Naming convention

I file di migrazione seguono il pattern `NNNN_verbo_oggetto.py`:

```
0001_init_baseline.py
0002_create_users.py
0003_add_import_jobs.py
```

Il numero progressivo garantisce l'ordine cronologico; `verbo_oggetto` descrive l'intenzione (`create`, `add`, `rename`, `drop`, ecc.).

### Workflow

**1. Generare una nuova migration**

```bash
make makemigration msg="create_import_jobs"
# → backend/alembic/versions/NNNN_create_import_jobs.py
```

Alembic esegue `--autogenerate` confrontando i modelli SQLAlchemy con lo schema attuale del DB. Il file generato va **sempre revisionato manualmente** prima di applicarlo.

**2. Review umana (checklist obbligatoria)**

Prima di committare o applicare la migration, verificare:

- [ ] `downgrade()` è implementato e il rollback è testato mentalmente
- [ ] Nessun dato viene distrutto senza un commento `# WARNING: destructive`
- [ ] Tipi PostgreSQL compatibili con il driver psycopg v3 (evitare tipi non-nativi non supportati)
- [ ] Se la migration include `ALTER TABLE` su tabella grande: valutare lock e finestra di manutenzione

**3. Applicare le migration**

```bash
make migrate   # alembic upgrade head — applica tutte le pending
```

Stesso comando eseguito da `preDeployCommand` su Railway prima dello swap del container (STORY-006).

**4. Rollback**

```bash
docker compose exec backend uv run alembic downgrade -1   # torna indietro di una revision
docker compose exec backend uv run alembic history        # lista la cronologia
docker compose exec backend uv run alembic current        # revision corrente del DB
```

### Note

- La prima migration (`0001_init_baseline.py`) è vuota: stabilisce il punto di partenza formale della cronologia. Le tabelle reali vengono aggiunte da E3 in poi.
- Lo schema dei constraint (FK, IX, UQ, CK, enum) segue la naming convention in `backend/app/db/conventions.py` (ADR-004-C).

## 8. Qualità del codice: lint, format, pre-commit

- **Backend**: **ruff** (lint + format, config in `pyproject.toml`): `make lint` / `make format`.
- **Frontend**: **ESLint flat config** + **Prettier** (config in `eslint.config.js` / `.prettierrc`): `make lint` / `make format`.
- **Type-check frontend**: `npm run type-check` (tsc --noEmit).

### Installazione hook pre-commit

```bash
pip install pre-commit
pre-commit install
```

Il file `.pre-commit-config.yaml` (root) esegue ruff e eslint/prettier sui soli file modificati ad ogni `git commit`. I check locali sono veloci e non bloccanti sull'intero progetto; il **gate vero** è la CI su `main` (ADR-003-F, STORY-009).

## 9. Test (unit, integration, E2E)

```bash
make test-backend    # pytest (unit + integration) nel container backend
make test-frontend   # Test frontend (vitest o playwright component — TODO STORY-008)
make e2e             # Playwright E2E (richiede E2E_TEST_MODE=true nel .env)
```

- **Scope E1**: l'E2E in E1 è uno **smoke infrastrutturale** (build & boot: `/health` ok anche via proxy, FE serve la pagina). Lo scenario auth #1 di `004-e2e-test-plan.md` dipende da E3 (JWT reali).
- `E2E_TEST_MODE=true` solo in locale/CI; la guardia impedisce il deploy in staging/production (ADR-003-B, STORY-008).
- La CI GitHub Actions (backend-ci, frontend-ci, e2e) è un required check per il merge su `main` (ADR-003-F), ortogonale al deploy Railway (ADR-002-H).

### Leggere report e trace Playwright su fallimento

**In CI (GitHub Actions)**: quando lo smoke E2E fallisce, il workflow `e2e.yml` carica automaticamente gli artifact `playwright-results` (retention 7 giorni). Scaricarli dalla tab *Actions → job → Artifacts*; contengono `test-results/` (screenshot + trace `.zip`) e `playwright-report/` (HTML).

**Aprire il report HTML in locale**:
```bash
cd e2e
npx playwright show-report playwright-report/
# Apre il browser su http://localhost:9323
```

**Aprire un trace**:
```bash
npx playwright show-trace test-results/<nome-test>/trace.zip
```

Il trace viewer mostra timeline, screenshot per step, network requests e console log. Il trace è prodotto solo `on-first-retry` in CI (configurato in `playwright.config.ts` → `use.trace`); in locale è `off` di default — attivare con `--trace on` se necessario:

```bash
cd e2e && npx playwright test --grep @smoke --trace on
```

Gli screenshot vengono catturati automaticamente `only-on-failure` anche in locale.

### Nota su `make test-frontend`

In E1 il Makefile chiama `npm test` nel container frontend, ma lo script `test` non è ancora definito in `frontend/package.json`: la CI frontend esegue solo lint + type-check + build (non ha ancora vitest). Il comando `make test-frontend` verrà completato quando vitest sarà configurato in un'epica successiva.

## 10. Seed dei dati

```bash
make seed    # Seed deterministico per E2E (placeholder in E1)
```

Il seed predispone utenti per ruolo e marcatori `E2E__*` (ADR-003-D). In E1 il comando è un placeholder; verrà popolato quando gli oggetti seed saranno definiti (E3/E7).

## 11. Troubleshooting

**Porta già in uso**
```bash
lsof -i :5173   # o :8000, :5432
# Fermare il processo o cambiare porta in docker-compose.yml
```

**Frontend: hot-reload non funziona**
Il volume anonimo su `node_modules` è necessario per evitare che il bind mount del codice host sovrascriva i moduli compilati nel container. Se aggiunto un nuovo pacchetto npm, ricostruire l'immagine:
```bash
make down && docker compose build frontend && make up
```

**PostgreSQL non healthy / backend non si avvia**
Il backend ha `depends_on: postgres: condition: service_healthy`. Se postgres non passa l'healthcheck (`pg_isready`):
```bash
make logs   # Verificare i log di postgres
docker compose ps   # Verificare lo stato dei servizi
```

**Pre-commit: ruff non trovato**
```bash
pre-commit autoupdate   # Aggiorna le versioni degli hook
pre-commit clean        # Pulisce la cache
```
