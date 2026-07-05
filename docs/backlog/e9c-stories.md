# E9c — Filtri Step 2 "Verifica ed Assegna"

> Filtri per data, progetto e task nella tabella dello Step 2 del wizard di importazione, per semplificare l'assegnazione dei connettori su file con molte righe.
>
> **Dipende da**: E8a (Done)
> **UI**: Opzione C — icone imbuto nell'intestazione colonna (stile Excel). Mockup: `Preview Filtri - Esplorazioni.html` nel progetto Claude Design `e1aac35b-a506-46e1-83e0-dbf593de6b87`.

---

## STORY-E9c-1: Hook `usePreviewFilters` — stato filtri e logica di filtraggio

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | tech |
| **Dipende da** | — |

**Obiettivo**: creare un custom hook riutilizzabile che gestisca lo stato dei filtri (data, progetto, task) e produca la lista degli indici visibili applicando logica AND.

**Criteri di accettazione**:
- Il hook accetta `entries: TimesheetEntry[]` e restituisce:
  - `filters`: stato corrente dei filtri (data, progetto, task)
  - `setFilterDate`, `setFilterProject`, `setFilterTask`: setter individuali
  - `resetFilters`: resetta tutti i filtri allo stato iniziale
  - `filteredIndices: number[]`: indici delle entries che soddisfano tutti i filtri attivi
  - `distinctProjects: string[]`: valori distinti del campo `project`, ordinati alfabeticamente, esclusi vuoti
  - `distinctTasks: string[]`: valori distinti del campo `task`, ordinati alfabeticamente, esclusi vuoti
  - `distinctDates: string[]`: date distinte ISO, ordinate cronologicamente
  - `isFiltered: boolean`: true se almeno un filtro è attivo
- Filtro data: selezione di uno o più valori discreti (date ISO presenti nelle entries)
- Filtro progetto: selezione di uno o più valori tra i `distinctProjects`
- Filtro task: selezione di uno o più valori tra i `distinctTasks`
- Valori distinti calcolati sull'array completo (non filtrato)
- Quando tutti i filtri sono vuoti, `filteredIndices` contiene tutti gli indici
- Quando più filtri sono attivi, si applicano in AND
- `filteredIndices`, `distinctProjects`, `distinctTasks`, `distinctDates` memoizzati con `useMemo`
- Test unitari (Vitest): ≥6 casi — nessun filtro, filtro singolo per ciascun campo, combinazione di 2 filtri, combinazione di 3 filtri, filtro che non matcha nessuna riga

---

## STORY-E9c-2: Filtri in PreviewTable — icone imbuto, righe filtrate e contatore

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | feature |
| **Dipende da** | STORY-E9c-1 |

**Obiettivo**: PreviewTable accetta `filteredIndices` e lo stato filtri dall'hook; mostra solo le righe filtrate con icone imbuto nell'header delle colonne filtrabile (Opzione C del design).

**Criteri di accettazione**:
- Prop opzionale `filteredIndices?: number[]`; se assente, mostra tutto (retrocompatibilità)
- Quando fornito, renderizza solo le entries con indice in `filteredIndices`, mantenendo la corrispondenza indice originale per `assignmentsByRow`, `onAssign`, warnings
- Le intestazioni delle colonne **Data**, **Progetto**, **Task** mostrano un'icona imbuto (funnel) cliccabile accanto al testo
- L'icona imbuto delle colonne con filtro attivo è evidenziata (background primary, colore bianco — classe `is-on` come da mockup C in `Preview Filtri - Esplorazioni.html`)
- Al click sull'icona imbuto si apre un menu dropdown con: campo di ricerca + lista checkbox multi-selezione con i valori distinti della colonna
- Il menu si chiude al click fuori
- Alert warning riflette il sottoinsieme filtrato
- Badge globali ("valide", "con warning", "righe pronte") riflettono sempre il totale, non il filtrato
- Contatore "Mostrate X di Y righe" visibile quando `isFiltered === true`
- Test unitario: `filteredIndices=[0,2]` su 4 entries → 2 righe renderizzate; i `data-testid` degli assign-trigger corrispondono agli indici originali (0 e 2, non 0 e 1)

---

## STORY-E9c-3: Cablaggio hook filtri in ImportPage + reset

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | feature |
| **Dipende da** | STORY-E9c-1, STORY-E9c-2 |

**Obiettivo**: integrare `usePreviewFilters` in `ImportPage.tsx`, passare stato filtri e callback a `PreviewTable`, gestire il reset.

**Criteri di accettazione**:
- `usePreviewFilters(entries)` istanziato in `ImportPage`
- `filteredIndices`, `filters`, setter e `distinctValues` passati a `PreviewTable` come props
- Aggiornamento immediato della tabella ad ogni modifica filtro (no pulsante "Applica")
- `data-testid` sui controlli filtro:
  - `column-filter-date` — icona imbuto colonna Data
  - `column-filter-project` — icona imbuto colonna Progetto
  - `column-filter-task` — icona imbuto colonna Task
  - `filter-reset` — pulsante/link reset filtri
  - `filter-count` — contatore "Mostrate X di Y"
- Filtri resettati su `handleBack` (torna a Step 1) e `handleReset` (nuova importazione)
- Filtri NON persistiti nella bozza `sessionStorage` — sono transitori e si perdono al reload

---

## STORY-E9c-4: Coerenza filtri con "Precompila righe simili"

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | enhancement |
| **Dipende da** | STORY-E9c-3 |

**Obiettivo**: garantire che `computeSimilarFill` operi correttamente in presenza di filtri attivi.

**Criteri di accettazione**:
- `computeSimilarFill` opera sull'array completo `entries` e `assignments`, indipendentemente dai filtri — un'assegnazione su una riga visibile si propaga anche a righe simili attualmente nascoste
- Il pulsante "Precompila righe simili" rimane sempre operativo: il click precompila tutte le righe simili (filtrate e non filtrate)
- Il contatore `fillableCount` nel messaggio di hint riflette il numero globale di righe precompilabili
- Dopo il click su "Precompila", le righe visibili si aggiornano immediatamente; le righe nascoste sono comunque precompilate (verificabile rimuovendo il filtro)
- Test unitari: precompila con filtri attivi; verifica conteggi globali vs filtrati

---

## STORY-E9c-5: Coerenza filtri con AssignModal e stato assegnazione

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | enhancement |
| **Dipende da** | STORY-E9c-3 |

**Obiettivo**: garantire che l'AssignModal riceva sempre l'indice originale e che il salvataggio aggiorni correttamente lo stato.

**Criteri di accettazione**:
- Il click su "Assegna" o "Modifica" di una riga filtrata apre l'AssignModal con l'`entryIndex` originale (non l'indice nella lista filtrata)
- Il salvataggio dall'AssignModal aggiorna `assignments[originalIndex]` e `entries[originalIndex]`
- Il badge "righe pronte" nel panel head riflette il totale globale aggiornato
- Se l'utente filtra, assegna un connettore, poi rimuove il filtro: l'assegnazione è visibile sulla riga corretta
- Test unitario: apertura modal da lista filtrata, verifica che l'indice passato a `onAssign` sia l'indice originale

---

## STORY-E9c-6: Test E2E filtri Step 2

| Campo | Valore |
|---|---|
| **Stato** | ✅ Done |
| **Tipo** | E2E |
| **Dipende da** | STORY-E9c-3, STORY-E9c-4, STORY-E9c-5 |

**Obiettivo**: copertura Playwright degli scenari principali di filtraggio nello Step 2 del wizard.

**Criteri di accettazione**:
- **Scenario: filtro singolo per progetto** — upload di un file con almeno 3 progetti distinti; selezionare un progetto nel filtro; la tabella mostra solo le righe di quel progetto; il contatore "Mostrate X di Y" è corretto
- **Scenario: filtri combinati (progetto + task)** — applicare filtro progetto, poi filtro task; la tabella mostra solo le righe che soddisfano entrambi i criteri
- **Scenario: reset filtri** — con filtri attivi, click su reset; la tabella torna a mostrare tutte le righe; il contatore scompare
- **Scenario: assegnazione con filtro attivo** — filtrare per progetto; assegnare un connettore a una riga visibile; resettare il filtro; l'assegnazione è visibile sulla riga corretta con il conteggio "righe pronte" aggiornato
- **Scenario: precompila con filtro attivo** — assegnare una riga; click precompila; reset filtri; le righe precompilate sono visibili
- **Fixture**: il file Excel di test deve contenere almeno 8 righe con 3+ progetti distinti, 3+ task distinti, 3+ date distinte

---

## Riepilogo

| ID | Titolo | Tipo | Stato |
|---|---|---|---|
| STORY-E9c-1 | Hook `usePreviewFilters` | tech | ✅ Done |
| STORY-E9c-2 | Filtri in PreviewTable — icone imbuto | feature | ✅ Done |
| STORY-E9c-3 | Cablaggio hook in ImportPage + reset | feature | ✅ Done |
| STORY-E9c-4 | Coerenza filtri con "Precompila righe simili" | enhancement | ✅ Done |
| STORY-E9c-5 | Coerenza filtri con AssignModal | enhancement | ✅ Done |
| STORY-E9c-6 | Test E2E filtri Step 2 | E2E | ✅ Done |
