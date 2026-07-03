import { Box, Typography } from '@mui/material'
import { SERVICE_META } from '@/components/connectors/serviceMeta'
import type { ServiceType } from '@/types'

interface ConnectorTagProps {
  service: ServiceType
  label: string
}

export function ConnectorTag({ service, label }: ConnectorTagProps) {
  const meta = SERVICE_META[service]
  return (
    <Box
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
      title={`${meta.name} · ${label}`}
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
        {label}
      </Typography>
    </Box>
  )
}
