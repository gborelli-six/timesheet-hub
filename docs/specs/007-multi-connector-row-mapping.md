# Timesheet Hub — Assegnazione multi-connettore per riga & suggerimenti da storico

| Campo | Valore |
|---|---|
| Versione | 0.1 |
| Data | 2026-06-30 |
| Stato | Bozza |
| Riferimenti | 001-functional-spec.md · 003-ux-brief.md · ADR-001 (§C) · ADR-005 |

---

## Scopo

Estende il flusso di importazione per consentire che **ogni riga del timesheet Excel sia assegnata a più connettori** (inserimento simultaneo su più sistemi di gestione: Odoo, Jira, Linear, Asana) e che, **per ciascun connettore**, l'utente scelga un **progetto** e un **task** del sistema remoto tramite **autocomplete**. Dalla **seconda importazione** in poi il sistema **suggerisce** queste associazioni in base alle importazioni precedenti; i suggerimenti restano **sempre modificabili**.

Motivazione: i nomi di progetto/task nel template aziendale non coincidono con quelli dei sistemi remoti, e la stessa riga di lavoro va spesso rendicontata su più sistemi (es. interno Odoo + cliente Jira). Memorizzare le associazioni elimina la ri-mappatura manuale mese su mese.

Questo documento copre il modello dati, l'algoritmo di suggerimento, i contratti API e l'estensione dell'interfaccia adapter. La realizzazione è distribuita tra **E6** (modello dati `TimesheetEntry`), **E7** (adapter espone progetti/task) ed **E8a** (UI wizard, persistenza, suggerimenti). Il pannello per-utente di gestione delle mappature preimpostate è rinviato a una **epica separata post-MVP** (vedi §6).

---

## 1. Modello dati frontend

L'output del Normalizer (E6, vedi `006-excel-parsing.md`) viene esteso: ogni `TimesheetEntry` porta una lista di assegnazioni a connettori, popolata nel wizard (E8a), vuota al termine del solo parsing.

```ts
// frontend/src/lib/timesheet/types.ts

type ServiceType = 'jira' | 'odoo' | 'linear' | 'asana'

interface ConnectorAssignment {
  connectorLabel: string     // ref a user_tokens.label dell'utente (connettore configurato in E5)
  service: ServiceType
  remoteProjectId: string
  remoteProjectName: string
  remoteTaskId: string
  remoteTaskName: string
  suggested: boolean         // true se proposto dallo storico e non ancora confermato dall'utente
}

interface TimesheetEntry {
  date?: string
  project: string            // progetto come scritto nell'Excel (chiave di matching)
  task: string               // task come scritto nell'Excel (chiave di matching)
  hours: number
  notes?: string
  connectorAssignments: ConnectorAssignment[]   // ⬅ nuovo; default []
}
```

Regole:
- Una riga può avere **0..N** assegnazioni. 0 = la riga non viene importata su alcun sistema.
- Più assegnazioni possono puntare allo stesso `service` con `connectorLabel` diversi (più istanze, es. due Jira) o a servizi diversi.
- `suggested = true` segnala visivamente all'utente che l'associazione proviene dallo storico ed è da rivedere; passa a `false` quando l'utente la conferma o la modifica.

---

## 2. Modello dati backend — tabella `connector_row_mappings`

Memoria per-utente delle associazioni, per alimentare i suggerimenti. **Possiede questa tabella l'epica E8a.** Convenzioni di naming in [`ADR-004`](../adr/ADR-004-orm-conventions.md).

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK → `users.id` | `ondelete=CASCADE`, FK `fk_connector_row_mappings_user_id_users` |
| `excel_project` | String(255) | progetto Excel **normalizzato** (chiave di matching) |
| `excel_task` | String(255) | task Excel **normalizzato** (chiave di matching) |
| `connector_label` | String(255) | label del connettore usato (ref logico a `user_tokens.label`) |
| `remote_project_id` | String(255) | id progetto sul sistema remoto |
| `remote_project_name` | String(255) | nome progetto remoto (cache per display senza round-trip) |
| `remote_task_id` | String(255) | id task sul sistema remoto |
| `remote_task_name` | String(255) | nome task remoto (cache per display) |
| `last_used_at` | timestamp | aggiornato a ogni submit che riusa/crea questa mappatura |
| `created_at` / `updated_at` | timestamp | `TimestampMixin` |

Vincoli:
- `UniqueConstraint(user_id, excel_project, excel_task, connector_label)` → `uq_connector_row_mappings_user_project_task_connector`
- Index su `(user_id, excel_project, excel_task)` → `ix_connector_row_mappings_user_project_task` (lookup suggerimenti)

**Normalizzazione delle chiavi** (`excel_project`, `excel_task`): `trim` + collasso spazi interni + lowercase, così varianti di battitura non frammentano lo storico. La stessa normalizzazione è applicata in scrittura (submit) e in lettura (lookup).

> Nota: `connector_label` è un riferimento logico, non una FK, perché la label appartiene allo spazio per-utente di `user_tokens` ed è già vincolata `uq_user_tokens_user_id_label`. Se l'utente rinomina/elimina un connettore, una mappatura orfana viene semplicemente ignorata in fase di suggerimento (vedi §3).

---

## 3. Algoritmo di suggerimento

All'avvio di una nuova importazione, per ogni riga si interroga `connector_row_mappings` con `(user_id, normalize(excel_project), normalize(excel_task))`.

1. **Match esatto** sulla coppia `(excel_project, excel_task)` → si propongono **tutte** le righe corrispondenti (una per `connector_label`), ciascuna come `ConnectorAssignment` con `suggested = true`.
2. **Filtro connettori validi**: una mappatura il cui `connector_label` non esiste più tra i connettori configurati dell'utente viene scartata (non suggerita).
3. **Tie-break**: se per la stessa coppia `(excel_project, excel_task, connector_label)` esistessero più candidati (non dovrebbe, per il vincolo unique), vince `last_used_at` più recente.
4. **Nessun match** → la riga resta senza assegnazioni; l'utente le aggiunge manualmente.

I suggerimenti sono **sempre modificabili**: l'utente può rimuovere un'assegnazione suggerita, cambiarne progetto/task, o aggiungerne di nuove prima di confermare.

### 3.1 Precompilazione righe simili in-page

Lo storico (§3) copre solo le righe già viste in importazioni precedenti. Alla **prima importazione**, o per **nuovi progetti/attività** non ancora presenti in `connector_row_mappings`, non c'è alcun suggerimento: l'utente deve assegnare a mano ogni riga, anche quando molte condividono la stessa coppia `(progetto, task)`.

Per accelerare questi casi, lo **Step 2 "Verifica e assegna"** espone un pulsante **"Precompila righe simili"** (icona *sparkle*, `data-testid=preview-btn-fill-similar`) con un hint che indica quante righe sono precompilabili (`data-testid=preview-fill-similar-hint`). Al click, per ogni riga **ancora vuota** il sistema cerca, **tra le righe già assegnate nella pagina corrente**, una riga con la **stessa coppia `(progetto, task)` normalizzata** e ne **clona** la lista di connettori, marcandola `suggested = true` (identica resa visiva dei suggerimenti da storico).

- **Chiave di matching**: identica allo storico — **match esatto** su `(project, task)` con la stessa normalizzazione (`trim` + collasso spazi + lowercase). Nessun fallback su solo-progetto.
- **Sorgente locale, non lo storico**: opera esclusivamente sui dati della pagina corrente (non richiede importazioni precedenti né una chiamata API); è complementare ai suggerimenti da storico di §3, che restano il meccanismo per le importazioni successive alla prima.
- **Solo righe vuote**: le righe già assegnate (manualmente o da suggerimento) non vengono toccate; se la prima assegnata per una data coppia ha più connettori, vengono clonati tutti.
- **Idempotente**: se nessuna riga vuota ha una coppia corrispondente a una riga assegnata, il pulsante è disabilitato (conteggio 0).
- **Persistenza**: le righe precompilate confluiscono in `entries` come qualsiasi altra assegnazione, quindi al `POST /imports` vengono importate **e** salvate nello storico via l'upsert di §3, diventando suggerimento del mese successivo.

**Persistenza alla submit**: al `POST /imports`, per ogni `ConnectorAssignment` effettivamente inviata si esegue un **upsert** su `connector_row_mappings` (chiave unique), aggiornando `remote_*` e `last_used_at`. Così la mappatura corrente diventa il suggerimento del mese successivo. Le associazioni rimosse dall'utente **non** vengono cancellate dallo storico (restano disponibili come suggerimento finché non sovrascritte) — scelta conservativa rivedibile col pannello di §6.

---

## 4. Contratti API

### 4.1 Autocomplete progetti/task (live dagli adapter — E7)

Le liste sono recuperate **in tempo reale** dal sistema remoto tramite l'adapter del connettore (vedi §5). Il parametro `query` filtra lato remoto/adapter; il `label` identifica il connettore per-utente da cui derivano credenziali e `service`.

```
GET /api/adapters/{label}/projects?query=<str>
→ 200 [{ id: string, name: string }]

GET /api/adapters/{label}/projects/{projectId}/tasks?query=<str>
→ 200 [{ id: string, name: string }]
```

- Errori dell'adapter mappati coerentemente con E7 (es. connettore `needs_reauth` → 409/422 con codice; sistema remoto irraggiungibile → 502/504). In E2E governati dai marcatori `E2E__OK`/`E2E__EXPIRED`/`E2E__DOWN`.
- RBAC: l'utente può interrogare solo i **propri** connettori (lookup `user_tokens` per `(current_user.id, label)`).

### 4.2 Suggerimenti da storico

Batch per l'intera preview, alla transizione verso lo step di assegnazione:

```
POST /api/me/mapping-suggestions
body: { rows: [{ excelProject: string, excelTask: string }] }
→ 200 { suggestions: ConnectorAssignment[][] }   // allineato per indice a rows
```

Ogni elemento dell'array esterno corrisponde alla riga di pari indice; la lista interna contiene le assegnazioni suggerite (può essere vuota). Tutte con `suggested = true`.

### 4.3 Persistenza alla submit

`POST /imports` (contratto completo definito in E8a) accetta, per ogni riga, le `connectorAssignments` confermate; il backend esegue l'import via adapter **e** l'upsert su `connector_row_mappings` descritto in §3.

---

## 5. Estensione interfaccia adapter (E7)

`TimesheetAdapter` (ADR-001-C) è esteso per alimentare l'autocomplete live:

```
interface TimesheetAdapter:
    submit(entries: TimesheetEntry[], config: AdapterConfig) → ImportResult
    validate(entries: TimesheetEntry[]) → ValidationResult
    getProjects(query?: string) → Project[]                  # esteso con filtro opzionale
    getTasks(projectId: string, query?: string) → Task[]     # ⬅ nuovo
```

`Project` e `Task` espongono almeno `{ id, name }`. L'adapter Odoo (MVP, E7) implementa `getProjects`/`getTasks` via JSON-RPC; gli adapter futuri (E11) seguono lo stesso contratto.

---

## 6. Fase 2 — Pannello per-utente delle mappature (post-MVP)

In una fase successiva, una **epica separata post-MVP** introdurrà una sezione di profilo dove l'utente può **visualizzare e modificare le mappature preimpostate** in `connector_row_mappings` senza dover avviare un'importazione: rinominare, correggere progetto/task remoto, eliminare associazioni obsolete. Questo documento ne definisce solo il modello dati di supporto; UX e API CRUD sono demandati a quell'epica.

---

## 7. Impatti sul flusso (riepilogo)

- **001-functional-spec.md**: Caso d'uso 1 step 4 → assegnazione per-riga multi-connettore + progetto/task + suggerimenti; §"Gestione connettori per-utente" → memoria associazioni.
- **003-ux-brief.md** §3.3: Step 2 mostra i connettori assegnati per riga; Step 3 diventa assegnazione/conferma per-riga con autocomplete e chip "Suggerito".
- **ADR-001-C**: interfaccia adapter estesa (§5).
- **E6** (`e6-stories.md`): `TimesheetEntry` porta `connectorAssignments`.
- **E8a** (`e8a-stories.md`): tabella + migrazione, endpoint autocomplete/suggestions, UI modal, E2E; pulsante "Precompila righe simili" nello Step 2 (§3.1).
