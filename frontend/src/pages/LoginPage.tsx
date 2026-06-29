import { Box, Typography, Button } from '@mui/material'

const MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace'

const Logo = () => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    style={{ width: '100%', height: '100%' }}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M39.07 14.65 L41.82 3.72 L58.18 3.72 L60.93 14.65 L67.26 17.27 L76.94 11.49 L88.51 23.06 L82.73 32.74 L85.35 39.07 L96.28 41.82 L96.28 58.18 L85.35 60.93 L82.73 67.26 L88.51 76.94 L76.94 88.51 L67.26 82.73 L60.93 85.35 L58.18 96.28 L41.82 96.28 L39.07 85.35 L32.74 82.73 L23.06 88.51 L11.49 76.94 L17.27 67.26 L14.65 60.93 L3.72 58.18 L3.72 41.82 L14.65 39.07 L17.27 32.74 L11.49 23.06 L23.06 11.49 L32.74 17.27 Z M50 24 a26 26 0 1 0 0.01 0 Z"
    />
    <path stroke="currentColor" strokeWidth="5.6" strokeLinecap="round" d="M50 50 V31" />
    <path stroke="currentColor" strokeWidth="5.6" strokeLinecap="round" d="M50 50 L64.5 59" />
  </svg>
)

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
)

const ShieldSvg = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

export default function LoginPage() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', minHeight: '100vh' }}>
      {/* Pannello sinistro — brand */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: 6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(155deg, #233247 0%, #1e2a3a 55%, #16202e 100%)',
          color: '#fff',
        }}
      >
        {/* Watermark gear/clock */}
        <Box
          sx={{
            position: 'absolute',
            right: '-90px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '420px',
            height: '420px',
            color: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }}
        >
          <Logo />
        </Box>

        {/* Logo + wordmark */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ width: 38, height: 38, flexShrink: 0, color: '#fff' }}>
            <Logo />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.04 }}>
            <Typography
              component="span"
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: '#fff',
                lineHeight: 1.04,
              }}
            >
              Timesheet
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'secondary.light',
                lineHeight: 1.04,
              }}
            >
              Hub
            </Typography>
          </Box>
        </Box>

        {/* Pitch */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontSize: '1.875rem',
              letterSpacing: '-0.025em',
              mb: 1.75,
              maxWidth: '13ch',
              color: '#fff',
            }}
          >
            Un solo strumento per tutti i tuoi timesheet
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.62)',
              maxWidth: '34ch',
              lineHeight: 1.4,
            }}
          >
            Carica l'Excel una volta e distribuisci i timesheet su Jira, Odoo, Linear e Asana —
            senza reinserire nulla.
          </Typography>
        </Box>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: MONO,
            color: 'rgba(255,255,255,0.45)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          sixfeetup · strumento interno
        </Typography>
      </Box>

      {/* Pannello destro — form */}
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.paper',
          p: 5,
        }}
      >
        <Box sx={{ width: 320 }} data-testid="login-card">
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 0.75 }}
          >
            Benvenuto
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, lineHeight: 1.4 }}>
            Lo strumento è interno. L'accesso avviene con il tuo account Google aziendale.
          </Typography>

          {/* Bottone Google — bianco con G colorata */}
          <Button
            fullWidth
            data-testid="login-google-button"
            onClick={() => {
              window.location.href = '/api/auth/login'
            }}
            sx={{
              height: 46,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              boxShadow: 1,
              justifyContent: 'center',
              '&:hover': { bgcolor: 'background.default', borderColor: 'divider' },
            }}
            startIcon={<GoogleG />}
          >
            Accedi con Google
          </Button>

          {/* Divider con linee + "solo @sixfeetup.it" */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 3 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            <Typography
              variant="caption"
              sx={{ fontFamily: MONO, color: 'text.disabled', whiteSpace: 'nowrap' }}
            >
              solo @sixfeetup.it
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
          </Box>

          {/* Security footer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.875,
              color: 'text.disabled',
            }}
          >
            <ShieldSvg />
            <Typography variant="caption" color="text.secondary">
              Accesso riservato
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
