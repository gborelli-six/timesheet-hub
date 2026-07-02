import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { AssignModal } from '../components/AssignModal'
import { FileUpload } from '../components/FileUpload'
import PreviewTable from '../components/PreviewTable'
import { useConnectors } from '../hooks/useConnectors'
import {
  useMappingSuggestions,
  type SuggestedAssignmentResponse,
} from '../hooks/useMappingSuggestions'
import { useSubmitImport } from '../hooks/useSubmitImport'
import { normalize } from '../lib/timesheet/normalizer'
import type { ConnectorAssignment, TimesheetEntry, RowWarning } from '../lib/timesheet/types'
import { WarningType, DEFAULT_COLUMN_MAPPING } from '../lib/timesheet/types'
import type { ConnectorOut, ConnectorResult } from '../types'

type ImportStep = 'upload' | 'preview' | 'confirm'
type ImportPhase = 'form' | 'submitting' | 'result'

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'preview', label: 'Verifica e assegna' },
  { id: 'confirm', label: 'Conferma' },
] as const

function StepBar({
  current,
  maxReached,
  onJump,
}: {
  current: number
  maxReached: number
  onJump: (i: number) => void
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: '14px 28px',
        mb: 2.5,
        position: 'sticky',
        top: 76,
        zIndex: 20,
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          const clickable = i <= maxReached && i !== current
          return (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                onClick={clickable ? () => onJump(i) : undefined}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    border: '2px solid',
                    bgcolor: done || active ? 'primary.main' : 'transparent',
                    borderColor: clickable
                      ? 'primary.light'
                      : done || active
                        ? 'primary.main'
                        : 'divider',
                    color: done || active ? '#fff' : 'text.disabled',
                    transition: 'all 0.15s',
                    cursor: clickable ? 'pointer' : 'default',
                    '&:hover': clickable
                      ? {
                          borderColor: 'primary.main',
                          boxShadow: '0 0 0 2px rgba(25,118,210,0.15)',
                        }
                      : {},
                  }}
                >
                  {done ? <CheckIcon sx={{ fontSize: 14 }} /> : i + 1}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: active ? 700 : 500,
                    color: active ? 'text.primary' : done ? 'text.secondary' : 'text.disabled',
                    fontSize: '0.8125rem',
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  onClick={clickable ? () => onJump(i) : undefined}
                >
                  {s.label}
                </Typography>
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  sx={{
                    width: 48,
                    height: 1,
                    bgcolor: i < current ? 'primary.main' : 'divider',
                    mx: 1.5,
                    transition: 'background-color 0.15s',
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Paper>
  )
}

function extractSubmitError(err: unknown): string {
  const fallback = 'Importazione non riuscita. Riprova o verifica i connettori nel Profilo.'
  const raw = err instanceof Error ? err.message : ''
  if (!raw) return fallback
  try {
    const detail = (JSON.parse(raw) as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const message = (detail as { message?: unknown }).message
      if (typeof message === 'string') return message
    }
  } catch {
    // corpo non-JSON: usa il testo grezzo se breve, altrimenti il fallback
    if (raw.length <= 200) return raw
  }
  return fallback
}

function buildSuggestedAssignments(
  suggestionsByRow: SuggestedAssignmentResponse[][],
  currentEntries: TimesheetEntry[],
  currentConnectors: ConnectorOut[],
): { newAssignments: Record<number, ConnectorAssignment[]>; updatedEntries: TimesheetEntry[] } {
  const newAssignments: Record<number, ConnectorAssignment[]> = {}
  const updatedEntries = currentEntries.map((entry, i) => {
    const rowSuggestions = suggestionsByRow[i] ?? []
    const mapped: ConnectorAssignment[] = rowSuggestions
      .map((s) => {
        const connector = currentConnectors.find((c) => c.label === s.connector_label)
        if (!connector) return null
        return {
          connectorLabel: s.connector_label,
          service: connector.service,
          remoteProjectId: s.remote_project_id ?? '',
          remoteProjectName: s.remote_project_name ?? '',
          remoteTaskId: s.remote_task_id ?? '',
          remoteTaskName: s.remote_task_name ?? '',
          suggested: true,
        } as ConnectorAssignment
      })
      .filter((x): x is ConnectorAssignment => x !== null)
    if (mapped.length > 0) {
      newAssignments[i] = mapped
      return { ...entry, connectorAssignments: mapped }
    }
    return entry
  })
  return { newAssignments, updatedEntries }
}

// ─── StepConfirm ────────────────────────────────────────────────────────────

function StepConfirm({ entries, period }: { entries: TimesheetEntry[]; period: string }) {
  const importableRows = entries.filter((e) => e.connectorAssignments.length > 0).length

  // Distinct connectors with their row counts
  const connectorCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of entries) {
      for (const a of e.connectorAssignments) {
        map[a.connectorLabel] = (map[a.connectorLabel] ?? 0) + 1
      }
    }
    return Object.entries(map)
  }, [entries])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Grid container spacing={2}>
        {/* Card sinistra — Dettagli importazione */}
        <Grid size={6}>
          <Paper variant="outlined" sx={{ p: '20px 24px', borderRadius: 2, height: '100%' }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'text.secondary',
                mb: 2,
              }}
            >
              Dettagli importazione
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.disabled',
                  }}
                >
                  Dipendente
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  Me stesso
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.disabled',
                  }}
                >
                  Periodo
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {period || '—'}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.disabled',
                  }}
                >
                  Righe importabili
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {importableRows} / {entries.length}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Card destra — Connettori coinvolti */}
        <Grid size={6}>
          <Paper variant="outlined" sx={{ p: '20px 24px', borderRadius: 2, height: '100%' }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'text.secondary',
                mb: 2,
              }}
            >
              Connettori coinvolti
            </Typography>
            {connectorCounts.length === 0 ? (
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
                Nessun connettore assegnato.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {connectorCounts.map(([label, count]) => (
                  <Box
                    key={label}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: '8px 12px',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'grey.50',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {label}
                    </Typography>
                    <Chip
                      label={`${count} rig${count === 1 ? 'a' : 'he'}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Alert severity="warning">
        <AlertTitle>Azione irreversibile.</AlertTitle>
        Le righe verranno inviate in scrittura ai connettori assegnati tramite i rispettivi adapter.
        Le righe senza connettori non saranno importate.
      </Alert>
    </Box>
  )
}

// ─── StepResult ─────────────────────────────────────────────────────────────

function StepResult({
  results,
  onReset,
  onGoToLog,
}: {
  results: ConnectorResult[]
  onReset: () => void
  onGoToLog: () => void
}) {
  const allSuccess = results.every((r) => r.error_count === 0 && r.success_count > 0)
  const allFail = results.every((r) => r.success_count === 0)
  const status: 'ok' | 'partial' | 'fail' = allSuccess ? 'ok' : allFail ? 'fail' : 'partial'

  const heroBg =
    status === 'ok' ? 'success.lighter' : status === 'partial' ? 'warning.lighter' : 'error.lighter'
  const heroColor =
    status === 'ok' ? 'success.main' : status === 'partial' ? 'warning.main' : 'error.main'
  const heroLabel =
    status === 'ok'
      ? 'Importazione completata'
      : status === 'partial'
        ? 'Importazione parziale'
        : 'Importazione fallita'
  const HeroIcon = status === 'ok' ? CheckIcon : status === 'partial' ? WarningAmberIcon : CloseIcon

  return (
    <Box data-testid="result-screen" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Hero */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: heroBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HeroIcon sx={{ fontSize: 32, color: heroColor }} />
        </Box>
        <Typography variant="h5" fontWeight={700}>
          {heroLabel}
        </Typography>
      </Box>

      {/* Per-connector list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {results.map((r) => {
          const connOk = r.error_count === 0 && r.success_count > 0
          const connFail = r.success_count === 0
          const chipColor = connOk ? 'success' : connFail ? 'error' : 'warning'
          const chipLabel = connOk
            ? `${r.success_count} righe importate`
            : connFail
              ? 'Nessuna riga importata'
              : `${r.success_count} importate, ${r.error_count} errori`
          return (
            <Box
              key={r.connector_label}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" fontWeight={700}>
                  {r.connector_label}
                </Typography>
                {r.errors.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                    {r.errors.map((e, idx) => (
                      <Typography key={idx} variant="caption" color="error.main">
                        Riga {e.row}: {e.message}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
              <Chip
                label={chipLabel}
                color={chipColor}
                size="small"
                sx={{ fontWeight: 600, flexShrink: 0 }}
              />
            </Box>
          )
        })}
      </Box>

      {/* Footer */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 1 }}>
        <Button variant="outlined" onClick={onGoToLog}>
          Log dettagliato
        </Button>
        <Button variant="contained" onClick={onReset}>
          Nuova importazione
        </Button>
      </Box>
    </Box>
  )
}

// ─── ImportPage ──────────────────────────────────────────────────────────────

export default function ImportPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<ImportStep>('upload')
  const [phase, setPhase] = useState<ImportPhase>('form')
  const [maxReached, setMaxReached] = useState(0)
  const [importResults, setImportResults] = useState<ConnectorResult[]>([])

  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [warnings, setWarnings] = useState<RowWarning[]>([])
  const [formatError, setFormatError] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [hasFile, setHasFile] = useState(false)
  const [assignments, setAssignments] = useState<Record<number, ConnectorAssignment[]>>({})
  const [modalRow, setModalRow] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: connectors = [] } = useConnectors()
  const { mutate: fetchSuggestions, isPending: suggestionsLoading } = useMappingSuggestions()
  const { mutate: submitImport } = useSubmitImport()

  const stepIndex = step === 'upload' ? 0 : step === 'preview' ? 1 : 2

  function goTo(i: number) {
    setStep(STEPS[i].id as ImportStep)
    setMaxReached((m) => Math.max(m, i))
  }

  function handleParsed(
    rows: Record<string, unknown>[],
    _file: File,
    rowNumbers: number[],
    _rowCount: number,
  ) {
    const result = normalize(rows, DEFAULT_COLUMN_MAPPING, rowNumbers)
    if (result.warnings.some((w) => w.type === WarningType.MISSING_PERIOD)) {
      setFormatError(
        'Formato non riconosciuto. Il file deve avere le colonne: Data, Progetto, Task, Ore, Note.',
      )
      setFileKey((k) => k + 1)
      setHasFile(false)
      return
    }
    setFormatError(null)
    setEntries(result.entries)
    setWarnings(result.warnings)
    setHasFile(true)
  }

  function handleNextToPreview() {
    goTo(1)
    const rows = entries.map((e) => ({
      excel_project: e.project ?? '',
      excel_task: e.task ?? '',
    }))
    fetchSuggestions(rows, {
      onSuccess: (data) => {
        const { newAssignments, updatedEntries } = buildSuggestedAssignments(
          data.suggestions,
          entries,
          connectors,
        )
        setAssignments(newAssignments)
        setEntries(updatedEntries)
      },
    })
  }

  function handleNextToConfirm() {
    goTo(2)
  }

  function handleBack() {
    setStep('upload')
    setEntries([])
    setWarnings([])
    setFormatError(null)
    setHasFile(false)
    setFileKey((k) => k + 1)
    setAssignments({})
    setModalRow(null)
    setSubmitError(null)
  }

  function handleBackToPreview() {
    setStep('preview')
    setSubmitError(null)
  }

  function handleSaveAssignments(idx: number, list: ConnectorAssignment[]) {
    setAssignments((prev) => {
      const next = { ...prev }
      if (list.length === 0) delete next[idx]
      else next[idx] = list
      return next
    })
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, connectorAssignments: list } : e)))
    setModalRow(null)
  }

  function handleSubmit() {
    setSubmitError(null)
    setPhase('submitting')
    submitImport(entries, {
      onSuccess: (results) => {
        setImportResults(results)
        setPhase('result')
      },
      onError: (err) => {
        setSubmitError(extractSubmitError(err))
        setPhase('form')
      },
    })
  }

  function handleReset() {
    setStep('upload')
    setPhase('form')
    setMaxReached(0)
    setImportResults([])
    setEntries([])
    setWarnings([])
    setFormatError(null)
    setHasFile(false)
    setFileKey((k) => k + 1)
    setAssignments({})
    setModalRow(null)
    setSubmitError(null)
  }

  const perRowWarnings = warnings.filter((w) => w.entryIndex >= 0)
  const warningRowCount = new Set(perRowWarnings.map((w) => w.entryIndex)).size
  const validRowCount = entries.length - warningRowCount

  const importableRows = Object.values(assignments).filter((a) => a.length > 0).length
  const hasSuggestions = Object.values(assignments).some((list) => list.some((a) => a.suggested))

  const period = useMemo(() => {
    const dates = entries.map((e) => e.date).filter(Boolean) as string[]
    if (dates.length === 0) return ''
    const d = new Date(Math.min(...dates.map((s) => new Date(s).getTime())))
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }, [entries])

  const distinctConnectors = useMemo(() => {
    const labels = new Set<string>()
    for (const e of entries) {
      for (const a of e.connectorAssignments) {
        labels.add(a.connectorLabel)
      }
    }
    return Array.from(labels)
  }, [entries])

  const panelHeadTitle =
    step === 'upload'
      ? 'Carica il file Excel'
      : step === 'preview'
        ? 'Verifica e assegna'
        : 'Conferma importazione'

  const panelHeadSubtitle =
    step === 'upload'
      ? 'Trascina o seleziona il timesheet del periodo. Il file viene letto in locale: nessun upload sul server in questa fase.'
      : step === 'preview'
        ? 'Controlla i dati parsati e assegna ogni riga ai connettori, con progetto e task remoto. Le righe con warning restano importabili; quelle senza connettori non verranno importate.'
        : "Controlla il riepilogo e conferma per avviare l'importazione verso i connettori assegnati."

  const panelStepLabel = step === 'upload' ? 'Step 1' : step === 'preview' ? 'Step 2' : 'Step 3'

  return (
    <Box>
      {/* Page hero */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 3 }}>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.6875rem',
            color: 'primary.main',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Importazione
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Nuova importazione
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', maxWidth: '60ch' }}>
          Carica il timesheet, verifica i dati e assegna ogni riga ai connettori con progetto e task
          remoto.
        </Typography>
      </Box>

      {/* Wizard */}
      <Box sx={{ maxWidth: 1060 }}>
        {/* StepBar: visibile solo in phase 'form' */}
        {phase === 'form' && <StepBar current={stepIndex} maxReached={maxReached} onJump={goTo} />}

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {/* Panel head — nascosto in result, mostrato in submitting solo per titolo */}
          {phase !== 'result' && (
            <Box
              sx={{
                p: '22px 28px',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2.5,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.6875rem',
                    color: 'primary.main',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {phase === 'submitting' ? 'Invio in corso' : panelStepLabel}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, mb: 0.5 }}>
                  {phase === 'submitting' ? 'Importazione' : panelHeadTitle}
                </Typography>
                {phase === 'form' && (
                  <Typography
                    sx={{ fontSize: '0.8125rem', color: 'text.secondary', maxWidth: '64ch' }}
                  >
                    {panelHeadSubtitle}
                  </Typography>
                )}
              </Box>

              {/* Summary badges — solo in step preview */}
              {phase === 'form' && step === 'preview' && entries.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                    flexShrink: 0,
                  }}
                >
                  <Chip
                    label={`${validRowCount} valide`}
                    color="success"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  {warningRowCount > 0 && (
                    <Chip
                      label={`${warningRowCount} con warning`}
                      color="warning"
                      size="small"
                      icon={<WarningAmberOutlinedIcon />}
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  <Chip
                    label={`${importableRows}/${entries.length} righe pronte`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  {hasSuggestions && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: 0.5,
                          bgcolor: 'info.lighter',
                          border: '1px dashed',
                          borderColor: 'info.light',
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                        = suggerito
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Panel body */}
          <Box sx={{ p: '24px 28px' }}>
            {/* Phase: submitting */}
            {phase === 'submitting' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  py: 8,
                }}
              >
                <CircularProgress size={40} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Invio ai connettori…
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {distinctConnectors.join(' · ')}
                </Typography>
              </Box>
            )}

            {/* Phase: result */}
            {phase === 'result' && (
              <StepResult
                results={importResults}
                onReset={handleReset}
                onGoToLog={() => navigate('/log')}
              />
            )}

            {/* Phase: form */}
            {phase === 'form' && (
              <>
                {step === 'upload' && (
                  <Box>
                    {formatError && (
                      <Alert severity="error" sx={{ mb: 2 }} data-testid="import-format-error">
                        {formatError}
                      </Alert>
                    )}
                    <FileUpload key={fileKey} onParsed={handleParsed} />

                    {/* Template hint card */}
                    <Box
                      sx={{
                        mt: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        p: '14px 16px',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1.25,
                        }}
                      >
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography
                          sx={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'text.secondary',
                          }}
                        >
                          Template aziendale standard
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {['Data', 'Progetto', 'Task', 'Ore', 'Note'].map((col) => (
                          <Box
                            key={col}
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              px: 1,
                              py: 0.25,
                              borderRadius: 10,
                              bgcolor: 'background.paper',
                              border: '1px solid',
                              borderColor: 'divider',
                              color: 'text.secondary',
                            }}
                          >
                            {col}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}

                {step === 'preview' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {hasSuggestions && (
                      <Alert
                        severity="info"
                        icon={<AutoAwesomeIcon fontSize="inherit" />}
                        data-testid="preview-suggestions-alert"
                      >
                        <AlertTitle>Assegnazioni pre-compilate</AlertTitle>
                        Le associazioni sono suggerite in base allo storico. Sono sempre
                        modificabili: apri una riga per cambiarle.
                      </Alert>
                    )}
                    <PreviewTable
                      entries={entries}
                      warnings={warnings}
                      assignmentsByRow={assignments}
                      onAssign={setModalRow}
                    />
                    {suggestionsLoading && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: 'text.secondary',
                        }}
                      >
                        <CircularProgress size={12} />
                        <Typography variant="caption">Caricamento suggerimenti…</Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {step === 'confirm' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {submitError && (
                      <Alert severity="error" data-testid="import-submit-error">
                        <AlertTitle>Importazione non riuscita</AlertTitle>
                        {submitError}
                      </Alert>
                    )}
                    <StepConfirm entries={entries} period={period} />
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Wizard footer — solo in phase 'form' */}
          {phase === 'form' && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: '16px 28px',
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50',
              }}
            >
              {/* Left */}
              {step === 'upload' ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    color: 'text.secondary',
                  }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 13 }} />
                  <Typography variant="caption">
                    Il file resta in locale fino alla conferma.
                  </Typography>
                </Box>
              ) : (
                <Button
                  variant="text"
                  color="inherit"
                  startIcon={<ArrowBackIcon />}
                  onClick={step === 'preview' ? handleBack : handleBackToPreview}
                  data-testid={step === 'preview' ? 'preview-btn-back' : 'confirm-btn-back'}
                >
                  Indietro
                </Button>
              )}

              {/* Right */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {step === 'preview' && importableRows === 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      color: 'text.secondary',
                    }}
                  >
                    <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
                    <Typography variant="caption">
                      Assegna almeno una riga per procedere.
                    </Typography>
                  </Box>
                )}

                {step === 'upload' && (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    disabled={!hasFile}
                    onClick={handleNextToPreview}
                    data-testid="upload-btn-next"
                  >
                    Avanti
                  </Button>
                )}

                {step === 'preview' && (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    disabled={importableRows === 0}
                    onClick={handleNextToConfirm}
                    data-testid="preview-btn-next"
                  >
                    Avanti
                  </Button>
                )}

                {step === 'confirm' && (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleSubmit}
                    data-testid="confirm-btn-submit"
                  >
                    Conferma importazione
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Assign modal */}
      {modalRow !== null && (
        <AssignModal
          open={modalRow !== null}
          entry={entries[modalRow]}
          entryIndex={modalRow}
          connectors={connectors}
          onSave={handleSaveAssignments}
          onClose={() => setModalRow(null)}
        />
      )}
    </Box>
  )
}
