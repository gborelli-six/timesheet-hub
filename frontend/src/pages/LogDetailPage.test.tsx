// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import LogDetailPage from './LogDetailPage'
import { useImportDetail } from '@/hooks/useImports'
import type { ImportLogDetail, ImportRowOut } from '@/types'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ id: 'imp-1' }),
}))

vi.mock('@/hooks/useImports', () => ({
  useImportDetail: vi.fn(),
}))

const mockUseImportDetail = vi.mocked(useImportDetail)

function row(over: Partial<ImportRowOut>): ImportRowOut {
  return {
    id: 'r',
    row_number: 1,
    connector_label: 'Jira',
    service: 'jira',
    excel_project: 'Progetto A',
    excel_task: 'Dev',
    remote_project_id: 'p1',
    remote_project_name: 'Remote A',
    remote_task_id: 't1',
    remote_task_name: 'Task A',
    hours: 8,
    status: 'success',
    error_message: null,
    ...over,
  }
}

const DETAIL: ImportLogDetail = {
  id: 'imp-1',
  period_start: '2026-05-01',
  period_end: '2026-05-31',
  status: 'partial',
  total_rows: 2,
  success_rows: 1,
  failed_rows: 1,
  services: ['jira', 'linear'],
  created_at: '2026-05-28T16:42:00',
  rows: [
    row({ id: 'r1', row_number: 1, service: 'jira', status: 'success' }),
    row({
      id: 'r2',
      row_number: 2,
      service: 'linear',
      status: 'failed',
      error_message: 'Task remoto già chiuso',
    }),
  ],
}

function mockState(over: Partial<ReturnType<typeof useImportDetail>> = {}) {
  mockUseImportDetail.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...over,
  } as unknown as ReturnType<typeof useImportDetail>)
}

describe('LogDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("mostra il messaggio d'errore solo sulle righe fallite", () => {
    mockState({ data: DETAIL })
    render(<LogDetailPage />)
    const errors = screen.getAllByTestId('row-error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toHaveTextContent('Task remoto già chiuso')
    expect(screen.getAllByTestId('detail-row')).toHaveLength(2)
  })

  it('il filtro "Solo errori" nasconde le righe riuscite', () => {
    mockState({ data: DETAIL })
    render(<LogDetailPage />)
    fireEvent.click(screen.getByText(/Solo errori/))
    expect(screen.getAllByTestId('detail-row')).toHaveLength(1)
  })

  it('mostra lo stato non trovato quando isError', () => {
    mockState({ isError: true })
    render(<LogDetailPage />)
    expect(screen.getByTestId('detail-notfound')).toBeInTheDocument()
  })

  it('mostra il loading', () => {
    mockState({ isLoading: true })
    render(<LogDetailPage />)
    expect(screen.getByTestId('detail-loading')).toBeInTheDocument()
  })
})
