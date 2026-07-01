import { WarningType } from './types'
import type { ColumnMapping, TimesheetEntry, RowWarning } from './types'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const IT_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const HHMM_RE = /^(\d+):(\d{2})$/

function parseHoursValue(raw: unknown): number {
  if (raw === undefined || raw === null) return NaN
  const s = String(raw).trim()
  if (s === '') return NaN
  const hhmmMatch = HHMM_RE.exec(s)
  if (hhmmMatch) {
    const h = parseInt(hhmmMatch[1], 10)
    const m = parseInt(hhmmMatch[2], 10)
    if (m >= 60) return NaN
    return h + m / 60
  }
  return Number(s)
}

function parseDate(raw: unknown): { value: string | undefined; invalid: boolean } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: undefined, invalid: false }
  }
  // ExcelJS restituisce un oggetto Date per le celle formattate come data.
  // Le date Excel sono memorizzate a mezzanotte UTC: usiamo i componenti UTC
  // per evitare slittamenti di un giorno dovuti al fuso orario locale.
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      return { value: undefined, invalid: true }
    }
    const yyyy = raw.getUTCFullYear().toString().padStart(4, '0')
    const mm = (raw.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = raw.getUTCDate().toString().padStart(2, '0')
    return { value: `${yyyy}-${mm}-${dd}`, invalid: false }
  }
  const s = String(raw).trim()
  if (ISO_DATE_RE.test(s)) {
    return { value: s, invalid: false }
  }
  const itMatch = IT_DATE_RE.exec(s)
  if (itMatch) {
    return { value: `${itMatch[3]}-${itMatch[2]}-${itMatch[1]}`, invalid: false }
  }
  // Numeri seriali Excel grezzi e formati non riconosciuti producono INVALID_DATE.
  return { value: undefined, invalid: true }
}

export function normalize(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  rowNumbers?: number[],
): { entries: TimesheetEntry[]; warnings: RowWarning[] } {
  const warnings: RowWarning[] = []
  const entries: TimesheetEntry[] = []

  // Normalize row keys to lowercase for case-insensitive column matching.
  const normalizedRows = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k.toLowerCase().trim()] = v
    }
    return out
  })
  const m = {
    date: mapping.date.toLowerCase().trim(),
    project: mapping.project.toLowerCase().trim(),
    task: mapping.task.toLowerCase().trim(),
    hours: mapping.hours.toLowerCase().trim(),
    notes: mapping.notes.toLowerCase().trim(),
  }

  // MISSING_PERIOD: hours column absent from every row header.
  const allKeys = new Set(normalizedRows.flatMap((r) => Object.keys(r)))
  if (!allKeys.has(m.hours)) {
    warnings.push({
      rowIndex: -1,
      entryIndex: -1,
      type: WarningType.MISSING_PERIOD,
      message: `Colonna "${mapping.hours}" non trovata nel file`,
    })
  }

  normalizedRows.forEach((row, idx) => {
    // rowIndex = numero di riga Excel reale (intestazione inclusa) fornito da FileUpload,
    // così i messaggi puntano alla riga visibile dall'utente nel foglio. In assenza dei
    // numeri reali si ricade sull'indice 1-based delle righe dati.
    const rowIndex = rowNumbers?.[idx] ?? idx + 1

    const rawProject = row[m.project]
    const project =
      rawProject !== undefined && rawProject !== null && String(rawProject).trim() !== ''
        ? String(rawProject).trim()
        : ''

    const rawTask = row[m.task]
    const task =
      rawTask !== undefined && rawTask !== null && String(rawTask).trim() !== ''
        ? String(rawTask).trim()
        : ''

    const rawHours = row[m.hours]
    const parsedHours = parseHoursValue(rawHours)

    const rawNotes = row[m.notes]
    const notes =
      rawNotes !== undefined && rawNotes !== null && String(rawNotes).trim() !== ''
        ? String(rawNotes).trim()
        : undefined

    if (!project) {
      warnings.push({
        rowIndex,
        entryIndex: idx,
        type: WarningType.MISSING_PROJECT,
        message: `Riga ${rowIndex}: colonna "${mapping.project}" mancante o vuota`,
      })
    }

    if (!task) {
      warnings.push({
        rowIndex,
        entryIndex: idx,
        type: WarningType.MISSING_TASK,
        message: `Riga ${rowIndex}: colonna "${mapping.task}" mancante o vuota`,
      })
    }

    let hours = 0
    if (isNaN(parsedHours)) {
      warnings.push({
        rowIndex,
        entryIndex: idx,
        type: WarningType.MISSING_HOURS,
        message: `Riga ${rowIndex}: valore "${mapping.hours}" assente o non numerico`,
      })
    } else {
      hours = parsedHours
    }

    const { value: date, invalid: dateInvalid } = parseDate(row[m.date])
    if (dateInvalid) {
      warnings.push({
        rowIndex,
        entryIndex: idx,
        type: WarningType.INVALID_DATE,
        message: `Riga ${rowIndex}: data non riconosciuta (usare YYYY-MM-DD o DD/MM/YYYY)`,
      })
    }

    entries.push({
      ...(date !== undefined ? { date } : {}),
      project,
      task,
      hours,
      ...(notes !== undefined ? { notes } : {}),
      connectorAssignments: [],
    })
  })

  return { entries, warnings }
}
