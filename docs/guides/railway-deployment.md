# Guida al deploy su Railway — Timesheet Hub

> Stato: SCHELETRO (E1). Sezioni con `TODO` da completare man mano che le storie chiudono.
> Riferimenti: ADR-001 · ADR-002 · ADR-003 · `docs/timesheet-hub-roadmap.md`

## Introduzione

Timesheet Hub è uno strumento interno (`@sixfeetup.it`) ospitato su **Railway Pro**, in un monorepo GitHub con tre servizi Docker (nginx, frontend, backend) più il plugin PostgreSQL managed. Questa guida descrive come è configurato il progetto su Railway e come avviene il deploy. Le decisioni architetturali sottostanti sono in ADR-001 (architettura/auth) e ADR-002 (infrastruttura).

## Indice
1. Prerequisiti
2. Struttura del progetto e dei servizi
3. Environment: staging e production
4. Builder Docker e configurazione `railway.json`
5. Pre-deploy: migrazioni database
6. Networking e single-origin (nginx)
7. Database PostgreSQL managed
8. Secret management
9. Flusso di deploy
10. CI e gate di merge (relazione con Railway)
11. Troubleshooting

## 1. Prerequisiti

- Account Railway con piano **Pro** (ADR-002-A) — necessario per environment multipli e plugin PostgreSQL managed.
- Ruolo **Admin** nel Railway Project per gestire servizi, variabili e custom domain.
- Accesso in scrittura al repository GitHub del monorepo.
- Opzionale: **Railway CLI** (`npm install -g @railway/cli`) per debug locale e accesso al DB.

## 2. Struttura del progetto e dei servizi

Monorepo con tre directory di primo livello, un singolo Railway Project con 3 servizi per environment + plugin PostgreSQL (ADR-002-B/D):

| Servizio | Source | rootDirectory (Railway UI) | Porta interna |
|---|---|---|---|
| `nginx` | GitHub (Docker) | `/nginx` | 80 |
| `frontend` | GitHub (Docker) | `/frontend` | 3000 |
| `backend` | GitHub (Docker) | `/backend` | 8000 |
| `postgres` | Railway Plugin | — | 5432 |

- `rootDirectory` è configurato **lato Railway UI** (Settings → Source → Root Directory), non in `railway.json` (ADR-002-B).

### Collegare il repo e impostare rootDirectory (prima configurazione)

Per ogni servizio (`nginx`, `frontend`, `backend`) nella Railway UI:

1. Railway Dashboard → Project → clic sul servizio → **Settings**
2. Sezione **Source** → **GitHub Repo** → selezionare il repo del monorepo (prima connessione: autorizzare l'integrazione GitHub tramite il link "Connect GitHub Account" se non ancora fatto)
3. Sezione **Source** → campo **Root Directory** → inserire il valore corrispondente:

| Servizio | Root Directory |
|---|---|
| `nginx` | `/nginx` |
| `frontend` | `/frontend` |
| `backend` | `/backend` |

4. Salvare; Railway userà quel percorso come contesto di build Docker (equivalente a `context:` in docker-compose).

Il `rootDirectory` non va nel `railway.json` perché è una configurazione della piattaforma, non del repo (ADR-002-B).

## 3. Environment: staging e production

Due environment isolati (ADR-002-C), ciascuno con i propri servizi e database separati:

| Environment | Branch | Scopo |
|---|---|---|
| `staging` | `development` | Validazione pre-rilascio |
| `production` | `main` | Live |

- Deploy trigger **nativo Railway** sul push al branch dell'environment. Nessuna pipeline CI esterna per il deploy (ADR-002-C, ADR-002-H).
- TODO: strategia di promozione staging → production (decisione aperta ADR-002).

## 4. Builder Docker e configurazione `railway.json`

Tutti i servizi usano builder **Docker** (ADR-002, aggiornato in STORY-001/006). Ogni servizio ha un `railway.json` nella propria directory con `build.builder = "DOCKERFILE"`.

### `backend/railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile",
    "buildTarget": "runtime"
  },
  "deploy": {
    "preDeployCommand": "alembic upgrade head"
  }
}
```

### `frontend/railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile",
    "buildTarget": "runtime"
  }
}
```

### `nginx/railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile"
  }
}
```

`buildTarget: "runtime"` seleziona lo stage finale dei Dockerfile multi-stage (backend: Python slim + user non-root; frontend: nginx:alpine con il bundle Vite compilato). Lo stage `dev` e `builder` intermedi vengono scartati nell'immagine finale.

## 5. Pre-deploy: migrazioni database

Il servizio `backend` esegue `alembic upgrade head` come `preDeployCommand` **prima** dello swap del container (STORY-006). Il comando viene eseguito nel container appena buildato, con accesso alla stessa `DATABASE_URL` dell'environment.

**Comportamento in caso di fallimento**: se `alembic upgrade head` fallisce, Railway interrompe il deploy e il container in esecuzione rimane attivo (nessun downtime). Il log di errore è visibile nella sezione Deployments → Logs del servizio.

- TODO: note su rollback (decidere se alembic downgrade -1 o rollback tramite backup DB — E2/E3).

## 6. Networking e single-origin (nginx)

Solo il servizio `nginx` ha un **custom domain pubblico**. I servizi `frontend` e `backend` sono raggiungibili **solo sulla rete privata Railway** (`frontend.railway.internal:3000`, `backend.railway.internal:8000`):

- `/api/*` → `backend.railway.internal:8000` (nginx strippa il prefisso `/api`)
- `/*` → `frontend.railway.internal:3000`

Il single-origin abilita cookie `SameSite=Strict` senza CORS (ADR-001-E/F).

### Configurare il custom domain e TLS

1. In Railway → servizio `nginx` → Settings → **Networking** → Custom Domain
2. Aggiungere il dominio (es. `timesheet.sixfeetup.it`)
3. Copiare il record CNAME fornito da Railway e aggiungerlo nel DNS
4. Railway gestisce TLS automaticamente tramite Let's Encrypt

## 7. Database PostgreSQL managed

Il plugin PostgreSQL di Railway inietta automaticamente `DATABASE_URL` nel servizio `backend` per ogni environment (ADR-002-E). Backup automatici gestiti dalla piattaforma.

- **Retention backup**: 30 giorni su piano Pro.
- **Accesso debug** (Railway CLI):
  ```bash
  railway connect postgres --environment staging
  # oppure
  railway environment staging
  railway shell postgres
  ```

## 8. Secret management

Le variabili sensibili sono configurate come **Railway Secret Variables** per environment (ADR-002-G), non commesse nel repository.

| Variabile | Scope | Note |
|---|---|---|
| `DATABASE_URL` | Iniettata dal plugin | Automatica per environment |
| `JWT_SECRET` | Backend | Stringa random ≥ 32 char |
| `TOKEN_ENCRYPT_KEY` | Backend | Chiave AES-256-GCM (32 byte in base64) |
| `GOOGLE_CLIENT_ID` | Backend + Frontend | Da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Backend | Da Google Cloud Console |

**IMPORTANTE**: `E2E_TEST_MODE` **non deve MAI essere impostato** in staging/production (ADR-003-B). Un deploy-check impedisce l'avvio del backend se questo flag è attivo (STORY-008).

- TODO: procedura di rotazione `JWT_SECRET` (ogni 90 giorni, ADR-001-H) — da definire in E3.

## 9. Flusso di deploy

**Staging** (push su `development`):
1. Push su branch `development` → Railway rileva il trigger nativo
2. Build Docker (`buildTarget: runtime`) nella cloud Railway
3. `preDeployCommand: alembic upgrade head` sul container appena buildato
4. Se migrazione OK: swap atomico del container (zero-downtime)
5. Se migrazione fallisce: deploy interrotto, container precedente resta attivo

**Production** (merge su `main`):
- Stesso flusso del punto precedente, sull'environment `production`.
- Il merge su `main` è bloccato finché la CI GitHub Actions non è verde (required check — ADR-002-H, ADR-003-F).

## 10. CI e gate di merge (relazione con Railway)

La CI GitHub Actions (STORY-009) è un **gate di merge** su `main` (required check + branch protection), **non** il meccanismo di deploy: il deploy resta trigger-su-branch nativo Railway. I due meccanismi sono ortogonali (ADR-002-H, ADR-003-F).

### Workflow CI

I tre workflow sono in `.github/workflows/`:

| File | Job name | Trigger |
|---|---|---|
| `backend-ci.yml` | `Backend CI / test` | push/PR su `backend/**` |
| `frontend-ci.yml` | `Frontend CI / Lint + Type-check + Build` | push/PR su `frontend/**` |
| `e2e.yml` | `E2E Smoke / Smoke (build & boot)` | push/PR su stack completo |

### Configurare branch protection su GitHub

Repository **Settings → Branches → Add branch protection rule**:

- **Branch name pattern**: `main`
- Spuntare **Require status checks to pass before merging**
- Aggiungere i required checks (usando i *job name* esatti sopra):
  - `Backend CI / test`
  - `Frontend CI / Lint + Type-check + Build`
  - `E2E Smoke / Smoke (build & boot)`
- Spuntare **Require branches to be up to date before merging**
- Opzionale: **Restrict who can push to matching branches** (solo Admin)

I check devono essere stati eseguiti almeno una volta sulla repo affinché GitHub li mostri come opzione nel selettore.

## 11. Troubleshooting

**Build Docker fallita**
Verificare il log in Railway → Deployments → Build Logs. Errori comuni: dipendenza mancante nel `pyproject.toml`/`package.json`, file `uv.lock`/`package-lock.json` non aggiornato.

**Pre-deploy migrate fallito**
Verificare che le migration siano coerenti con il DB (`alembic history` + `alembic current`). Se la migration ha un errore sintattico, fixare e fare re-deploy.

**Networking interno non funziona**
I servizi privati Railway usano il formato `<nome-servizio>.railway.internal`. Verificare che i nomi corrispondano a quelli configurati in Railway UI. La risoluzione DNS interna funziona solo tra servizi dello stesso environment.
