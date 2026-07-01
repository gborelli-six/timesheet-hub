import { useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import KeyIcon from '@mui/icons-material/Key'
import LockIcon from '@mui/icons-material/Lock'
import { ConfirmDialog, StatusBadge } from '@/components/ui'
import { useDeleteConnector, useUpsertConnector } from '@/hooks/useConnectors'
import type { ConnectorOut, ServiceType } from '@/types'

import { SERVICE_META } from './serviceMeta'

interface ConnectorRowProps {
  conn: ConnectorOut
  isExpanded: boolean
  onToggle: () => void
  'data-testid'?: string
}

export function ConnectorRow({
  conn,
  isExpanded,
  onToggle,
  'data-testid': testId = `connector-row-${conn.label}`,
}: ConnectorRowProps) {
  const meta = SERVICE_META[conn.service as ServiceType]
  const upsert = useUpsertConnector()
  const deleteConnector = useDeleteConnector()

  const [accountIdentifier, setAccountIdentifier] = useState(conn.account_identifier ?? '')
  const [baseUrl, setBaseUrl] = useState(conn.base_url ?? '')
  const [dbName, setDbName] = useState(conn.db_name ?? '')
  const [secret, setSecret] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sync state when conn changes (after invalidation)
  useEffect(() => {
    setAccountIdentifier(conn.account_identifier ?? '')
    setBaseUrl(conn.base_url ?? '')
    setDbName(conn.db_name ?? '')
    setSecret('')
    setSaveSuccess(false)
  }, [conn.account_identifier, conn.base_url, conn.db_name, conn.label])

  const handleSave = () => {
    const body: {
      account_identifier?: string | null
      base_url?: string | null
      db_name?: string | null
      secret?: string
    } = {}
    if (accountIdentifier !== (conn.account_identifier ?? '')) {
      body.account_identifier = accountIdentifier || null
    }
    if (meta.hasBaseUrl && baseUrl !== (conn.base_url ?? '')) {
      body.base_url = baseUrl || null
    }
    if (meta.hasDbName && dbName !== (conn.db_name ?? '')) {
      body.db_name = dbName || null
    }
    if (secret) body.secret = secret

    upsert.mutate(
      { label: conn.label, body },
      {
        onSuccess: () => {
          setSaveSuccess(true)
          setSecret('')
          setTimeout(() => setSaveSuccess(false), 2500)
        },
      },
    )
  }

  const handleDelete = () => {
    deleteConnector.mutate(conn.label)
    setDeleteOpen(false)
  }

  const isSaving = upsert.isPending
  const isDeleting = deleteConnector.isPending

  const status: 'success' | 'warning' = conn.needs_reauth ? 'warning' : 'success'
  const statusLabel = conn.needs_reauth ? 'Da aggiornare' : 'Configurato'

  const formattedDate = conn.updated_at
    ? new Date(conn.updated_at).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <>
      {/* Compact summary row */}
      <Box
        data-testid={testId}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          cursor: 'pointer',
          bgcolor: isExpanded ? 'primary.50' : 'transparent',
          transition: 'background 150ms',
          '&:hover': { bgcolor: isExpanded ? 'primary.50' : 'grey.50' },
        }}
        onClick={onToggle}
      >
        {/* Service logo */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: meta.color,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#fff',
          }}
          aria-hidden
        >
          {meta.letter}
        </Box>

        {/* Name + meta */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {conn.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}
            noWrap
          >
            {meta.name} · {conn.account_identifier ?? <em>non configurato</em>}
          </Typography>
        </Box>

        {/* Status badge */}
        <StatusBadge status={status} label={statusLabel} data-testid={`${testId}-status`} />

        {/* Action buttons */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title={isExpanded ? 'Chiudi' : 'Modifica'}>
            <IconButton
              size="small"
              onClick={onToggle}
              sx={isExpanded ? { bgcolor: 'primary.50', color: 'primary.700' } : {}}
              data-testid={`${testId}-btn-edit`}
            >
              {isExpanded ? <CloseIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Elimina">
            <IconButton
              size="small"
              color="error"
              onClick={() => setDeleteOpen(true)}
              disabled={isDeleting}
              data-testid={`${testId}-btn-delete`}
            >
              {isDeleting ? (
                <CircularProgress size={14} color="error" />
              ) : (
                <DeleteOutlineIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Inline edit form */}
      <Collapse in={isExpanded} unmountOnExit>
        <Divider sx={{ borderStyle: 'dashed', borderColor: 'primary.200' }} />
        <Box
          sx={{
            px: 2.5,
            py: 2,
            bgcolor: 'rgba(64,104,200,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
          }}
        >
          {upsert.isError && (
            <Alert severity="error" sx={{ borderRadius: 1.5 }}>
              {upsert.error instanceof Error
                ? upsert.error.message
                : 'Errore durante il salvataggio'}
            </Alert>
          )}

          {conn.needs_reauth && (
            <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
              Il token per questo connettore non è più valido. Inserisci un nuovo segreto per
              ripristinarlo.
            </Alert>
          )}

          <Grid container spacing={2} alignItems="flex-start">
            {/* account_identifier */}
            <Grid size={{ xs: 12, sm: meta.hasBaseUrl ? 6 : 12 }}>
              <TextField
                fullWidth
                size="small"
                label={meta.accountLabel}
                value={accountIdentifier}
                onChange={(e) => setAccountIdentifier(e.target.value)}
                placeholder={meta.accountPlaceholder}
                data-testid={`${testId}-account-identifier`}
              />
            </Grid>

            {/* base_url (solo per i servizi che lo usano) */}
            {meta.hasBaseUrl && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="URL istanza"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={meta.baseUrlPlaceholder}
                  data-testid={`${testId}-base-url`}
                />
              </Grid>
            )}

            {/* db_name (solo per i servizi che lo usano) */}
            {meta.hasDbName && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={meta.dbNameLabel}
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder={meta.dbNamePlaceholder}
                  data-testid={`${testId}-db-name`}
                />
              </Grid>
            )}

            {/* Secret write-only */}
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {meta.secretLabel}
                    <Typography
                      component="span"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.6875rem',
                        fontWeight: 400,
                        color: 'text.disabled',
                      }}
                    >
                      write-only
                    </Typography>
                  </Box>
                }
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={conn.configured ? '•••• già configurato' : 'Incolla il token…'}
                autoComplete="new-password"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                helperText={
                  conn.configured
                    ? 'Lascia vuoto per mantenere il token esistente.'
                    : 'Il token verrà cifrato lato server e non sarà mai restituito in chiaro.'
                }
                data-testid={`${testId}-secret`}
              />
            </Grid>
          </Grid>

          {/* Footer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box
              component="button"
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              data-testid={`${testId}-btn-save`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                height: 32,
                px: 1.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: saveSuccess ? 'success.main' : 'primary.main',
                bgcolor: saveSuccess ? 'success.main' : 'primary.main',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: isSaving || saveSuccess ? 'default' : 'pointer',
                transition: 'all 150ms',
                '&:hover:not(:disabled)': { bgcolor: 'primary.dark', borderColor: 'primary.dark' },
                '&:disabled': { opacity: 0.75 },
              }}
            >
              {isSaving ? (
                <CircularProgress size={13} sx={{ color: '#fff' }} />
              ) : saveSuccess ? (
                <>
                  <CheckIcon sx={{ fontSize: 13 }} /> Salvato
                </>
              ) : (
                'Aggiorna'
              )}
            </Box>

            {formattedDate && !saveSuccess && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                Aggiornato {formattedDate}
              </Typography>
            )}

            {saveSuccess && (
              <Typography
                variant="caption"
                sx={{
                  color: 'success.main',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <CheckIcon sx={{ fontSize: 12 }} /> Token cifrato e salvato
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>

      <ConfirmDialog
        open={deleteOpen}
        title="Elimina connettore"
        message={`Rimuovere il connettore "${conn.label}" (${meta.name})? Questa azione non può essere annullata.`}
        confirmLabel="Elimina"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        data-testid={`${testId}-confirm-delete`}
      />
    </>
  )
}
