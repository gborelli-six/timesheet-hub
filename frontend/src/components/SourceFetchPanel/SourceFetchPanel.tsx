import { useState } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import { useFetchSource } from '@/hooks/useFetchSource'
import type { TimesheetEntry } from '@/lib/timesheet/types'

interface SourceFetchPanelProps {
  connectorLabel: string
  serviceLabel: string
  onFetched: (entries: TimesheetEntry[]) => void
}

interface FetchErrorDetail {
  code?: string
  message: string
}

function extractFetchErrorDetail(err: unknown): FetchErrorDetail {
  const fallback = 'Impossibile scaricare le voci dalla sorgente. Riprova più tardi.'
  const raw = err instanceof Error ? err.message : ''
  if (!raw) return { message: fallback }
  try {
    const detail = (JSON.parse(raw) as { detail?: unknown }).detail
    if (typeof detail === 'string') return { message: detail }
    if (detail && typeof detail === 'object') {
      const code = 'code' in detail && typeof detail.code === 'string' ? detail.code : undefined
      const message =
        'message' in detail && typeof detail.message === 'string' ? detail.message : undefined
      if (message) return { code, message }
    }
  } catch {
    // corpo non-JSON: usa il testo grezzo se breve, altrimenti il fallback
    if (raw.length <= 200) return { message: raw }
  }
  return { message: fallback }
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(first), end: fmt(last) }
}

// Step "input" del wizard quando la sorgente è un connettore API invece di un
// file Excel: sceglie il periodo e scarica le voci, che vengono passate al
// genitore già nella forma TimesheetEntry[] — da lì il flusso è identico a
// quello dell'upload (preview, suggerimenti, assegnazione).
export function SourceFetchPanel({
  connectorLabel,
  serviceLabel,
  onFetched,
}: SourceFetchPanelProps) {
  const defaultRange = currentMonthRange()
  const [start, setStart] = useState(defaultRange.start)
  const [end, setEnd] = useState(defaultRange.end)
  const [fetchedCount, setFetchedCount] = useState<number | null>(null)

  const { mutate, isPending, isError, error, reset } = useFetchSource()

  const errorDetail = isError ? extractFetchErrorDetail(error) : null
  const periodInvalid = start !== '' && end !== '' && start > end

  const handleFetch = () => {
    setFetchedCount(null)
    mutate(
      { label: connectorLabel, period: { start, end } },
      {
        onSuccess: (entries) => {
          setFetchedCount(entries.length)
          onFetched(entries)
        },
      },
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <InfoOutlinedIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption">
          Le voci verranno scaricate da <strong>{serviceLabel}</strong> tramite il connettore{' '}
          <strong>{connectorLabel}</strong>.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          label="Dal"
          type="date"
          size="small"
          value={start}
          onChange={(e) => {
            setStart(e.target.value)
            reset()
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'source-fetch-start' }}
        />
        <TextField
          label="Al"
          type="date"
          size="small"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value)
            reset()
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'source-fetch-end' }}
          error={periodInvalid}
          helperText={periodInvalid ? 'La data di fine deve seguire quella di inizio.' : undefined}
        />
        <Button
          variant="contained"
          startIcon={
            isPending ? (
              <CircularProgress size={14} sx={{ color: '#fff' }} />
            ) : (
              <CloudDownloadOutlinedIcon />
            )
          }
          onClick={handleFetch}
          disabled={isPending || !start || !end || periodInvalid}
          data-testid="source-fetch-submit"
        >
          Scarica voci
        </Button>
      </Box>

      {isError && errorDetail && (
        <Alert severity="error" data-testid="source-fetch-error">
          <AlertTitle>Scarico non riuscito</AlertTitle>
          {errorDetail.message}
          {errorDetail.code === 'needs_reauth' && (
            <Box sx={{ mt: 1 }}>
              <Typography
                component="a"
                href="/profile"
                variant="body2"
                sx={{ color: 'error.dark', fontWeight: 700, textUnderlineOffset: 2 }}
                data-testid="source-fetch-reauth-link"
              >
                Aggiorna il token nel Profilo
              </Typography>
            </Box>
          )}
          {errorDetail.code === 'backend_unavailable' && (
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleFetch}
                data-testid="source-fetch-retry"
              >
                Riprova
              </Button>
            </Box>
          )}
        </Alert>
      )}

      {fetchedCount !== null && !isError && (
        <Chip
          icon={<CheckCircleOutlineIcon />}
          color="success"
          label={
            fetchedCount === 0
              ? 'Nessuna voce trovata nel periodo selezionato'
              : `${fetchedCount} vo${fetchedCount === 1 ? 'ce scaricata' : 'ci scaricate'}`
          }
          sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          data-testid="source-fetch-result"
        />
      )}
    </Box>
  )
}
