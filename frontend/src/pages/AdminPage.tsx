import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function AdminPage() {
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
          Amministrazione
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}
        >
          Pannello Admin
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '56ch' }}>
          Gestisci utenti, ruoli, configurazioni backend e mapping Excel.
        </Typography>
      </Box>
    </Box>
  )
}
