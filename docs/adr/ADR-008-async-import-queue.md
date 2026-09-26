# ADR-008 — Import asincrono con asyncio.Queue

- **Stato**: Accettato
- **Data**: 2026-07-03
- **Contesto**: E8a (Wizard importazione Employee — refactoring sincrono → asincrono)

---

## Problema

L'endpoint `POST /api/me/imports` era originariamente sincrono: attendeva il completamento di tutte le chiamate agli adapter prima di restituire la risposta HTTP. Con batch di dimensioni realistiche (100 righe × 3 connettori) e adapter intrinsecamente lenti (XML-RPC Odoo, REST Jira), il tempo di risposta supera facilmente i 60 secondi — il `proxy_read_timeout` configurato in nginx (ADR-001-E). Il timeout nginx causa un errore 504 al client anche se il backend sta ancora lavorando correttamente.

Requisiti da soddisfare:

- Il client non deve attendere il completamento dell'elaborazione per ricevere una risposta HTTP.
- L'utente deve poter monitorare il progresso in tempo reale.
- La soluzione non deve aggiungere nuovi servizi Railway (vincolo di costo e complessità operativa).
- Gli adapter sincroni (XML-RPC Odoo, REST Jira) non devono bloccare l'event loop FastAPI.

---

## Decisioni

### ADR-008-A — asyncio.Queue in-process con worker coroutine

**Decisione**: si adotta una coda in-process (`asyncio.Queue`) con N worker coroutine avviati al boot dell'applicazione FastAPI (`lifespan`). L'endpoint `POST /api/me/imports` accoda il job e risponde immediatamente con `{import_id}` e `status=in_progress`.

**Flusso:**

```
POST /api/me/imports
  → crea record imports con status='in_progress'
  → accoda job in asyncio.Queue
  → risponde {import_id} (< 1 s)

Worker coroutine (N paralleli, N = IMPORT_WORKERS):
  → dequeue job
  → asyncio.gather(*[asyncio.to_thread(adapter.submit, ...) for connector])
  → aggiorna record imports a success/partial/failed
  → aggiorna import_rows con i risultati per riga

GET /api/me/imports/{id}   ← polling dal frontend
  → restituisce status corrente + righe (se completato)
```

**Parametro di configurazione:**

| Variabile d'ambiente | Tipo | Default | Descrizione |
|---|---|---|---|
| `IMPORT_WORKERS` | `int` | `3` | Numero di worker asyncio; tuning senza deploy di codice |

---

### ADR-008-B — asyncio.to_thread per adapter sincroni

**Decisione**: le chiamate agli adapter sincroni (`adapter.submit`, `adapter.get_projects`, `adapter.get_tasks`) vengono eseguite con `asyncio.to_thread()`. Questo delega l'esecuzione al thread pool di default di Python senza bloccare l'event loop FastAPI.

All'interno dello stesso job, le chiamate a connettori distinti vengono lanciate in parallelo tramite `asyncio.gather`, riducendo il tempo totale al connettore più lento anziché alla somma dei tempi.

---

### ADR-008-C — Stato `in_progress` nell'enum PostgreSQL

**Decisione**: `import_status_enum` viene esteso con il valore `'in_progress'` tramite migrazione Alembic. Tutti i consumer dell'enum (query, filtri, UI) devono gestire questo stato.

| Valore | Significato |
|---|---|
| `in_progress` | Elaborazione avviata, non ancora completata |
| `success` | Tutte le righe importate con successo |
| `partial` | Almeno una riga fallita, almeno una riuscita |
| `failed` | Tutte le righe fallite |

---

### ADR-008-D — Polling HTTP dal frontend

**Decisione**: il frontend usa polling periodico su `GET /api/me/imports/{id}` per monitorare lo stato. Il wizard mostra un indicatore di avanzamento finché `status != 'in_progress'`.

Il polling è implementato tramite TanStack Query con `refetchInterval` condizionale: attivo solo mentre `status === 'in_progress'`, disattivato automaticamente al completamento.

---

## Alternative considerate

**1. Celery + Redis**

Coda di task distribuita con broker Redis. Scartata: aggiunge 2 servizi Railway (Celery worker + Redis), aumenta il costo operativo e la complessità di deploy. Per un tool interno a basso volume (importazione mensile per dipendente) l'overhead non è giustificato.

**2. SSE (Server-Sent Events) o WebSocket**

Permetterebbero al server di notificare il client al completamento senza polling. Scartati: Railway e nginx richiedono configurazione keepalive specifica per connessioni long-lived; il pattern è più complesso da gestire lato TanStack Query; overkill per MVP con frequenza d'uso mensile.

**3. Import sincrono con timeout nginx allungato**

Aumentare `proxy_read_timeout` a 300s. Scartato: non scala con batch grandi o N connettori, degrada la UX (spinner bloccante senza feedback), non risolve il problema strutturalmente.

**4. procrastinate (PostgreSQL come job queue)**

Libreria Python che usa PostgreSQL come broker di job, con retry automatico e durabilità cross-restart. Valutata ma rinviata: più robusta dell'approccio in-process ma introduce una dipendenza aggiuntiva e richiede tabelle dedicate. Da rivalutare se emerge la necessità di retry automatico o di durabilità dei job attraverso i restart del processo.

---

## Conseguenze

**Positive:**

- Nessun nuovo servizio Railway: la soluzione usa solo risorse già presenti (FastAPI event loop, PostgreSQL).
- Il `POST /api/me/imports` risponde in < 1 s indipendentemente dalla dimensione del batch.
- `IMPORT_WORKERS` consente di bilanciare throughput e carico sul DB senza deploy di codice.
- I connettori per lo stesso job vengono chiamati in parallelo: il tempo di elaborazione scala con il connettore più lento, non con la somma.
- `proxy_read_timeout nginx` (60 s) non è più un vincolo per l'endpoint import.

**Negative / trade-off accettati:**

- Job in-progress persi se il processo FastAPI viene riavviato. Mitigazione pianificata: al boot, record con `status='in_progress'` creati più di 10 minuti prima vengono marcati `'failed'` (da implementare in follow-up).
- `import_status_enum` esteso con `'in_progress'`: tutti i consumer (query, filtri, label UI) devono gestire questo stato esplicitamente.
- La concorrenza è limitata a N worker: job in eccesso restano in coda. Con IMPORT_WORKERS=3 e frequenza d'uso mensile il rischio di accodamento è trascurabile.
- Il polling introduce N richieste HTTP aggiuntive per importazione. Con intervallo di 2 s e durata media < 30 s il carico è trascurabile.

---

## Riferimenti

- `ADR-001-E` — Configurazione nginx, `proxy_read_timeout`
- `ADR-007` — Interfaccia `TimesheetAdapter`; adapter sincroni (Odoo XML-RPC, Jira REST)
- `docs/specs/001-functional-spec.md` — Modello dati `imports`, endpoint, stati
