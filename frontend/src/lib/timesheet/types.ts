import type { ServiceType } from '../../types/index'

export enum WarningType {
  MISSING_HOURS = 'MISSING_HOURS',
  MISSING_PROJECT = 'MISSING_PROJECT',
  MISSING_TASK = 'MISSING_TASK',
  INVALID_DATE = 'INVALID_DATE',
  MISSING_PERIOD = 'MISSING_PERIOD',
}

export interface RowWarning {
  rowIndex: number // numero di riga Excel reale (1-based), usato solo nei messaggi mostrati all'utente
  entryIndex: number // indice 0-based nell'array entries; -1 per i warning globali (MISSING_PERIOD)
  type: WarningType
  message: string
}

export interface ConnectorAssignment {
  connectorLabel: string
  service: ServiceType
  remoteProjectId: string
  remoteProjectName: string
  remoteTaskId: string
  remoteTaskName: string
  suggested: boolean
}

export interface TimesheetEntry {
  date?: string
  project: string
  task: string
  hours: number
  notes?: string
  connectorAssignments: ConnectorAssignment[]
}

export type ColumnMapping = {
  date: string
  project: string
  task: string
  hours: string
  notes: string
}

export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  date: 'Data',
  project: 'Progetto',
  task: 'Task',
  hours: 'Ore',
  notes: 'Note',
}

export const WARNING_LABEL: Record<WarningType, string> = {
  [WarningType.MISSING_HOURS]: 'Ore mancanti',
  [WarningType.MISSING_PROJECT]: 'Progetto mancante',
  [WarningType.MISSING_TASK]: 'Task mancante',
  [WarningType.INVALID_DATE]: 'Data non valida',
  [WarningType.MISSING_PERIOD]: 'Periodo non determinato',
}
