export type ServiceType = 'jira' | 'odoo' | 'linear' | 'asana'

export interface ConnectorOut {
  label: string
  service: ServiceType
  base_url: string | null
  account_identifier: string | null
  db_name?: string | null
  configured: boolean
  needs_reauth: boolean
  updated_at: string
}

export interface ConnectorUpsertRequest {
  service?: ServiceType
  account_identifier?: string | null
  base_url?: string | null
  db_name?: string | null
  secret?: string
}

export interface ConnectorResult {
  connector_label: string
  success_count: number
  error_count: number
  errors: Array<{ row: number; message: string }>
}

// ─── Log importazioni (E9a) ──────────────────────────────────────────────────

export type ImportStatus = 'success' | 'partial' | 'failed'
export type ImportRowStatus = 'success' | 'failed'

export interface ImportRowOut {
  id: string
  row_number: number
  connector_label: string
  service: ServiceType
  excel_project: string
  excel_task: string
  remote_project_id: string | null
  remote_project_name: string | null
  remote_task_id: string | null
  remote_task_name: string | null
  hours: number
  status: ImportRowStatus
  error_message: string | null
}

export interface ImportLogSummary {
  id: string
  period_start: string | null
  period_end: string | null
  status: ImportStatus
  total_rows: number
  success_rows: number
  failed_rows: number
  services: ServiceType[]
  created_at: string
}

export interface ImportLogDetail extends ImportLogSummary {
  rows: ImportRowOut[]
}

export interface ImportFilters {
  period_from?: string
  period_to?: string
  service?: ServiceType | ''
  status?: ImportStatus | ''
}

// Response completa del submit: prima si scartava import_id, ora serve per
// linkare al log appena creato dalla schermata risultato del wizard.
export interface ImportSubmitResponse {
  import_id: string
  results: ConnectorResult[]
}
