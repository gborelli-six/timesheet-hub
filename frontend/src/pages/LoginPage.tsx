import { Box, Button, Typography } from '@mui/material'

export default function LoginPage() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      gap={3}
    >
      <Typography variant="h4" component="h1">
        Timesheet Hub
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => {
          window.location.href = '/api/auth/login'
        }}
      >
        Accedi con Google
      </Button>
    </Box>
  )
}
