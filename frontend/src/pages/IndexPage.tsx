import { Box, Typography, Container } from '@mui/material'

export default function IndexPage() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h3" component="h1">
          Timesheet Hub
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Frontend scaffold — E1 in progress
        </Typography>
      </Box>
    </Container>
  )
}
