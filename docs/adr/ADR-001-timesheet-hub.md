# ADR-001 — Timesheet Hub: architettura, autenticazione e sicurezza

| Campo | Valore |
|---|---|
| ID | ADR-001 |
| Titolo | Architettura generale, stack tecnologico, autenticazione e secrets management |
| Stato | Accettato |
| Data | 2026-05-28 |
| Aggiornato | 2026-05-28 |
| Autori | 6feetup Engineering |

---

## Contesto

L'azienda necessita di uno strumento interno per centralizzare l'importazione dei timesheet mensili dei dipendenti su più backend eterogenei (Jira, Odoo, Linear, Asana). Il processo attuale è manuale e ridondante: i dati vengono inseriti più volte su sistemi diversi, alcuni gestiti internamente, altri dai clienti.

Due casi d'uso principali guidano i requisiti:

1. Il dipendente carica il proprio file Excel con le ore lavorate per progetto e task.
2. Il responsabile HR carica il timesheet per conto di altri dipendenti.

Il sistema deve essere a **basso costo di manutenzione**, semplice da usare e facile da estendere con nuovi backend.

---

## Decisioni

### ADR-001-A — Architettura generale: PWA + backend API (Opzione B)

**Decisione:** si adotta un'architettura a due livelli — frontend React come PWA e backend API — con un database centralizzato.

**Alternative considerate:**

- *SPA browser-only*: scartata perché le API dei backend enterprise bloccano le chiamate CORS dirette dal browser, i token API sarebbero esposti nel client e il caso d'uso HR (upload per conto di altri) richiederebbe comunque un'identità centralizzata.
- *Webapp classica multi-tenant (Django/Rails)*: scartata perché sovradimensionata per uso interno con importazioni mensili. Costo di sviluppo e manutenzione sproporzionato.
- *App desktop (Electron/Tauri)*: scartata perché risolve solo il caso del singolo dipendente, introduce un ciclo di distribuzione/aggiornamento e non supporta il caso HR.

**Motivazione:** l'Opzione B è il punto di equilibrio ottimale: supporta entrambi i casi d'uso, protegge i token API lato server, mantiene una cronologia delle importazioni e permette di aggiungere nuovi backend senza modificare il frontend.

---

### ADR-001-B — Stack tecnologico

**Frontend**

| Tecnologia | Ruolo |
|---|---|
| React + Vite | SPA, PWA-ready |
| SheetJS | Parsing Excel client-side per preview pre-invio |
| TanStack Query (`@tanstack/react-query`) | Gestione stato asincrono e cache |
| MUI v7 + Mantis | Componenti UI e shell admin |

**Backend**

| Tecnologia | Ruolo |
|---|---|
| FastAPI (Python) | API REST, async, type-safe |
| Adapter pattern | Modulo isolato per ciascun backend esterno |
| SQLAlchemy | ORM |
| Alembic | Gestione migrazioni DB |

**Database**

Si utilizza **PostgreSQL** tramite il plugin Railway managed. La scelta di SQLite inizialmente prevista nell'ADR è stata superata in fase di provisioning: su Railway Pro il plugin Postgres non ha costi aggiuntivi significativi, gestisce backup automatici e non richiede la gestione di Railway Volumes per la persistenza del file. Le tabelle core sono: `users`, `user_tokens`, `imports`, `backend_configs`.

**Infrastruttura**

| Componente | Servizio |
|---|---|
| Hosting | Railway Pro — monorepo GitHub, 3 servizi: nginx, frontend, backend |
| Reverse proxy | Nginx (vedi ADR-001-E) |
| Database | PostgreSQL — Railway managed plugin |
| Ambienti | Due Railway Environments: `staging` (branch `development`) e `production` (branch `main`) |
| Deploy | Trigger automatico Railway su push al branch configurato per environment — nessuna GitHub Action coinvolta nel deploy. Il merge gate CI su `main` è descritto in ADR-002-H. |
| Secrets | Secret Variables Railway per environment — mai in chiaro nel repository |

---

### ADR-001-C — Adapter pattern per i backend esterni

**Decisione:** ogni backend esterno (Jira, Odoo, Linear, Asana) è implementato come un modulo separato che implementa un'interfaccia comune `TimesheetAdapter`.

```
interface TimesheetAdapter:
    submit(entries: TimesheetEntry[], config: AdapterConfig) → ImportResult
    validate(entries: TimesheetEntry[]) → ValidationResult
    getProjects() → Project[]
```

**Motivazione:** isola completamente il codice specifico di ciascun backend. Aggiungere un nuovo sistema significa aggiungere un file che implementa l'interfaccia, senza toccare il resto del sistema. Il pannello di controllo (accessibile agli admin) configura quale adapter è attivo per quale progetto e memorizza le credenziali cifrate per ciascuno.

**Normalizer:** prima degli adapter, un componente `Normalizer` mappare le colonne del file Excel al modello interno `TimesheetEntry[]`. Il mapping è configurabile dal pannello HR (drag & drop colonne) per adattarsi a variazioni future del template aziendale.

---

### ADR-001-D — Autenticazione: Google OAuth con vincolo di dominio

> ✅ Implementata in E3 (STORY-017…020) — 2026-06-28

**Decisione:** l'autenticazione avviene esclusivamente tramite Google OAuth 2.0, con constraint `hd` (hosted domain) che limita l'accesso alle sole email `@sixfeetup.it`.

**Motivazione:** l'intera azienda usa Google Workspace. Google OAuth elimina la gestione di password, reset, e storage di credenziali. Il vincolo sul dominio è applicato sia lato Google Cloud Console (parametro `hd` nella richiesta) sia lato backend (verifica del campo `hd` nell'`id_token` decodificato).

**Flusso:**

1. Il browser reindirizza a Google con `hd=sixfeetup.it`.
2. Google restituisce un `code` alla pagina di callback frontend `/auth/callback`, che lo inoltra al backend (`POST /api/auth/callback`).
3. Il backend scambia il `code` con `id_token` + `email`.
4. Il backend verifica che `hd == "sixfeetup.it"`, recupera o crea il record utente con il ruolo assegnato.
5. Il backend emette un JWT firmato contenente `email`, `role`, `exp` e lo imposta come cookie `httpOnly`.

---

### ADR-001-E — Topologia di rete: nginx come reverse proxy su unico dominio

> ✅ Implementata in E1 (STORY-004, STORY-006) — 2026-06-28

**Decisione:** nginx è deployato come terzo servizio Railway e serve entrambe le applicazioni sotto lo stesso dominio, separando il traffico per path:

```
6feetup-timesheet.up.railway.app/      → frontend React  (porta 3000)
6feetup-timesheet.up.railway.app/api/  → backend API     (porta 8000)
```

Solo nginx ha un custom domain pubblico configurato su Railway. Frontend e backend sono raggiungibili esclusivamente sulla rete privata Railway tramite hostname interni (`frontend.railway.internal`, `backend.railway.internal`).

**Motivazione:** questa topologia rende frontend e backend della stessa origin (`6feetup-timesheet.up.railway.app`), il che consente l'uso di cookie `SameSite=Strict` senza nessuna configurazione CORS. I servizi interni su Railway si raggiungono per hostname privato; solo nginx espone la porta pubblica. Railway gestisce TLS automaticamente sul custom domain.

**Configurazione nginx rilevante:**

```nginx
server {
    listen 80;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass         http://backend.railway.internal:8000/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass       http://frontend.railway.internal:3000;
        proxy_set_header Host $host;
    }
}
```

Lo slash finale in `proxy_pass http://backend.railway.internal:8000/` rimuove il prefisso `/api` prima di girare la richiesta, così il backend non ha bisogno di conoscere il prefisso esterno.

---

### ADR-001-F — Sessione: cookie httpOnly con SameSite=Strict

> ✅ Implementata in E3 (STORY-018, STORY-019) — 2026-06-28

**Decisione:** il JWT di sessione è trasmesso e conservato esclusivamente tramite cookie `httpOnly`. Non viene mai scritto in `localStorage` o `sessionStorage`.

```
Set-Cookie: session=<jwt>
  HttpOnly
  Secure
  SameSite=Strict
  Path=/
  Max-Age=28800     ← 8 ore, fine giornata lavorativa
```

**Alternative considerate:**

- *localStorage*: scartato. Accessibile da qualsiasi JavaScript in esecuzione sulla pagina, incluso codice iniettato via XSS o dipendenza npm compromessa.
- *sessionStorage*: scartato. Stessa vulnerabilità XSS di `localStorage`; la sola differenza è la durata dell'esposizione (solo tab corrente), non la natura del rischio.
- *JWT in memoria React*: accettabile per sicurezza, ma richiede ri-autenticazione ad ogni refresh di pagina — UX degradata per uno strumento interno senza benefici aggiuntivi rispetto al cookie.

**Motivazione:** il cookie `httpOnly` è invisibile a JavaScript, anche in caso di XSS. `SameSite=Strict` è possibile perché frontend e backend condividono la stessa origin (vedi ADR-001-E), rendendo superfluo un CSRF token separato.

---

### ADR-001-G — Autorizzazioni: RBAC con tre ruoli fissi

**Decisione:** si adottano tre ruoli fissi, verificati da un middleware/decorator su ogni endpoint protetto.

| Ruolo | Permessi |
|---|---|
| `employee` | Importa solo il proprio timesheet; vede solo i propri log |
| `hr` | Importa per qualsiasi dipendente; vede tutti i log di importazione |
| `admin` | Gestisce utenti e ruoli; configura i backend adapter; gestisce le credenziali di sistema |

Il ruolo è incluso nel JWT al momento del login e non richiede una query al DB per ogni richiesta. La modifica del ruolo di un utente invalida le sessioni attive al loro naturale scadere (8 ore).

**Motivazione:** tre condizionali espliciti (`if role == 'hr'`) sono più manutenibili di un permission engine generico per questo caso d'uso. Un sistema RBAC configurabile è over-engineering per tre ruoli stabili.

---

### ADR-001-H — Secrets management: due livelli separati

**Livello 1 — Secrets di sistema** (configurati dall'admin, invarianti a runtime):

| Secret | Descrizione |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID applicazione Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client secret Google OAuth |
| `JWT_SECRET` | Chiave di firma JWT, 256-bit random, rotazione ogni 90 giorni |
| `TOKEN_ENCRYPT_KEY` | Chiave AES-256 per cifrare i token per-utente nel DB |

Gestiti tramite **Infisical** (free tier) o variabili d'ambiente cifrate su Railway. Mai in chiaro nel repository.

**Livello 2 — Token per-utente** (Jira, Odoo, Linear, Asana):

Ogni dipendente inserisce i propri token API nel proprio profilo. Il backend li cifra con **AES-256-GCM** prima di scriverli in DB, usando un IV random per ogni record.

Schema tabella `user_tokens`:

| Campo | Tipo | Note |
|---|---|---|
| `user_id` | FK | riferimento a `users` |
| `service` | enum | `'jira'`, `'odoo'`, `'linear'`, `'asana'` |
| `token_enc` | bytes | token cifrato AES-256-GCM |
| `iv` | bytes | initialization vector, unico per record |
| `updated_at` | timestamp | |

A runtime, il token viene decifrato in memoria solo al momento della chiamata API esterna e immediatamente scartato. Non viene mai loggato. Un errore 401 dal servizio esterno genera una notifica all'utente per aggiornare il token.

---

## Conseguenze

**Positive:**
- Costo infrastrutturale contenuto (~10-15 €/mese su Railway Pro).
- Nessun costo di dominio aggiuntivo se `sixfeetup.it` è già il dominio aziendale.
- Aggiungere un nuovo backend richiede solo un nuovo file adapter.
- Sicurezza delle sessioni equivalente alle best practice web moderne.
- Nessuna gestione di password utente.
- PostgreSQL managed su Railway: backup automatici, nessuna gestione di volumi o filesystem effimero.
- Due environment (staging/production) isolati con deploy automatico da branch — nessuna pipeline CI/CD da mantenere.

**Trade-off accettati:**
- Tre servizi Railway invece di due (nginx aggiunge una piccola latenza di proxy, trascurabile per uso interno).
- La chiave `TOKEN_ENCRYPT_KEY` è condivisa a livello di sistema: se compromessa, tutti i token utente sono a rischio. Accettabile per uso interno; una chiave per-utente richiederebbe un key management più complesso.
- I ruoli nel JWT scadono solo naturalmente (8 ore): una modifica di ruolo non è istantanea.

---

## Decisioni aperte

- Schema SQL completo delle tabelle core.
- Flusso dettagliato di importazione Excel (upload → preview → mapping → submit → log).
- Gestione degli errori parziali (alcune righe importate, altre fallite).
- Strategia di notifica in caso di token scaduti o errori di importazione.

---

## Appendice E4 — Decisioni shell & tema (STORY-025/026)

> Implementato in E4 (STORY-025…029) — 2026-06-29

Le seguenti decisioni di E4 non sono ovvie dalla sola lettura del codice.

**1. Palette `sidebar` via module augmentation TypeScript**

MUI v7 non espone una namespace `sidebar` nella palette. Piuttosto che hardcodare valori hex nel componente shell, la palette è estesa con `declare module '@mui/material/styles'` in `frontend/src/theme/index.ts`. Questo rende `theme.palette.sidebar.background` type-safe e accessibile in tutti i componenti tramite il tema, con un unico punto di modifica.

**2. Dark mode esclusa esplicitamente**

`mode: 'light'` è impostato in modo fisso nel tema. Non è stato aggiunto nessun toggle né `PaletteMode`. La dark mode aumenterebbe la complessità del tema (colori semantici, sidebar, superfici) senza beneficio per uno strumento interno desktop-only usato in orario lavorativo. La decisione è reversibile in una versione futura aggiungendo un secondo oggetto tema.

**3. SVG icons inline — nessuna libreria di icone**

La shell usa 5 icone (import, log, profilo, admin, logout). Invece di aggiungere `@mui/icons-material` (~6 MB) o `lucide-react` come dipendenza, i path SVG sono embedded come costanti stringa in `AppShell.tsx`. Per un set fisso e piccolo è la soluzione con il minor overhead di build e bundle.

**4. CSS Grid per il layout shell — nessun Drawer MUI**

Il layout `AppShell` usa CSS Grid (`gridTemplateRows: '60px 1fr'`, `gridTemplateColumns: '244px 1fr'`) anziché il componente `Drawer` di MUI o il pattern classico Mantis con `Drawer` permanente. La shell è desktop-only (nessun breakpoint mobile, nessun `useMediaQuery`), quindi la sidebar non ha mai bisogno di collassarsi. CSS Grid in questo contesto è più prevedibile e meno codice rispetto a un Drawer configurato come permanente.