import { Box, Typography } from '@mui/material'
import { SERVICE_META } from '@/components/connectors/serviceMeta'
import type { ServiceType } from '@/types'

export interface ServiceTagProps {
  service: ServiceType
  /** Mostra la descrizione del servizio accanto al nome (usata nella lista). */
  showDesc?: boolean
}

// Monogramma colorato + nome del backend, coerente con il design "Log importazioni".
export function ServiceTag({ service, showDesc = false }: ServiceTagProps) {
  const meta = SERVICE_META[service]
  return (
    <Box
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
      title={`${meta.name} · ${meta.desc}`}
    >
      <Box
        sx={{
          width: 22,
          height: 22,
          flex: 'none',
          borderRadius: 1,
          bgcolor: meta.color,
          color: '#fff',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 11,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {meta.letter}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {meta.name}
      </Typography>
      {showDesc && (
        <Typography variant="caption" color="text.secondary">
          {meta.desc}
        </Typography>
      )}
    </Box>
  )
}
