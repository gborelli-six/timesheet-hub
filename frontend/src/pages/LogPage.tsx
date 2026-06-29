import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function LogPage() {
  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.6875rem',
            color: '#4068c8',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Storico
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}
        >
          Log importazioni
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '56ch' }}>
          Visualizza lo storico delle importazioni effettuate e i relativi dettagli.
        </Typography>
      </Box>
    </Box>
  )
}
