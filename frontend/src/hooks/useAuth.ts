import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'

export interface MeResponse {
  email: string
  role: 'employee' | 'hr' | 'admin'
}

export function useAuth() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/api/me') as Promise<MeResponse>,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
