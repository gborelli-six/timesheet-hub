import type { StatusType } from '@/components/ui/StatusBadge'
import type { ImportStatus } from '@/types'

// Mapping stato importazione → props di StatusBadge (riuso del componente ui).
const STATUS_BADGE: Record<ImportStatus, { status: StatusType; label: string }> = {
  success: { status: 'success', label: 'Successo' },
  partial: { status: 'warning', label: 'Parziale' },
  failed: { status: 'error', label: 'Fallito' },
}

export function statusBadge(status: ImportStatus): { status: StatusType; label: string } {
  return STATUS_BADGE[status]
}

// created_at è un istante (timestamp UTC con offset dall'API): lo convertiamo
// nel fuso del browser.
export function formatLogDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatLogDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// period_start/period_end sono date-calendario pure (YYYY-MM-DD), senza fuso:
// le costruiamo come data locale per non farle slittare di un giorno rispetto
// alla mezzanotte UTC nei fusi a ovest.
export function formatCalendarDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPeriodRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  if (start && end && start === end) return formatCalendarDate(start)
  return `${formatCalendarDate(start)} – ${formatCalendarDate(end)}`
}
