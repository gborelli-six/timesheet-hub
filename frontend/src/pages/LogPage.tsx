import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import { StatusBadge } from '@/components/ui'
import { ConnectorTag } from '@/components/log/ConnectorTag'
import { ALL_SERVICES, SERVICE_META } from '@/components/connectors/serviceMeta'
import { useImports } from '@/hooks/useImports'
import { useConnectors } from '@/hooks/useConnectors'
import { formatLogDate, formatPeriodRange, statusBadge } from '@/lib/importLog'
import type { ImportFilters, ImportStatus } from '@/types'

const EMPTY_FILTERS: ImportFilters = {
  period_from: '',
  period_to: '',
  service: '',
  status: '',
  connector_label: '',
}

const STATUS_OPTIONS: { value: ImportStatus; label: string }[] = [
  { value: 'in_progress', label: 'In corso' },
  { value: 'success', label: 'Successo' },
  { value: 'partial', label: 'Parziale' },
  { value: 'failed', label: 'Fallito' },
]

// Pannello centrato riusato per gli stati vuoto/errore.
function StatePanel({
  icon,
  tone,
  title,
  subtitle,
  action,
  'data-testid': testId,
}: {
  icon: ReactNode
  tone: 'neutral' | 'error'
  title: string
  subtitle: string
  action?: ReactNode
  'data-testid'?: string
}) {
  return (
    <Paper
      variant="outlined"
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        textAlign: 'center',
        py: 8,
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: tone === 'error' ? 'error.lighter' : 'grey.100',
          color: tone === 'error' ? 'error.main' : 'text.secondary',
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '44ch' }}>
        {subtitle}
      </Typography>
      {action}
    </Paper>
  )
}

export default function LogPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ImportFilters>(EMPTY_FILTERS)

  const { data: imports, isLoading, isError, refetch } = useImports(filters)

  const { data: allConnectors = [] } = useConnectors()

  const connectorOptions = filters.service
    ? allConnectors.filter((c) => c.service === filters.service)
    : allConnectors

  const handleServiceChange = (svc: string) => {
    const currentConn = allConnectors.find((c) => c.label === filters.connector_label)
    const labelStillValid = !svc || currentConn?.service === svc
    setFilters((prev) => ({
      ...prev,
      service: svc as ImportFilters['service'],
      connector_label: labelStillValid ? prev.connector_label : '',
    }))
  }

  const handleConnectorChange = (label: string) => {
    const conn = allConnectors.find((c) => c.label === label)
    setFilters((prev) => ({
      ...prev,
      connector_label: label,
      service: label ? (conn?.service ?? prev.service ?? '') : (prev.service ?? ''),
    }))
  }

  const hasFilter = useMemo(
    () =>
      Boolean(
        filters.period_from ||
        filters.period_to ||
        filters.service ||
        filters.status ||
        filters.connector_label,
      ),
    [filters],
  )
  const reset = () => setFilters(EMPTY_FILTERS)
  const setField = <K extends keyof ImportFilters>(key: K, value: ImportFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const rows = imports ?? []

  return (
    <Box sx={{ maxWidth: 1080 }}>
      {/* Page hero */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
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
          Storico
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Log importazioni
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', maxWidth: '64ch' }}>
          Cronologia delle importazioni effettuate, con esito, backend coinvolti e conteggio righe.
          Apri una riga per il dettaglio degli errori.
        </Typography>
      </Box>

      {/* Filtri */}
      <Paper
        variant="outlined"
        data-testid="log-filters"
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          flexWrap: 'wrap',
          p: 2,
          mb: 2.5,
        }}
      >
        <TextField
          label="Da"
          type="date"
          size="small"
          value={filters.period_from ?? ''}
          onChange={(e) => setField('period_from', e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'filter-period-from' }}
        />
        <TextField
          label="A"
          type="date"
          size="small"
          value={filters.period_to ?? ''}
          onChange={(e) => setField('period_to', e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'filter-period-to' }}
        />
        <TextField
          select
          label="Tipo"
          size="small"
          value={filters.service ?? ''}
          onChange={(e) => handleServiceChange(e.target.value)}
          sx={{ minWidth: 140 }}
          inputProps={{ 'data-testid': 'filter-service' }}
        >
          <MenuItem value="">Tutti</MenuItem>
          {ALL_SERVICES.map((s) => (
            <MenuItem key={s} value={s}>
              {SERVICE_META[s].name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Connettore"
          size="small"
          value={filters.connector_label ?? ''}
          onChange={(e) => handleConnectorChange(e.target.value)}
          sx={{ minWidth: 180 }}
          inputProps={{ 'data-testid': 'filter-connector' }}
          disabled={connectorOptions.length === 0}
        >
          <MenuItem value="">Tutti</MenuItem>
          {connectorOptions.map((c) => (
            <MenuItem key={c.label} value={c.label}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Esito"
          size="small"
          value={filters.status ?? ''}
          onChange={(e) => setField('status', e.target.value as ImportStatus | '')}
          sx={{ minWidth: 150 }}
          inputProps={{ 'data-testid': 'filter-status' }}
        >
          <MenuItem value="">Tutti</MenuItem>
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ flex: 1 }} />
        {hasFilter && (
          <Button size="small" onClick={reset} data-testid="log-filters-reset">
            Azzera filtri
          </Button>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="log-count"
          sx={{ fontFamily: 'monospace', alignSelf: 'center' }}
        >
          {rows.length} import
        </Typography>
      </Paper>

      {/* Stati */}
      {isError ? (
        <StatePanel
          data-testid="log-error"
          tone="error"
          icon={<ErrorOutlineIcon />}
          title="Impossibile caricare il log"
          subtitle="Si è verificato un errore nel recupero delle importazioni. Riprova tra qualche istante."
          action={
            <Button variant="outlined" size="small" onClick={() => refetch()}>
              Riprova
            </Button>
          }
        />
      ) : isLoading ? (
        <Box data-testid="log-loading" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <StatePanel
          data-testid="log-empty"
          tone="neutral"
          icon={<DescriptionOutlinedIcon />}
          title={hasFilter ? 'Nessuna importazione trovata' : 'Nessuna importazione'}
          subtitle={
            hasFilter
              ? 'Nessun risultato per i filtri selezionati. Prova ad ampliare periodo, tipo, connettore o esito.'
              : 'Non hai ancora effettuato importazioni. Carica un timesheet per iniziare.'
          }
          action={
            hasFilter ? (
              <Button variant="outlined" size="small" onClick={reset}>
                Azzera filtri
              </Button>
            ) : (
              <Button variant="contained" size="small" onClick={() => navigate('/import')}>
                Nuova importazione
              </Button>
            )
          }
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" data-testid="log-table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>Data</TableCell>
                <TableCell>Connettori</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>
                  OK / Fail
                </TableCell>
                <TableCell sx={{ width: 130 }}>Esito</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((imp) => {
                const badge = statusBadge(imp.status)
                return (
                  <TableRow
                    key={imp.id}
                    hover
                    data-testid="log-row"
                    data-import-id={imp.id}
                    onClick={() => navigate(`/log/${imp.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {formatLogDate(imp.created_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatPeriodRange(imp.period_start, imp.period_end)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {(imp.connectors ?? []).map((c) => (
                          <ConnectorTag key={c.label} service={c.service} label={c.label} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        component="span"
                        sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                      >
                        <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>
                          {imp.success_rows}
                        </Box>
                        <Box component="span" sx={{ color: 'text.disabled', mx: 0.5 }}>
                          /
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            color: imp.failed_rows > 0 ? 'error.main' : 'text.disabled',
                            fontWeight: 700,
                          }}
                        >
                          {imp.failed_rows}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={badge.status} label={badge.label} />
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
