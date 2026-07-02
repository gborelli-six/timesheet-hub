import { useState } from 'react'

import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LinkIcon from '@mui/icons-material/Link'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'

import { useAdapterProjects, useAdapterTasks, useDebounce } from '@/hooks/useAdapterAutocomplete'
import type { ConnectorAssignment, TimesheetEntry } from '@/lib/timesheet/types'
import { WARNING_LABEL } from '@/lib/timesheet/types'
import { SERVICE_META } from '@/components/connectors/serviceMeta'
import type { ConnectorOut } from '@/types'

interface AssignModalProps {
  open: boolean
  entry: TimesheetEntry
  entryIndex: number
  connectors: ConnectorOut[]
  onSave: (index: number, assignments: ConnectorAssignment[]) => void
  onClose: () => void
  'data-testid'?: string
}

/* ── AssignCard ─────────────────────────────────────────── */

interface AssignCardProps {
  assignment: ConnectorAssignment
  connectors: ConnectorOut[]
  disabledLabels: Set<string>
  onChange: (next: ConnectorAssignment) => void
  onRemove: () => void
  'data-testid'?: string
}

function AssignCard({
  assignment,
  connectors,
  disabledLabels,
  onChange,
  onRemove,
  'data-testid': testId,
}: AssignCardProps) {
  const [projectQuery, setProjectQuery] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const debouncedProjectQuery = useDebounce(projectQuery, 300)
  const debouncedTaskQuery = useDebounce(taskQuery, 300)

  const connector = connectors.find((c) => c.label === assignment.connectorLabel)
  const tokenOk = connector ? !connector.needs_reauth : false
  const meta = connector ? SERVICE_META[connector.service] : null

  const { data: projects = [], isLoading: projectsLoading } = useAdapterProjects(
    tokenOk ? assignment.connectorLabel : null,
    debouncedProjectQuery,
  )

  const { data: tasks = [], isLoading: tasksLoading } = useAdapterTasks(
    tokenOk && assignment.remoteProjectId ? assignment.connectorLabel : null,
    assignment.remoteProjectId || null,
    debouncedTaskQuery,
  )

  const pickConnector = (label: string) => {
    const next = connectors.find((c) => c.label === label)
    onChange({
      ...assignment,
      connectorLabel: label,
      service: next?.service ?? assignment.service,
      remoteProjectId: '',
      remoteProjectName: '',
      remoteTaskId: '',
      remoteTaskName: '',
      suggested: false,
    })
    setProjectQuery('')
    setTaskQuery('')
  }

  const pickProject = (_: unknown, option: { id: string; name: string } | null) => {
    onChange({
      ...assignment,
      remoteProjectId: option?.id ?? '',
      remoteProjectName: option?.name ?? '',
      remoteTaskId: '',
      remoteTaskName: '',
      suggested: false,
    })
    setTaskQuery('')
  }

  const pickTask = (_: unknown, option: { id: string; name: string } | null) => {
    onChange({
      ...assignment,
      remoteTaskId: option?.id ?? '',
      remoteTaskName: option?.name ?? '',
      suggested: false,
    })
  }

  const selectedProject = assignment.remoteProjectId
    ? { id: assignment.remoteProjectId, name: assignment.remoteProjectName }
    : null

  const selectedTask = assignment.remoteTaskId
    ? { id: assignment.remoteTaskId, name: assignment.remoteTaskName }
    : null

  return (
    <Box
      data-testid={testId}
      sx={{
        border: '1px solid',
        borderColor: tokenOk ? 'divider' : 'warning.light',
        borderRadius: 2,
        p: 1.75,
        bgcolor: tokenOk ? 'background.paper' : 'warning.lighter',
      }}
    >
      {/* Top row: connector selector + status + remove */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          mb: 1.5,
        }}
      >
        {/* Connector selector */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            bgcolor: 'grey.100',
            borderRadius: 1.5,
            p: 0.375,
          }}
        >
          {connectors.map((c) => {
            const m = SERVICE_META[c.service]
            const isOn = c.label === assignment.connectorLabel
            // Un altro card usa già questo connettore: non selezionabile qui.
            const isDisabled = !isOn && disabledLabels.has(c.label)
            return (
              <Box
                key={c.label}
                component="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) pickConnector(c.label)
                }}
                data-testid={testId ? `${testId}-connector-${c.label}` : undefined}
                title={isDisabled ? `${c.label} — già assegnato a questa riga` : c.label}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: isOn ? 1.25 : 0.75,
                  py: 0.625,
                  border: 'none',
                  borderRadius: 1.25,
                  bgcolor: isOn ? 'background.paper' : 'transparent',
                  boxShadow: isOn ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  fontFamily: 'inherit',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isOn ? 'text.primary' : 'text.secondary',
                  transition: 'all 140ms',
                  '&:hover': { color: isDisabled ? undefined : 'text.primary' },
                }}
              >
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: 0.5,
                    bgcolor: m.color,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {m.letter}
                </Box>
                {isOn && (
                  <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {c.label}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {assignment.suggested && (
            <Chip
              label="Suggerito"
              size="small"
              icon={<AutoAwesomeIcon />}
              sx={{
                bgcolor: 'info.lighter',
                color: 'info.dark',
                border: '1px dashed',
                borderColor: 'info.light',
                fontSize: '0.6875rem',
              }}
              data-testid={testId ? `${testId}-chip-suggested` : undefined}
            />
          )}
          {tokenOk ? (
            <Chip
              label="Token OK"
              size="small"
              color="success"
              icon={<CheckIcon />}
              sx={{ fontSize: '0.6875rem' }}
            />
          ) : (
            <Chip
              label={connector?.needs_reauth ? 'Token scaduto' : 'Token mancante'}
              size="small"
              color="warning"
              icon={<WarningAmberOutlinedIcon />}
              sx={{ fontSize: '0.6875rem' }}
            />
          )}
          <Tooltip title="Rimuovi connettore">
            <IconButton
              size="small"
              onClick={onRemove}
              data-testid={testId ? `${testId}-remove` : undefined}
              sx={{
                color: 'text.secondary',
                '&:hover': { bgcolor: 'error.lighter', color: 'error.main' },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Token warning */}
      {!tokenOk && (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 1.5, fontSize: '0.8125rem' }}>
          Il token <strong>{meta?.name ?? assignment.connectorLabel}</strong> è{' '}
          {connector?.needs_reauth ? 'scaduto' : 'mancante'}: l'autocomplete è disabilitato.{' '}
          <Typography
            component="a"
            href="/profile"
            sx={{ color: 'warning.dark', fontWeight: 700, textUnderlineOffset: 2 }}
          >
            Aggiornalo nel Profilo
          </Typography>
          .
        </Alert>
      )}

      {/* Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ display: 'block', mb: 0.625, color: 'text.primary' }}
          >
            Progetto remoto{' '}
            <Typography component="span" color="error" variant="caption">
              *
            </Typography>
          </Typography>
          <Autocomplete<AdapterProject>
            options={projects}
            getOptionLabel={(o) => (connector?.service === 'jira' ? `${o.id} — ${o.name}` : o.name)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            filterOptions={(x) => x}
            value={selectedProject}
            onChange={pickProject}
            inputValue={projectQuery}
            onInputChange={(_, val) => setProjectQuery(val)}
            disabled={!tokenOk}
            loading={projectsLoading}
            loadingText="Ricerca sul sistema remoto…"
            noOptionsText={projectQuery ? 'Nessun risultato' : 'Digita per cercare…'}
            size="small"
            data-testid={testId ? `${testId}-project-autocomplete` : undefined}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {connector?.service === 'jira' ? (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: 'text.secondary',
                        flexShrink: 0,
                      }}
                    >
                      {option.id}
                    </Typography>
                    <Typography component="span" variant="body2">
                      {option.name}
                    </Typography>
                  </Box>
                ) : (
                  option.name
                )}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={`Cerca progetto su ${meta?.name ?? assignment.connectorLabel}…`}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {projectsLoading ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        </Box>

        <Box>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ display: 'block', mb: 0.625, color: 'text.primary' }}
          >
            Task remoto{' '}
            <Typography component="span" color="error" variant="caption">
              *
            </Typography>
          </Typography>
          <Autocomplete<AdapterTask>
            options={tasks}
            getOptionLabel={(o) => (connector?.service === 'jira' ? `${o.id} — ${o.name}` : o.name)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            filterOptions={(x) => x}
            value={selectedTask}
            onChange={pickTask}
            inputValue={taskQuery}
            onInputChange={(_, val) => setTaskQuery(val)}
            disabled={!tokenOk || !assignment.remoteProjectId}
            loading={tasksLoading}
            loadingText="Ricerca task…"
            noOptionsText={
              !assignment.remoteProjectId ? 'Scegli prima il progetto' : 'Nessun risultato'
            }
            size="small"
            data-testid={testId ? `${testId}-task-autocomplete` : undefined}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {connector?.service === 'jira' ? (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: 'text.secondary',
                        flexShrink: 0,
                      }}
                    >
                      {option.id}
                    </Typography>
                    <Typography component="span" variant="body2">
                      {option.name}
                    </Typography>
                  </Box>
                ) : (
                  option.name
                )}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={
                  assignment.remoteProjectId ? 'Cerca task…' : 'Scegli prima il progetto'
                }
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {tasksLoading ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        </Box>
      </Box>
    </Box>
  )
}

/* ── AssignModal ─────────────────────────────────────────── */

type AdapterProject = { id: string; name: string }
type AdapterTask = { id: string; name: string }

export function AssignModal({
  open,
  entry,
  entryIndex,
  connectors,
  onSave,
  onClose,
  'data-testid': testId = 'assign-modal',
}: AssignModalProps) {
  const [list, setList] = useState<ConnectorAssignment[]>(() =>
    (entry.connectorAssignments ?? []).map((a) => ({ ...a })),
  )

  // Reset when the modal opens for a different entry
  const [prevIndex, setPrevIndex] = useState(entryIndex)
  if (prevIndex !== entryIndex) {
    setPrevIndex(entryIndex)
    setList((entry.connectorAssignments ?? []).map((a) => ({ ...a })))
  }

  const entryWarnings = [] as string[]
  if (!entry.project) entryWarnings.push(WARNING_LABEL.MISSING_PROJECT)
  if (!entry.task) entryWarnings.push(WARNING_LABEL.MISSING_TASK)
  if (entry.hours == null || isNaN(entry.hours)) entryWarnings.push(WARNING_LABEL.MISSING_HOURS)

  const hasSuggested = list.some((a) => a.suggested)
  const completeCount = list.filter((a) => a.remoteProjectId && a.remoteTaskId).length
  const canSave = list.length === 0 || list.every((a) => a.remoteProjectId && a.remoteTaskId)

  // Un connettore può essere assegnato una sola volta per riga: il backend
  // conserva solo il primo assignment per label, quindi eventuali duplicati
  // verrebbero scartati silenziosamente.
  const usedLabels = new Set(list.map((a) => a.connectorLabel))
  const allConnectorsUsed = connectors.length > 0 && usedLabels.size >= connectors.length

  const addConnector = () => {
    const next = connectors.find((c) => !usedLabels.has(c.label))
    if (!next) return
    setList((prev) => [
      ...prev,
      {
        connectorLabel: next.label,
        service: next.service,
        remoteProjectId: '',
        remoteProjectName: '',
        remoteTaskId: '',
        remoteTaskName: '',
        suggested: false,
      },
    ])
  }

  const changeCard = (idx: number, next: ConnectorAssignment) => {
    setList((prev) => prev.map((a, i) => (i === idx ? next : a)))
  }

  const removeCard = (idx: number) => {
    setList((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    onSave(entryIndex, list)
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      data-testid={testId}
      PaperProps={{
        sx: {
          width: 'min(496px, 100vw)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2.75,
          pt: 2.25,
          pb: 1.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}
        >
          <Typography variant="body1" fontWeight={700}>
            Assegna connettori
          </Typography>
          <IconButton size="small" onClick={onClose} data-testid={`${testId}-close`}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Context row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            flexWrap: 'wrap',
            px: 1.5,
            py: 1,
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: 'text.secondary' }}>
            <CalendarTodayOutlinedIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption">{entry.date ?? '—'}</Typography>
          </Box>
          <Box sx={{ width: 1, height: 14, bgcolor: 'divider' }} />
          <Typography
            variant="caption"
            fontWeight={700}
            color={entry.project ? 'text.primary' : 'text.disabled'}
            sx={{ fontStyle: entry.project ? 'normal' : 'italic' }}
          >
            {entry.project || '— progetto mancante'}
          </Typography>
          <Box sx={{ width: 1, height: 14, bgcolor: 'divider' }} />
          <Typography
            variant="caption"
            color={entry.task ? 'text.secondary' : 'text.disabled'}
            sx={{ fontStyle: entry.task ? 'normal' : 'italic' }}
          >
            {entry.task || '— task mancante'}
          </Typography>
          <Box sx={{ width: 1, height: 14, bgcolor: 'divider' }} />
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ fontFamily: 'monospace' }}
            color={entry.hours != null ? 'text.primary' : 'text.disabled'}
          >
            {entry.hours != null ? `${entry.hours} h` : '— h'}
          </Typography>
        </Box>

        {/* Row warnings */}
        {entryWarnings.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.875,
              mt: 1.25,
              color: 'warning.dark',
            }}
          >
            <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption" color="warning.dark">
              {entryWarnings.join(' · ')} — puoi comunque assegnare e importare.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2.75,
          py: 2.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
        }}
      >
        {/* Suggestions note */}
        {hasSuggested && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.125,
              px: 1.625,
              py: 1.125,
              bgcolor: 'info.lighter',
              border: '1px dashed',
              borderColor: 'info.light',
              borderRadius: 1.5,
              color: 'info.dark',
            }}
            data-testid={`${testId}-suggest-note`}
          >
            <AutoAwesomeIcon sx={{ fontSize: 14, flexShrink: 0, color: 'info.main' }} />
            <Typography variant="caption" fontWeight={500}>
              Associazioni pre-compilate dallo storico. Verifica, modifica o rimuovi prima di
              confermare.
            </Typography>
          </Box>
        )}

        {/* Empty state */}
        {list.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              textAlign: 'center',
              py: 3.5,
              px: 2.5,
              border: '1.5px dashed',
              borderColor: 'grey.300',
              borderRadius: 2,
              color: 'text.disabled',
            }}
            data-testid={`${testId}-empty-state`}
          >
            <LinkIcon sx={{ fontSize: 28, opacity: 0.35 }} />
            <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mt: 0.75 }}>
              Nessun connettore assegnato
            </Typography>
            <Typography variant="caption">
              Una riga senza connettori <strong>non verrà importata</strong>. Aggiungine almeno uno.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {list.map((a, i) => (
              <AssignCard
                key={i}
                assignment={a}
                connectors={connectors}
                disabledLabels={
                  new Set(list.filter((_, j) => j !== i).map((other) => other.connectorLabel))
                }
                onChange={(next) => changeCard(i, next)}
                onRemove={() => removeCard(i)}
                data-testid={`${testId}-card-${i}`}
              />
            ))}
          </Box>
        )}

        {/* Add connector button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={addConnector}
          disabled={list.length >= 4 || connectors.length === 0 || allConnectorsUsed}
          data-testid={`${testId}-btn-add`}
          sx={{ alignSelf: 'flex-start' }}
        >
          Aggiungi connettore
        </Button>
      </Box>

      {/* Footer */}
      <Divider />
      <Box
        sx={{
          flexShrink: 0,
          px: 2.75,
          py: 1.75,
          bgcolor: 'grey.50',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={600}
          data-testid={`${testId}-status`}
          sx={{
            color: list.length === 0 ? 'warning.dark' : 'text.secondary',
            fontFamily: 'monospace',
          }}
        >
          {list.length === 0 ? (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
              <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
              Riga non importabile
            </Box>
          ) : (
            `${completeCount}/${list.length} connettori completi`
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
          <Button
            variant="text"
            size="small"
            onClick={onClose}
            data-testid={`${testId}-btn-cancel`}
          >
            Annulla
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<CheckIcon />}
            onClick={handleSave}
            disabled={!canSave}
            data-testid={`${testId}-btn-save`}
          >
            Conferma assegnazione
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
