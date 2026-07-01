import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'

export interface AdapterProject {
  id: string
  name: string
}

export interface AdapterTask {
  id: string
  name: string
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export function useAdapterProjects(label: string | null, query: string) {
  return useQuery<AdapterProject[]>({
    queryKey: ['adapter-projects', label, query],
    queryFn: () => {
      const params = query ? `?query=${encodeURIComponent(query)}` : ''
      return apiClient.get(
        `/api/adapters/${encodeURIComponent(label!)}/projects${params}`,
      ) as Promise<AdapterProject[]>
    },
    enabled: !!label,
    staleTime: 60_000,
    placeholderData: (prev: AdapterProject[] | undefined) => prev,
  })
}

export function useAdapterTasks(label: string | null, projectId: string | null, query: string) {
  return useQuery<AdapterTask[]>({
    queryKey: ['adapter-tasks', label, projectId, query],
    queryFn: () => {
      const params = query ? `?query=${encodeURIComponent(query)}` : ''
      return apiClient.get(
        `/api/adapters/${encodeURIComponent(label!)}/projects/${encodeURIComponent(projectId!)}/tasks${params}`,
      ) as Promise<AdapterTask[]>
    },
    enabled: !!label && !!projectId,
    staleTime: 60_000,
    placeholderData: (prev: AdapterTask[] | undefined) => prev,
  })
}
