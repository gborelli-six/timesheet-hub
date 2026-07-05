import { useMemo, useState } from 'react'
import type { TimesheetEntry } from '../lib/timesheet/types'

/** Stato dei filtri dello Step 2: selezione multipla per data, progetto e task. */
export interface PreviewFilters {
  dates: string[]
  projects: string[]
  tasks: string[]
}

export interface UsePreviewFiltersResult {
  filters: PreviewFilters
  setFilterDate: (values: string[]) => void
  setFilterProject: (values: string[]) => void
  setFilterTask: (values: string[]) => void
  resetFilters: () => void
  /** Indici (originali) delle entries che soddisfano tutti i filtri attivi (AND). */
  filteredIndices: number[]
  /** Valori distinti per la costruzione dei dropdown, calcolati sull'array completo. */
  distinctDates: string[]
  distinctProjects: string[]
  distinctTasks: string[]
  /** true se almeno un filtro è attivo. */
  isFiltered: boolean
}

const EMPTY_FILTERS: PreviewFilters = { dates: [], projects: [], tasks: [] }

/**
 * Gestisce lo stato dei filtri della tabella di preview e produce la lista degli
 * indici visibili applicando logica AND fra i filtri attivi. I valori distinti
 * sono sempre calcolati sull'array completo `entries` (non filtrato).
 */
export function usePreviewFilters(entries: TimesheetEntry[]): UsePreviewFiltersResult {
  const [dates, setDates] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [tasks, setTasks] = useState<string[]>([])

  const distinctDates = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.date) set.add(e.date)
    }
    // Date ISO (YYYY-MM-DD): l'ordinamento lessicografico è cronologico.
    return Array.from(set).sort()
  }, [entries])

  const distinctProjects = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.project) set.add(e.project)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [entries])

  const distinctTasks = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.task) set.add(e.task)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filteredIndices = useMemo(() => {
    const indices: number[] = []
    entries.forEach((e, i) => {
      if (dates.length > 0 && !(e.date && dates.includes(e.date))) return
      if (projects.length > 0 && !(e.project && projects.includes(e.project))) return
      if (tasks.length > 0 && !(e.task && tasks.includes(e.task))) return
      indices.push(i)
    })
    return indices
  }, [entries, dates, projects, tasks])

  const isFiltered = dates.length > 0 || projects.length > 0 || tasks.length > 0

  function resetFilters() {
    setDates(EMPTY_FILTERS.dates)
    setProjects(EMPTY_FILTERS.projects)
    setTasks(EMPTY_FILTERS.tasks)
  }

  return {
    filters: { dates, projects, tasks },
    setFilterDate: setDates,
    setFilterProject: setProjects,
    setFilterTask: setTasks,
    resetFilters,
    filteredIndices,
    distinctDates,
    distinctProjects,
    distinctTasks,
    isFiltered,
  }
}
