# E6 — Parsing Excel & Normalizer: dettaglio storie

> Epica che implementa il parsing client-side dei file Excel (SheetJS), la normalizzazione in `TimesheetEntry[]`, il mapping colonne configurabile e la preview con warning. Sblocca E8 (wizard completo). Non possiede tabelle DB — tutta la logica è frontend. Riusa i componenti MUI di E4 (shell) e presuppone identità utente da E3.
>
> **Nota sugli ID**: come E5, gli ID `STORY-E6-N` sono provvisori; assegnare i numeri definitivi all'inserimento in sprint.

---

## STORY-E6-1 — Design UX: step Upload & step Preview

- **Stato**: ⬜ Todo
- **Tipo**: UX/UI
- **Dipende da**: STORY-030 (E4 completata, design system disponibile)

**Obiettivo**: la specifica visiva dei due step di competenza E6 (step 1 upload + step 2 preview) è completa e serve da riferimento alle storie di implementazione.

**Criteri di accettazione**:
- Revisione di `docs/specs/003-timesheet-hub-ux-brief.md` sezioni Step 1 e Step 2; integrazione con i dettagli mancanti:
  - Step 1: stati visivi del componente FileUpload (idle, loading, error-formato, error-dimensione, success) con mockup o descrizione testuale precisa
  - Step 2: layout tabella preview (colonne, larghezze, colonna warning), icona/sfondo riga anomala, tooltip per tipo warning, badge riepilogativo "X valide · Y con warning"
- Lista definitiva dei tipi di warning: `MISSING_HOURS`, `MISSING_PROJECT`, `MISSING_TASK`, `INVALID_DATE`, `MISSING_PERIOD`
- Il documento aggiornato (o una nota integrazione in `docs/specs/`) è approvato prima di iniziare E6-2/E6-3

---

## STORY-E6-2 — Tipo `TimesheetEntry` e Normalizer

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E6-1

**Obiettivo**: esiste un modulo puro (nessuna UI, nessuna dipendenza React) che trasforma righe raw SheetJS in `TimesheetEntry[]` applicando un `ColumnMapping` configurabile; le anomalie sono tracciate come `RowWarning[]`.

**Criteri di accettazione**:
- `frontend/src/lib/timesheet/types.ts`:
  - `TimesheetEntry`: `{ date?: string; project: string; task: string; hours: number; notes?: string; }`
  - `ColumnMapping`: record con chiavi fisse (`date`, `project`, `task`, `hours`, `notes`) → intestazione Excel configurabile; esportato `DEFAULT_COLUMN_MAPPING` per il template aziendale standard (`Data | Progetto | Task | Ore | Note`)
  - `RowWarning`: `{ rowIndex: number; type: WarningType; message: string }`
  - `WarningType`: enum `MISSING_HOURS | MISSING_PROJECT | MISSING_TASK | INVALID_DATE | MISSING_PERIOD`
- `frontend/src/lib/timesheet/normalizer.ts`:
  - `normalize(rows: Record<string, unknown>[], mapping: ColumnMapping): { entries: TimesheetEntry[]; warnings: RowWarning[] }`
  - Riga senza valore `hours` o non-numerico → `RowWarning` tipo `MISSING_HOURS`; la riga è inclusa in `entries` con `hours: 0` (non scartata) per permettere la preview
  - Riga senza `project` → `RowWarning` tipo `MISSING_PROJECT`
  - Riga senza `task` → `RowWarning` tipo `MISSING_TASK`
  - Colonna `date` presente ma valore non parsabile → `RowWarning` tipo `INVALID_DATE`
  - `ColumnMapping` non trova alcuna colonna `hours` nell'header → `RowWarning` globale tipo `MISSING_PERIOD` (una sola, non per-riga)
  - Il Normalizer **non** importa componenti React, MUI o altri framework UI
- `frontend/src/lib/timesheet/normalizer.test.ts` (Vitest):
  - round-trip con il mapping default: 3 righe valide → 3 `TimesheetEntry`, 0 warning
  - 1 riga senza Ore → 1 warning `MISSING_HOURS`, entry con `hours: 0`
  - 1 riga senza Progetto → 1 warning `MISSING_PROJECT`
  - mapping alternativo (es. colonna "Progetto" rinominata "Project") → normalizzazione corretta

---

## STORY-E6-3 — Componente `FileUpload` + parsing SheetJS

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E6-1

**Obiettivo**: l'utente può trascinare o selezionare un file Excel; il componente invoca SheetJS, valida il formato e chiama `onParsed` con le righe raw.

**Criteri di accettazione**:
- `xlsx` aggiunto a `frontend/package.json` (dipendenza di produzione).
- Componente `frontend/src/components/FileUpload/FileUpload.tsx`:
  - Area drag-and-drop + pulsante "Sfoglia" (MUI `Box` + `Button`); icona file e nome file visualizzati dopo selezione
  - Parsing: `FileReader.readAsArrayBuffer` → `XLSX.read(buffer, { type: 'array' })` → primo sheet → `XLSX.utils.sheet_to_json(sheet, { header: 1 })` (array grezzo) per poi estrarre header e righe
  - Validazione:
    - Estensione non `.xlsx` / `.xls` → stato `error` con messaggio "Formato non supportato. Carica un file Excel (.xlsx o .xls)"
    - Dimensione > 5 MB → stato `error` con messaggio "File troppo grande (max 5 MB)"
    - File vuoto o senza righe → stato `error` con messaggio "Il file non contiene dati"
  - Prop `onParsed(rows: Record<string, unknown>[], file: File): void` — invocata solo a parsing riuscito
  - Prop `onError(message: string): void` — opzionale, invocata sugli errori di validazione
  - Stati visivi: `idle` | `loading` (durante parsing) | `error` (messaggio inline) | `success` (nome file + dimensione)
  - Bottone "Rimuovi" nello stato success per resettare a `idle`
- Test unit (`FileUpload.test.tsx`, Vitest + Testing Library):
  - drop di file non-Excel → stato error con messaggio corretto
  - drop di file > 5 MB → stato error dimensione
  - drop di file `.xlsx` valido (mock ArrayBuffer con XLSX.read stubbed) → `onParsed` chiamato con righe

---

## STORY-E6-4 — Componente `PreviewTable` con warning righe anomale

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E6-2, STORY-E6-3

**Obiettivo**: la tabella dei dati normalizzati è visualizzata con evidenziazione visiva delle righe anomale; l'utente vede il riepilogo valide/warning e può procedere o tornare indietro.

**Criteri di accettazione**:
- Componente `frontend/src/components/PreviewTable/PreviewTable.tsx`:
  - Props: `entries: TimesheetEntry[]`, `warnings: RowWarning[]`, `onBack: () => void`, `onNext: () => void`
  - Tabella MUI (`Table`/`TableHead`/`TableBody`) con colonne: Data, Progetto, Task, Ore, Note, Stato
  - Colonna Stato: se la riga ha ≥ 1 warning → chip/icona warning + `Tooltip` con la lista dei tipi; altrimenti cella vuota
  - Riga con warning: `sx={{ backgroundColor: 'warning.lighter' }}` (token MUI)
  - Badge riepilogativo sopra la tabella: `Alert` severity `warning` se ci sono righe anomale, con testo "X righe valide · Y righe con warning"; nascosto se tutti i warning sono 0
  - Bottone "Indietro": chiama `onBack`; resetta lo stato al parent (il parent gestisce il reset del FileUpload)
  - Bottone "Avanti — Seleziona backend": chiama `onNext`; **non disabilitato** anche in presenza di warning (non bloccante)
- Test unit (`PreviewTable.test.tsx`):
  - rendering con 3 entry valide: nessun alert warning, nessuna riga evidenziata
  - rendering con 1 entry valida + 2 con warning: alert "1 valida · 2 con warning", 2 righe con sfondo warning
  - click "Indietro" → `onBack` chiamato
  - click "Avanti" con warning presenti → `onNext` chiamato (non bloccato)

---

## STORY-E6-5 — Fixture Excel E2E + scenari E2E #6/#7/#8

- **Stato**: ⬜ Todo
- **Tipo**: E2E
- **Dipende da**: STORY-E6-3, STORY-E6-4

**Obiettivo**: i tre scenari E2E di E6 (upload formato errato, preview con anomalie, navigazione step) sono verdi in CI.

**Criteri di accettazione**:
- Script di generazione fixture `e2e/fixtures/generate-e6.ts` (o integrazione nello script esistente):
  - `wrong-format.xlsx`: header `Cognome | Nome | Anno` (assenti Progetto e Ore), 2 righe dati
  - `anomalie.xlsx`: header standard `Data | Progetto | Task | Ore | Note`; 3 righe: `2026-01-15 | E2E__OK | dev | 8 | —` (valida), `2026-01-16 | | review | | —` (mancano Progetto e Ore), `2026-01-17 | E2E__OK | | 4 | —` (manca Task)
- Scenario #6 (`e2e/tests/excel-upload.spec.ts` — nuovo file):
  - Upload `wrong-format.xlsx` → componente FileUpload mostra errore inline (testo "non supportato" o simile); il pulsante "Avanti" non è presente / non è cliccabile; nessuna navigazione a Step 2
- Scenario #7:
  - Upload `anomalie.xlsx` → navigazione a Step 2 (preview); badge mostra "1 valida · 2 con warning"; le 2 righe anomale hanno sfondo o chip warning visibile nel DOM
- Scenario #8:
  - Upload `anomalie.xlsx` → Step 2 visibile; click "Indietro" → tornato a Step 1, FileUpload in stato idle; upload di `happy.xlsx` (dalla fixture esistente) → Step 2 mostra 3 righe senza warning
- Tutti e 3 gli scenari verdi in `pnpm playwright test e2e/tests/excel-upload.spec.ts`

---

## STORY-E6-6 — Documentazione E6

- **Stato**: ⬜ Todo
- **Tipo**: Docs
- **Dipende da**: STORY-E6-1 … STORY-E6-5

**Obiettivo**: le decisioni implementate in E6 sono coerenti con la documentazione permanente; gli utenti hanno una guida per caricare il file timesheet.

**Criteri di accettazione**:
- `docs/specs/001-functional-spec.md` aggiornato: sezione "Parsing Excel" con la definizione di `TimesheetEntry`, `ColumnMapping` default (tabella colonne), lista `WarningType`, regola "warning non bloccante"
- `docs/specs/006-excel-parsing.md` (nuovo file): spec tecnica del Normalizer — default `ColumnMapping`, algoritmo di extract-period dalla colonna Data, regole di validazione per-riga, struttura `RowWarning`
- `docs/guides/excel-upload.md` (nuovo file): guida utente "Come caricare il file timesheet" per ruoli Employee / HR — istruzioni upload, interpretazione warning, quando procedere nonostante i warning, quando ricaricare il file
- `docs/backlog/README.md` aggiornato: E6 nella tabella avanzamento + sezione body; dopo merge su `main` le storie vanno spostate a "E6 — Completata" (da fare in quel momento, non ora)
