import { Chip } from '@mui/material'

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default'

export interface StatusBadgeProps {
  status: StatusType
  label: string
  'data-testid'?: string
}

export function StatusBadge({
  status,
  label,
  'data-testid': testId = 'status-badge',
}: StatusBadgeProps) {
  return <Chip data-testid={testId} label={label} color={status} size="small" />
}
