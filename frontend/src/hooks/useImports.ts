import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { ImportFilters, ImportLogDetail, ImportLogSummary } from '@/types'

const IMPORTS_KEY = 'imports'

// Costruisce la query string omettendo le chiavi vuote/undefined, così da non
// inviare `?service=` o `?service=undefined`.
function buildQuery(filters?: ImportFilters): string {
  if (!filters) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.append(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function useImports(filters?: ImportFilters) {
  const query = buildQuery(filters)
  return useQuery<ImportLogSummary[]>({
    queryKey: [IMPORTS_KEY, 'list', query],
    queryFn: () => apiClient.get(`/api/me/imports${query}`) as Promise<ImportLogSummary[]>,
  })
}

export function useImportDetail(id: string | null) {
  return useQuery<ImportLogDetail>({
    queryKey: [IMPORTS_KEY, 'detail', id],
    queryFn: () => apiClient.get(`/api/me/imports/${id}`) as Promise<ImportLogDetail>,
    enabled: !!id,
  })
}
