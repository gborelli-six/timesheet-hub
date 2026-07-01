import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import ExcelJS from 'exceljs'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'

interface FileUploadProps {
  onParsed: (
    rows: Record<string, unknown>[],
    file: File,
    rowNumbers: number[],
    rowCount: number,
  ) => void
  onError?: (message: string) => void
}

type UploadState = 'idle' | 'loading' | 'error' | 'success'

const MAX_BYTES = 5 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUpload({ onParsed, onError }: FileUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function setError(msg: string) {
    setState('error')
    setErrorMessage(msg)
    onError?.(msg)
  }

  function reset() {
    setState('idle')
    setErrorMessage(null)
    setSelectedFile(null)
    setRowCount(0)
    setDragging(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx')) {
      setError('Formato non supportato. Carica un file Excel (.xlsx)')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File troppo grande (max 5 MB)')
      return
    }

    setState('loading')
    setErrorMessage(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        setError('Il file non contiene dati')
        return
      }

      const headers: string[] = []
      const rows: Record<string, unknown>[] = []
      const rowNumbers: number[] = []

      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as unknown[]
        if (rowNumber === 1) {
          for (let i = 1; i < values.length; i++) {
            const h = values[i]
            headers.push(h !== undefined && h !== null ? String(h) : '')
          }
        } else {
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => {
            obj[h] = values[i + 1]
          })
          if (
            Object.values(obj).some((v) => v !== undefined && v !== null && String(v).trim() !== '')
          ) {
            rows.push(obj)
            rowNumbers.push(rowNumber)
          }
        }
      })

      if (rows.length === 0) {
        setError('Il file non contiene dati')
        return
      }

      setSelectedFile(file)
      setRowCount(rows.length)
      setState('success')
      onParsed(rows, file, rowNumbers, rows.length)
    } catch {
      setError('Errore durante la lettura del file')
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  if (state === 'loading') {
    return (
      <Box
        sx={{
          border: '2px solid',
          borderColor: 'primary.200',
          borderRadius: 2,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          minHeight: 200,
          bgcolor: 'primary.50',
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" fontWeight={500}>
          Lettura del file…
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Parsing del primo foglio con SheetJS
        </Typography>
      </Box>
    )
  }

  if (state === 'success' && selectedFile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: '14px 16px',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <TaskOutlinedIcon sx={{ fontSize: 28, color: 'success.main', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {selectedFile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatSize(selectedFile.size)} · {rowCount} righe · 1° foglio
            </Typography>
          </Box>
          <Chip
            label="Formato valido"
            color="success"
            size="small"
            icon={<CheckCircleOutlineIcon />}
            sx={{ flexShrink: 0 }}
          />
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<DeleteOutlinedIcon />}
            onClick={reset}
            data-testid="file-upload-remove"
            sx={{ flexShrink: 0, color: 'text.secondary' }}
          >
            Rimuovi
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
          <InfoOutlinedIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption">
            Parsing eseguito in locale (SheetJS) — il file non è stato caricato sul server.
          </Typography>
        </Box>
      </Box>
    )
  }

  const isError = state === 'error'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
          border: '2px dashed',
          borderColor: isError ? 'error.main' : dragging ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          minHeight: 200,
          cursor: 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
          bgcolor: isError ? 'error.lighter' : dragging ? 'primary.lighter' : 'grey.50',
          '&:hover': { borderColor: isError ? 'error.main' : 'primary.main' },
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        data-testid="file-upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={onInputChange}
          data-testid="file-upload-input"
        />
        <UploadFileOutlinedIcon
          sx={{ fontSize: 40, color: isError ? 'error.main' : 'primary.main' }}
        />
        <Typography variant="body2" fontWeight={500}>
          Trascina qui il file Excel del timesheet
        </Typography>
        <Typography variant="caption" color="text.secondary">
          oppure
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
        >
          Sfoglia file
        </Button>
        <Typography
          variant="caption"
          sx={{ fontFamily: 'monospace', color: 'text.disabled', mt: 0.5 }}
        >
          .xlsx · max 5 MB · viene letto il primo foglio
        </Typography>
      </Box>

      {isError && errorMessage && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '10px 14px',
            borderRadius: 1.5,
            bgcolor: 'error.lighter',
            border: '1px solid',
            borderColor: 'error.light',
            color: 'error.dark',
          }}
          data-testid="file-upload-error"
        >
          <WarningAmberOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={500}>
            {errorMessage}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
