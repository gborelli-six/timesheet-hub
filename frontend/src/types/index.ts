export type ServiceType = 'jira' | 'odoo' | 'clockify' | 'linear' | 'asana'

export interface ConnectorOut {
  label: string
  service: ServiceType
  base_url: string | null
  account_identifier: string | null
  config: Record<string, string>
  configured: boolean
  needs_reauth: boolean
  updated_at: string
}

export interface ConnectorUpsertRequest {
  service?: ServiceType
  account_identifier?: string | null
  base_url?: string | null
  config?: Record<string, string>
  secret?: string
}

// ─── Catalogo dei tipi di connettore (E13) ───────────────────────────────────
// Rispecchia GET /api/connector-types: il frontend genera il form di
// configurazione a partire da questo schema invece di duplicarne i campi.

export interface ConfigFieldOut {
  key: string
  label: string
  type: 'string' | 'url'
  required: boolean
  help: string | null
}

export interface ConnectorTypeOut {
  service: ServiceType
  label: string
  is_source: boolean
  is_destination: boolean
  available: boolean
  secret_label: string
  secret_help: string | null
  requires_base_url: boolean
  requires_account_identifier: boolean
  account_identifier_label: string
  config_fields: ConfigFieldOut[]
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
