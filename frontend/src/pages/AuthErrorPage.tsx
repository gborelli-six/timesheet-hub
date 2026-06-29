import { Box, Card, CardContent, Typography, Button, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function AuthErrorPage() {
  const navigate = useNavigate()
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Card sx={{ minWidth: 360, p: 2 }} data-testid="auth-error-card">
        <CardContent
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
        >
          <Typography variant="h5" component="h1" fontWeight={700}>
            Timesheet Hub
          </Typography>
          <Alert severity="error" sx={{ width: '100%' }} data-testid="auth-error-message">
            Account non autorizzato — usa un account @sixfeetup.it
          </Alert>
          <Button
            variant="outlined"
            fullWidth
            data-testid="auth-error-back-button"
            onClick={() => navigate('/login')}
          >
            Torna al login
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
