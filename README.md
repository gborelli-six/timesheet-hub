# Timesheet Hub

Applicazione per l'importazione di timesheet da file Excel verso backend gestionali (Odoo e altri).

## Prerequisiti

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) (incluso in Docker Desktop)
- `make`

## Setup sviluppo locale

```bash
# 1. Copia le variabili d'ambiente
cp .env.example .env
# Modifica .env: aggiungi JWT_SECRET, TOKEN_ENCRYPT_KEY, VITE_GOOGLE_CLIENT_ID

# 2. Avvia lo stack (postgres + backend + frontend)
make up

# 3. Esegui le migrazioni DB al primo avvio
make migrate
```

## Servizi

| Servizio | URL | Note |
|---|---|---|
| Frontend (Vite HMR) | http://localhost:5173 | Proxy `/api` → backend |
| Backend (FastAPI) | http://localhost:8000 | `/health` per il health check |
| PostgreSQL | localhost:5432 | DB: `timesheet_hub` |
| Nginx (opzionale) | http://localhost:80 | Solo con `--profile proxy` |

### Nginx proxy (opzionale)

```bash
docker compose --profile proxy up -d
# Accesso single-origin: http://localhost/api/... e http://localhost/
```

## Comandi Makefile

```bash
make up                          # Avvia lo stack in background
make down                        # Ferma e rimuove i container
make logs                        # Segui i log di tutti i servizi
make migrate                     # Applica le migrazioni Alembic
make makemigration msg="..."     # Genera una nuova migrazione Alembic
make test-backend                # Esegui pytest nel container backend
make test-frontend               # Esegui i test frontend (npm test)
make e2e                         # Avvia stack in modalità E2E (STORY-008)
make lint                        # ruff (backend) + eslint (frontend)
make format                      # ruff format (backend) + prettier (frontend)
make seed                        # Seed deterministico E2E (no-op in E1)
```

## Architettura

```
browser
  └── :5173 (Vite dev server)
        └── /api/* → :8000 (FastAPI + uvicorn --reload)
                          └── postgres:5432

# con --profile proxy:
browser
  └── :80 (nginx dev)
        ├── /api/* → backend:8000
        └── /      → frontend:5173
```

Documentazione tecnica: `docs/adr/`, `docs/specs/`, `docs/guides/`.
