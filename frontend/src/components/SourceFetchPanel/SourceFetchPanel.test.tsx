// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { SourceFetchPanel } from './SourceFetchPanel'
import { apiClient } from '@/lib/apiClient'

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

const mockedPost = vi.mocked(apiClient.post)

function renderPanel(onFetched = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const result = render(
    <SourceFetchPanel
      connectorLabel="Clockify team"
      serviceLabel="Clockify"
      onFetched={onFetched}
    />,
    { wrapper },
  )
  return { onFetched, ...result }
}

describe('SourceFetchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('precompila un periodo di default (mese corrente)', () => {
    renderPanel()
    const start = screen.getByTestId('source-fetch-start') as HTMLInputElement
    const end = screen.getByTestId('source-fetch-end') as HTMLInputElement
    expect(start.value).not.toBe('')
    expect(end.value).not.toBe('')
  })

  it('scarica le voci e le converte in TimesheetEntry al click su Scarica voci', async () => {
    mockedPost.mockResolvedValueOnce({
      rows: [
        { date: '2026-05-04', project: 'Proj A', task: 'Dev', hours: 8, notes: 'ok' },
        { date: '2026-05-05', project: 'Proj B', task: 'QA', hours: 4, notes: null },
      ],
    })
    const { onFetched } = renderPanel()

    fireEvent.click(screen.getByTestId('source-fetch-submit'))

    await waitFor(() => expect(onFetched).toHaveBeenCalledTimes(1))
    const entries = onFetched.mock.calls[0][0]
    expect(entries).toEqual([
      {
        date: '2026-05-04',
        project: 'Proj A',
        task: 'Dev',
        hours: 8,
        notes: 'ok',
        connectorAssignments: [],
      },
      {
        date: '2026-05-05',
        project: 'Proj B',
        task: 'QA',
        hours: 4,
        connectorAssignments: [],
      },
    ])
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/me/sources/Clockify%20team/fetch',
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    )
    expect(screen.getByTestId('source-fetch-result')).toHaveTextContent('2 voci scaricate')
  })

  it('mostra il link al Profilo su errore needs_reauth (409)', async () => {
    mockedPost.mockRejectedValueOnce(
      new Error(JSON.stringify({ detail: { code: 'needs_reauth', message: 'Token scaduto' } })),
    )
    renderPanel()

    fireEvent.click(screen.getByTestId('source-fetch-submit'))

    await waitFor(() => expect(screen.getByTestId('source-fetch-error')).toBeInTheDocument())
    expect(screen.getByTestId('source-fetch-error')).toHaveTextContent('Token scaduto')
    expect(screen.getByTestId('source-fetch-reauth-link')).toBeInTheDocument()
    expect(screen.queryByTestId('source-fetch-retry')).not.toBeInTheDocument()
  })

  it('mostra un pulsante Riprova su errore backend_unavailable (502)', async () => {
    mockedPost.mockRejectedValueOnce(
      new Error(
        JSON.stringify({
          detail: { code: 'backend_unavailable', message: 'Servizio non raggiungibile' },
        }),
      ),
    )
    renderPanel()

    fireEvent.click(screen.getByTestId('source-fetch-submit'))

    await waitFor(() => expect(screen.getByTestId('source-fetch-error')).toBeInTheDocument())
    expect(screen.getByTestId('source-fetch-error')).toHaveTextContent('Servizio non raggiungibile')
    expect(screen.getByTestId('source-fetch-retry')).toBeInTheDocument()
    expect(screen.queryByTestId('source-fetch-reauth-link')).not.toBeInTheDocument()
  })
})
