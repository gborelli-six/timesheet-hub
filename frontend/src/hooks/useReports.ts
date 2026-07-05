import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { HoursReport, ReportFilters } from '@/types'

const REPORTS_KEY = 'reports'

// Costruisce la query string omettendo le chiavi vuote/undefined (stesso pattern
// di useImports): non c'è nessun concetto di group_by, l'aggregazione è client-side.
function buildQuery(filters?: ReportFilters): string {
  if (!filters) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.append(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function useHoursReport(filters?: ReportFilters) {
  const query = buildQuery(filters)
  return useQuery<HoursReport>({
    queryKey: [REPORTS_KEY, 'hours', query],
    queryFn: () => apiClient.get(`/api/me/reports/hours${query}`) as Promise<HoursReport>,
  })
}
