import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import type { TimesheetEntry } from '@/lib/timesheet/types'

export interface SourceRowOut {
  date: string
  project: string
  task: string
  hours: number
  notes: string | null
}

interface FetchSourceResponse {
  rows: SourceRowOut[]
}

export interface FetchSourcePeriod {
  start: string
  end: string
}

interface FetchSourceParams {
  label: string
  period: FetchSourcePeriod
}

// Unico punto di conversione riga-sorgente → TimesheetEntry: da qui in poi il
// wizard (preview, suggerimenti, assegnazione) non distingue più Excel da
// sorgente API. Nessun warning: non c'è parsing da validare, solo dati già
// tipizzati restituiti dal backend.
function toEntries(rows: SourceRowOut[]): TimesheetEntry[] {
  return rows.map((row) => ({
    date: row.date,
    project: row.project,
    task: row.task,
    hours: row.hours,
    ...(row.notes ? { notes: row.notes } : {}),
    connectorAssignments: [],
  }))
}

export function useFetchSource() {
  return useMutation({
    mutationFn: ({ label, period }: FetchSourceParams): Promise<TimesheetEntry[]> =>
      apiClient
        .post(`/api/me/sources/${encodeURIComponent(label)}/fetch`, period)
        .then((res) => toEntries((res as FetchSourceResponse).rows)),
  })
}
