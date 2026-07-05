import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

import { SERVICE_META } from '@/components/connectors/serviceMeta'
import { useHoursReport } from '@/hooks/useReports'
import { formatCalendarDate } from '@/lib/importLog'
import type { HoursDetailRow, ServiceType } from '@/types'
import './ReportPage.css'

/* ── Inline SVG icon helper ─────────────────────────────── */
const ICONS = {
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  caret: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  chart:
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
} as const

function Ico({
  p,
  size = 16,
  cls,
  strokeW = 2,
}: {
  p: string
  size?: number
  cls?: string
  strokeW?: number
}) {
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeW}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: p }}
    />
  )
}

/* ── Date helpers (local-noon to dodge TZ drift) ────────── */
const DP_MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]
const DP_DOW = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

function dpParse(iso: string): Date | null {
  return iso ? new Date(iso + 'T12:00:00') : null
}
function dpISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dpFmtIT(iso: string): string {
  if (!iso) return ''
  const d = dpParse(iso)!
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
function dpFirstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12)
}
function dpDowMon(d: Date): number {
  return (d.getDay() + 6) % 7
}
function dpMatrix(view: Date): Date[] {
  const first = dpFirstOfMonth(view)
  const start = new Date(first)
  start.setDate(first.getDate() - dpDowMon(first))
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

/* ── DateField — calendar picker (stand-in for MUI X DatePicker) ─ */
function DateField({
  value = '',
  onChange,
  minDate = '',
  maxDate = '',
  placeholder = 'gg/mm/aaaa',
  align = 'left',
  initialMonth = '',
  testid,
}: {
  value?: string
  onChange: (iso: string) => void
  minDate?: string
  maxDate?: string
  placeholder?: string
  align?: 'left' | 'right'
  initialMonth?: string
  testid?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() =>
    dpFirstOfMonth(dpParse(value) || dpParse(initialMonth) || new Date()),
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) setView(dpFirstOfMonth(dpParse(value)!))
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const todayISO = dpISO(new Date())
  const selISO = value || ''
  const outOfRange = (iso: string) => (!!minDate && iso < minDate) || (!!maxDate && iso > maxDate)
  const days = dpMatrix(view)

  const pick = (d: Date) => {
    const iso = dpISO(d)
    if (outOfRange(iso)) return
    onChange(iso)
    setOpen(false)
  }
  const clear = (e: ReactMouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const prevMonth = () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1, 12))
  const nextMonth = () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1, 12))
  const prevDisabled =
    !!minDate && dpISO(new Date(view.getFullYear(), view.getMonth(), 0, 12)) < minDate
  const nextDisabled =
    !!maxDate && dpISO(new Date(view.getFullYear(), view.getMonth() + 1, 1, 12)) > maxDate

  return (
    <div className={`datefield${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="df-trigger"
        data-testid={testid}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Ico p={ICONS.cal} size={16} cls="df-cal" />
        <span className={`df-val${value ? '' : ' is-empty'}`}>
          {value ? dpFmtIT(value) : placeholder}
        </span>
        {value && (
          <svg
            className="df-clear"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            role="button"
            aria-label="Cancella data"
            onClick={clear}
            dangerouslySetInnerHTML={{ __html: ICONS.x }}
          />
        )}
      </button>

      {open && (
        <div
          className={`datepop align-${align}`}
          role="dialog"
          data-testid={testid ? testid + '-pop' : undefined}
        >
          <div className="datepop-head">
            <button
              type="button"
              className="dp-nav"
              onClick={prevMonth}
              disabled={prevDisabled}
              aria-label="Mese precedente"
            >
              <Ico p={ICONS.chevL} size={16} />
            </button>
            <span className="dp-month">
              {DP_MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <button
              type="button"
              className="dp-nav"
              onClick={nextMonth}
              disabled={nextDisabled}
              aria-label="Mese successivo"
            >
              <Ico p={ICONS.chevR} size={16} />
            </button>
          </div>
          <div className="dp-grid">
            {DP_DOW.map((d) => (
              <span key={d} className="dp-dow">
                {d}
              </span>
            ))}
            {days.map((d, i) => {
              const iso = dpISO(d)
              const outside = d.getMonth() !== view.getMonth()
              const cls = [
                'dp-day',
                outside ? 'is-outside' : '',
                iso === selISO ? 'is-selected' : '',
                iso === todayISO && iso !== selISO ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  type="button"
                  key={i}
                  className={cls}
                  disabled={outOfRange(iso)}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="datepop-foot">
            <button type="button" className="dp-link muted" onClick={() => onChange('')}>
              Cancella
            </button>
            <button
              type="button"
              className="dp-link"
              disabled={outOfRange(todayISO)}
              onClick={() => {
                if (!outOfRange(todayISO)) {
                  onChange(todayISO)
                  setOpen(false)
                }
              }}
            >
              Oggi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Client-side aggregation (pivot) ────────────────────── */
type Dim = 'date' | 'task'

interface Item {
  date: string | null
  task: string
  connector: string
  hours: number
}
interface Group {
  key: string | null
  byConnector: Record<string, number>
  total: number
  items: Item[]
}
interface ProjectNode {
  project: string
  byConnector: Record<string, number>
  total: number
  items: Item[]
}
interface Pivot {
  rows: ProjectNode[]
  connectors: string[]
  connectorService: Record<string, ServiceType>
  svcTotal: Record<string, number>
  grand: number
  projectCount: number
}

interface Filters {
  from: string
  to: string
  connector: string
  project: string
  task: string
}
const EMPTY_FILTERS: Filters = { from: '', to: '', connector: '', project: '', task: '' }

// Test range inclusivo su entry_date: le righe senza data (null) restano dentro
// solo quando NON è attivo alcun filtro periodo (coerente col backend E9d-1).
function inDateRange(date: string | null, from: string, to: string): boolean {
  if (!from && !to) return true
  if (date === null) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

// Ordinamento chiavi con null in fondo (giorni senza data).
function cmpKey(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

function buildPivot(allRows: HoursDetailRow[], f: Filters): Pivot {
  const connectorService: Record<string, ServiceType> = {}
  for (const r of allRows) connectorService[r.connector_label] = r.service

  const cell: Record<string, Record<string, number>> = {}
  const projTotal: Record<string, number> = {}
  const svcTotal: Record<string, number> = {}
  const items: Record<string, Item[]> = {}
  const connectorsSeen = new Set<string>()
  let grand = 0

  for (const r of allRows) {
    if (!inDateRange(r.entry_date, f.from, f.to)) continue
    if (f.connector && r.connector_label !== f.connector) continue
    if (f.project && r.excel_project !== f.project) continue
    if (f.task && r.excel_task !== f.task) continue

    const p = r.excel_project
    const c = r.connector_label
    const h = r.total_hours
    cell[p] = cell[p] || {}
    cell[p][c] = (cell[p][c] || 0) + h
    projTotal[p] = (projTotal[p] || 0) + h
    svcTotal[c] = (svcTotal[c] || 0) + h
    connectorsSeen.add(c)
    ;(items[p] = items[p] || []).push({
      date: r.entry_date,
      task: r.excel_task,
      connector: c,
      hours: h,
    })
    grand += h
  }

  const connectors = [...connectorsSeen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const rows: ProjectNode[] = Object.keys(cell)
    .map((p) => ({ project: p, byConnector: cell[p], total: projTotal[p], items: items[p] }))
    .sort((a, b) => (a.project < b.project ? -1 : a.project > b.project ? 1 : 0))

  return { rows, connectors, connectorService, svcTotal, grand, projectCount: rows.length }
}

// Raggruppa gli item di un progetto per giorno o task, sommando per connettore.
function groupItems(list: Item[], key: Dim): Group[] {
  const map = new Map<string | null, Group>()
  for (const it of list) {
    const k = key === 'date' ? it.date : it.task
    let g = map.get(k)
    if (!g) {
      g = { key: k, byConnector: {}, total: 0, items: [] }
      map.set(k, g)
    }
    g.byConnector[it.connector] = (g.byConnector[it.connector] || 0) + it.hours
    g.total += it.hours
    g.items.push(it)
  }
  const arr = [...map.values()]
  if (key === 'date') arr.sort((a, b) => cmpKey(a.key, b.key))
  else arr.sort((a, b) => cmpKey(a.key, b.key))
  return arr
}

const fmtHrs = (h: number | undefined): string | null =>
  h == null || h === 0 ? null : h.toFixed(1)
const dayLbl = (iso: string | null): string => (iso ? formatCalendarDate(iso) : '—')

/* ── Per-connector hour cells + total (shared across levels) ─ */
function SvcCells({
  byConnector,
  total,
  connectors,
}: {
  byConnector: Record<string, number>
  total: number
  connectors: string[]
}) {
  return (
    <>
      {connectors.map((c) => {
        const v = fmtHrs(byConnector[c])
        return (
          <td key={c} className="conn-col num">
            {v ? <span className="cell-hrs">{v}</span> : <span className="cell-zero">—</span>}
          </td>
        )
      })}
      <td className="conn-col num total-col">{total.toFixed(1)}</td>
    </>
  )
}

/* ── Connector column header (monogram + name) ──────────── */
function ConnTh({ label, service }: { label: string; service: ServiceType }) {
  const meta = SERVICE_META[service]
  return (
    <span className="conn-th" title={`${label} · ${meta.name}`}>
      <span className="svc-dot" style={{ background: meta.color }}>
        {meta.letter}
      </span>
      <span className="cth-name">{label}</span>
    </span>
  )
}

/* ── Period presets (relative to today) ─────────────────── */
function monthRange(d: Date): { from: string; to: string } {
  const y = d.getFullYear()
  const m = d.getMonth()
  return { from: dpISO(new Date(y, m, 1, 12)), to: dpISO(new Date(y, m + 1, 0, 12)) }
}
function quarterRange(d: Date): { from: string; to: string } {
  const q = Math.floor(d.getMonth() / 3)
  const y = d.getFullYear()
  return { from: dpISO(new Date(y, q * 3, 1, 12)), to: dpISO(new Date(y, q * 3 + 3, 0, 12)) }
}
const PERIOD_PRESETS: {
  id: string
  label: string
  range: (t: Date) => { from: string; to: string }
}[] = [
  { id: 'thisMonth', label: 'Mese corrente', range: (t) => monthRange(t) },
  {
    id: 'lastMonth',
    label: 'Mese precedente',
    range: (t) => monthRange(new Date(t.getFullYear(), t.getMonth() - 1, 1, 12)),
  },
  { id: 'quarter', label: 'Trimestre corrente', range: (t) => quarterRange(t) },
  {
    id: 'year',
    label: 'Anno corrente',
    range: (t) => ({
      from: dpISO(new Date(t.getFullYear(), 0, 1, 12)),
      to: dpISO(new Date(t.getFullYear(), 11, 31, 12)),
    }),
  },
]
function activePreset(from: string, to: string) {
  const t = new Date()
  return PERIOD_PRESETS.find((p) => {
    const r = p.range(t)
    return r.from === from && r.to === to
  })
}

interface OptionEntry {
  value: string
  label: string
  sub?: string
  dot?: { color: string; letter: string }
}

/* ── One pill + its popover ─────────────────────────────── */
function FilterPill({
  id,
  label,
  value,
  active,
  openId,
  setOpenId,
  width,
  children,
}: {
  id: string
  label: string
  value: string
  active: boolean
  openId: string | null
  setOpenId: (v: string | null) => void
  width?: number
  children: ReactNode
}) {
  const open = openId === id
  return (
    <div className="fpill-wrap">
      <button
        type="button"
        className={`pop-btn${active ? ' active' : ''}${open ? ' is-open' : ''}`}
        data-testid={`filter-${id}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : id)}
      >
        <span className="pk">{label}</span>
        <span className="pv">{value}</span>
        <Ico p={ICONS.caret} size={15} cls="pcaret" />
      </button>
      {open && (
        <div
          className="fpop"
          style={width ? { width } : undefined}
          role="dialog"
          data-testid={`filter-${id}-pop`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Generic single-select option list ──────────────────── */
function OptionList({
  options,
  value,
  onPick,
  allLabel = 'Tutti',
}: {
  options: OptionEntry[]
  value: string
  onPick: (v: string) => void
  allLabel?: string
}) {
  return (
    <div className="fopt-list">
      <button type="button" className={`fopt${!value ? ' on' : ''}`} onClick={() => onPick('')}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`fopt${value === o.value ? ' on' : ''}`}
          onClick={() => onPick(o.value)}
        >
          {o.dot && (
            <span className="svc-dot" style={{ background: o.dot.color }}>
              {o.dot.letter}
            </span>
          )}
          <span className="fopt-lbl">{o.label}</span>
          {o.sub && <span className="fopt-sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

/* ── Filter toolbar (period row + popover pills) ────────── */
function FilterToolbar({
  f,
  setF,
  reset,
  hasFilter,
  summary,
  connectorOptions,
  projectOptions,
  taskOptions,
  dateMin,
  dateMax,
}: {
  f: Filters
  setF: (patch: Partial<Filters>) => void
  reset: () => void
  hasFilter: boolean
  summary: ReactNode
  connectorOptions: OptionEntry[]
  projectOptions: OptionEntry[]
  taskOptions: OptionEntry[]
  dateMin: string
  dateMax: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [custom, setCustom] = useState<boolean>(
    () => !!(f.from || f.to) && !activePreset(f.from, f.to),
  )
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openId) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openId])

  const curPreset = activePreset(f.from, f.to)
  const applyPreset = (p: (typeof PERIOD_PRESETS)[number]) => {
    const r = p.range(new Date())
    setF({ from: r.from, to: r.to })
    setCustom(false)
    setOpenId(null)
  }

  const connLabel =
    f.connector && connectorOptions.find((o) => o.value === f.connector)
      ? connectorOptions.find((o) => o.value === f.connector)!.label
      : 'Tutti'

  return (
    <div className="filter-stack" data-testid="report-filters" ref={barRef}>
      {/* Periodo — preset espliciti su riga dedicata */}
      <div className="period-row">
        <span className="pr-label">Periodo</span>
        <div className="preset-seg" role="group" aria-label="Intervallo periodo">
          {PERIOD_PRESETS.map((p) => {
            const on = !!curPreset && curPreset.id === p.id && !custom
            return (
              <button
                type="button"
                key={p.id}
                className={on ? 'on' : ''}
                data-testid={`period-${p.id}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            )
          })}
          <button
            type="button"
            className={custom ? 'on' : ''}
            data-testid="period-custom"
            onClick={() => setCustom(true)}
          >
            Personalizzato
          </button>
        </div>
        {custom && (
          <div className="pr-dates">
            <span className="cr-lbl">Da</span>
            <DateField
              testid="filter-from-date"
              value={f.from}
              onChange={(v) => setF({ from: v })}
              placeholder="gg/mm/aaaa"
              minDate={dateMin}
              maxDate={f.to || dateMax}
              initialMonth={dateMin}
              align="left"
            />
            <span className="cr-sep">→</span>
            <DateField
              testid="filter-to-date"
              value={f.to}
              onChange={(v) => setF({ to: v })}
              placeholder="gg/mm/aaaa"
              minDate={f.from || dateMin}
              maxDate={dateMax}
              initialMonth={f.from || dateMax}
              align="right"
            />
          </div>
        )}
      </div>

      {/* Connettore / Progetto / Task — pill con popover */}
      <div className="pop-bar">
        <FilterPill
          id="connector"
          label="Connettore"
          value={connLabel}
          active={!!f.connector}
          openId={openId}
          setOpenId={setOpenId}
          width={272}
        >
          <div className="fpop-lbl">Connettore</div>
          <OptionList
            options={connectorOptions}
            value={f.connector}
            onPick={(v) => {
              setF({ connector: v })
              setOpenId(null)
            }}
          />
        </FilterPill>

        <FilterPill
          id="project"
          label="Progetto"
          value={f.project || 'Tutti'}
          active={!!f.project}
          openId={openId}
          setOpenId={setOpenId}
          width={240}
        >
          <div className="fpop-lbl">Progetto</div>
          <OptionList
            options={projectOptions}
            value={f.project}
            onPick={(v) => {
              setF({ project: v })
              setOpenId(null)
            }}
          />
        </FilterPill>

        <FilterPill
          id="task"
          label="Task"
          value={f.task || 'Tutti'}
          active={!!f.task}
          openId={openId}
          setOpenId={setOpenId}
          width={240}
        >
          <div className="fpop-lbl">Task</div>
          <OptionList
            options={taskOptions}
            value={f.task}
            onPick={(v) => {
              setF({ task: v })
              setOpenId(null)
            }}
          />
        </FilterPill>

        <span className="pop-spacer" />
        {hasFilter && (
          <button
            type="button"
            className="pop-reset"
            data-testid="report-filters-reset"
            onClick={reset}
          >
            <Ico p={ICONS.x} size={13} strokeW={2.2} />
            Azzera
          </button>
        )}
        <span className="pop-count">{summary}</span>
      </div>
    </div>
  )
}

/* ── Loading skeleton ───────────────────────────────────── */
function ReportSkeleton() {
  const widths = ['70%', '58%', '80%', '64%', '74%']
  return (
    <div data-testid="report-loading">
      <div className="table-wrap">
        <table className="table pivot">
          <thead>
            <tr>
              <th>Progetto</th>
              <th className="conn-col">Connettore</th>
              <th className="conn-col">Connettore</th>
              <th className="conn-col total-col">Totale</th>
            </tr>
          </thead>
          <tbody>
            {widths.map((w, i) => (
              <tr key={i}>
                <td>
                  <span className="skeleton skel-cell" style={{ width: w }} />
                </td>
                <td className="conn-col">
                  <span
                    className="skeleton skel-cell"
                    style={{ width: '46px', marginLeft: 'auto' }}
                  />
                </td>
                <td className="conn-col">
                  <span
                    className="skeleton skel-cell"
                    style={{ width: '46px', marginLeft: 'auto' }}
                  />
                </td>
                <td className="conn-col total-col">
                  <span
                    className="skeleton skel-cell"
                    style={{ width: '46px', marginLeft: 'auto' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Report page (E9d) ──────────────────────────────────── */
export default function ReportPage() {
  const { data, isLoading, isError, refetch } = useHoursReport()
  const allRows = useMemo(() => data?.rows ?? [], [data])

  const [f, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const setF = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const hasFilter = !!(f.from || f.to || f.connector || f.project || f.task)
  const reset = () => setFilters(EMPTY_FILTERS)

  // Universi di filtro derivati dal dataset completo (stabili al variare dei filtri).
  const connectorOptions = useMemo<OptionEntry[]>(() => {
    const svc: Record<string, ServiceType> = {}
    for (const r of allRows) svc[r.connector_label] = r.service
    return Object.keys(svc)
      .sort((a, b) => (a < b ? -1 : 1))
      .map((label) => {
        const meta = SERVICE_META[svc[label]]
        return {
          value: label,
          label,
          sub: meta.name,
          dot: { color: meta.color, letter: meta.letter },
        }
      })
  }, [allRows])
  const projectOptions = useMemo<OptionEntry[]>(
    () =>
      [...new Set(allRows.map((r) => r.excel_project))]
        .sort((a, b) => (a < b ? -1 : 1))
        .map((p) => ({ value: p, label: p })),
    [allRows],
  )
  const taskOptions = useMemo<OptionEntry[]>(
    () =>
      [...new Set(allRows.map((r) => r.excel_task))]
        .sort((a, b) => (a < b ? -1 : 1))
        .map((t) => ({ value: t, label: t })),
    [allRows],
  )
  const { dateMin, dateMax } = useMemo(() => {
    const dates = allRows
      .map((r) => r.entry_date)
      .filter((d): d is string => !!d)
      .sort()
    return { dateMin: dates[0] || '', dateMax: dates[dates.length - 1] || '' }
  }, [allRows])

  const pivot = useMemo(() => buildPivot(allRows, f), [allRows, f])

  // Stato espansione drill-down (popover chooser per-riga).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [groupDim, setGroupDim] = useState<Record<string, Dim>>({})
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const [dimPop, setDimPop] = useState<string | null>(null)

  // Reset dell'espansione al cambio filtri.
  useEffect(() => {
    setExpanded(new Set())
    setGroupDim({})
    setOpenGroups(new Set())
    setDimPop(null)
  }, [f])

  const toggleDimPop = (p: string) => setDimPop((prev) => (prev === p ? null : p))
  const chooseDim = (p: string, dim: Dim) => {
    setGroupDim((prev) => ({ ...prev, [p]: dim }))
    setExpanded((prev) => new Set(prev).add(p))
    setOpenGroups((prev) => new Set([...prev].filter((k) => !k.startsWith(p + '|'))))
    setDimPop(null)
  }
  const collapseProject = (p: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.delete(p)
      return n
    })
    setDimPop(null)
  }
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  // Chiusura del chooser su click esterno / Esc.
  useEffect(() => {
    if (!dimPop) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element
      if (!t.closest('.dim-pop') && !t.closest('.rpt-proj-trigger')) setDimPop(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDimPop(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [dimPop])

  const { connectors } = pivot

  return (
    <div className="report-page">
      <div className="report-wrap">
        <div className="page-hero">
          <div className="page-eyebrow">Analisi</div>
          <h1 className="page-title">Report importazioni</h1>
          <p className="page-sub">
            Ore effettivamente registrate per progetto, aggregate per connettore nel periodo
            selezionato. Ogni cella somma le righe importate con esito positivo; il Log resta il
            dettaglio transazionale riga per riga.
          </p>
        </div>

        <FilterToolbar
          f={f}
          setF={setF}
          reset={reset}
          hasFilter={hasFilter}
          summary={
            <>
              <b>{pivot.projectCount}</b> progett{pivot.projectCount === 1 ? 'o' : 'i'} ·{' '}
              <b>{pivot.grand.toFixed(1)}</b> h
            </>
          }
          connectorOptions={connectorOptions}
          projectOptions={projectOptions}
          taskOptions={taskOptions}
          dateMin={dateMin}
          dateMax={dateMax}
        />

        {isError ? (
          <div className="state-panel" data-testid="report-error">
            <div className="state-ico error">
              <Ico p={ICONS.warning} size={26} />
            </div>
            <p className="state-title">Impossibile calcolare il report</p>
            <p className="state-sub">
              Si è verificato un errore nell'aggregazione delle importazioni. Riprova tra qualche
              istante.
            </p>
            <button className="btn btn-outline btn-sm" onClick={() => refetch()}>
              <Ico p={ICONS.refresh} size={14} /> Riprova
            </button>
          </div>
        ) : isLoading ? (
          <ReportSkeleton />
        ) : pivot.rows.length === 0 ? (
          <div className="state-panel" data-testid="report-empty">
            <div className="state-ico neutral">
              <Ico p={ICONS.chart} size={26} />
            </div>
            <p className="state-title">Nessuna ora aggregata</p>
            <p className="state-sub">
              {hasFilter
                ? 'Nessuna riga importata con successo per i filtri selezionati. Prova ad ampliare il periodo o rimuovere connettore, progetto o task.'
                : 'Non risultano ancora importazioni andate a buon fine da aggregare.'}
            </p>
            {hasFilter && (
              <button className="btn btn-outline btn-sm" onClick={reset}>
                Azzera filtri
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="pivot-head">
              <span className="pivot-title">Ore per progetto × connettore</span>
              <span className="pivot-meta">
                {pivot.projectCount} progett{pivot.projectCount === 1 ? 'o' : 'i'} ·{' '}
                {connectors.length} connettor{connectors.length === 1 ? 'e' : 'i'}
              </span>
            </div>

            <div className="table-wrap">
              <table className="table pivot" data-testid="report-table">
                <thead>
                  <tr>
                    <th>Progetto</th>
                    {connectors.map((c) => (
                      <th key={c} className="conn-col">
                        <ConnTh label={c} service={pivot.connectorService[c]} />
                      </th>
                    ))}
                    <th className="conn-col total-col">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {pivot.rows.map((r) => {
                    const open = expanded.has(r.project)
                    const dim = groupDim[r.project]
                    const rowEls: ReactNode[] = [
                      <tr
                        key={r.project}
                        className={`rpt-proj${open ? ' is-open' : ''}${
                          dimPop === r.project ? ' pop-open' : ''
                        }`}
                        data-testid="report-row"
                        data-project={r.project}
                      >
                        <td className="proj-name">
                          <button
                            type="button"
                            className="rpt-cell rpt-proj-trigger"
                            aria-haspopup="menu"
                            aria-expanded={dimPop === r.project}
                            data-testid={`proj-trigger-${r.project}`}
                            onClick={() => toggleDimPop(r.project)}
                          >
                            <Ico
                              p={ICONS.chevR}
                              size={15}
                              cls={`rpt-chev${open ? ' is-open' : ''}`}
                            />
                            {r.project}
                          </button>
                          {dimPop === r.project && (
                            <div className="dim-pop" role="menu">
                              <div className="dim-pop-lbl">Dettaglio per</div>
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={open && dim === 'date'}
                                className={`dim-pop-opt${open && dim === 'date' ? ' is-on' : ''}`}
                                data-testid="dim-opt-date"
                                onClick={() => chooseDim(r.project, 'date')}
                              >
                                Giorno
                              </button>
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={open && dim === 'task'}
                                className={`dim-pop-opt${open && dim === 'task' ? ' is-on' : ''}`}
                                data-testid="dim-opt-task"
                                onClick={() => chooseDim(r.project, 'task')}
                              >
                                Task
                              </button>
                              {open && (
                                <button
                                  type="button"
                                  className="dim-pop-collapse"
                                  data-testid="dim-opt-collapse"
                                  onClick={() => collapseProject(r.project)}
                                >
                                  <Ico p={ICONS.x} size={12} strokeW={2.2} /> Comprimi
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <SvcCells
                          byConnector={r.byConnector}
                          total={r.total}
                          connectors={connectors}
                        />
                      </tr>,
                    ]

                    if (open && dim) {
                      const otherDim: Dim = dim === 'date' ? 'task' : 'date'
                      groupItems(r.items, dim).forEach((g) => {
                        const gkey = r.project + '|' + String(g.key)
                        const gopen = openGroups.has(gkey)
                        rowEls.push(
                          <tr
                            key={gkey}
                            className={`rpt-sub rpt-l1${gopen ? ' is-open' : ''}`}
                            data-testid="report-l1-row"
                            onClick={() => toggleGroup(gkey)}
                          >
                            <td>
                              <span className="rpt-cell indent-1">
                                <Ico
                                  p={ICONS.chevR}
                                  size={14}
                                  cls={`rpt-chev${gopen ? ' is-open' : ''}`}
                                />
                                <span className="rpt-l1-lbl">
                                  {dim === 'date' ? dayLbl(g.key) : g.key}
                                </span>
                              </span>
                            </td>
                            <SvcCells
                              byConnector={g.byConnector}
                              total={g.total}
                              connectors={connectors}
                            />
                          </tr>,
                        )
                        if (gopen) {
                          groupItems(g.items, otherDim).forEach((s) => {
                            rowEls.push(
                              <tr key={gkey + '||' + String(s.key)} className="rpt-sub rpt-l2">
                                <td>
                                  <span className="rpt-cell indent-2">
                                    <span className="rpt-l2-lbl">
                                      {otherDim === 'date' ? dayLbl(s.key) : s.key}
                                    </span>
                                  </span>
                                </td>
                                <SvcCells
                                  byConnector={s.byConnector}
                                  total={s.total}
                                  connectors={connectors}
                                />
                              </tr>,
                            )
                          })
                        }
                      })
                    }

                    return <Fragment key={r.project}>{rowEls}</Fragment>
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="foot-label">Totale ore</td>
                    {connectors.map((c) => (
                      <td key={c} className="conn-col num">
                        {(pivot.svcTotal[c] ?? 0).toFixed(1)}
                      </td>
                    ))}
                    <td className="conn-col num total-col">{pivot.grand.toFixed(1)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
