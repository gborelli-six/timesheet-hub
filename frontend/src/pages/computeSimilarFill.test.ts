import { describe, it, expect } from 'vitest'
import { computeSimilarFill } from './ImportPage'
import type { ConnectorAssignment, TimesheetEntry } from '../lib/timesheet/types'

function makeEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    date: '2026-01-15',
    project: 'Progetto A',
    task: 'Dev',
    hours: 8,
    connectorAssignments: [],
    ...overrides,
  }
}

const ASSIGN: ConnectorAssignment[] = [
  {
    connectorLabel: 'Odoo',
    service: 'odoo',
    remoteProjectId: 'p1',
    remoteProjectName: 'Progetto Alpha',
    remoteTaskId: 't1',
    remoteTaskName: 'Task Uno',
    suggested: false,
  },
]

describe('computeSimilarFill (coerenza con filtri — E9c-4)', () => {
  it('precompila anche righe simili non visibili nel filtro corrente', () => {
    // 3 righe: 0 e 2 stessa chiave (Beta/Dev), 1 diversa. Solo la 0 è assegnata.
    const entries = [
      makeEntry({ project: 'Beta', task: 'Dev' }), // 0 (assegnata, ipoteticamente visibile)
      makeEntry({ project: 'Alpha', task: 'Review' }), // 1 (nascosta dal filtro)
      makeEntry({ project: 'Beta', task: 'Dev' }), // 2 (nascosta dal filtro)
    ]
    const assignments: Record<number, ConnectorAssignment[]> = { 0: ASSIGN }

    // computeSimilarFill ignora i filtri: opera sull'array completo.
    const add = computeSimilarFill(entries, assignments)

    // La riga 2 (nascosta) deve essere precompilata perché ha la stessa chiave della 0.
    expect(Object.keys(add)).toEqual(['2'])
    expect(add[2][0].suggested).toBe(true)
    expect(add[2][0].remoteProjectId).toBe('p1')
  })

  it('fillableCount globale non dipende dal sottoinsieme filtrato', () => {
    const entries = [
      makeEntry({ project: 'Beta', task: 'Dev' }), // 0 assegnata
      makeEntry({ project: 'Beta', task: 'Dev' }), // 1 simile
      makeEntry({ project: 'Beta', task: 'Dev' }), // 2 simile
    ]
    const assignments: Record<number, ConnectorAssignment[]> = { 0: ASSIGN }
    const add = computeSimilarFill(entries, assignments)
    // 2 righe precompilabili a livello globale, indipendentemente da quali sono visibili.
    expect(Object.keys(add).length).toBe(2)
  })
})
