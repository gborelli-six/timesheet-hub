# ADR-008 — Sorgenti di importazione via API (Clockify)

- **Stato**: Accettato
- **Data**: 2026-09-21
- **Contesto**: E13 (Sorgenti di importazione via API — Clockify)

---

## Problema

Fino a E12, le voci timesheet entrano in Timesheet Hub in un solo modo: upload di un file Excel, parsing client-side (`ADR-006`), preview, assegnazione multi-connettore (`007-multi-connector-row-mapping.md`), submit verso un `TimesheetAdapter` (`ADR-007`).

E13 introduce una seconda via di ingresso: scaricare le voci direttamente da un backend esterno via API — Clockify in questa epica, altri in futuro — invece di passare da un file. Requisiti:

- Il download deve restare **per-utente**, con credenziali proprie, sullo stesso modello di sicurezza dei connettori esistenti (`ADR-005`).
- Ogni tipo di sorgente può richiedere una configurazione propria (es. un workspace ID per una futura sorgente Toggl/Harvest) che non ha senso generalizzare a colonne condivise sulla tabella `user_tokens`.
- Il risultato deve alimentare la **stessa preview** del wizard usata per l'Excel: l'utente approva sempre prima che qualcosa venga scritto su una destinazione (invariante fissata da `ADR-006`).
- Deve restare possibile testare il flusso in E2E senza un account Clockify reale (`ADR-003`).

---

## Decisioni

### ADR-008-A — Secondo ABC `TimesheetSource`, non un'estensione di `TimesheetAdapter`

**Decisione**: le sorgenti implementano una nuova interfaccia `TimesheetSource(ABC)` (`backend/app/sources/base.py`), distinta da `TimesheetAdapter` (`backend/app/adapters/base.py`).

`TimesheetAdapter` descrive una **destinazione**: dove le ore vengono scritte (Odoo, Jira). I suoi quattro metodi — `validate`, `submit`, `get_projects`, `get_tasks` — non contengono nulla che esprima "scarica le voci di un periodo". Clockify, al contrario, non riceve mai ore: è una **sorgente** da cui leggerle. I due ruoli (sorgente/destinazione) sono ortogonali, non un caso particolare l'uno dell'altro: un servizio può essere l'uno, l'altro, o — in astratto — entrambi (`ADR-008-D`).

`TimesheetSource` espone due soli metodi:

| Metodo | Firma | Responsabilità |
|---|---|---|
| `validate` | `(config: SourceConfig) → ValidationResult` | Verifica raggiungibilità e credenziali della sorgente |
| `fetch_entries` | `(start: str, end: str, config: SourceConfig) → list[SourceRow]` | Scarica le voci del periodo `[start, end]` (date `YYYY-MM-DD`) |

I due ABC **condividono deliberatamente** (import diretto da `app.adapters.base`, ri-esportati da `app.sources.base`):
- `ServiceType` — vocabolario unico dei servizi, comune a sorgenti e destinazioni;
- la gerarchia `AdapterError` / `AdapterAuthError` / `AdapterConnectionError`;
- `ValidationResult`;
- e di conseguenza il mapping errore→HTTP già scritto per gli adapter, `app.routers.adapters._map_adapter_error`, riusato tale e quale dal router delle sorgenti (`app/routers/sources.py`).

**Alternative considerate**:
- *Aggiungere `fetch_entries` a `TimesheetAdapter`*: avrebbe costretto ogni destinazione (Odoo, Jira, e in futuro Linear/Asana) a implementare un metodo di lettura che per una destinazione pura non ha alcun senso — un metodo astratto obbligatorio senza una responsabilità reale da assolvere. Scartata.
- *Un adapter "bidirezionale" unico con metodi opzionali (default `NotImplementedError`)*: eviterebbe un secondo ABC, ma sposta a runtime — al primo utilizzo — un errore di progettazione che un ABC dedicato coglie a import-time (lo stesso argomento di `ADR-007-A` contro il duck-typing). Scartata.

**Motivazione**: due interfacce piccole e a responsabilità singola sono più semplici da implementare correttamente di una grande con metodi condizionali. Condividere eccezioni e `ValidationResult` evita di duplicare il layer di traduzione errore→HTTP mantenendo comunque la separazione concettuale sorgente/destinazione.

### ADR-008-B — Registry gemello `source_registry`

**Decisione**: `SourceRegistry` (`backend/app/sources/registry.py`) è la copia strutturale di `AdapterRegistry` (`ADR-007-B`): un dizionario `ServiceType → type[TimesheetSource]`, singleton di modulo (`source_registry`), stesse regole:

- `register()` rifiuta qualunque classe che non sia sottoclasse di `TimesheetSource` (`TypeError`);
- `register()` sovrascrive silenziosamente una registrazione esistente — comportamento sfruttato da `StubSource` in modalità E2E (`ADR-008-E`);
- `get()` solleva `KeyError` se il servizio non è registrato come sorgente; il router lo traduce in `422` (vedi `008-clockify-source.md`).

**Alternative considerate**: le stesse di `ADR-007-B` (factory con `if/elif`, registry in config YAML), scartate per lo stesso motivo — nessun beneficio proporzionato alla complessità per un numero di sorgenti noto e limitato.

**Motivazione**: mantenere la stessa forma di `AdapterRegistry` rende il layer sorgenti immediatamente comprensibile a chi già conosce quello adapter, e riusa lo stesso meccanismo di override per gli stub E2E.

### ADR-008-C — `SourceRow` ha la stessa forma di una riga Excel normalizzata

**Decisione**: `SourceRow` (`date`, `project`, `task`, `hours`, `notes`) rispecchia deliberatamente la granularità di una riga del foglio Excel dopo il parsing client-side (`ADR-006`). Il router `POST /api/me/sources/{label}/fetch` restituisce queste righe **senza persistere nulla**: sono materiale di preview, esattamente come le righe uscite dal Normalizer Excel.

Questo preserva intatto l'invariante funzionale di `ADR-006` — la preview avviene sempre *prima* che i dati raggiungano una destinazione, e l'utente approva esplicitamente cosa viene scritto e dove. Cambia solo la provenienza delle righe (upload di file vs. chiamata API), non il punto in cui l'utente le rivede: tutto ciò che sta a valle nel wizard — suggerimenti da storico (`connector_row_mappings`, `007-multi-connector-row-mapping.md`), assegnazione multi-connettore per riga, submit verso gli adapter — resta invariato e non ha bisogno di sapere se una riga viene da un file o da Clockify.

**Alternative considerate**:
- *Un DTO specifico Clockify, mappato al formato Excel altrove nel wizard*: avrebbe spostato la responsabilità di conversione lato frontend o in un layer intermedio, duplicando una trasformazione che la sorgente stessa può fare una volta sola. Scartata.

**Motivazione**: un solo formato di riga "pronta per la preview" mantiene il wizard agnostico rispetto alla sorgente dei dati.

### ADR-008-D — Configurazione per tipo in JSONB `user_tokens.config` + catalogo `app/connector_types.py`

**Decisione**: la colonna Odoo-specifica `db_name` (aggiunta in `0006`) viene sostituita da una colonna JSONB generica `user_tokens.config` (migrazione `0010_add_config_to_user_tokens.py`), il cui schema per tipo di servizio è dichiarato in un catalogo applicativo unico: `backend/app/connector_types.py`.

Il catalogo (`CONNECTOR_TYPES: dict[ServiceType, ConnectorTypeSpec]`) dichiara per ogni servizio:

| Campo | Significato |
|---|---|
| `is_source` / `is_destination` | ruolo del servizio — un servizio può essere l'uno, l'altro, o (in astratto) entrambi |
| `available` | `False` per i tipi previsti dall'enum ma senza implementazione (`linear`, `asana`): selezionabili in futuro, ma non oggi — evita di far creare un connettore che fallirebbe al primo utilizzo |
| `secret_label` / `secret_help` | etichetta e aiuto per il campo segreto, specifici del servizio |
| `requires_base_url` / `requires_account_identifier` | quali campi comuni di `user_tokens` il servizio richiede |
| `config_fields: tuple[ConfigField, ...]` | i campi specifici del tipo (es. `db_name` per Odoo), ciascuno con `key`, `label`, `type`, `required`, `help` — Clockify non ne ha: l'API key basta da sola |

`GET /api/connector-types` (`backend/app/routers/connector_types.py`) espone il catalogo al frontend, che ne deriva il form di configurazione dinamico invece di duplicare i campi lato client (com'era per `db_name`). `validate_config()` normalizza e valida il `config` fornito contro lo schema del servizio al momento del salvataggio (`PUT /api/me/connectors/{label}`), così un errore di configurazione emerge subito e non al primo import.

**Nota di sicurezza**: `config` contiene **esclusivamente dati non sensibili**. I segreti restano in `secret_enc`, cifrati AES-256-GCM come da `ADR-005`; questa distinzione non cambia con E13, la estende soltanto a un nuovo tipo di servizio. Vedi la nota aggiunta in `ADR-005-A`.

**Alternative considerate**:
- *Una nuova colonna nullable per ogni campo specifico (come `db_name`)*: avrebbe sporcato lo schema di `user_tokens` a ogni nuova integrazione (una colonna quasi sempre `NULL` per tutti i servizi tranne uno). Scartata esplicitamente da questa epica.
- *Tabelle di configurazione separate per tipo di servizio*: normalizzazione più "corretta" ma complessità sproporzionata per pochi campi opzionali per servizio, e un `JOIN` in più su ogni lettura di connettore. Scartata.

**Motivazione**: un'unica colonna JSONB, validata applicativamente contro un catalogo dichiarativo, scala a un numero arbitrario di tipi di connettore senza toccare lo schema del database a ogni nuova integrazione — lo stesso principio di estensibilità "un file nuovo, zero modifiche al core" di `ADR-007-B`, applicato al modello dati.

### ADR-008-E — Dipendenza `clockify-timesheet` da PyPI (già `Superseded`)

**Stato**: `Superseded` — il 2026-09-24 la libreria è stata pubblicata su PyPI (`gborelli/clockify-timesheet`, repository ora pubblico). La sezione originale, riportata sotto per memoria storica, descriveva il vendoring del wheel reso necessario dal repository privato `gborelli/timesheet`; quel vincolo non esiste più.

**Decisione attuale**: `clockify-timesheet` è una dipendenza ordinaria in `backend/pyproject.toml`, risolta da PyPI come qualsiasi altro pacchetto:

```toml
dependencies = [
    ...
    "clockify-timesheet>=0.5.1",
]
```

Nessun `[tool.uv.sources]`, nessuna directory `backend/vendor/`, nessun target `make vendor-clockify`. L'aggiornamento è il flusso standard: bump del vincolo di versione in `pyproject.toml` + `uv lock` in `backend/`. Il `Dockerfile` non copia più `vendor/`: `uv sync` risolve la dipendenza da PyPI in ogni ambiente (locale, CI, Railway) allo stesso modo.

**Decisione originale (2026, pre-pubblicazione su PyPI)**: `ClockifySource` (`backend/app/sources/clockify.py`) era costruita sulla libreria `clockify-timesheet`, che viveva in un repository privato (`gborelli/timesheet`). Invece di dichiararla come dipendenza `git+https://...` in `pyproject.toml`, il progetto vendorizzava il wheel compilato in `backend/vendor/` e lo referenziava via `[tool.uv.sources]`, perché una dipendenza `git+https://` avrebbe richiesto credenziali valide in tre ambienti di build distinti (locale, CI, Railway), e sia gli asset di una release GitHub sia gli artifact di GitHub Actions erano ugualmente *auth-gated* su un repo privato (questi ultimi, in più, con scadenza di default a 90 giorni). Il vendoring evitava ogni credenziale a build-time, al prezzo di un binario `.whl` committato in Git e di una risincronizzazione manuale via `make vendor-clockify`, tracciata in `backend/vendor/CLOCKIFY_REF`.

**Motivazione del superamento**: con la libreria pubblica su PyPI, una dipendenza di versione ordinaria offre le stesse garanzie del vendoring (nessuna credenziale richiesta in CI/Railway) senza i suoi trade-off (binario committato, risincronizzazione manuale, script dedicato).

### ADR-008-F — `StubSource` per i test E2E

**Decisione**: `StubSource` (`backend/app/sources/stub.py`) implementa `TimesheetSource` con comportamento deterministico guidato da un marker stringa, esattamente come `StubAdapter` (`ADR-007-D`):

| Marker | `validate` | `fetch_entries` |
|---|---|---|
| `E2E__OK` | `ValidationResult(ok=True)` | righe fisse, filtrate sul periodo richiesto |
| `E2E__FAIL` | — | `AdapterError` ("Stub: errore applicativo dalla sorgente") |
| `E2E__EXPIRED` | `AdapterAuthError` | `AdapterAuthError` |
| `E2E__DOWN` | `AdapterConnectionError` | `AdapterConnectionError` |

Righe fisse (filtrate su `start <= date <= end`):

| Data | Progetto | Task | Ore | Note |
|---|---|---|---|---|
| 2026-06-01 | Progetto Alpha | Task Frontend | 7.5 | Stub: sviluppo interfaccia |
| 2026-06-02 | Progetto Alpha | Task Backend | 4.0 | Stub: endpoint import |
| 2026-06-03 | Progetto Beta | Task Design | 2.25 | — |

I progetti/task corrispondono deliberatamente a quelli di `StubAdapter`: uno scenario E2E può scaricare righe da qui e assegnarle a un connettore stub di destinazione senza dati intermedi da armonizzare a mano.

Il marker viaggia in `SourceConfig.marker`, popolato dal router (`_build_source_config` in `app/routers/sources.py`) da `user_tokens.account_identifier` — la stessa convenzione già in uso per gli adapter. Il seed E2E deve quindi valorizzare quel campo sul connettore Clockify di test, altrimenti gli scenari di errore non si attivano (comportamento già osservato per gli adapter, vedi `project_e2e_import_log_partial_fail_bug.md` in memoria di progetto).

**Guard di attivazione**: `StubSource` si registra nel registry **solo** se `settings.e2e_test_mode` è vero, con lo stesso meccanismo fail-closed di `ADR-003-B`. Quando attivo, sovrascrive `ClockifySource` per `ServiceType.clockify` sfruttando l'override silenzioso di `ADR-008-B`.

**Motivazione**: nessuno scenario E2E dipende da un account Clockify reale — esecuzione deterministica e veloce in CI, sulla stessa filosofia di `StubAdapter`.

---

## Conseguenze

**Positive**:
- Aggiungere una nuova sorgente (es. Toggl, Harvest) richiede un solo file nuovo in `app/sources/` — nessuna modifica al core, sulla falsariga di `ADR-007-B`.
- Il riuso di `ServiceType`, della gerarchia di eccezioni e di `ValidationResult` evita di duplicare il mapping errore→HTTP tra adapter e sorgenti.
- `SourceRow` identico a una riga Excel normalizzata rende il wizard di importazione indifferente all'origine dei dati: nessuna logica condizionale "se viene da Clockify allora...".
- Il catalogo `app/connector_types.py` elimina la crescita di colonne nullable specifiche di servizio su `user_tokens`, e alimenta sia la validazione backend sia il form dinamico frontend da un'unica fonte di verità.
- `clockify-timesheet` da PyPI rende il build riproducibile in CI/Railway senza credenziali verso alcun repository privato, con l'aggiornamento standard `uv lock` invece di uno script dedicato (`ADR-008-E`).
- `StubSource` rende i test E2E del flusso Clockify completamente indipendenti da un account reale.

**Negative / trade-off accettati**:
- Due ABC paralleli (`TimesheetAdapter`, `TimesheetSource`) da mantenere in sincronia concettuale: un servizio che diventasse sia sorgente sia destinazione (nessun caso oggi) richiederebbe due implementazioni distinte che condividono solo config/credenziali, non codice.
- `user_tokens.config` è una colonna JSONB non tipizzata a livello di database: l'integrità dello schema per servizio è garantita solo applicativamente (`validate_config`), non da un vincolo SQL. Una scrittura diretta sul DB che bypassi l'applicazione potrebbe produrre un `config` non valido per il tipo.
- Il downgrade della migrazione `0010` perde irrimediabilmente ogni chiave di `config` diversa da `db_name` — documentato come `WARNING` nello script stesso.
- L'handler `POST /api/me/sources/{label}/fetch` è sincrono e gira nel threadpool di FastAPI: una sorgente lenta o irraggiungibile occupa un thread per l'intera durata del timeout della libreria (vedi `008-clockify-source.md`).

---

## Riferimenti

- `ADR-005` — Cifratura AES-256-GCM dei segreti; `ADR-005-A` annota ora che `user_tokens.config` è in chiaro per progetto
- `ADR-006` — Parsing Excel client-side; invariante "preview prima del submit" preservato da `ADR-008-C`
- `ADR-007` — Architettura plug-in degli adapter (layer di **destinazione**); `TimesheetSource` ne è il gemello per il layer di **sorgente**
- `007-multi-connector-row-mapping.md` — wizard, suggerimenti da storico, a valle della preview indipendentemente dalla provenienza delle righe
- `008-clockify-source.md` — contratti API, mapping dei campi, gestione errori e timeout, procedura di aggiornamento della libreria
