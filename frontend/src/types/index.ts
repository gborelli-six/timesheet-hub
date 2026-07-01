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
