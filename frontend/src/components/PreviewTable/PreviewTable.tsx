import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import type { ConnectorAssignment, RowWarning, TimesheetEntry } from '../../lib/timesheet/types'
import { WARNING_LABEL } from '../../lib/timesheet/types'
import { SERVICE_META } from '../connectors/serviceMeta'

interface PreviewTableProps {
  entries: TimesheetEntry[]
  warnings: RowWarning[]
  assignmentsByRow?: Record<number, ConnectorAssignment[]>
  onAssign?: (entryIndex: number) => void
}

/* ── Connector chips for one row ────────────────────────── */

interface ConnChipsProps {
  assigns: ConnectorAssignment[]
  onAssign: () => void
  entryIndex: number
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function ConnChips({ assigns, onAssign, entryIndex }: ConnChipsProps) {
  if (assigns.length === 0) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={onAssign}
        data-testid={`assign-trigger-${entryIndex}`}
        sx={{
          borderStyle: 'dashed',
          fontSize: '0.6875rem',
          fontWeight: 600,
          height: 26,
          px: 1.25,
          minWidth: 0,
          color: 'primary.main',
          borderColor: 'primary.light',
          '&:hover': { borderStyle: 'dashed', bgcolor: 'primary.lighter' },
        }}
      >
        + Assegna
      </Button>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.75 }}>
      {assigns.map((a, i) => {
        const meta = SERVICE_META[a.service]
        return (
          <Tooltip
            key={i}
            title={`${meta.name} · ${a.remoteProjectName} · ${a.remoteTaskName}`}
            arrow
          >
            <Box
              data-testid={`conn-chip-${entryIndex}-${i}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.3,
                px: 1,
                py: 0.625,
                borderRadius: 1.5,
                border: '1px solid',
                ...(a.suggested
                  ? { bgcolor: 'info.lighter', borderStyle: 'dashed', borderColor: 'info.light' }
                  : { bgcolor: 'grey.100', borderColor: 'divider' }),
                cursor: 'default',
              }}
            >
              {/* Riga 1 — tipo connettore */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 0.5,
                    bgcolor: meta.color,
                    display: 'inline-grid',
                    placeItems: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.5rem',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {meta.letter}
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1 }}>
                  {meta.name}
                </Typography>
                {a.suggested && (
                  <AutoAwesomeIcon
                    sx={{ fontSize: 10, color: 'info.main' }}
                    data-testid={`suggested-icon-${entryIndex}-${i}`}
                  />
                )}
              </Box>

              {/* Riga 2 — progetto */}
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  lineHeight: 1,
                }}
              >
                {a.remoteProjectId}
                {a.remoteProjectName ? ` · ${trunc(a.remoteProjectName, 15)}` : ''}
              </Typography>

              {/* Riga 3 — task */}
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  lineHeight: 1,
                }}
              >
                {a.remoteTaskId}
                {a.remoteTaskName ? ` · ${trunc(a.remoteTaskName, 15)}` : ''}
              </Typography>
            </Box>
          </Tooltip>
        )
      })}
      <Tooltip title="Modifica assegnazione">
        <IconButton
          size="small"
          onClick={onAssign}
          data-testid={`assign-edit-${entryIndex}`}
          sx={{ width: 22, height: 22, color: 'text.secondary' }}
        >
          <EditOutlinedIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString()
}

export default function PreviewTable({
  entries,
  warnings,
  assignmentsByRow,
  onAssign,
}: PreviewTableProps) {
  const perRowWarnings = warnings.filter((w) => w.entryIndex >= 0)
  const warningEntryIndexes = new Set(perRowWarnings.map((w) => w.entryIndex))
  const warningRowCount = warningEntryIndexes.size
  const validRowCount = entries.length - warningRowCount

  function rowWarnings(idx: number): RowWarning[] {
    return perRowWarnings.filter((w) => w.entryIndex === idx)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {warningRowCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberOutlinedIcon fontSize="inherit" />}
          data-testid="preview-warning-alert"
        >
          <AlertTitle>
            {validRowCount} {validRowCount === 1 ? 'riga valida' : 'righe valide'} ·{' '}
            {warningRowCount} {warningRowCount === 1 ? 'riga con warning' : 'righe con warning'}
          </AlertTitle>
          I warning (ore, progetto, task o data mancanti) non bloccano l'importazione: assegna
          comunque i connettori oppure ricarica un file corretto.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 70 }}>Data</TableCell>
              <TableCell>Progetto</TableCell>
              <TableCell>Task</TableCell>
              <TableCell sx={{ width: 180 }}>Note</TableCell>
              <TableCell align="right" sx={{ width: 70 }}>
                Ore
              </TableCell>
              <TableCell sx={{ width: 132 }}>Stato</TableCell>
              <TableCell sx={{ width: onAssign ? 230 : 200 }}>Connettori assegnati</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry, idx) => {
              const rw = rowWarnings(idx)
              const hasWarning = rw.length > 0
              const tooltipText = rw.map((w) => WARNING_LABEL[w.type]).join(' · ')
              const warningLabel =
                rw.length === 1 ? WARNING_LABEL[rw[0].type] : `${rw.length} warning`
              return (
                <TableRow
                  key={idx}
                  sx={hasWarning ? { backgroundColor: 'warning.lighter' } : undefined}
                  data-testid={hasWarning ? 'preview-row-warning' : undefined}
                >
                  <TableCell
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(entry.date)}
                  </TableCell>
                  <TableCell>
                    {entry.project ? (
                      entry.project
                    ) : (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontStyle: 'italic', color: 'text.disabled' }}
                      >
                        — mancante
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.task ? (
                      entry.task
                    ) : (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontStyle: 'italic', color: 'text.disabled' }}
                      >
                        — mancante
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.8125rem',
                      color: entry.notes ? 'text.primary' : 'text.disabled',
                      fontStyle: entry.notes ? 'normal' : 'italic',
                    }}
                    title={entry.notes ?? undefined}
                  >
                    {entry.notes ?? '—'}
                  </TableCell>
                  <TableCell align="right">
                    {entry.hours != null ? (
                      entry.hours
                    ) : (
                      <Typography component="span" variant="body2" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasWarning ? (
                      <Tooltip title={tooltipText} arrow>
                        <Chip
                          label={warningLabel}
                          size="small"
                          color="warning"
                          icon={<WarningAmberOutlinedIcon />}
                          data-testid="preview-warning-chip"
                          sx={{ cursor: 'help' }}
                        />
                      </Tooltip>
                    ) : (
                      <Chip
                        label="OK"
                        size="small"
                        color="success"
                        icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important' }} />}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {onAssign ? (
                      <ConnChips
                        assigns={assignmentsByRow?.[idx] ?? []}
                        onAssign={() => onAssign(idx)}
                        entryIndex={idx}
                      />
                    ) : (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontStyle: 'italic', color: 'text.disabled', fontSize: '0.75rem' }}
                      >
                        — da assegnare
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
