import { Backdrop, CircularProgress } from '@mui/material'

export interface LoadingOverlayProps {
  open: boolean
  'data-testid'?: string
}

export function LoadingOverlay({
  open,
  'data-testid': testId = 'loading-overlay',
}: LoadingOverlayProps) {
  return (
    <Backdrop
      data-testid={testId}
      open={open}
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }}
    >
      <CircularProgress color="inherit" />
    </Backdrop>
  )
}
