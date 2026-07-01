import { describe, it, expect } from 'vitest'
import { normalize } from './normalizer'
import { DEFAULT_COLUMN_MAPPING, WarningType } from './types'
import type { ColumnMapping } from './types'

describe('normalize', () => {
  it('round-trip con mapping default: 3 righe valide → 3 entries, 0 warning', () => {
    const rows = [
      { Data: '2026-01-15', Progetto: 'Alpha', Task: 'dev', Ore: 8, Note: 'ok' },
      { Data: '2026-01-16', Progetto: 'Beta', Task: 'review', Ore: 4 },
      { Data: '2026-01-17', Progetto: 'Alpha', Task: 'test', Ore: 6, Note: '' },
    ]
    const { entries, warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    expect(warnings).toHaveLength(0)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      date: '2026-01-15',
      project: 'Alpha',
      task: 'dev',
      hours: 8,
      notes: 'ok',
      connectorAssignments: [],
    })
    expect(entries[1]).toMatchObject({ project: 'Beta', task: 'review', hours: 4 })
    expect(entries[2].notes).toBeUndefined()
  })

  it('1 riga senza Ore → warning MISSING_HOURS, entry con hours: 0', () => {
    const rows = [{ Data: '2026-01-15', Progetto: 'Alpha', Task: 'dev' }]
    const { entries, warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    const hoursWarnings = warnings.filter((w) => w.type === WarningType.MISSING_HOURS)
    expect(hoursWarnings).toHaveLength(1)
    expect(hoursWarnings[0].rowIndex).toBe(1)
    expect(entries[0].hours).toBe(0)
    expect(entries[0].connectorAssignments).toEqual([])
  })

  it('1 riga senza Progetto → warning MISSING_PROJECT', () => {
    const rows = [{ Data: '2026-01-15', Task: 'dev', Ore: 8 }]
    const { entries, warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    const projectWarnings = warnings.filter((w) => w.type === WarningType.MISSING_PROJECT)
    expect(projectWarnings).toHaveLength(1)
    expect(projectWarnings[0].rowIndex).toBe(1)
    expect(entries[0].project).toBe('')
  })

  it('mapping alternativo: colonna "Progetto" rinominata "Project" → normalizzazione corretta', () => {
    const altMapping: ColumnMapping = { ...DEFAULT_COLUMN_MAPPING, project: 'Project' }
    const rows = [{ Data: '2026-01-15', Project: 'MyProject', Task: 'dev', Ore: 6 }]
    const { entries, warnings } = normalize(rows, altMapping)

    expect(warnings.filter((w) => w.type === WarningType.MISSING_PROJECT)).toHaveLength(0)
    expect(entries[0].project).toBe('MyProject')
  })

  it('formato data italiano DD/MM/YYYY → convertito a YYYY-MM-DD', () => {
    const rows = [{ Data: '15/01/2026', Progetto: 'Alpha', Task: 'dev', Ore: 8 }]
    const { entries, warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    expect(warnings.filter((w) => w.type === WarningType.INVALID_DATE)).toHaveLength(0)
    expect(entries[0].date).toBe('2026-01-15')
  })

  it('cella-data Excel (oggetto Date) → convertita a YYYY-MM-DD senza warning', () => {
    const rows = [{ Data: new Date(Date.UTC(2026, 0, 15)), Progetto: 'Alpha', Task: 'dev', Ore: 8 }]
    const { entries, warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    expect(warnings.filter((w) => w.type === WarningType.INVALID_DATE)).toHaveLength(0)
    expect(entries[0].date).toBe('2026-01-15')
  })

  it("colonna Ore assente nell'header → warning MISSING_PERIOD con rowIndex -1", () => {
    const rows = [{ Data: '2026-01-15', Progetto: 'Alpha', Task: 'dev' }]
    const { warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING)

    const periodWarnings = warnings.filter((w) => w.type === WarningType.MISSING_PERIOD)
    expect(periodWarnings).toHaveLength(1)
    expect(periodWarnings[0].rowIndex).toBe(-1)
  })

  it('rowNumbers fornito → rowIndex riferisce la riga Excel reale (header + righe vuote saltate)', () => {
    // FileUpload scarta header (riga 1) e una riga vuota (riga 3): qui sopravvivono
    // le righe Excel 2 e 4. Il warning deve puntare alla riga 4, non alla 2ª riga dati.
    const rows = [
      { Data: '2026-01-15', Progetto: 'Alpha', Task: 'dev', Ore: 8 },
      { Data: '2026-01-16', Task: 'review', Ore: 4 },
    ]
    const { warnings } = normalize(rows, DEFAULT_COLUMN_MAPPING, [2, 4])

    const projectWarnings = warnings.filter((w) => w.type === WarningType.MISSING_PROJECT)
    expect(projectWarnings).toHaveLength(1)
    // rowIndex punta alla riga Excel (4) per il messaggio; entryIndex resta l'indice
    // 0-based nell'array entries (la 2ª riga dati), usato per l'associazione in preview.
    expect(projectWarnings[0].rowIndex).toBe(4)
    expect(projectWarnings[0].entryIndex).toBe(1)
  })
})
