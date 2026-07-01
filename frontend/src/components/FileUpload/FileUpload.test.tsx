// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import FileUpload from './FileUpload'

vi.mock('exceljs', () => {
  const MockWorkbook = vi.fn().mockImplementation(() => ({
    worksheets: [
      {
        eachRow: (cb: (row: { values: unknown[] }, rowNumber: number) => void) => {
          cb({ values: [null, 'Progetto', 'Task', 'Ore'] }, 1)
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

function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

function dropFile(dropzone: HTMLElement, file: File) {
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
}

describe('FileUpload', () => {
  let onParsed: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onParsed = vi.fn()
    onError = vi.fn()
  })

  it('mostra errore per file non-Excel', async () => {
    render(<FileUpload onParsed={onParsed} onError={onError} />)
    dropFile(
      screen.getByTestId('file-upload-dropzone'),
      makeFile('documento.pdf', 100, 'application/pdf'),
    )

    await waitFor(() => {
      expect(screen.getByText(/Formato non supportato/i)).toBeInTheDocument()
    })
    expect(onParsed).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Formato non supportato'))
  })

  it('mostra errore per file > 5 MB', async () => {
    render(<FileUpload onParsed={onParsed} onError={onError} />)
    dropFile(screen.getByTestId('file-upload-dropzone'), makeFile('grande.xlsx', 6 * 1024 * 1024))

    await waitFor(() => {
      expect(screen.getByText(/troppo grande/i)).toBeInTheDocument()
    })
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('chiama onParsed con le righe quando il file .xlsx è valido', async () => {
    render(<FileUpload onParsed={onParsed} onError={onError} />)
    dropFile(screen.getByTestId('file-upload-dropzone'), makeFile('timesheet.xlsx', 1024))

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledTimes(1)
    })

    const [rows, , , rowCount] = onParsed.mock.calls[0] as [
      Record<string, unknown>[],
      File,
      number[],
      number,
    ]
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toHaveProperty('Progetto', 'Proj A')
    expect(typeof rowCount).toBe('number')
  })
})
