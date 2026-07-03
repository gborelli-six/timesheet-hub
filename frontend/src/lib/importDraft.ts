import type { TimesheetEntry, RowWarning } from './timesheet/types'

export type ImportStep = 'upload' | 'preview' | 'confirm'

// Versione dello schema della bozza: incrementare quando cambia la forma dei
// dati persistiti, così le bozze vecchie in sessionStorage vengono ignorate.
const DRAFT_VERSION = 1

export interface ImportDraft {
  v: number
  step: ImportStep
  entries: TimesheetEntry[]
  warnings: RowWarning[]
  hasFile: boolean
}

function keyFor(userId: string): string {
  return `import-draft:${userId}`
}

/**
 * Legge la bozza del wizard di importazione da sessionStorage.
 * Ritorna null se assente, di versione non compatibile o non deserializzabile.
 */
export function loadDraft(userId: string): ImportDraft | null {
  try {
    const raw = sessionStorage.getItem(keyFor(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImportDraft
    if (!parsed || parsed.v !== DRAFT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Salva la bozza in sessionStorage. Ignora silenziosamente errori di quota o
 * ambienti senza sessionStorage: la persistenza è best-effort e non deve mai
 * rompere il wizard.
 */
export function saveDraft(userId: string, draft: Omit<ImportDraft, 'v'>): void {
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify({ v: DRAFT_VERSION, ...draft }))
  } catch {
    // no-op: QuotaExceededError o storage non disponibile
  }
}

/** Rimuove la bozza da sessionStorage. */
export function clearDraft(userId: string): void {
  try {
    sessionStorage.removeItem(keyFor(userId))
  } catch {
    // no-op
  }
}
