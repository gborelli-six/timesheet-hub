// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import PreviewTable from './PreviewTable'
import { WarningType } from '../../lib/timesheet/types'
import type { ConnectorAssignment, TimesheetEntry, RowWarning } from '../../lib/timesheet/types'

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

function makeWarning(
  entryIndex: number,
  type: WarningType = WarningType.MISSING_HOURS,
): RowWarning {
  // rowIndex simula la riga Excel (header a riga 1, prima riga dati a riga 2);
  // l'associazione entry↔warning avviene tramite entryIndex.
  const rowIndex = entryIndex + 2
  return { rowIndex, entryIndex, type, message: `Warning riga ${rowIndex}` }
}

describe('PreviewTable', () => {
  it('rendering con 3 entry valide: nessun alert warning, nessuna riga evidenziata', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()]
    render(<PreviewTable entries={entries} warnings={[]} />)

    expect(screen.queryByTestId('preview-warning-alert')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('preview-row-warning')).toHaveLength(0)
  })

  it('rendering con 1 entry valida + 2 con warning: alert corretto, 2 righe evidenziate', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()]
    const warnings = [
      makeWarning(0, WarningType.MISSING_PROJECT),
      makeWarning(1, WarningType.MISSING_HOURS),
    ]
    render(<PreviewTable entries={entries} warnings={warnings} />)

    const alert = screen.getByTestId('preview-warning-alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('1 riga valida')
    expect(alert).toHaveTextContent('2 righe con warning')

    expect(screen.getAllByTestId('preview-row-warning')).toHaveLength(2)
  })

  it('chip warning mostra etichetta tipizzata per warning singolo', () => {
    const entries = [makeEntry()]
    const warnings = [makeWarning(0, WarningType.MISSING_PROJECT)]
    render(<PreviewTable entries={entries} warnings={warnings} />)

    expect(screen.getByTestId('preview-warning-chip')).toHaveTextContent('Progetto mancante')
  })

  it('chip warning mostra conteggio per warning multipli sulla stessa riga', () => {
    const entries = [makeEntry()]
    const warnings = [
      makeWarning(0, WarningType.MISSING_PROJECT),
      makeWarning(0, WarningType.MISSING_HOURS),
    ]
    render(<PreviewTable entries={entries} warnings={warnings} />)

    expect(screen.getByTestId('preview-warning-chip')).toHaveTextContent('2 warning')
  })

  it('righe senza warning mostrano badge OK', () => {
    render(<PreviewTable entries={[makeEntry()]} warnings={[]} />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('icona sparkle visibile per assignment con suggested=true', () => {
    const assignmentsByRow: Record<number, ConnectorAssignment[]> = {
      0: [
        {
          connectorLabel: 'Jira principale',
          service: 'jira',
          remoteProjectId: 'proj-1',
          remoteProjectName: 'Progetto Alpha',
          remoteTaskId: 'task-1',
          remoteTaskName: 'Task Uno',
          suggested: true,
        },
      ],
    }
    render(
      <PreviewTable
        entries={[makeEntry()]}
        warnings={[]}
        assignmentsByRow={assignmentsByRow}
        onAssign={() => {}}
      />,
    )
    expect(screen.getByTestId('suggested-icon-0-0')).toBeInTheDocument()
  })

  it('nessuna icona sparkle per assignment con suggested=false', () => {
    const assignmentsByRow: Record<number, ConnectorAssignment[]> = {
      0: [
        {
          connectorLabel: 'Jira principale',
          service: 'jira',
          remoteProjectId: 'proj-1',
          remoteProjectName: 'Progetto Alpha',
          remoteTaskId: 'task-1',
          remoteTaskName: 'Task Uno',
          suggested: false,
        },
      ],
    }
    render(
      <PreviewTable
        entries={[makeEntry()]}
        warnings={[]}
        assignmentsByRow={assignmentsByRow}
        onAssign={() => {}}
      />,
    )
    expect(screen.queryByTestId('suggested-icon-0-0')).not.toBeInTheDocument()
  })
})
