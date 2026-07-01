import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { FileUpload } from '../components/FileUpload'
import PreviewTable from '../components/PreviewTable'
import { normalize } from '../lib/timesheet/normalizer'
import type { TimesheetEntry, RowWarning } from '../lib/timesheet/types'
import { WarningType, DEFAULT_COLUMN_MAPPING } from '../lib/timesheet/types'

type ImportStep = 'upload' | 'preview'

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'preview', label: 'Verifica e assegna' },
  { id: 'confirm', label: 'Conferma' },
] as const

function StepBar({ current }: { current: number }) {
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
          return (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    borderColor: done || active ? 'primary.main' : 'divider',
                    color: done || active ? '#fff' : 'text.disabled',
                    transition: 'all 0.15s',
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
                  }}
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

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [warnings, setWarnings] = useState<RowWarning[]>([])
  const [formatError, setFormatError] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [hasFile, setHasFile] = useState(false)

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

  function handleBack() {
    setStep('upload')
    setEntries([])
    setWarnings([])
    setFormatError(null)
    setHasFile(false)
    setFileKey((k) => k + 1)
  }

  const stepIndex = step === 'upload' ? 0 : 1

  const perRowWarnings = warnings.filter((w) => w.entryIndex >= 0)
  const warningRowCount = new Set(perRowWarnings.map((w) => w.entryIndex)).size
  const validRowCount = entries.length - warningRowCount

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
        <StepBar current={stepIndex} />

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {/* Panel head */}
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
                {step === 'upload' ? 'Step 1' : 'Step 2'}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, mb: 0.5 }}>
                {step === 'upload' ? 'Carica il file Excel' : 'Verifica e assegna'}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', maxWidth: '64ch' }}>
                {step === 'upload'
                  ? 'Trascina o seleziona il timesheet del periodo. Il file viene letto in locale: nessun upload sul server in questa fase.'
                  : 'Controlla i dati parsati e assegna ogni riga ai connettori, con progetto e task remoto. Le righe con warning restano importabili; quelle senza connettori non verranno importate.'}
              </Typography>
            </Box>

            {/* Summary badges — solo in step 2 */}
            {step === 'preview' && entries.length > 0 && (
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
                  label={`0/${entries.length} righe pronte`}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            )}
          </Box>

          {/* Panel body */}
          <Box sx={{ p: '24px 28px' }}>
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

            {step === 'preview' && <PreviewTable entries={entries} warnings={warnings} />}
          </Box>

          {/* Wizard footer */}
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
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}
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
                onClick={handleBack}
                data-testid="preview-btn-back"
              >
                Indietro
              </Button>
            )}

            {/* Right */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {step === 'preview' && (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}
                >
                  <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
                  <Typography variant="caption">Assegna almeno una riga per procedere.</Typography>
                </Box>
              )}
              {step === 'upload' ? (
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  disabled={!hasFile}
                  onClick={() => setStep('preview')}
                  data-testid="upload-btn-next"
                >
                  Avanti
                </Button>
              ) : (
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  disabled
                  data-testid="preview-btn-next"
                >
                  Avanti
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
