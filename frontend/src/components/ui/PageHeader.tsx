import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

export interface PageHeaderProps {
  title: string
  actions?: ReactNode
  'data-testid'?: string
}

export function PageHeader({
  title,
  actions,
  'data-testid': testId = 'page-header',
}: PageHeaderProps) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Typography variant="h4">{title}</Typography>
      {actions && <Box>{actions}</Box>}
    </Box>
  )
}
