import { useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Popover from '@mui/material/Popover'
import SearchIcon from '@mui/icons-material/Search'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import type { ConnectorAssignment, RowWarning, TimesheetEntry } from '../../lib/timesheet/types'
import { WARNING_LABEL } from '../../lib/timesheet/types'
import type { PreviewFilters } from '../../hooks/usePreviewFilters'
import { SERVICE_META } from '../connectors/serviceMeta'

interface PreviewTableProps {
  entries: TimesheetEntry[]
  warnings: RowWarning[]
  assignmentsByRow?: Record<number, ConnectorAssignment[]>
  onAssign?: (entryIndex: number) => void
  /** Indici (originali) da mostrare; se assente mostra tutte le entries. */
  filteredIndices?: number[]
  filters?: PreviewFilters
  distinctDates?: string[]
  distinctProjects?: string[]
  distinctTasks?: string[]
  onFilterDate?: (values: string[]) => void
  onFilterProject?: (values: string[]) => void
  onFilterTask?: (values: string[]) => void
  isFiltered?: boolean
  onResetFilters?: () => void
}

/* ── Column funnel filter (Opzione C) ───────────────────── */

interface ColumnFilterProps {
  values: string[]
  selected: string[]
  onChange: (values: string[]) => void
  testId: string
  /** Nome della colonna, usato per l'aria-label del pulsante imbuto. */
  columnLabel: string
  /** Formatta il valore per la visualizzazione (es. date ISO → locale). */
  formatValue?: (value: string) => string
}

function ColumnFilter({
  values,
  selected,
  onChange,
  testId,
  columnLabel,
  formatValue,
}: ColumnFilterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const active = selected.length > 0

  function close() {
    setAnchorEl(null)
    setSearch('')
  }

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const visible = values.filter((v) =>
    (formatValue ? formatValue(v) : v).toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <>
      <IconButton
        size="small"
        data-testid={testId}
        aria-label={`Filtra per ${columnLabel.toLowerCase()}`}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          width: 20,
          height: 20,
          ...(active
            ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
            : { color: 'text.disabled' }),
        }}
      >
        {active ? (
          <FilterAltIcon sx={{ fontSize: 14 }} />
        ) : (
          <FilterAltOutlinedIcon sx={{ fontSize: 14 }} />
        )}
      </IconButton>
      <Popover
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 240, maxHeight: 340 } } }}
        data-testid={`${testId}-menu`}
      >
        <Box sx={{ p: 1 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Cerca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <Divider />
        <List dense sx={{ maxHeight: 240, overflow: 'auto', py: 0 }}>
          {visible.length === 0 && (
            <Typography
              variant="body2"
              sx={{ px: 2, py: 1, color: 'text.disabled', fontStyle: 'italic' }}
            >
              Nessun valore
            </Typography>
          )}
          {visible.map((value) => (
            <ListItemButton key={value} dense onClick={() => toggle(value)} sx={{ py: 0.25 }}>
              <Checkbox
                edge="start"
                size="small"
                checked={selected.includes(value)}
                tabIndex={-1}
                disableRipple
                sx={{ py: 0, mr: 0.5 }}
              />
              <ListItemText
                primary={formatValue ? formatValue(value) : value}
                slotProps={{ primary: { sx: { fontSize: '0.8125rem' } } }}
              />
            </ListItemButton>
          ))}
        </List>
        {active && (
          <>
            <Divider />
            <Box sx={{ p: 0.5, textAlign: 'right' }}>
              <Button size="small" onClick={() => onChange([])}>
                Deseleziona
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </>
  )
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
                  {a.connectorLabel}
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

function FilterableHeader({ label, filter }: { label: string; filter: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <span>{label}</span>
      {filter}
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
  filteredIndices,
  filters,
  distinctDates,
  distinctProjects,
  distinctTasks,
  onFilterDate,
  onFilterProject,
  onFilterTask,
  isFiltered,
  onResetFilters,
}: PreviewTableProps) {
  const perRowWarnings = warnings.filter((w) => w.entryIndex >= 0)

  // Indici da renderizzare: sottoinsieme filtrato oppure tutte le entries.
  const visibleIndices = filteredIndices ?? entries.map((_, i) => i)

  // Alert warning e conteggi riflettono il sottoinsieme filtrato visibile.
  const visibleWarningIndexes = new Set(
    perRowWarnings.map((w) => w.entryIndex).filter((i) => visibleIndices.includes(i)),
  )
  const warningRowCount = visibleWarningIndexes.size
  const validRowCount = visibleIndices.length - warningRowCount

  const filtersEnabled = onFilterDate != null || onFilterProject != null || onFilterTask != null

  function rowWarnings(idx: number): RowWarning[] {
    return perRowWarnings.filter((w) => w.entryIndex === idx)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isFiltered && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary" data-testid="filter-count">
            Mostrate {visibleIndices.length} di {entries.length} righe
          </Typography>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={onResetFilters}
            data-testid="filter-reset"
          >
            Rimuovi filtri
          </Link>
        </Box>
      )}
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
              <TableCell sx={{ width: 90 }}>
                <FilterableHeader
                  label="Data"
                  filter={
                    filtersEnabled && onFilterDate ? (
                      <ColumnFilter
                        values={distinctDates ?? []}
                        selected={filters?.dates ?? []}
                        onChange={onFilterDate}
                        testId="column-filter-date"
                        columnLabel="Data"
                        formatValue={formatDate}
                      />
                    ) : null
                  }
                />
              </TableCell>
              <TableCell>
                <FilterableHeader
                  label="Progetto"
                  filter={
                    filtersEnabled && onFilterProject ? (
                      <ColumnFilter
                        values={distinctProjects ?? []}
                        selected={filters?.projects ?? []}
                        onChange={onFilterProject}
                        testId="column-filter-project"
                        columnLabel="Progetto"
                      />
                    ) : null
                  }
                />
              </TableCell>
              <TableCell>
                <FilterableHeader
                  label="Task"
                  filter={
                    filtersEnabled && onFilterTask ? (
                      <ColumnFilter
                        values={distinctTasks ?? []}
                        selected={filters?.tasks ?? []}
                        onChange={onFilterTask}
                        testId="column-filter-task"
                        columnLabel="Task"
                      />
                    ) : null
                  }
                />
              </TableCell>
              <TableCell sx={{ width: 180 }}>Note</TableCell>
              <TableCell align="right" sx={{ width: 70 }}>
                Ore
              </TableCell>
              <TableCell sx={{ width: 132 }}>Stato</TableCell>
              <TableCell sx={{ width: onAssign ? 230 : 200 }}>Connettori assegnati</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleIndices.map((idx) => {
              const entry = entries[idx]
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
