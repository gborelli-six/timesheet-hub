// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import LogPage from './LogPage'
import { useImports } from '@/hooks/useImports'
import type { ImportLogSummary } from '@/types'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/hooks/useImports', () => ({
  useImports: vi.fn(),
}))

const mockUseImports = vi.mocked(useImports)

function summary(overrides: Partial<ImportLogSummary> = {}): ImportLogSummary {
  return {
    id: 'imp-1',
    period_start: '2026-05-01',
    period_end: '2026-05-31',
    status: 'partial',
    total_rows: 5,
    success_rows: 3,
    failed_rows: 2,
    services: ['jira', 'odoo'],
    created_at: '2026-05-28T16:42:00',
    ...overrides,
  }
}

function mockState(over: Partial<ReturnType<typeof useImports>> = {}) {
  mockUseImports.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useImports>)
}

describe('LogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderizza le righe dalla lista', () => {
    mockState({ data: [summary(), summary({ id: 'imp-2', status: 'success', failed_rows: 0 })] })
    render(<LogPage />)
    expect(screen.getAllByTestId('log-row')).toHaveLength(2)
    expect(screen.getByTestId('log-count')).toHaveTextContent('2 import')
  })

  it('naviga al dettaglio al click su una riga', () => {
    mockState({ data: [summary()] })
    render(<LogPage />)
    fireEvent.click(screen.getByTestId('log-row'))
    expect(navigateMock).toHaveBeenCalledWith('/log/imp-1')
  })

  it('cambiare un filtro aggiorna i parametri passati a useImports', () => {
    mockState({ data: [] })
    render(<LogPage />)
    const from = screen.getByTestId('filter-period-from') as HTMLInputElement
    fireEvent.change(from, { target: { value: '2026-05-01' } })
    expect(mockUseImports).toHaveBeenLastCalledWith(
      expect.objectContaining({ period_from: '2026-05-01' }),
    )
  })

  it('mostra lo stato vuoto', () => {
    mockState({ data: [] })
    render(<LogPage />)
    expect(screen.getByTestId('log-empty')).toBeInTheDocument()
  })

  it('mostra lo stato di errore', () => {
    mockState({ isError: true })
    render(<LogPage />)
    expect(screen.getByTestId('log-error')).toBeInTheDocument()
  })

  it('mostra lo stato di caricamento', () => {
    mockState({ isLoading: true })
    render(<LogPage />)
    expect(screen.getByTestId('log-loading')).toBeInTheDocument()
  })
})
