// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AssignModal } from './AssignModal'
import type { ConnectorAssignment, TimesheetEntry } from '../../lib/timesheet/types'
import type { ConnectorOut } from '../../types'

/* ── Mocks ──────────────────────────────────────────────── */

vi.mock('../../hooks/useAdapterAutocomplete', () => ({
  useDebounce: <T,>(v: T) => v,
  useAdapterProjects: (_label: string | null, _query: string) => ({
    data: [
      { id: 'proj-1', name: 'Progetto Alpha' },
      { id: 'proj-2', name: 'Progetto Beta' },
    ],
    isLoading: false,
  }),
  useAdapterTasks: (_label: string | null, projectId: string | null, _query: string) => ({
    data: projectId
      ? [
          { id: 'task-1', name: 'Task Uno' },
          { id: 'task-2', name: 'Task Due' },
        ]
      : [],
    isLoading: false,
  }),
}))

/* ── Helpers ────────────────────────────────────────────── */

function makeConnector(label: string, service: 'jira' | 'odoo' = 'jira'): ConnectorOut {
  return {
    label,
    service,
    base_url: null,
    account_identifier: null,
    configured: true,
    needs_reauth: false,
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    date: '2026-05-04',
    project: 'Progetto A',
    task: 'Dev',
    hours: 8,
    connectorAssignments: [],
    ...overrides,
  }
}

function makeAssignment(label: string, projectId = '', taskId = ''): ConnectorAssignment {
  return {
    connectorLabel: label,
    service: 'jira',
    remoteProjectId: projectId,
    remoteProjectName: projectId ? 'Progetto Alpha' : '',
    remoteTaskId: taskId,
    remoteTaskName: taskId ? 'Task Uno' : '',
    suggested: false,
  }
}

function renderModal(
  props: Partial<Parameters<typeof AssignModal>[0]> = {},
  connectors: ConnectorOut[] = [makeConnector('Jira principale')],
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSave = vi.fn()
  const onClose = vi.fn()

  const defaultEntry = makeEntry()
  const result = render(
    <QueryClientProvider client={qc}>
      <AssignModal
        open={true}
        entry={defaultEntry}
        entryIndex={0}
        connectors={connectors}
        onSave={onSave}
        onClose={onClose}
        data-testid="modal"
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onSave, onClose, ...result }
}

/* ── Tests ──────────────────────────────────────────────── */

describe('AssignModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra empty state quando nessun connettore assegnato', () => {
    renderModal()
    expect(screen.getByTestId('modal-empty-state')).toBeInTheDocument()
  })

  it('Conferma abilitata con lista vuota (riga non verrà importata — non importata, non errore)', () => {
    renderModal()
    // Lista vuota → canSave = true: l'utente sceglie consapevolmente di non assegnare connettori
    expect(screen.getByTestId('modal-btn-save')).toBeEnabled()
  })

  it('Aggiungi connettore aggiunge una card', async () => {
    renderModal()
    fireEvent.click(screen.getByTestId('modal-btn-add'))
    await waitFor(() => expect(screen.getByTestId('modal-card-0')).toBeInTheDocument())
    expect(screen.queryByTestId('modal-empty-state')).not.toBeInTheDocument()
  })

  it('Rimuovi connettore torna allo empty state', async () => {
    renderModal()
    fireEvent.click(screen.getByTestId('modal-btn-add'))
    await waitFor(() => expect(screen.getByTestId('modal-card-0-remove')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('modal-card-0-remove'))
    await waitFor(() => expect(screen.getByTestId('modal-empty-state')).toBeInTheDocument())
  })

  it('Conferma è disabilitata se la card non ha progetto e task', async () => {
    renderModal()
    fireEvent.click(screen.getByTestId('modal-btn-add'))
    await waitFor(() => expect(screen.getByTestId('modal-card-0')).toBeInTheDocument())
    // Progetto e task vuoti → canSave = false
    expect(screen.getByTestId('modal-btn-save')).toBeDisabled()
  })

  it('Task autocomplete è disabilitato finché il progetto non è scelto', async () => {
    renderModal()
    fireEvent.click(screen.getByTestId('modal-btn-add'))
    await waitFor(() => expect(screen.getByTestId('modal-card-0')).toBeInTheDocument())

    const taskAutocomplete = screen.getByTestId('modal-card-0-task-autocomplete')
    const taskInput = taskAutocomplete.querySelector('input')
    expect(taskInput).toBeDisabled()
  })

  it('onSave viene chiamato con gli assignments corretti al click Conferma', async () => {
    const existingAssignments = [makeAssignment('Jira principale', 'proj-1', 'task-1')]
    const entry = makeEntry({ connectorAssignments: existingAssignments })
    const { onSave } = renderModal({ entry, entryIndex: 2 })

    const saveBtn = screen.getByTestId('modal-btn-save')
    expect(saveBtn).toBeEnabled()
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ connectorLabel: 'Jira principale', remoteProjectId: 'proj-1' }),
      ]),
    )
  })

  it('chip Suggerito visibile quando suggested=true', async () => {
    const suggestedAssignments: ConnectorAssignment[] = [
      {
        connectorLabel: 'Jira principale',
        service: 'jira',
        remoteProjectId: 'proj-1',
        remoteProjectName: 'Progetto Alpha',
        remoteTaskId: 'task-1',
        remoteTaskName: 'Task Uno',
        suggested: true,
      },
    ]
    const entry = makeEntry({ connectorAssignments: suggestedAssignments })
    renderModal({ entry })

    expect(screen.getByTestId('modal-card-0-chip-suggested')).toBeInTheDocument()
    expect(screen.getByTestId('modal-suggest-note')).toBeInTheDocument()
  })

  it('onClose viene chiamato al click Annulla', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByTestId('modal-btn-cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('chip Suggerito rimosso dopo cambio connettore', async () => {
    const connectors = [makeConnector('Jira'), makeConnector('Odoo', 'odoo')]
    const suggestedAssignment: ConnectorAssignment = {
      connectorLabel: 'Jira',
      service: 'jira',
      remoteProjectId: 'proj-1',
      remoteProjectName: 'Progetto Alpha',
      remoteTaskId: 'task-1',
      remoteTaskName: 'Task Uno',
      suggested: true,
    }
    const entry = makeEntry({ connectorAssignments: [suggestedAssignment] })
    renderModal({ entry }, connectors)

    expect(screen.getByTestId('modal-card-0-chip-suggested')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('modal-card-0-connector-Odoo'))

    await waitFor(() => {
      expect(screen.queryByTestId('modal-card-0-chip-suggested')).not.toBeInTheDocument()
    })
  })
})
