# Timesheet Hub — Sorgenti di importazione via API (Clockify)

| Campo | Valore |
|---|---|
| Versione | 0.1 |
| Data | 2026-09-21 |
| Stato | Accettato |
| Riferimenti | ADR-008 · ADR-005 · ADR-006 · ADR-007 · 007-multi-connector-row-mapping.md |

---

## 1. Scopo

Questo documento è la spec tecnica gemella di `ADR-008`: mentre l'ADR motiva le scelte architetturali, qui sono descritti i contratti esatti — richieste, risposte, codici di errore, schema di configurazione e mapping dei campi — del layer sorgenti introdotto da E13, con Clockify come prima implementazione.

Non copre l'interfaccia utente del wizard (Step 0 "scegli sorgente", pulsante "Scarica da Clockify"): quella parte è demandata alle guide utente, da scrivere a frontend pronto.

---

## 2. Contratto di `GET /api/connector-types`

Espone il catalogo `CONNECTOR_TYPES` (`backend/app/connector_types.py`) a qualunque ruolo autenticato (`employee`/`hr`/`admin`). Nessun parametro.

```
GET /api/connector-types
→ 200 [ConnectorTypeOut]
```

```ts
interface ConfigFieldOut {
  key: string
  label: string
  type: "string" | "url"
  required: boolean
  help: string | null
}

interface ConnectorTypeOut {
  service: string                  // "odoo" | "jira" | "linear" | "asana" | "clockify"
  label: string
  is_source: boolean
  is_destination: boolean
  available: boolean                // false = selezionabile in enum ma non implementato
  secret_label: string
  secret_help: string | null
  requires_base_url: boolean
  requires_account_identifier: boolean
  account_identifier_label: string
  config_fields: ConfigFieldOut[]
}
```

Stato dichiarato oggi per ciascuno dei 5 tipi:

| `service` | `is_source` | `is_destination` | `available` | `requires_base_url` | `requires_account_identifier` | `config_fields` |
|---|---|---|---|---|---|---|
| `odoo` | `false` | `true` | `true` | `true` | `true` (label: "Utente") | `db_name` (required) |
| `jira` | `false` | `true` | `true` | `true` | `true` (label: "Email") | — |
| `clockify` | `true` | `false` | `true` | `false` | `false` | — |
| `linear` | `false` | `true` | `false` | `false` | `false` | — |
| `asana` | `false` | `true` | `false` | `false` | `false` | — |

`linear` e `asana` esistono nell'enum del database e nel catalogo (per coerenza — sono già previsti dalla roadmap, E11) ma `available: false`: la UI li mostra ma non ne consente la creazione, e `PUT /api/me/connectors/{label}` rifiuta la creazione di un connettore su un servizio non disponibile con `422` (vedi §4).

---

## 3. Contratto di `POST /api/me/sources/{label}/fetch`

Router: `backend/app/routers/sources.py`. Protetto da `require_role([employee, hr, admin])` — nessuna restrizione di ruolo oltre l'autenticazione, la sorgente è sempre quella dell'utente in sessione.

### Request

```
POST /api/me/sources/{label}/fetch
Content-Type: application/json

{ "start": "2026-06-01", "end": "2026-06-30" }
```

`start`/`end` sono `date` Pydantic in formato `YYYY-MM-DD`. `label` è l'etichetta del connettore dell'utente (stesso spazio dei nomi di `/api/me/connectors`), non il nome del servizio.

### Response (200)

```json
{
  "rows": [
    { "date": "2026-06-01", "project": "Alfa", "task": "Sviluppo", "hours": 7.5, "notes": "refactor" },
    { "date": "2026-06-02", "project": "Beta", "task": "Design", "hours": 2.0, "notes": null }
  ]
}
```

Nessuna persistenza: la risposta è materiale di preview per il wizard (`ADR-008-C`). `hours` è un `float` con arrotondamento a 2 decimali già applicato dalla sorgente (§5).

### Codici di errore

| Codice | Condizione | Body (`detail`) |
|---|---|---|
| `401` | Nessuna sessione valida | — (gestito dal middleware auth comune) |
| `404` | `label` inesistente **o appartenente a un altro utente** | `"Connettore non trovato"` — **stesso messaggio e stesso codice nei due casi**: la risposta non deve rivelare se esiste un connettore con quella label per un altro utente |
| `409` | La sorgente solleva `AdapterAuthError` (credenziali scadute/errate) | `{"code": "needs_reauth", "message": "..."}` |
| `502` | La sorgente solleva `AdapterConnectionError` o un `AdapterError` generico (non-auth) | `{"code": "backend_unavailable", "message": "..."}` |
| `422` | Periodo invertito (`start > end`) | `"La data di inizio deve precedere la data di fine"` |
| `422` | Periodo più ampio di 366 giorni | `"Il periodo non può superare 366 giorni"` |
| `422` | Il servizio del connettore non è registrato come sorgente (es. un connettore Odoo) | `"Il servizio '<service>' non è una sorgente di importazione"` |
| `422` | `start`/`end` non nel formato `YYYY-MM-DD` | corpo di validazione standard FastAPI/Pydantic (non il messaggio applicativo sopra: il parsing del body fallisce prima di raggiungere l'handler) |

Le tre condizioni di `422` applicative (periodo invertito, periodo troppo ampio, servizio non-sorgente) sono verificate **prima** di interrogare la sorgente: nei primi due casi la sorgente non viene nemmeno istanziata. Il limite di 366 giorni è una misura di sicurezza operativa, non una regola di dominio: una richiesta su anni interi farebbe paginare la sorgente per minuti, occupando a lungo un thread del pool (vedi §7).

Gli errori applicativi della sorgente sono loggati (`logger.warning`) con `service`, `label` e il **nome della classe** dell'eccezione — mai il messaggio grezzo che potrebbe (in teoria) contenere dettagli del backend remoto, e mai il segreto, che non transita mai per il logger.

---

## 4. Contratto modificato di `/api/me/connectors`

Il body di `PUT /api/me/connectors/{label}` (`backend/app/routers/connectors.py`) sostituisce il vecchio campo Odoo-specifico `db_name` con `config: dict | null`, generico per tutti i servizi:

```ts
interface ConnectorUpsertRequest {
  service?: "odoo" | "jira" | "linear" | "asana" | "clockify"  // obbligatorio in creazione
  account_identifier?: string
  base_url?: string
  secret?: string           // obbligatorio in creazione, max 4096 char
  config?: Record<string, string>
}
```

Regole:

- **Sostituzione, non merge**. Se `config` è presente nel body (`"config" in body.model_fields_set`), il valore fornito **sostituisce interamente** `user_tokens.config`; non viene fatto merge con il config precedente. Un merge renderebbe impossibile svuotare un campo opzionale già valorizzato di un futuro tipo di connettore — la UI deve quindi inviare sempre il config completo, non un delta.
- **Validazione contro il catalogo**, sempre eseguita da `validate_config(service, config)` (`app/connector_types.py`), sia in creazione sia in aggiornamento:
  - una chiave non prevista per quel `service` → `422` ("Campi non previsti per il servizio '...': ...");
  - un campo `required` assente o vuoto (dopo `trim`) → `422` ("Il campo '...' è obbligatorio per '...'");
  - un valore non scalare (es. un oggetto annidato) → `422` ("Il campo '...' deve essere una stringa");
  - valori numerici/float vengono **coercizzati a stringa**;
  - una stringa vuota per un campo opzionale viene **scartata** (non salvata come `""`), per non rendere ambiguo "non configurato" rispetto a "configurato con stringa vuota";
  - `config: null` o assente equivale a `{}`: accettato se il servizio non ha campi obbligatori, rifiutato altrimenti.
- **Creazione su servizio non disponibile**: se `get_spec(service).available` è `false` (oggi `linear`, `asana`), la creazione è rifiutata con `422` — evita di creare un connettore che fallirebbe al primo utilizzo, prima ancora di validare `config`.
- `service` resta **non aggiornabile** dopo la creazione, come da `ADR-005-C`; questo non cambia con E13.
- La risposta (`ConnectorOut`) espone `config: dict` (mai vuoto in output: `token.config or {}`), accanto ai campi già noti (`label`, `service`, `base_url`, `account_identifier`, `configured`, `needs_reauth`, `updated_at`). Il segreto resta assente da ogni risposta, invariato rispetto ad `ADR-005-C`.

---

## 5. Schema `config` di Clockify

Nessuno. `config_fields` di Clockify è la tupla vuota: l'API key personale basta da sola a identificare account e workspace, non c'è alcun campo aggiuntivo da configurare. `ClockifyClient.fetch_entries(start_iso, end_iso)` è chiamato senza `workspace_id`, e la libreria usa sempre il workspace di default dell'account associato all'API key.

---

## 6. Mapping dei campi Clockify → `SourceRow`

`ClockifySource.fetch_entries` (`backend/app/sources/clockify.py`):

1. Valida `start`/`end` con `clockify_timesheet.utils.validate_dates`, che li converte nel range ISO richiesto dall'API Clockify (`2026-06-01T00:00:00.000Z` → `2026-06-30T23:59:59.999Z`). Questa validazione è una **rete di sicurezza**: il router valida già formato e ordine delle date prima di arrivare qui (§3); un `ValueError` a questo punto è imprevisto e viene comunque tradotto in `AdapterError`.
2. Chiama `client.fetch_entries(start_iso, end_iso)` (workspace di default dell'account associato all'API key), che internamente pagina il report dettagliato di Clockify (`PAGE_SIZE = 1000` righe per pagina) finché una pagina restituisce meno del massimo.
3. Passa le voci grezze a `group_entries_flat(entries)`, funzione della libreria che:
   - **aggrega** per la quadrupla `(date, project, task, note)`, sommando le durate in secondi delle voci che condividono tutti e quattro i valori — due segmenti di lavoro sullo stesso progetto/task/nota nello stesso giorno diventano un'unica riga;
   - restituisce già `date` in formato `YYYY-MM-DD` (conversione dalla timestamp ISO originale di Clockify);
   - sostituisce con i placeholder della libreria `"— No project —"` / `"— No task —"` le voci Clockify prive di progetto o task assegnato — non è un comportamento di `ClockifySource`, ma della libreria a monte;
   - restituisce `notes` come stringa vuota `""` quando la voce non ha descrizione (non `None`).
4. `ClockifySource` converte ogni riga aggregata in un `SourceRow`:
   - `hours = round(seconds / 3600, 2)` — arrotondamento a 2 decimali applicato **qui**, non dalla libreria (che lavora in secondi);
   - `notes = row["notes"] or None` — la stringa vuota di `group_entries_flat` diventa `None`, coerente con la convenzione delle altre righe del wizard (nota assente ⇒ `None`, non stringa vuota).

Esempio: due segmenti da 3600s e 1800s nello stesso giorno, stesso progetto/task/nota → una riga con `hours: 1.5`. Un segmento da 100s isolato → `hours: 0.03` (100/3600 = 0.02777... → arrotondato a 0.03).

---

## 7. Contratto d'errore atteso dalla libreria

`ClockifySource._map_error()` (`backend/app/sources/clockify.py`) è **l'unico punto del progetto** che conosce la gerarchia di eccezioni di `clockify-timesheet`. Se la superficie della libreria cambia, si tocca solo questo metodo.

| Eccezione della libreria | Quando (lato libreria) | Eccezione applicativa risultante |
|---|---|---|
| `ClockifyAuthError` | HTTP 401/403 dalla API Clockify | `AdapterAuthError` |
| `ClockifyConnectionError` | Timeout di rete, connessione rifiutata, o HTTP ≥ 500 da Clockify | `AdapterConnectionError` |
| `ClockifyError` (base, non più specifica) | Qualsiasi altro errore HTTP applicativo (es. 4xx diverso da 401/403) | `AdapterError` |
| Qualunque altra `Exception` | Errore imprevisto (bug nella libreria, cambiamento di contratto non ancora mappato) | `AdapterError("Errore imprevisto da Clockify: ...")` — non silenziato, ma nemmeno propagato come tipo sconosciuto |

Questa tabella vale sia per `validate()` sia per `fetch_entries()`: entrambi delegano a `_map_error` nello stesso modo. Il router traduce poi `AdapterAuthError → 409 needs_reauth` e qualunque altro `AdapterError` (incluso `AdapterConnectionError`) `→ 502 backend_unavailable`, riusando `app.routers.adapters._map_adapter_error` (§3, `ADR-008-A`).

Il messaggio d'errore propagato non contiene mai il segreto: `ClockifyClient` non lo include nei propri messaggi di eccezione (riporta solo status HTTP e causa di trasporto), e nessun punto del codice applicativo concatena `config.secret` a un messaggio di log o di eccezione.

---

## 8. Nota operativa sui timeout

`ClockifyClient` applica, per ogni chiamata HTTP verso l'API Clockify, un timeout di default:

- **connect**: 5 secondi
- **read**: 30 secondi

sovrascrivibili tramite le variabili d'ambiente `CLOCKIFY_CONNECT_TIMEOUT` e `CLOCKIFY_READ_TIMEOUT` (secondi, valori numerici; un valore non numerico fa fallire l'inizializzazione del client). Oggi Timesheet Hub non imposta queste variabili: vale il default 5s/30s.

**Perché conta**: `POST /api/me/sources/{label}/fetch` è un handler **sincrono** FastAPI (`def`, non `async def`), quindi gira nel threadpool di default di FastAPI/Starlette, non nell'event loop. Una sorgente che non risponde entro il timeout occupa un thread del pool per tutta la sua durata (fino a 30s per il solo read timeout, di più se la libreria pagina più richieste in sequenza su un periodo ampio — da cui anche il limite di 366 giorni imposto dal router, §3). Un numero sufficiente di richieste lente in parallelo può esaurire il pool e mettere in coda richieste indipendenti. Non è un problema nuovo introdotto da Clockify — `OdooAdapter` e `JiraAdapter` hanno la stessa natura sincrona (`ADR-007` nota lo stesso trade-off per Odoo) — ma vale la pena tenerlo esplicito qui perché è la prima sorgente, e le sorgenti (a differenza delle destinazioni, invocate da un background task del submit) sono chiamate **nel thread della request** del wizard.

---

## 9. Procedura di aggiornamento della libreria

`clockify-timesheet` è pubblicata su PyPI (`gborelli/clockify-timesheet`) ed è una dipendenza ordinaria di `backend/pyproject.toml` (§`ADR-008-E`, `Superseded` — il vendoring del wheel descritto in versioni precedenti di questo documento non è più necessario dal 2026-09-24). Per aggiornarla:

1. Bump del vincolo di versione in `dependencies` (`backend/pyproject.toml`), es. `"clockify-timesheet>=0.5.1"`.
2. `cd backend && uv lock`.

Da committare al termine: `backend/pyproject.toml`, `backend/uv.lock`. Nessun altro file cambia: il codice applicativo (`app/sources/clockify.py`) dipende solo dai simboli pubblici della libreria (`ClockifyClient`, `group_entries_flat`, le tre eccezioni, `validate_dates`), non dal suo numero di versione — vale comunque la pena eseguire i test di `tests/unit/test_clockify_source.py` e `tests/integration/test_sources_fetch.py` dopo un aggiornamento di versione minore/major, per intercettare eventuali cambi nella superficie pubblica.

---

## 10. Riferimenti

- `ADR-008` — decisioni architetturali (interfaccia, registry, `SourceRow`, catalogo config, dipendenza `clockify-timesheet` da PyPI, stub E2E)
- `ADR-005` — cifratura dei segreti; `user_tokens.config` resta in chiaro per progetto
- `ADR-006` — invariante preview-prima-del-submit, preservato identico per le sorgenti API
- `ADR-007` — layer adapter (destinazioni); mapping errore→HTTP condiviso
- `007-multi-connector-row-mapping.md` — cosa succede alle righe di preview dopo il fetch, indipendentemente dalla loro provenienza
