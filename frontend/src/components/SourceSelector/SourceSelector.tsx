import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import { SERVICE_META } from '@/components/connectors/serviceMeta'
import type { ConnectorOut, ConnectorTypeOut } from '@/types'

export type SourceSelection =
  | { kind: 'excel' }
  | { kind: 'connector'; label: string; service: ConnectorOut['service']; serviceLabel: string }

interface SourceSelectorProps {
  connectors: ConnectorOut[]
  connectorTypes: ConnectorTypeOut[]
  value: SourceSelection | null
  onSelect: (selection: SourceSelection) => void
}

interface SourceCardProps {
  selected: boolean
  onClick: () => void
  'data-testid': string
  icon: ReactNode
  color: string
  title: string
  subtitle: string
}

function SourceCard({
  selected,
  onClick,
  'data-testid': testId,
  icon,
  color,
  title,
  subtitle,
}: SourceCardProps) {
  return (
    <Box
      component="button"
      onClick={onClick}
      data-testid={testId}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: '16px 18px',
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: selected ? 'primary.50' : 'background.paper',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all 150ms',
        width: '100%',
        '&:hover': { borderColor: 'primary.light' },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          bgcolor: color,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '1rem',
          color: '#fff',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <ArrowForwardIcon
        sx={{ fontSize: 18, color: selected ? 'primary.main' : 'text.disabled', flexShrink: 0 }}
      />
    </Box>
  )
}

// Step 0 del wizard: l'utente sceglie da dove leggere le voci del timesheet.
// L'Excel è sempre disponibile; le sorgenti API sono i connettori dell'utente
// il cui tipo è dichiarato "is_source" nel catalogo (oggi solo Clockify).
export function SourceSelector({
  connectors,
  connectorTypes,
  value,
  onSelect,
}: SourceSelectorProps) {
  const sourceConnectors = connectors.filter(
    (c) => connectorTypes.find((t) => t.service === c.service)?.is_source,
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SourceCard
        selected={value?.kind === 'excel'}
        onClick={() => onSelect({ kind: 'excel' })}
        data-testid="source-option-excel"
        icon={<DescriptionOutlinedIcon />}
        color="#475569"
        title="File Excel"
        subtitle="Carica un .xlsx con le colonne Data, Progetto, Task, Ore, Note."
      />

      {sourceConnectors.map((c) => {
        const meta = SERVICE_META[c.service]
        const serviceLabel = connectorTypes.find((t) => t.service === c.service)?.label ?? meta.name
        return (
          <SourceCard
            key={c.label}
            selected={value?.kind === 'connector' && value.label === c.label}
            onClick={() =>
              onSelect({ kind: 'connector', label: c.label, service: c.service, serviceLabel })
            }
            data-testid={`source-option-${c.label}`}
            icon={meta.letter}
            color={meta.color}
            title={c.label}
            subtitle={`Scarica le voci da ${serviceLabel} per un periodo a scelta.`}
          />
        )
      })}

      {sourceConnectors.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '10px 14px',
            borderRadius: 1.5,
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
            color: 'text.secondary',
          }}
          data-testid="source-no-connectors-hint"
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          <Typography variant="caption">
            Nessuna sorgente API configurata. Aggiungine una dal{' '}
            <Typography
              component="a"
              href="/profile"
              variant="caption"
              sx={{ color: 'primary.main', fontWeight: 700, textUnderlineOffset: 2 }}
            >
              Profilo
            </Typography>{' '}
            per importare direttamente da un servizio esterno.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
