import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingOverlay } from '@/components/ui'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isError } = useAuth()

  if (isLoading) {
    return <LoadingOverlay open data-testid="auth-loading" />
  }

  if (isError) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
