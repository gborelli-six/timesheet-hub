import { useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import AddIcon from '@mui/icons-material/Add'
import KeyIcon from '@mui/icons-material/Key'
import LockIcon from '@mui/icons-material/Lock'

import { useUpsertConnector } from '@/hooks/useConnectors'
import type { ServiceType } from '@/types'

import { ALL_SERVICES, SERVICE_META } from './serviceMeta'

interface AddConnectorDrawerProps {
  open: boolean
  onClose: () => void
  /** Label già in uso dall'utente: servono a impedire un upsert che sovrascriverebbe un connettore esistente. */
  existingLabels: string[]
  'data-testid'?: string
}

export function AddConnectorDrawer({
  open,
  onClose,
  existingLabels,
  'data-testid': testId = 'add-connector-drawer',
}: AddConnectorDrawerProps) {
  const upsert = useUpsertConnector()

  const [service, setService] = useState<ServiceType>('jira')
  const [label, setLabel] = useState('')
  const [accountIdentifier, setAccountIdentifier] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [dbName, setDbName] = useState('')
  const [secret, setSecret] = useState('')

  const meta = SERVICE_META[service]

  const selectService = (s: ServiceType) => {
    setService(s)
    // La label è scelta dall'utente (nessun default): la preserviamo al cambio servizio.
    setAccountIdentifier('')
    setBaseUrl('')
    setDbName('')
    setSecret('')
  }

  const trimmedLabel = label.trim()
  // PUT è un upsert per-label: una label già esistente sovrascriverebbe il connettore corrente
  // invece di crearne uno nuovo. Blocchiamo la collisione lato UI.
  const labelExists = existingLabels.includes(trimmedLabel)
  const canAdd = trimmedLabel !== '' && secret.trim() !== '' && !labelExists

  const handleAdd = () => {
    if (!canAdd || upsert.isPending) return
    upsert.mutate(
      {
        label: trimmedLabel,
        body: {
          service,
          account_identifier: accountIdentifier.trim() || null,
          base_url: meta.hasBaseUrl ? baseUrl.trim() || null : null,
          db_name: meta.hasDbName ? dbName.trim() || null : null,
          secret,
        },
      },
      {
        onSuccess: () => {
          onClose()
          // Reset form
          setService('jira')
          setLabel('')
          setAccountIdentifier('')
          setBaseUrl('')
          setDbName('')
          setSecret('')
        },
      },
    )
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      data-testid={testId}
      PaperProps={{ sx: { width: 440 } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: meta.color,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.875rem',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {meta.letter}
          </Box>
          <Box>
            <Typography variant="body1" fontWeight={700}>
              Aggiungi connettore
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {meta.name}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 3,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {upsert.isError && (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>
            {upsert.error instanceof Error ? upsert.error.message : 'Errore durante la creazione'}
          </Alert>
        )}

        {/* Tipo di servizio */}
        <Box>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'text.secondary',
              display: 'block',
              mb: 1,
            }}
          >
            Tipo di servizio
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            {ALL_SERVICES.map((s) => {
              const sm = SERVICE_META[s]
              const selected = s === service
              return (
                <Box
                  key={s}
                  component="button"
                  onClick={() => selectService(s)}
                  data-testid={`${testId}-service-${s}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.875,
                    py: 1.5,
                    px: 1,
                    border: '1.5px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderRadius: 1.5,
                    bgcolor: selected ? 'primary.50' : 'background.paper',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: selected ? 'primary.main' : 'text.secondary',
                    transition: 'all 150ms',
                    '&:hover': { borderColor: 'primary.light', color: 'text.primary' },
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      bgcolor: sm.color,
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      color: '#fff',
                    }}
                  >
                    {sm.letter}
                  </Box>
                  {sm.name}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Nome connettore */}
        <TextField
          fullWidth
          size="small"
          label={
            <>
              Nome connettore{' '}
              <Typography component="span" color="error">
                *
              </Typography>
            </>
          }
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="es. Jira Team Alpha"
          error={labelExists}
          helperText={
            labelExists
              ? 'Esiste già un connettore con questo nome. Scegline uno diverso.'
              : 'Un nome descrittivo per riconoscerlo nella lista.'
          }
          data-testid={`${testId}-label`}
        />

        {/* account_identifier */}
        <TextField
          fullWidth
          size="small"
          label={meta.accountLabel}
          value={accountIdentifier}
          onChange={(e) => setAccountIdentifier(e.target.value)}
          placeholder={meta.accountPlaceholder}
          data-testid={`${testId}-account-identifier`}
        />

        {/* base_url (condizionale) */}
        {meta.hasBaseUrl && (
          <TextField
            fullWidth
            size="small"
            label="URL istanza"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={meta.baseUrlPlaceholder}
            data-testid={`${testId}-base-url`}
          />
        )}

        {/* db_name (condizionale) */}
        {meta.hasDbName && (
          <TextField
            fullWidth
            size="small"
            label={meta.dbNameLabel}
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            placeholder={meta.dbNamePlaceholder}
            data-testid={`${testId}-db-name`}
          />
        )}

        {/* Secret (required alla creazione) */}
        <TextField
          fullWidth
          size="small"
          type="password"
          required
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
          placeholder="Incolla il token…"
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
          helperText="Il token verrà cifrato lato server e non sarà mai restituito in chiaro."
          data-testid={`${testId}-secret`}
        />
      </Box>

      {/* Footer */}
      <Divider />
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'grey.50',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexShrink: 0,
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={
            upsert.isPending ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AddIcon />
          }
          onClick={handleAdd}
          disabled={!canAdd || upsert.isPending}
          data-testid={`${testId}-btn-add`}
        >
          Aggiungi connettore
        </Button>
        <Button variant="text" size="small" onClick={onClose} data-testid={`${testId}-btn-cancel`}>
          Annulla
        </Button>
      </Box>
    </Drawer>
  )
}
