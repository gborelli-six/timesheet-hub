import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, CircularProgress } from '@mui/material'
import { apiClient } from '@/lib/apiClient'

export default function CallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      setError('Parametro code mancante nella risposta OAuth.')
      return
    }

    apiClient
      .post('/api/auth/callback', { code, state })
      .then(() => navigate('/'))
      .catch(() => setError('Dominio non autorizzato o errore di accesso.'))
  }, [navigate, searchParams])

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" p={3}>
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      </Box>
    )
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
    </Box>
  )
}
