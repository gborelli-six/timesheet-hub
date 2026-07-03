import { useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

import AddIcon from '@mui/icons-material/Add'
import PlugConnectedIcon from '@mui/icons-material/PowerOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import { LoadingOverlay } from '@/components/ui'
import { AddConnectorDrawer } from '@/components/connectors/AddConnectorDrawer'
import { ConnectorRow } from '@/components/connectors/ConnectorRow'
import { useAuth } from '@/hooks/useAuth'
import { useConnectors } from '@/hooks/useConnectors'

export default function ProfilePage() {
  const { data: me } = useAuth()
  const { data: connectors = [], isLoading, isError } = useConnectors()

  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const handleToggle = (label: string) => {
    setExpandedLabel((prev) => (prev === label ? null : label))
  }

  const expiredCount = connectors.filter((c) => c.needs_reauth).length

  const roleLabel =
    me?.role === 'admin' ? 'Amministratore' : me?.role === 'hr' ? 'HR' : 'Dipendente'

  const initials = me?.email
    ? me.email
        .split('@')[0]
        .split('.')
        .map((s: string) => s[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2)
    : '??'

  return (
    <Box data-testid="profile-page">
      {/* Page hero */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
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
          Account
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Profilo
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', maxWidth: '56ch' }}>
          Gestisci i tuoi dati e i token API per i servizi connessi.
        </Typography>
      </Box>

      {/* Global expired banner (E5-5) */}
      {expiredCount > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3.5, borderRadius: 2 }}>
          <Typography fontWeight={600} fontSize="0.875rem">
            {expiredCount === 1 ? '1 token da aggiornare' : `${expiredCount} token da aggiornare`}
          </Typography>
          <Typography fontSize="0.8125rem">
            Uno o più token API non sono più validi. Aprili dalla lista e sostituisci il token.
          </Typography>
        </Alert>
      )}

      {/* User info card */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: 3,
          mb: 5,
          overflow: 'hidden',
        }}
        data-testid="profile-user-card"
      >
        {/* Identity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2.5, flex: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4068c8, #33509f)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {initials}
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize="0.9375rem">
              {me?.email
                ?.split('@')[0]
                .replace('.', ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()) ?? '—'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mt: 0.25 }}
            >
              {me?.email ?? '—'}
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: me?.role === 'admin' ? 'primary.50' : 'grey.100',
                border: '1px solid',
                borderColor: me?.role === 'admin' ? 'primary.200' : 'grey.300',
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                color={me?.role === 'admin' ? 'primary.main' : 'text.secondary'}
              >
                {roleLabel}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Stat: connettori configurati */}
        <Box sx={{ px: 2.5, py: 2.5, minWidth: 120 }}>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.disabled',
              display: 'block',
            }}
          >
            Connettori
          </Typography>
          <Typography
            fontWeight={600}
            fontSize="1.125rem"
            sx={{ fontFamily: 'monospace', mt: 0.25 }}
          >
            {connectors.length}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Stat: sessione */}
        <Box sx={{ px: 2.5, py: 2.5, minWidth: 120 }}>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.disabled',
              display: 'block',
            }}
          >
            Sessione
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: 'success.main',
                flexShrink: 0,
              }}
            />
            <Typography fontWeight={600} fontSize="0.9375rem">
              Attiva
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Section header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}
          >
            <Box
              sx={{
                width: 4,
                height: 18,
                bgcolor: 'primary.main',
                borderRadius: 0.5,
                flexShrink: 0,
              }}
              aria-hidden
            />
            Connettori e token API
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ pl: 1.75, display: 'block', mt: 0.5 }}
          >
            Ogni connettore può avere parametri specifici per il servizio. I token sono cifrati lato
            server.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            setAddOpen(true)
            setExpandedLabel(null)
          }}
          sx={{ flexShrink: 0, mt: 0.5 }}
          data-testid="btn-add-connector"
        >
          Aggiungi connettore
        </Button>
      </Box>

      {/* Connector list */}
      {isLoading ? (
        <LoadingOverlay open />
      ) : isError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Impossibile caricare i connettori. Riprova più tardi.
        </Alert>
      ) : (
        <Paper
          variant="outlined"
          sx={{ borderRadius: 3, overflow: 'hidden' }}
          data-testid="connector-list"
        >
          {connectors.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                py: 8,
                px: 4,
                textAlign: 'center',
                color: 'text.disabled',
              }}
            >
              <PlugConnectedIcon sx={{ fontSize: 36, opacity: 0.3 }} />
              <Typography fontWeight={600} color="text.secondary">
                Nessun connettore configurato
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ maxWidth: '40ch' }}>
                Aggiungi il primo connettore per poter avviare le importazioni su un servizio
                esterno.
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ mt: 1 }}
                data-testid="btn-add-connector-empty"
              >
                Aggiungi connettore
              </Button>
            </Box>
          ) : (
            connectors.map((conn, idx) => (
              <Box key={conn.label}>
                {idx > 0 && <Divider />}
                <ConnectorRow
                  conn={conn}
                  isExpanded={expandedLabel === conn.label}
                  onToggle={() => handleToggle(conn.label)}
                  data-testid={`connector-row-${conn.label}`}
                />
              </Box>
            ))
          )}
        </Paper>
      )}

      <AddConnectorDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingLabels={connectors.map((c) => c.label)}
        data-testid="add-connector-drawer"
      />
    </Box>
  )
}
