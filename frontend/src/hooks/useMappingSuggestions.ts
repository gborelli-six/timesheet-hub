import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'

export interface SuggestedAssignmentResponse {
  connector_label: string
  remote_project_id: string | null
  remote_project_name: string | null
  remote_task_id: string | null
  remote_task_name: string | null
  suggested: boolean
}

interface RowKey {
  excel_project: string
  excel_task: string
}

export interface MappingSuggestionsResponse {
  suggestions: SuggestedAssignmentResponse[][]
}

export function useMappingSuggestions() {
  return useMutation({
    mutationFn: (rows: RowKey[]): Promise<MappingSuggestionsResponse> =>
      apiClient.post('/api/me/mapping-suggestions', {
        rows,
      }) as Promise<MappingSuggestionsResponse>,
  })
}
