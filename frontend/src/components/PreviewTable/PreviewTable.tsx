import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import type { RowWarning, TimesheetEntry } from '../../lib/timesheet/types'
import { WARNING_LABEL } from '../../lib/timesheet/types'

interface PreviewTableProps {
  entries: TimesheetEntry[]
  warnings: RowWarning[]
}

export default function PreviewTable({ entries, warnings }: PreviewTableProps) {
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
              <TableCell align="right" sx={{ width: 70 }}>
                Ore
              </TableCell>
              <TableCell sx={{ width: 132 }}>Stato</TableCell>
              <TableCell sx={{ width: 200 }}>Connettori assegnati</TableCell>
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
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.date ?? '—'}
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
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ fontStyle: 'italic', color: 'text.disabled', fontSize: '0.75rem' }}
                    >
                      — da assegnare
                    </Typography>
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
