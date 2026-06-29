import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  confirmColor?: 'primary' | 'error' | 'warning'
  'data-testid'?: string
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Conferma',
  confirmColor = 'primary',
  'data-testid': testId = 'confirm-dialog',
}: ConfirmDialogProps) {
  return (
    <Dialog data-testid={testId} open={open} maxWidth="sm" fullWidth onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button data-testid={`${testId}-cancel`} onClick={onCancel}>
          Annulla
        </Button>
        <Button
          data-testid={`${testId}-confirm`}
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
