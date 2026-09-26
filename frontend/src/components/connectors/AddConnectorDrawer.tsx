import { useEffect, useState } from 'react'

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
import { useConnectorTypes } from '@/hooks/useConnectorTypes'
import type { ConnectorTypeOut, ServiceType } from '@/types'

import { SERVICE_META } from './serviceMeta'

export type ConnectorDrawerKind = 'source' | 'destination'

interface AddConnectorDrawerProps {
  open: boolean
  /** Filtra i tipi selezionabili a sole sorgenti o sole destinazioni: i due
   * ruoli hanno azioni ed elenchi separati nella pagina Profilo, quindi anche
   * il drawer non deve mescolare i tipi dell'uno con quelli dell'altro. */
  kind: ConnectorDrawerKind
  onClose: () => void
  /** Label già in uso dall'utente: servono a impedire un upsert che sovrascriverebbe un connettore esistente. */
  existingLabels: string[]
  'data-testid'?: string
}

export function AddConnectorDrawer({
  open,
  kind,
  onClose,
  existingLabels,
  'data-testid': testIdProp,
}: AddConnectorDrawerProps) {
  const testId = testIdProp ?? `add-${kind}-drawer`
  const upsert = useUpsertConnector()
  const { data: allConnectorTypes = [], isLoading: typesLoading } = useConnectorTypes()
  const connectorTypes = allConnectorTypes.filter((t) =>
    kind === 'source' ? t.is_source : t.is_destination,
  )

  const [service, setService] = useState<ServiceType | null>(null)
  const [label, setLabel] = useState('')
  const [accountIdentifier, setAccountIdentifier] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState('')

  // Il primo tipo disponibile (nel sottoinsieme filtrato per `kind`) diventa
  // la selezione di default appena il catalogo è caricato o quando il drawer
  // cambia ruolo (non possiamo assumere che il primo tipo del sottoinsieme
  // sia sempre disponibile).
  useEffect(() => {
    if (!open) return
    if (connectorTypes.length === 0) return
    if (service !== null && connectorTypes.some((t) => t.service === service)) return
    const firstAvailable = connectorTypes.find((t) => t.available)
    setService((firstAvailable ?? connectorTypes[0]).service)
    // Il servizio corrente non è più tra quelli del `kind` attivo (es. si è
    // appena passati da "Aggiungi sorgente" a "Aggiungi connettore"): i campi
    // specifici del servizio precedente non hanno senso per il nuovo.
    setAccountIdentifier('')
    setBaseUrl('')
    setConfig({})
    setSecret('')
  }, [connectorTypes, open, service])

  const spec: ConnectorTypeOut | undefined = connectorTypes.find((t) => t.service === service)

  const selectService = (s: ConnectorTypeOut) => {
    if (!s.available) return
    setService(s.service)
    // La label è scelta dall'utente (nessun default): la preserviamo al cambio servizio.
    setAccountIdentifier('')
    setBaseUrl('')
    setConfig({})
    setSecret('')
  }

  const setConfigField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const trimmedLabel = label.trim()
  // PUT è un upsert per-label: una label già esistente sovrascriverebbe il connettore corrente
  // invece di crearne uno nuovo. Blocchiamo la collisione lato UI.
  const labelExists = existingLabels.includes(trimmedLabel)
  const missingRequiredConfig = (spec?.config_fields ?? []).some(
    (f) => f.required && !(config[f.key] ?? '').trim(),
  )
  const canAdd =
    !!spec?.available &&
    trimmedLabel !== '' &&
    secret.trim() !== '' &&
    !labelExists &&
    !missingRequiredConfig

  const handleAdd = () => {
    if (!canAdd || !service || upsert.isPending) return
    upsert.mutate(
      {
        label: trimmedLabel,
        body: {
          service,
          account_identifier: accountIdentifier.trim() || null,
          base_url: spec?.requires_base_url ? baseUrl.trim() || null : null,
          config,
          secret,
        },
      },
      {
        onSuccess: () => {
          onClose()
          // Reset form
          setService(null)
          setLabel('')
          setAccountIdentifier('')
          setBaseUrl('')
          setConfig({})
          setSecret('')
        },
      },
    )
  }

  const meta = service ? SERVICE_META[service] : null
  const actionLabel = kind === 'source' ? 'Aggiungi sorgente' : 'Aggiungi connettore'

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
              bgcolor: meta?.color ?? 'grey.400',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.875rem',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {meta?.letter ?? '?'}
          </Box>
          <Box>
            <Typography variant="body1" fontWeight={700}>
              {actionLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {meta?.name ?? '—'}
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
          {typesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {connectorTypes.map((t) => {
                const sm = SERVICE_META[t.service]
                const selected = t.service === service
                const disabled = !t.available
                return (
                  <Box
                    key={t.service}
                    component="button"
                    onClick={() => selectService(t)}
                    disabled={disabled}
                    title={disabled ? 'Non ancora disponibile' : undefined}
                    data-testid={`${testId}-service-${t.service}`}
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
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                      fontFamily: 'inherit',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: selected ? 'primary.main' : 'text.secondary',
                      transition: 'all 150ms',
                      '&:hover': disabled
                        ? {}
                        : { borderColor: 'primary.light', color: 'text.primary' },
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
          )}
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

        {/* account_identifier (condizionale) */}
        {spec?.requires_account_identifier && (
          <TextField
            fullWidth
            size="small"
            label={spec?.account_identifier_label ?? 'Identificativo account'}
            value={accountIdentifier}
            onChange={(e) => setAccountIdentifier(e.target.value)}
            data-testid={`${testId}-account-identifier`}
          />
        )}

        {/* base_url (condizionale) */}
        {spec?.requires_base_url && (
          <TextField
            fullWidth
            size="small"
            label="URL istanza"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            data-testid={`${testId}-base-url`}
          />
        )}

        {/* Campi di configurazione specifici del servizio (dal catalogo) */}
        {(spec?.config_fields ?? []).map((field) => (
          <TextField
            key={field.key}
            fullWidth
            size="small"
            label={
              field.required ? (
                <>
                  {field.label}{' '}
                  <Typography component="span" color="error">
                    *
                  </Typography>
                </>
              ) : (
                field.label
              )
            }
            value={config[field.key] ?? ''}
            onChange={(e) => setConfigField(field.key, e.target.value)}
            helperText={field.help ?? undefined}
            data-testid={`${testId}-config-${field.key}`}
          />
        ))}

        {/* Secret (required alla creazione) */}
        <TextField
          fullWidth
          size="small"
          type="password"
          required
          label={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {spec?.secret_label ?? 'Segreto'}
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
          helperText={spec?.secret_help ?? undefined}
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
          data-testid={`${testId}-secret`}
        />
        {!spec?.secret_help && (
          <Typography variant="caption" color="text.disabled" sx={{ mt: -1.5 }}>
            Il token verrà cifrato lato server e non sarà mai restituito in chiaro.
          </Typography>
        )}
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
          {actionLabel}
        </Button>
        <Button variant="text" size="small" onClick={onClose} data-testid={`${testId}-btn-cancel`}>
          Annulla
        </Button>
      </Box>
    </Drawer>
  )
}
