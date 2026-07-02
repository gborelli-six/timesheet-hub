# Timesheet Hub — Specifiche funzionali

| Campo | Valore |
|---|---|
| Versione | 0.1 |
| Data | 2026-05-28 |
| Stato | Bozza |

---

## Scopo

Timesheet Hub è uno strumento interno per centralizzare l'importazione mensile dei timesheet dei dipendenti su più sistemi di rendicontazione eterogenei. Elimina la necessità di inserire manualmente gli stessi dati su piattaforme diverse, riducendo il tempo speso e gli errori di trascrizione.

---

## Attori

| Attore | Descrizione |
|---|---|
| **Dipendente** | Carica il proprio timesheet Excel e seleziona i backend su cui importare |
| **HR Manager** | Carica il timesheet per conto di qualsiasi dipendente; ha visibilità su tutti i log |
| **Admin** | Configura i backend attivi, gestisce gli utenti e i ruoli, inserisce le credenziali di sistema |

---

## Caso d'uso 1 — Il dipendente importa il proprio timesheet

1. Il dipendente accede all'applicazione tramite il proprio account Google aziendale (`@sixfeetup.it`).
2. Carica il proprio file Excel seguendo il template aziendale standard.
3. L'applicazione mostra un'anteprima dei dati parsati: dipendente, periodo, righe per progetto e task con le ore.
4. Per **ciascuna riga** il dipendente assegna uno o più connettori (inserimento simultaneo su più sistemi, es. Odoo + Jira) e, per ogni connettore scelto, seleziona il **progetto** e il **task** del sistema remoto tramite **autocomplete**. Dalla **seconda importazione** in poi queste associazioni sono **pre-suggerite** in base alle importazioni precedenti e restano sempre modificabili.
5. Conferma l'importazione.
6. L'applicazione invia ogni riga ai connettori assegnati tramite i rispettivi adapter, e memorizza le associazioni per i suggerimenti futuri.
7. Viene mostrato il risultato per ciascun backend: successo, errori parziali o fallimento.
8. Il log dell'importazione viene salvato e consultabile in seguito.

> Dettaglio del modello dati, dell'algoritmo di suggerimento e dei contratti API in [`007-multi-connector-row-mapping.md`](007-multi-connector-row-mapping.md).

---

## Caso d'uso 2 — L'HR Manager importa per conto di un dipendente

1. L'HR Manager accede con il proprio account Google aziendale.
2. Seleziona il dipendente per cui sta operando.
3. Carica il file Excel del dipendente.
4. Segue gli stessi passi 3–8 del caso d'uso 1.
5. Il log registra sia il dipendente di riferimento sia l'HR che ha effettuato l'operazione.

---

## Il timesheet Excel

Il file Excel è un template **standard aziendale**, uguale per tutti i dipendenti. Contiene:

- Identificativo del dipendente (nome, email o matricola)
- Periodo di riferimento (mese/anno)
- Righe con: progetto, task, ore giornaliere o totali per il periodo

Il mapping tra le colonne del file Excel e i campi interni è **configurabile** dal pannello Admin, per adattarsi a eventuali variazioni future del template senza modificare il codice.

### Vincoli e comportamento del parser (v1)

| Parametro | Valore |
|---|---|
| Estensioni accettate | `.xlsx`, `.xls` |
| Dimensione massima | 5 MB |
| Foglio letto | Sempre il **primo foglio** del file, indipendentemente dal nome |
| Righe vuote | Saltate silenziosamente (non generano warning) |
| Limite righe | Nessuno (unico limite è la dimensione del file) |
| Formati data accettati | ISO `YYYY-MM-DD` e italiano `DD/MM/YYYY`; altri formati → warning `INVALID_DATE` |

In v2 il formato data sarà selezionabile dall'Admin nel wizard di configurazione.

---

## Parsing Excel

Il parsing avviene **interamente nel browser** tramite SheetJS (nessun upload al server durante il parsing). Il risultato è un array `TimesheetEntry[]` passato al wizard di importazione.

### Struttura `TimesheetEntry`

| Campo | Tipo | Note |
|---|---|---|
| `date` | `string` (opzionale) | ISO `YYYY-MM-DD`; assente se la colonna non è compilata |
| `project` | `string` | Progetto come scritto nell'Excel |
| `task` | `string` | Task come scritto nell'Excel |
| `hours` | `number` | Ore; `0` se il valore è assente o non numerico (warning) |
| `notes` | `string` (opzionale) | Note libere |
| `connectorAssignments` | `ConnectorAssignment[]` | Sempre vuoto dopo il parsing; popolato nel wizard (E8a) |

### Mapping colonne default

| Campo interno | Intestazione Excel default |
|---|---|
| `date` | `Data` |
| `project` | `Progetto` |
| `task` | `Task` |
| `hours` | `Ore` |
| `notes` | `Note` |

Il mapping è configurabile dall'Admin (previsto in E10). Per v1 si usa il mapping default.

### Tipi di warning

| `WarningType` | Condizione | Ambito |
|---|---|---|
| `MISSING_HOURS` | Valore `Ore` assente o non numerico | Per riga |
| `MISSING_PROJECT` | Valore `Progetto` assente o vuoto | Per riga |
| `MISSING_TASK` | Valore `Task` assente o vuoto | Per riga |
| `INVALID_DATE` | Formato data non riconosciuto (né ISO né italiano) | Per riga |
| `MISSING_PERIOD` | Colonna `Ore` assente dall'intero file | Globale |

### Warning non bloccanti

I warning **non impediscono** di procedere all'importazione. Il pulsante "Avanti" è sempre abilitato, anche in presenza di righe anomale. L'utente vede il riepilogo "X righe valide · Y righe con warning" e decide se ricaricare il file o procedere.

Vedi spec tecnica dettagliata in [`006-excel-parsing.md`](006-excel-parsing.md).

---

## Backend supportati

L'applicazione supporta l'importazione su più sistemi, configurabili indipendentemente per ciascun progetto:

| Backend | Tipo | Note |
|---|---|---|
| **Jira** | Cliente / interno | Worklogs su issue tramite REST API v3 |
| **Odoo** | Interno | Timesheet module tramite JSON-RPC |
| **Linear** | Cliente | Time tracking tramite GraphQL API |
| **Asana** | Cliente | Time entries tramite REST API |

Ogni backend è **opzionale e indipendente**: l'assegnazione avviene a livello di **singola riga** del timesheet — la stessa riga può essere inviata a più connettori contemporaneamente, ciascuno con il proprio progetto e task remoto. L'aggiunta di nuovi backend non richiede modifiche ai componenti esistenti.

I backend sono integrati tramite un'**architettura plug-in** basata sull'interfaccia astratta `TimesheetAdapter` e un `AdapterRegistry` globale. Ogni adapter si auto-registra all'import del proprio modulo; il core applicativo non conosce i dettagli dei singoli backend. Per le decisioni architetturali di dettaglio vedere [ADR-007](../adr/ADR-007-adapter-plugin-architecture.md); per aggiungere un nuovo backend seguire la guida [`docs/guides/aggiungere-un-adapter.md`](../guides/aggiungere-un-adapter.md).

---

## Pannello di controllo (Admin)

L'admin può configurare:

- **Backend attivi per progetto**: quale adapter usare per ciascun progetto/cliente.
- **Credenziali di sistema**: token e URL dei backend (cifrati, mai visibili in chiaro dopo l'inserimento).
- **Utenti e ruoli**: assegnazione dei ruoli `employee`, `hr`, `admin` agli utenti che hanno effettuato almeno un accesso.
- **Mapping colonne Excel**: associazione tra colonne del template e campi interni.

---

## Gestione dei connettori per-utente

> Dettaglio decisioni implementative in [`ADR-005`](../adr/ADR-005-connector-credentials-security.md).

Ciascun dipendente configura nel proprio profilo le credenziali dei connettori per i backend che utilizza. Ogni connettore è identificato da una **label** (nome assegnato dall'utente, es. "Jira Azienda") e ha:

- **`account_identifier`** — username, email o ID account del servizio esterno; visibile in chiaro nella UI dopo il salvataggio.
- **`secret`** — token API o password; **write-only**: non viene mai restituito né visualizzato dopo l'inserimento, solo sostituibile.
- **`base_url`** — URL base per istanze self-hosted (es. Odoo on-premise); opzionale.

Il segreto è cifrato con AES-256-GCM prima della scrittura in DB; più connettori dello stesso servizio (es. due istanze Jira diverse) sono supportati con label distinte.

Se un segreto risulta scaduto o non valido al momento dell'importazione, il connettore viene marcato "da aggiornare" e il dipendente viene notificato di sostituire la credenziale.

### Memoria delle associazioni riga ↔ connettore

Per evitare la ri-mappatura manuale a ogni importazione, il sistema memorizza per ciascun utente le associazioni tra la coppia (progetto, task) del file Excel e il connettore + progetto + task remoto scelti. Dalla seconda importazione queste associazioni vengono **suggerite automaticamente** e restano modificabili. In una **fase successiva** (epica post-MVP) un pannello per-utente permetterà di visualizzare e modificare direttamente le mappature preimpostate. Dettaglio in [`007-multi-connector-row-mapping.md`](007-multi-connector-row-mapping.md).

---

## Log delle importazioni

Ogni importazione viene persistita al momento del submit (`POST /api/me/imports`).

### Modello dati

**`imports`** (header):
- `id` — UUID PK
- `employee_id` — UUID FK → `users.id` (dipendente di riferimento)
- `operator_id` — UUID FK → `users.id` nullable (NULL per self-import; valorizzato da E8b/HR)
- `status` — `success` | `partial` | `failed` (derivato dai conteggi)
- `period_start` / `period_end` — date derivate dalle entries importate
- `total_rows` / `success_rows` / `failed_rows` — conteggi aggregati
- `created_at` / `updated_at` — timestamp (TimestampMixin)

**`import_rows`** (dettaglio per riga × connettore):
- `import_id` — FK → `imports.id` CASCADE
- `row_number` — indice 1-based come nel foglio
- `connector_label` / `service` — connettore usato
- `excel_project` / `excel_task` — dati sorgente
- `remote_project_id|name` / `remote_task_id|name` — destinazione remota
- `hours`, `status` (`success`|`failed`), `error_message` nullable

### Endpoint
- `GET /api/me/imports` — lista proprie importazioni, filtri opzionali `period_from/to`, `service`, `status`; ordinamento `created_at` DESC
- `GET /api/me/imports/{id}` — dettaglio con righe; 404 se non proprio (nessun leakage cross-utente)

### Visibilità per ruolo
- `employee`: solo i propri log (via `GET /api/me/imports`)
- HR Manager: tutti i log — E9b (futura)
- Admin: tutti i log — E9b (futura)

---

## Frequenza d'uso attesa

L'importazione avviene tipicamente **una volta al mese** per dipendente, a chiusura del periodo di rendicontazione. Il sistema non è progettato per importazioni in tempo reale o ad alta frequenza.

---

## Requisiti non funzionali

| Requisito | Valore atteso |
|---|---|
| Accesso | Solo da rete aziendale o VPN (configurabile a livello infrastrutturale) |
| Autenticazione | Google OAuth, solo dominio `@sixfeetup.it` |
| Sessione | Durata 8 ore, corrispondente alla giornata lavorativa |
| Disponibilità | Best effort — strumento interno, downtime brevi tollerati |
| Costo operativo | Minimizzato — infrastruttura cloud a consumo (~10-15 €/mese) |

---

## Fuori scope (v1)

- Creazione o modifica del timesheet direttamente nell'applicazione (si importa sempre da Excel).
- Sincronizzazione bidirezionale: il flusso è solo in scrittura verso i backend.
- Notifiche automatiche di reminder per la scadenza mensile.
- Supporto multi-azienda.
- App mobile nativa.
