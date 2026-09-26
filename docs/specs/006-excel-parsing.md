# Timesheet Hub — Spec tecnica: Parsing Excel & Normalizer

| Campo | Valore |
|---|---|
| Versione | 0.1 |
| Data | 2026-06-30 |
| Stato | Stabile |
| Riferimenti | `001-functional-spec.md` · `007-multi-connector-row-mapping.md` · ADR-006 |

---

## Scope

Questa spec descrive il parsing client-side dei file Excel (ExcelJS — vedi ADR-006) e la funzione `normalize()` che trasforma le righe raw in `TimesheetEntry[]`. Tutta la logica è **frontend-only** — nessun dato raggiunge il server durante il parsing. Il parsing avviene nello step 1 del wizard di importazione; la struttura `TimesheetEntry[]` risultante è passata ai passi successivi del wizard (E8a).

Modulo di riferimento: `frontend/src/lib/timesheet/normalizer.ts`  
Tipi: `frontend/src/lib/timesheet/types.ts`

---

## 1. ColumnMapping

Il `ColumnMapping` mappa ogni campo interno `TimesheetEntry` all'intestazione Excel corrispondente.

```typescript
type ColumnMapping = {
  date: string
  project: string
  task: string
  hours: string
  notes: string
}
```

### Mapping default (v1)

| Campo interno | Intestazione Excel |
|---|---|
| `date` | `Date` |
| `project` | `Project` |
| `task` | `Task` |
| `hours` | `Hours` |
| `notes` | `Notes` |

Esportato da `types.ts` come `DEFAULT_COLUMN_MAPPING`. In v1 è hardcoded; il pannello Admin per la configurazione è previsto in E10.

---

## 2. Algoritmo `normalize()`

**Firma**: `normalize(rows: Record<string, unknown>[], mapping: ColumnMapping, rowNumbers?: number[]): { entries: TimesheetEntry[]; warnings: RowWarning[] }`

I `rows` in input sono prodotti dal componente `FileUpload` leggendo il foglio con ExcelJS (`worksheet.eachRow`): la prima riga fornisce le intestazioni e ogni record successivo ha le chiavi corrispondenti a tali intestazioni Excel. Le righe completamente vuote sono filtrate a monte dal componente `FileUpload` prima di chiamare `normalize()`.

Il parametro opzionale `rowNumbers` contiene, allineato a `rows`, il numero di riga Excel reale (1-based, intestazione inclusa) di ciascuna riga sopravvissuta al filtro: serve a riferire i warning alla riga visibile dall'utente nel foglio (vedi §4). Se non fornito, `rowIndex` ricade sull'indice 1-based delle sole righe dati.

### Passi in ordine

1. **Check globale `MISSING_PERIOD`**: raccoglie tutte le chiavi presenti nei `rows`. Se `mapping.hours` non è tra le chiavi → produce un `RowWarning` con `rowIndex: -1` e `type: MISSING_PERIOD`. Il ciclo per-riga continua comunque.

2. **Per ogni riga** (`rowIndex` esposto = numero di riga Excel reale da `rowNumbers[idx]`, con fallback all'indice 1-based delle righe dati):
   - **Estrazione `project`**: `row[mapping.project]`, trim; vuoto/undefined → stringa `''`
   - **Estrazione `task`**: `row[mapping.task]`, trim; vuoto/undefined → stringa `''`
   - **Estrazione `hours`**: `row[mapping.hours]`; converte a `Number`; assente/non-numerico → `NaN`
   - **Estrazione `notes`**: `row[mapping.notes]`, trim; assente/vuoto → `undefined`
   - **Estrazione `date`**: `row[mapping.date]`; passa a `parseDate()` (vedi §3)

3. **Validazione e produzione warning** (in questo ordine):
   - `project === ''` → `RowWarning` tipo `MISSING_PROJECT`
   - `task === ''` → `RowWarning` tipo `MISSING_TASK`
   - `hours` è `NaN` → `RowWarning` tipo `MISSING_HOURS`; `hours` impostato a `0`
   - `dateInvalid === true` → `RowWarning` tipo `INVALID_DATE`

4. **Push entry**: ogni riga (indipendentemente dai warning) produce un `TimesheetEntry` con `connectorAssignments: []`.

---

## 3. Formato data

Gestito dalla funzione interna `parseDate(raw: unknown): { value: string | undefined; invalid: boolean }`.

| Input | Output `value` | Output `invalid` |
|---|---|---|
| `undefined` / `null` / `''` | `undefined` | `false` — data assente, campo opzionale |
| Oggetto `Date` (cella formattata come data, restituita da ExcelJS) | `YYYY-MM-DD` dai componenti UTC | `false` |
| Stringa `YYYY-MM-DD` | stringa ISO as-is | `false` |
| Stringa `DD/MM/YYYY` | convertita a `YYYY-MM-DD` | `false` |
| `Date` non valida (`NaN`) o numero seriale Excel grezzo | `undefined` | `true` → `INVALID_DATE` |
| Qualsiasi altro formato | `undefined` | `true` → `INVALID_DATE` |

> Le celle formattate come data in Excel arrivano a `parseDate()` come oggetti `Date` (comportamento di ExcelJS): vengono normalizzate usando i componenti UTC per evitare slittamenti di un giorno dovuti al fuso orario locale.

La **data assente** non genera warning: `date` è un campo opzionale in `TimesheetEntry`. L'utente può compilare l'Excel senza la colonna Data e il parsing procede senza errori.

---

## 4. Struttura `RowWarning`

```typescript
interface RowWarning {
  rowIndex: number   // 1-based (= riga Excel visibile); -1 per warning globali
  type: WarningType
  message: string    // testo leggibile, es. "Riga 3: colonna "Ore" assente o non numerica"
}
```

| `rowIndex` | Significato |
|---|---|
| `-1` | Warning globale (es. `MISSING_PERIOD` — colonna assente dall'intero file) |
| `>= 1` | Warning sulla riga Excel corrispondente (1-based) |

---

## 5. Regole di validazione

| Condizione | `WarningType` | Comportamento entry |
|---|---|---|
| Colonna `hours` assente dal file | `MISSING_PERIOD` (rowIndex -1) | Entry incluse con `hours: 0` |
| `project` vuoto/assente | `MISSING_PROJECT` | Entry inclusa con `project: ''` |
| `task` vuoto/assente | `MISSING_TASK` | Entry inclusa con `task: ''` |
| `hours` assente o non numerico | `MISSING_HOURS` | Entry inclusa con `hours: 0` |
| Formato data non riconosciuto | `INVALID_DATE` | Entry inclusa senza `date` |
| `date` assente/vuota | — (nessun warning) | Entry inclusa senza `date` |
| `notes` assente/vuota | — (nessun warning) | Entry inclusa senza `notes` |

Nessun warning è bloccante: tutte le righe vengono incluse in `entries`.

---

## 6. Integrazione con `FileUpload`

Il componente `FileUpload` (`frontend/src/components/FileUpload/FileUpload.tsx`) si occupa di:
- Validare estensione (solo `.xlsx`) e dimensione (max 5 MB). ExcelJS non legge il formato binario legacy `.xls`, quindi non è accettato.
- Leggere il file con `File.arrayBuffer()`
- Caricare il workbook con `workbook.xlsx.load(buffer)` (ExcelJS) e prendere il **primo foglio** (`workbook.worksheets[0]`)
- Iterare con `worksheet.eachRow`: la prima riga fornisce le intestazioni, le righe successive diventano `Record<string, unknown>[]` con chiavi = intestazioni
- Filtrare silenziosamente le righe completamente vuote, conservando per le righe superstiti il numero di riga Excel reale
- Chiamare la prop `onParsed(rows, file, rowNumbers)` con le righe filtrate e i rispettivi numeri di riga

Il chiamante (la pagina/wizard) esegue `normalize(rows, DEFAULT_COLUMN_MAPPING, rowNumbers)` e passa `entries` e `warnings` a `PreviewTable`.

---

## 7. Riferimenti

- Tipi: `frontend/src/lib/timesheet/types.ts`
- Implementazione: `frontend/src/lib/timesheet/normalizer.ts`
- Componente upload: `frontend/src/components/FileUpload/FileUpload.tsx`
- Componente preview: `frontend/src/components/PreviewTable/PreviewTable.tsx`
- Spec multi-connettore: [`007-multi-connector-row-mapping.md`](007-multi-connector-row-mapping.md)
- ADR excel parsing client-side: `docs/adr/ADR-006-excel-parsing-client-side.md`
