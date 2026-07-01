import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { TimesheetEntry } from '@/lib/timesheet/types'
import type { ConnectorResult } from '@/types'

interface ImportResponse {
  results: ConnectorResult[]
}

export function useSubmitImport() {
  return useMutation({
    mutationFn: (entries: TimesheetEntry[]): Promise<ConnectorResult[]> => {
      const body = {
        entries: entries
          .filter((e) => e.connectorAssignments.length > 0)
          .map((e) => ({
            date: e.date ?? '',
            project: e.project ?? '',
            task: e.task ?? '',
            hours: e.hours,
            notes: e.notes,
            connector_assignments: e.connectorAssignments.map((a) => ({
              connector_label: a.connectorLabel,
              remote_project_id: a.remoteProjectId,
              remote_project_name: a.remoteProjectName,
              remote_task_id: a.remoteTaskId,
              remote_task_name: a.remoteTaskName,
            })),
          })),
      }
      return (apiClient.post('/api/me/imports', body) as Promise<ImportResponse>).then(
        (r) => r.results,
      )
    },
  })
}
