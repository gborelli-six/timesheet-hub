// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import ImportPage from './ImportPage'
import { useAuth } from '@/hooks/useAuth'
import { useConnectors } from '@/hooks/useConnectors'
import { useConnectorTypes } from '@/hooks/useConnectorTypes'
import { useMappingSuggestions } from '@/hooks/useMappingSuggestions'
import { useImportPolling } from '@/hooks/useImports'
import { useSubmitImport } from '@/hooks/useSubmitImport'
import type { ConnectorOut, ConnectorTypeOut } from '@/types'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('exceljs', () => {
  const MockWorkbook = vi.fn().mockImplementation(() => ({
    worksheets: [
      {
        eachRow: (cb: (row: { values: unknown[] }, rowNumber: number) => void) => {
          // Intestazioni in inglese: DEFAULT_COLUMN_MAPPING è stato allineato al
          // template aziendale standard (Date/Project/Task/Hours/Notes) da main.
          cb({ values: [null, 'Project', 'Task', 'Hours'] }, 1)
          cb({ values: [null, 'Proj A', 'Dev', 8] }, 2)
        },
      },
    ],
    xlsx: {
      load: vi.fn().mockResolvedValue(undefined),
    },
  }))
  return { default: { Workbook: MockWorkbook } }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('@/hooks/useConnectors', () => ({
  useConnectors: vi.fn(),
}))
vi.mock('@/hooks/useConnectorTypes', () => ({
  useConnectorTypes: vi.fn(),
}))
vi.mock('@/hooks/useMappingSuggestions', () => ({
  useMappingSuggestions: vi.fn(),
}))
// ImportPage usa useImportPolling per il passaggio da 'submitting' a 'result'
// dopo il submit (coda di importazione asincrona, E9d): nessuno di questi test
// arriva al submit, quindi basta un valore neutro senza dato in polling.
vi.mock('@/hooks/useImports', () => ({
  useImportPolling: vi.fn(),
}))
vi.mock('@/hooks/useSubmitImport', () => ({
  useSubmitImport: vi.fn(),
}))

// AssignCard interroga l'autocomplete degli adapter: senza mock servirebbe un
// QueryClientProvider attorno alla pagina, che qui non aggiunge nulla al test.
vi.mock('@/hooks/useAdapterAutocomplete', () => ({
  useDebounce: <T,>(v: T) => v,
  useAdapterProjects: () => ({ data: [], isLoading: false }),
  useAdapterTasks: () => ({ data: [], isLoading: false }),
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseConnectors = vi.mocked(useConnectors)
const mockUseConnectorTypes = vi.mocked(useConnectorTypes)
const mockUseMappingSuggestions = vi.mocked(useMappingSuggestions)
const mockUseImportPolling = vi.mocked(useImportPolling)
const mockUseSubmitImport = vi.mocked(useSubmitImport)

function makeFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: 'application/octet-stream' })
}

function dropFile(dropzone: HTMLElement, file: File) {
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
}

function mockConnectorsState(data: ConnectorOut[], isLoading = false) {
  mockUseConnectors.mockReturnValue({
    data,
    isLoading,
    isError: false,
  } as unknown as ReturnType<typeof useConnectors>)
}

function mockConnectorTypesState(data: ConnectorTypeOut[], isLoading = false) {
  mockUseConnectorTypes.mockReturnValue({
    data,
    isLoading,
    isError: false,
  } as unknown as ReturnType<typeof useConnectorTypes>)
}

function clockifyConnectorType(): ConnectorTypeOut {
  return {
    service: 'clockify',
    label: 'Clockify',
    is_source: true,
    is_destination: false,
    available: true,
    secret_label: 'API key',
    secret_help: null,
    requires_base_url: false,
    requires_account_identifier: false,
    account_identifier_label: 'Identificativo account',
    config_fields: [],
  }
}

function clockifyConnector(): ConnectorOut {
  return {
    label: 'Clockify team',
    service: 'clockify',
    base_url: null,
    account_identifier: null,
    config: {},
    configured: true,
    needs_reauth: false,
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function odooConnectorType(): ConnectorTypeOut {
  return {
    service: 'odoo',
    label: 'Odoo',
    is_source: false,
    is_destination: true,
    available: true,
    secret_label: 'Password',
    secret_help: null,
    requires_base_url: true,
    requires_account_identifier: true,
    account_identifier_label: 'Utente',
    config_fields: [
      { key: 'db_name', label: 'Nome database', type: 'string', required: true, help: null },
    ],
  }
}

function odooConnector(): ConnectorOut {
  return {
    label: 'Odoo prod',
    service: 'odoo',
    base_url: 'https://odoo.example.com',
    account_identifier: 'alice',
    config: { db_name: 'prod' },
    configured: true,
    needs_reauth: false,
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // ImportPage ripristina una bozza da sessionStorage per userId (E9c/E13):
    // senza reset esplicito, una bozza salvata da un test (es. dopo "Avanti"
    // in preview) sopravvive al render del test successivo — che mocka sempre
    // lo stesso userId 'user-1' — e ne altera lo step iniziale.
    sessionStorage.clear()
    mockUseAuth.mockReturnValue({
      data: { id: 'user-1', email: 'employee@sixfeetup.it', role: 'employee' },
    } as unknown as ReturnType<typeof useAuth>)
    mockUseMappingSuggestions.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMappingSuggestions>)
    mockUseImportPolling.mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useImportPolling>)
    mockUseSubmitImport.mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useSubmitImport>)
  })

  describe('senza connettori sorgente configurati', () => {
    beforeEach(() => {
      mockConnectorsState([])
      mockConnectorTypesState([])
    })

    it('salta lo step Sorgente e apre direttamente sull’upload Excel', async () => {
      render(<ImportPage />)

      // Nessuna schermata di scelta sorgente: il dropzone è visibile subito.
      expect(await screen.findByTestId('file-upload-dropzone')).toBeInTheDocument()
      expect(screen.queryByTestId('source-option-excel')).not.toBeInTheDocument()
      // StepBar a 3 step: "Sorgente" non compare.
      expect(screen.queryByText('Sorgente')).not.toBeInTheDocument()
      expect(screen.getByText('Upload')).toBeInTheDocument()
    })

    it('non mostra il pulsante Indietro nello step di upload (nessuno step precedente)', async () => {
      render(<ImportPage />)
      await screen.findByTestId('file-upload-dropzone')
      expect(screen.queryByTestId('input-btn-back')).not.toBeInTheDocument()
    })

    it('il flusso di upload resta identico: parsing → Avanti → preview', async () => {
      render(<ImportPage />)
      const dropzone = await screen.findByTestId('file-upload-dropzone')

      dropFile(dropzone, makeFile('timesheet.xlsx', 1024))

      const nextBtn = await screen.findByTestId('upload-btn-next')
      await waitFor(() => expect(nextBtn).toBeEnabled())
      fireEvent.click(nextBtn)

      expect(await screen.findByText('Proj A')).toBeInTheDocument()
      expect(screen.getByTestId('preview-btn-back')).toBeInTheDocument()
    })
  })

  describe('con almeno un connettore sorgente configurato', () => {
    beforeEach(() => {
      mockConnectorsState([clockifyConnector()])
      mockConnectorTypesState([clockifyConnectorType()])
    })

    it('mostra lo step Sorgente all’avvio, con la card Excel disponibile', async () => {
      render(<ImportPage />)
      expect(await screen.findByTestId('source-option-excel')).toBeInTheDocument()
      expect(screen.getByText('Sorgente')).toBeInTheDocument()
      // Il flusso di upload non è ancora visibile: bisogna prima scegliere la sorgente.
      expect(screen.queryByTestId('file-upload-dropzone')).not.toBeInTheDocument()
    })

    it('scegliere Excel allo step Sorgente porta al flusso di upload preesistente, invariato', async () => {
      render(<ImportPage />)
      fireEvent.click(await screen.findByTestId('source-option-excel'))

      const dropzone = await screen.findByTestId('file-upload-dropzone')
      expect(dropzone).toBeInTheDocument()

      dropFile(dropzone, makeFile('timesheet.xlsx', 1024))

      const nextBtn = await screen.findByTestId('upload-btn-next')
      await waitFor(() => expect(nextBtn).toBeEnabled())
      fireEvent.click(nextBtn)

      expect(await screen.findByText('Proj A')).toBeInTheDocument()
      expect(screen.getByTestId('preview-btn-back')).toBeInTheDocument()
    })

    it('Indietro dallo step input torna allo step Sorgente', async () => {
      render(<ImportPage />)
      fireEvent.click(await screen.findByTestId('source-option-excel'))
      await screen.findByTestId('file-upload-dropzone')

      fireEvent.click(screen.getByTestId('input-btn-back'))

      expect(await screen.findByTestId('source-option-excel')).toBeInTheDocument()
      expect(screen.queryByTestId('file-upload-dropzone')).not.toBeInTheDocument()
    })
  })

  describe('assegnazione riga → connettore', () => {
    beforeEach(() => {
      mockConnectorsState([clockifyConnector(), odooConnector()])
      mockConnectorTypesState([clockifyConnectorType(), odooConnectorType()])
    })

    it('propone solo i connettori di destinazione, mai una sorgente', async () => {
      // Una sorgente non ha un adapter di scrittura: assegnarle una riga
      // darebbe un autocomplete vuoto e un errore al submit.
      render(<ImportPage />)
      fireEvent.click(await screen.findByTestId('source-option-excel'))

      const dropzone = await screen.findByTestId('file-upload-dropzone')
      dropFile(dropzone, makeFile('timesheet.xlsx', 1024))
      const nextBtn = await screen.findByTestId('upload-btn-next')
      await waitFor(() => expect(nextBtn).toBeEnabled())
      fireEvent.click(nextBtn)

      fireEvent.click(await screen.findByTestId('assign-trigger-0'))
      fireEvent.click(await screen.findByTestId('assign-modal-btn-add'))

      expect(
        await screen.findByTestId('assign-modal-card-0-connector-Odoo prod'),
      ).toBeInTheDocument()
      expect(
        screen.queryByTestId('assign-modal-card-0-connector-Clockify team'),
      ).not.toBeInTheDocument()
    })
  })
})
