// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useImports, useImportDetail } from './useImports'
import { apiClient } from '@/lib/apiClient'
import type { ImportLogSummary } from '@/types'

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockedGet = vi.mocked(apiClient.get)

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const SUMMARY: ImportLogSummary = {
  id: 'imp-1',
  period_start: '2026-05-01',
  period_end: '2026-05-31',
  status: 'partial',
  total_rows: 5,
  success_rows: 3,
  failed_rows: 2,
  services: ['jira', 'odoo'],
  created_at: '2026-05-28T16:42:00',
}

describe('useImports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetch ok popola i dati della lista', async () => {
    mockedGet.mockResolvedValueOnce([SUMMARY])
    const { result } = renderHook(() => useImports(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([SUMMARY])
    expect(mockedGet).toHaveBeenCalledWith('/api/me/imports')
  })

  it('risposta di errore → stato error', async () => {
    mockedGet.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useImports(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('i filtri non vuoti finiscono nei params (e le chiavi vuote sono omesse)', async () => {
    mockedGet.mockResolvedValueOnce([])
    const { result } = renderHook(
      () => useImports({ service: 'jira', status: '', period_from: '2026-05-01' }),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith('/api/me/imports?service=jira&period_from=2026-05-01')
  })
})

describe('useImportDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('non esegue la query quando id è null (enabled=false)', () => {
    renderHook(() => useImportDetail(null), { wrapper: wrapper() })
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('fetch ok popola il dettaglio', async () => {
    mockedGet.mockResolvedValueOnce({ ...SUMMARY, rows: [] })
    const { result } = renderHook(() => useImportDetail('imp-1'), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith('/api/me/imports/imp-1')
  })
})
