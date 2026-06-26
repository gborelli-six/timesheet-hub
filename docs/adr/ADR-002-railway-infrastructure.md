# ADR-002 — Timesheet Hub: infrastruttura Railway

| Campo | Valore |
|---|---|
| ID | ADR-002 |
| Titolo | Infrastruttura Railway: progetto, ambienti, servizi, database e deploy |
| Stato | Accettato |
| Data | 2026-05-28 |
| Autori | 6feetup Engineering |

---

## Contesto

L'ADR-001 definisce l'architettura applicativa e lo stack tecnologico. Questo documento entra nel dettaglio delle decisioni infrastrutturali: come il progetto è organizzato su Railway, quali servizi lo compongono, come è strutturato il ciclo di deploy e come sono gestiti i secret a livello di piattaforma.

Il sistema è uno strumento interno con 1–5 utenti iniziali, picco di utilizzo a fine mese. I requisiti infrastrutturali sono: costo contenuto, semplicità operativa, isolamento tra ambiente di sviluppo e produzione.

---

## Decisioni

### ADR-002-A — Piano Railway: Pro

**Decisione:** si utilizza il piano **Railway Pro**.

**Motivazione:** rispetto al piano Hobby, il Pro rimuove il limite di credito mensile ($5), offre Volume persistenti senza restrizioni e supporta ambienti multipli senza limitazioni. Il costo atteso (~10–15 €/mese a pieno regime) è ampiamente coperto dal piano Pro e in linea con i requisiti non funzionali dell'ADR-001.

---

### ADR-002-B — Struttura del progetto: monorepo + singolo Railway Project

**Decisione:** il codice risiede in un **monorepo GitHub** con tre directory di primo livello. Un **singolo Railway Project** ospita tutti i servizi.

```
timesheet-hub/          ← repository GitHub
├── frontend/           → servizio Railway: frontend
├── backend/            → servizio Railway: backend
└── nginx/              → servizio Railway: nginx
```

**Motivazione:** il monorepo semplifica la gestione delle PR (una PR può coprire modifiche coordinate tra frontend e backend), mantiene la history condivisa e non richiede sincronizzazione tra repository separati. Railway supporta la configurazione `rootDirectory` per servizio: un deploy viene triggerato solo se la directory radice del servizio contiene file modificati nel commit, evitando rebuild inutili.

**Conseguenza:** ogni servizio Railway ha `rootDirectory` configurato sulla propria subdirectory (`/frontend`, `/backend`, `/nginx`).

---

### ADR-002-C — Ambienti: staging e production

**Decisione:** il Railway Project contiene due **Environments** distinti e isolati.

| Environment | Branch GitHub | Scopo |
|---|---|---|
| `staging` | `development` | Validazione funzionale prima del rilascio |
| `production` | `main` | Ambiente live |

Ogni environment ha i propri servizi, variabili d'ambiente e istanza database indipendenti. Non c'è condivisione di risorse tra i due ambienti.

**Deploy trigger:** Railway è in ascolto diretto sui branch configurati. Un push su `development` triggera il deploy in staging; un merge su `main` triggera il deploy in production. Non sono presenti GitHub Actions o pipeline CI/CD esterne.

**Motivazione:** Railway Environments è il meccanismo nativo per l'isolamento degli ambienti sulla piattaforma, senza overhead di configurazione. L'assenza di una pipeline CI/CD esterna riduce la superficie di manutenzione; i test automatici, se introdotti in futuro, potranno essere aggiunti tramite un `pre-deploy command` configurabile direttamente su Railway.

---

### ADR-002-D — Servizi: tre servizi per environment

**Decisione:** ogni environment contiene tre servizi applicativi e un plugin database.

| Servizio | Tipo | Source | `rootDirectory` | Porta interna |
|---|---|---|---|---|
| `nginx` | Docker (Dockerfile custom) | GitHub | `/nginx` | 80 |
| `frontend` | Nixpacks (Node) | GitHub | `/frontend` | 3000 |
| `backend` | Nixpacks (Python) | GitHub | `/backend` | 8000 |
| `postgres` | Railway Plugin | — | — | 5432 |

**Networking:** solo `nginx` ha un custom domain pubblico configurato su Railway. `frontend` e `backend` non espongono porte pubbliche e sono raggiungibili esclusivamente sulla rete privata Railway tramite hostname interni (`frontend.railway.internal`, `backend.railway.internal`). Il plugin `postgres` è raggiungibile dal backend tramite la variabile `DATABASE_URL` iniettata automaticamente da Railway.

**Motivazione:** tenere frontend e backend separati da nginx permette deploy indipendenti: una modifica al solo frontend non richiede il rebuild di nginx, e viceversa. Il costo aggiuntivo di un container che serve file statici è trascurabile (~20 MB RAM).

---

### ADR-002-E — Database: PostgreSQL Railway managed

**Decisione:** si utilizza il **plugin PostgreSQL di Railway** al posto di SQLite (inizialmente previsto in ADR-001-B).

**Motivazione:** su Railway Pro il plugin Postgres non comporta costi aggiuntivi significativi e offre vantaggi operativi concreti rispetto a SQLite:

- Backup automatici gestiti dalla piattaforma.
- Nessuna necessità di Railway Volumes per la persistenza (il filesystem dei container Railway è effimero).
- Nessuna migrazione futura da SQLite a Postgres da pianificare.
- `DATABASE_URL` iniettata automaticamente da Railway nel servizio backend.

Ogni environment ha la propria istanza Postgres indipendente, senza condivisione di dati tra staging e production.

**Alternative considerate:**

- *SQLite + Railway Volume*: scartato. Richiede la configurazione e il mount di un Volume persistente, aggiunge un punto di failure e non elimina la necessità di una futura migrazione a Postgres al crescere del carico.

---

### ADR-002-F — Sizing iniziale

Il carico atteso è 1–5 utenti con picco a fine mese. I limiti seguenti sono i valori minimi di partenza; Railway scala verticalmente su richiesta senza modifiche alla configurazione dei servizi.

| Servizio | CPU | RAM |
|---|---|---|
| `nginx` | 0.1 vCPU | 64 MB |
| `frontend` | 0.1 vCPU | 64 MB |
| `backend` | 0.25 vCPU | 256 MB |
| `postgres` | gestito Railway | 256 MB |

---

### ADR-002-G — Secret management su Railway

**Decisione:** i secret sono gestiti come **Secret Variables di Railway**, configurate a livello di Environment. Non viene utilizzato alcun secret manager esterno (es. Infisical).

I secret infrastrutturali (`JWT_SECRET`, `TOKEN_ENCRYPT_KEY`) sono definiti manualmente per ciascun environment. La variabile `DATABASE_URL` è iniettata automaticamente dal plugin Postgres e non richiede configurazione manuale.

I secret applicativi (Google OAuth, variabili di configurazione dell'app) sono gestiti separatamente e non rientrano nel perimetro di questo ADR.

**Motivazione:** Railway Secret Variables cifra i valori a riposo e non li espone nei log. Per il volume di secret di questo progetto, un secret manager esterno aggiunge complessità senza benefici tangibili.

---

## Conseguenze

**Positive:**
- Infrastruttura interamente gestita da Railway: nessuna pipeline CI/CD esterna da mantenere.
- Isolamento completo tra staging e production a livello di servizi, database e variabili.
- Deploy automatici da branch: il flusso `development → staging`, `main → production` è configurato una volta sola su Railway.
- Postgres managed elimina la gestione del filesystem persistente e la pianificazione di una futura migrazione da SQLite.
- Rebuild selettivo per servizio grazie alla configurazione `rootDirectory` sul monorepo.

**Trade-off accettati:**
- Assenza di test automatici nel ciclo di deploy: un push su `development` triggera il deploy senza gate di qualità. Accettabile nella fase iniziale; un `pre-deploy command` su Railway può introdurre i test in futuro senza modificare l'architettura.
- Tre servizi per environment invece di due (nginx separato da frontend): aggiunge un hop di rete interno, trascurabile per uso interno.

---

## Decisioni aperte

- Strategia di promozione da staging a production: merge manuale su `main` oppure introduzione di un branch `release` intermedio.
- Configurazione del `pre-deploy command` Railway per le migration del database (`alembic upgrade head`) prima dello swap del container backend.
- Definizione delle retention policy sui log Railway per i due environment.
