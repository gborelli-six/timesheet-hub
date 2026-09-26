import { useEffect, useMemo, useRef, useState } from 'react'
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
import { SourceFetchPanel } from '../components/SourceFetchPanel'
import { SourceSelector } from '../components/SourceSelector'
import type { SourceSelection } from '../components/SourceSelector'
import { useConnectors } from '../hooks/useConnectors'
import { useConnectorTypes } from '../hooks/useConnectorTypes'
import {
  useMappingSuggestions,
  type SuggestedAssignmentResponse,
} from '../hooks/useMappingSuggestions'
import { useSubmitImport } from '../hooks/useSubmitImport'
import { normalize } from '../lib/timesheet/normalizer'
import type { ConnectorAssignment, TimesheetEntry, RowWarning } from '../lib/timesheet/types'
import { WarningType, DEFAULT_COLUMN_MAPPING } from '../lib/timesheet/types'
import type { ConnectorOut, ConnectorResult } from '../types'

type ImportStep = 'source' | 'input' | 'preview' | 'confirm'
type ImportPhase = 'form' | 'submitting' | 'result'
// 'loading': non sappiamo ancora se l'utente ha sorgenti API configurate.
// 'with-source': ha almeno un connettore sorgente → wizard a 4 step con lo
// step "Sorgente" in testa. 'excel-only': nessuna sorgente configurata → lo
// step "Sorgente" viene saltato, il wizard parte direttamente dall'upload
// Excel (comportamento pre-E13), con `source` implicitamente `{kind:'excel'}`.
type WizardMode = 'loading' | 'with-source' | 'excel-only'

interface StepDef {
  id: ImportStep
  label: string
}

function StepBar({
  steps,
  current,
  maxReached,
  onJump,
}: {
  steps: StepDef[]
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
        {steps.map((s, i) => {
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
              {i < steps.length - 1 && (
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

function extractErrorMessage(err: unknown, fallback: string): string {
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

function extractSubmitError(err: unknown): string {
  return extractErrorMessage(
    err,
    'Importazione non riuscita. Riprova o verifica i connettori nel Profilo.',
  )
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
        <Button variant="outlined" onClick={onGoToLog} data-testid="result-go-to-log">
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

  const [wizardMode, setWizardMode] = useState<WizardMode>('loading')
  const [step, setStep] = useState<ImportStep>('source')
  const [phase, setPhase] = useState<ImportPhase>('form')
  const [maxReached, setMaxReached] = useState(0)
  const [importResults, setImportResults] = useState<ConnectorResult[]>([])
  const [importId, setImportId] = useState<string | null>(null)

  const [source, setSource] = useState<SourceSelection | null>(null)
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [warnings, setWarnings] = useState<RowWarning[]>([])
  const [formatError, setFormatError] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [hasInput, setHasInput] = useState(false)
  const [assignments, setAssignments] = useState<Record<number, ConnectorAssignment[]>>({})
  const [modalRow, setModalRow] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const connectorsQuery = useConnectors()
  const connectorTypesQuery = useConnectorTypes()
  const connectors = connectorsQuery.data ?? []
  const connectorTypes = connectorTypesQuery.data ?? []
  const { mutate: fetchSuggestions, isPending: suggestionsLoading } = useMappingSuggestions()
  const { mutate: submitImport } = useSubmitImport()

  const hasSourceConnectors = connectors.some(
    (c) => connectorTypes.find((t) => t.service === c.service)?.is_source,
  )

  // Una riga si assegna solo a una DESTINAZIONE: un connettore sorgente (es.
  // Clockify) non ha un adapter di scrittura, quindi proporlo qui darebbe un
  // autocomplete progetto/task vuoto e un errore al submit. Finché il catalogo
  // non è caricato non si filtra nulla: la modale non è comunque raggiungibile
  // prima dello step di preview.
  const destinationConnectors =
    connectorTypes.length === 0
      ? connectors
      : connectors.filter(
          (c) => connectorTypes.find((t) => t.service === c.service)?.is_destination,
        )

  // Decide una sola volta, al primo caricamento riuscito di connettori e
  // catalogo, se lo step "Sorgente" va mostrato o saltato. La decisione resta
  // fissa per la sessione del wizard: se l'utente aggiunge/rimuove connettori
  // sorgente mentre il wizard è aperto, il layout non cambia sotto ai suoi
  // piedi (si aggiorna al prossimo mount della pagina).
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    if (connectorsQuery.isLoading || connectorTypesQuery.isLoading) return
    initializedRef.current = true
    if (hasSourceConnectors) {
      setWizardMode('with-source')
      setStep('source')
    } else {
      setWizardMode('excel-only')
      setSource({ kind: 'excel' })
      setStep('input')
    }
  }, [connectorsQuery.isLoading, connectorTypesQuery.isLoading, hasSourceConnectors])

  const steps: StepDef[] =
    wizardMode === 'excel-only'
      ? [
          { id: 'input', label: 'Upload' },
          { id: 'preview', label: 'Verifica e assegna' },
          { id: 'confirm', label: 'Conferma' },
        ]
      : [
          { id: 'source', label: 'Sorgente' },
          { id: 'input', label: source?.kind === 'connector' ? 'Periodo' : 'Upload' },
          { id: 'preview', label: 'Verifica e assegna' },
          { id: 'confirm', label: 'Conferma' },
        ]
  const stepIndex = steps.findIndex((s) => s.id === step)

  function goTo(i: number) {
    setStep(steps[i].id)
    setMaxReached((m) => Math.max(m, i))
  }

  // Naviga per id di step invece che per indice numerico: con la StepBar a
  // lunghezza variabile (3 o 4 step a seconda di wizardMode) un indice
  // hardcoded punterebbe allo step sbagliato in una delle due configurazioni.
  function goToStep(id: ImportStep) {
    const i = steps.findIndex((s) => s.id === id)
    if (i === -1) return
    goTo(i)
  }

  function resetInputState() {
    setEntries([])
    setWarnings([])
    setFormatError(null)
    setHasInput(false)
    setFileKey((k) => k + 1)
    setAssignments({})
    setModalRow(null)
    setSubmitError(null)
  }

  function handleSelectSource(selection: SourceSelection) {
    setSource(selection)
    resetInputState()
    goToStep('input')
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
      setHasInput(false)
      return
    }
    setFormatError(null)
    setEntries(result.entries)
    setWarnings(result.warnings)
    setHasInput(true)
  }

  function handleSourceFetched(fetchedEntries: TimesheetEntry[]) {
    setEntries(fetchedEntries)
    setWarnings([])
    setHasInput(true)
  }

  function handleNextToPreview() {
    goToStep('preview')
    const rows = entries.map((e) => ({
      excel_project: e.project ?? '',
      excel_task: e.task ?? '',
    }))
    fetchSuggestions(rows, {
      onSuccess: (data) => {
        const { newAssignments, updatedEntries } = buildSuggestedAssignments(
          data.suggestions,
          entries,
          destinationConnectors,
        )
        setAssignments(newAssignments)
        setEntries(updatedEntries)
      },
    })
  }

  function handleNextToConfirm() {
    goToStep('confirm')
  }

  function handleBackToSource() {
    // Il bottone che chiama questa funzione è nascosto in modalità
    // 'excel-only' (nessuno step precedente a cui tornare): guardia difensiva.
    if (wizardMode !== 'with-source') return
    setStep('source')
    setSource(null)
    resetInputState()
  }

  function handleBackToInput() {
    setStep('input')
    setSubmitError(null)
    setModalRow(null)
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
      onSuccess: (res) => {
        setImportResults(res.results)
        setImportId(res.import_id)
        setPhase('result')
      },
      onError: (err) => {
        setSubmitError(extractSubmitError(err))
        setPhase('form')
      },
    })
  }

  function handleReset() {
    // Riparte dallo stesso step iniziale della sessione corrente (deciso una
    // volta sola all'apertura della pagina): 'source' se ci sono sorgenti API,
    // altrimenti direttamente 'input' con Excel implicito.
    if (wizardMode === 'excel-only') {
      setStep('input')
      setSource({ kind: 'excel' })
    } else {
      setStep('source')
      setSource(null)
    }
    setPhase('form')
    setMaxReached(0)
    setImportResults([])
    setImportId(null)
    resetInputState()
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
    step === 'source'
      ? 'Scegli la sorgente'
      : step === 'input'
        ? source?.kind === 'connector'
          ? `Scarica da ${source.serviceLabel}`
          : 'Carica il file Excel'
        : step === 'preview'
          ? 'Verifica e assegna'
          : 'Conferma importazione'

  const panelHeadSubtitle =
    step === 'source'
      ? 'Seleziona da dove leggere le voci del timesheet: un file Excel oppure una sorgente API configurata nel Profilo.'
      : step === 'input'
        ? source?.kind === 'connector'
          ? 'Scegli il periodo e scarica le voci. Potrai rivedere e correggere tutto nello step successivo.'
          : 'Trascina o seleziona il timesheet del periodo. Il file viene letto in locale: nessun upload sul server in questa fase.'
        : step === 'preview'
          ? 'Controlla i dati parsati e assegna ogni riga ai connettori, con progetto e task remoto. Le righe con warning restano importabili; quelle senza connettori non verranno importate.'
          : "Controlla il riepilogo e conferma per avviare l'importazione verso i connettori assegnati."

  const panelStepLabel = `Step ${stepIndex + 1}`

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
          Scegli la sorgente, verifica i dati e assegna ogni riga ai connettori con progetto e task
          remoto.
        </Typography>
      </Box>

      {/* Wizard */}
      <Box sx={{ maxWidth: 1060 }}>
        {wizardMode === 'loading' ? (
          // Non sappiamo ancora se lo step "Sorgente" va mostrato: niente
          // flash dello step sbagliato, solo un caricamento neutro finché
          // connettori e catalogo non sono pronti.
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 3,
              p: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
            data-testid="import-wizard-loading"
          >
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Caricamento…
            </Typography>
          </Paper>
        ) : (
          <>
            {/* StepBar: visibile solo in phase 'form' */}
            {phase === 'form' && (
              <StepBar steps={steps} current={stepIndex} maxReached={maxReached} onJump={goTo} />
            )}

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
                    onGoToLog={() => navigate(importId ? `/log/${importId}` : '/log')}
                  />
                )}

                {/* Phase: form */}
                {phase === 'form' && (
                  <>
                    {step === 'source' && (
                      <SourceSelector
                        connectors={connectors}
                        connectorTypes={connectorTypes}
                        value={source}
                        onSelect={handleSelectSource}
                      />
                    )}

                    {step === 'input' && source?.kind === 'excel' && (
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

                    {step === 'input' && source?.kind === 'connector' && (
                      <SourceFetchPanel
                        key={source.label}
                        connectorLabel={source.label}
                        serviceLabel={source.serviceLabel}
                        onFetched={handleSourceFetched}
                      />
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
                  {step === 'source' ? (
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
                        Scegli una card per continuare: l'importazione parte sempre da qui.
                      </Typography>
                    </Box>
                  ) : step === 'input' && wizardMode === 'with-source' ? (
                    <Button
                      variant="text"
                      color="inherit"
                      startIcon={<ArrowBackIcon />}
                      onClick={handleBackToSource}
                      data-testid="input-btn-back"
                    >
                      Indietro
                    </Button>
                  ) : step === 'input' ? (
                    // wizardMode 'excel-only': è il primo step, non c'è un
                    // precedente a cui tornare — niente pulsante Indietro (nascosto,
                    // non disabilitato), stesso hint informativo di prima di E13.
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
                      onClick={step === 'preview' ? handleBackToInput : handleBackToPreview}
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

                    {step === 'input' && (
                      <Button
                        variant="contained"
                        endIcon={<ArrowForwardIcon />}
                        disabled={!hasInput}
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
          </>
        )}
      </Box>

      {/* Assign modal */}
      {modalRow !== null && (
        <AssignModal
          open={modalRow !== null}
          entry={entries[modalRow]}
          entryIndex={modalRow}
          connectors={destinationConnectors}
          onSave={handleSaveAssignments}
          onClose={() => setModalRow(null)}
        />
      )}
    </Box>
  )
}
