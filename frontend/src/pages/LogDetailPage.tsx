import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import { StatusBadge } from '@/components/ui'
import { ServiceTag } from '@/components/log/ServiceTag'
import { SERVICE_META } from '@/components/connectors/serviceMeta'
import { useImportDetail } from '@/hooks/useImports'
import { formatLogDateTime, formatPeriodRange, statusBadge } from '@/lib/importLog'
import type { ImportRowOut } from '@/types'

type GroupStatus = 'success' | 'failed' | 'mixed'

interface RowGroup {
  rowNumber: number
  excelProject: string
  excelTask: string
  hours: number
  backends: ImportRowOut[]
  status: GroupStatus
}

// Raggruppa le import_rows per riga sorgente (row_number): una riga Excel può
// puntare a più backend, ciascuno con esito indipendente.
function groupRows(rows: ImportRowOut[]): RowGroup[] {
  const order: number[] = []
  const byNum = new Map<number, RowGroup>()
  for (const r of rows) {
    let g = byNum.get(r.row_number)
    if (!g) {
      g = {
        rowNumber: r.row_number,
        excelProject: r.excel_project,
        excelTask: r.excel_task,
        hours: r.hours,
        backends: [],
        status: 'success',
      }
      byNum.set(r.row_number, g)
      order.push(r.row_number)
    }
    g.backends.push(r)
  }
  for (const g of byNum.values()) {
    const okN = g.backends.filter((b) => b.status === 'success').length
    g.status = okN === g.backends.length ? 'success' : okN === 0 ? 'failed' : 'mixed'
  }
  return order.map((n) => byNum.get(n)!)
}

function MetaCard({ label, children, sub }: { label: string; children: ReactNode; sub?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography
        variant="caption"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'text.secondary',
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ fontSize: '1.125rem', fontWeight: 700 }}>{children}</Box>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      startIcon={<ArrowBackIcon />}
      size="small"
      color="inherit"
      sx={{ color: 'text.secondary', mb: 1.5 }}
    >
      Torna al log
    </Button>
  )
}

export default function LogDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [rowFilter, setRowFilter] = useState<'all' | 'fail'>('all')

  const { data: imp, isLoading, isError } = useImportDetail(id ?? null)

  const groups = useMemo(() => (imp ? groupRows(imp.rows) : []), [imp])
  const failGroups = groups.filter((g) => g.status !== 'success')
  const visibleGroups = rowFilter === 'fail' ? failGroups : groups

  const back = () => navigate('/log')

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 1080 }} data-testid="detail-loading">
        <BackLink onClick={back} />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  if (isError || !imp) {
    return (
      <Box sx={{ maxWidth: 1080 }}>
        <BackLink onClick={back} />
        <Paper
          variant="outlined"
          data-testid="detail-notfound"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
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
              bgcolor: 'error.lighter',
              color: 'error.main',
            }}
          >
            <ErrorOutlineIcon />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Importazione non trovata
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '44ch' }}>
            L&apos;importazione richiesta non esiste o non è associata al tuo account.
          </Typography>
          <Button variant="outlined" size="small" onClick={back}>
            Torna al log
          </Button>
        </Paper>
      </Box>
    )
  }

  const badge = statusBadge(imp.status)

  return (
    <Box sx={{ maxWidth: 1080 }} data-testid="detail-container" data-import-id={imp.id}>
      <BackLink onClick={back} />

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
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
            Import {imp.id}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mt: 0.5 }}>
            {formatPeriodRange(imp.period_start, imp.period_end)}
          </Typography>
        </Box>
        <StatusBadge status={badge.status} label={badge.label} />
      </Box>

      {/* Metadata */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.75,
          mb: 3,
        }}
      >
        <MetaCard label="Periodo" sub={formatLogDateTime(imp.created_at)}>
          {formatPeriodRange(imp.period_start, imp.period_end)}
        </MetaCard>
        <MetaCard label="Esito">
          <StatusBadge status={badge.status} label={badge.label} />
        </MetaCard>
        <MetaCard label="Righe importate" sub={`su ${imp.total_rows} totali`}>
          <Box component="span" sx={{ color: 'success.main', fontFamily: 'monospace' }}>
            {imp.success_rows}
          </Box>
        </MetaCard>
        <MetaCard
          label="Righe fallite"
          sub={imp.services.map((s) => SERVICE_META[s].name).join(' · ')}
        >
          <Box
            component="span"
            sx={{
              color: imp.failed_rows > 0 ? 'error.main' : 'text.primary',
              fontFamily: 'monospace',
            }}
          >
            {imp.failed_rows}
          </Box>
        </MetaCard>
      </Box>

      {/* Righe */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Righe importazione
        </Typography>
        <Box sx={{ display: 'inline-flex', gap: 1 }} data-testid="rows-filter">
          <Button
            size="small"
            variant={rowFilter === 'all' ? 'contained' : 'text'}
            onClick={() => setRowFilter('all')}
          >
            Tutte ({groups.length})
          </Button>
          <Button
            size="small"
            variant={rowFilter === 'fail' ? 'contained' : 'text'}
            color="error"
            onClick={() => setRowFilter('fail')}
          >
            Solo errori ({failGroups.length})
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" data-testid="detail-rows">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }}>#</TableCell>
              <TableCell sx={{ width: 180 }}>Progetto (Excel)</TableCell>
              <TableCell sx={{ width: 160 }}>Task (Excel)</TableCell>
              <TableCell align="right" sx={{ width: 64 }}>
                Ore
              </TableCell>
              <TableCell>Backend → destinazione remota</TableCell>
              <TableCell sx={{ width: 120 }}>Esito adapter</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleGroups.map((g) =>
              g.backends.map((b, j) => {
                const bad = b.status === 'failed'
                return (
                  <TableRow
                    key={`${g.rowNumber}-${j}`}
                    data-testid={j === 0 ? 'detail-row' : 'detail-backend'}
                    data-row-status={g.status}
                    data-backend-status={b.status}
                  >
                    {j === 0 && (
                      <>
                        <TableCell rowSpan={g.backends.length} sx={{ verticalAlign: 'top' }}>
                          {g.rowNumber}
                        </TableCell>
                        <TableCell rowSpan={g.backends.length} sx={{ verticalAlign: 'top' }}>
                          <Typography variant="body2" fontWeight={600}>
                            {g.excelProject}
                          </Typography>
                        </TableCell>
                        <TableCell rowSpan={g.backends.length} sx={{ verticalAlign: 'top' }}>
                          <Typography variant="body2">{g.excelTask}</Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          rowSpan={g.backends.length}
                          sx={{ verticalAlign: 'top', fontFamily: 'monospace' }}
                        >
                          {g.hours.toFixed(1)}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                        >
                          <ServiceTag service={b.service} />
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: 'text.secondary',
                            }}
                          >
                            <ArrowForwardIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                            {[b.remote_project_name, b.remote_task_name]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </Box>
                        </Box>
                        {bad && b.error_message && (
                          <Box
                            data-testid="row-error"
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 0.75,
                              color: 'error.main',
                              fontSize: '0.75rem',
                              maxWidth: '46ch',
                            }}
                          >
                            <ErrorOutlineIcon sx={{ fontSize: 14, mt: '1px' }} />
                            <span>{b.error_message}</span>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {bad ? (
                        <Chip size="small" color="error" icon={<CloseIcon />} label="Fallita" />
                      ) : (
                        <Chip size="small" color="success" icon={<CheckIcon />} label="OK" />
                      )}
                    </TableCell>
                  </TableRow>
                )
              }),
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
