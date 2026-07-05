// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePreviewFilters } from './usePreviewFilters'
import type { TimesheetEntry } from '../lib/timesheet/types'

function makeEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    date: '2026-01-15',
    project: 'Progetto A',
    task: 'Dev',
    hours: 8,
    connectorAssignments: [],
    ...overrides,
  }
}

// 4 entries con progetti/task/date parzialmente sovrapposti.
const ENTRIES: TimesheetEntry[] = [
  makeEntry({ date: '2026-03-02', project: 'Beta', task: 'Review' }), // 0
  makeEntry({ date: '2026-03-01', project: 'Alpha', task: 'Dev' }), // 1
  makeEntry({ date: '2026-03-01', project: 'Beta', task: 'Dev' }), // 2
  makeEntry({ date: '2026-03-03', project: 'Alpha', task: 'Review' }), // 3
]

describe('usePreviewFilters', () => {
  it('nessun filtro: filteredIndices contiene tutti gli indici', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    expect(result.current.filteredIndices).toEqual([0, 1, 2, 3])
    expect(result.current.isFiltered).toBe(false)
  })

  it('filtro singolo per data', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => result.current.setFilterDate(['2026-03-01']))
    expect(result.current.filteredIndices).toEqual([1, 2])
    expect(result.current.isFiltered).toBe(true)
  })

  it('filtro singolo per progetto', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => result.current.setFilterProject(['Alpha']))
    expect(result.current.filteredIndices).toEqual([1, 3])
  })

  it('filtro singolo per task', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => result.current.setFilterTask(['Review']))
    expect(result.current.filteredIndices).toEqual([0, 3])
  })

  it('combinazione di 2 filtri (AND)', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => {
      result.current.setFilterProject(['Beta'])
      result.current.setFilterTask(['Dev'])
    })
    expect(result.current.filteredIndices).toEqual([2])
  })

  it('combinazione di 3 filtri (AND)', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => {
      result.current.setFilterDate(['2026-03-01'])
      result.current.setFilterProject(['Alpha'])
      result.current.setFilterTask(['Dev'])
    })
    expect(result.current.filteredIndices).toEqual([1])
  })

  it('filtro senza match restituisce lista vuota', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => result.current.setFilterProject(['Inesistente']))
    expect(result.current.filteredIndices).toEqual([])
  })

  it('resetFilters ripristina tutti gli indici', () => {
    const { result } = renderHook(() => usePreviewFilters(ENTRIES))
    act(() => result.current.setFilterProject(['Alpha']))
    expect(result.current.filteredIndices).toEqual([1, 3])
    act(() => result.current.resetFilters())
    expect(result.current.filteredIndices).toEqual([0, 1, 2, 3])
    expect(result.current.isFiltered).toBe(false)
  })

  it('distinctProjects/Tasks ordinati alfabeticamente e senza vuoti', () => {
    const entries = [
      makeEntry({ project: 'Zeta', task: 'QA' }),
      makeEntry({ project: 'Alpha', task: 'Dev' }),
      makeEntry({ project: '', task: '' }),
    ]
    const { result } = renderHook(() => usePreviewFilters(entries))
    expect(result.current.distinctProjects).toEqual(['Alpha', 'Zeta'])
    expect(result.current.distinctTasks).toEqual(['Dev', 'QA'])
  })

  it('distinctDates ordinate cronologicamente e senza vuoti', () => {
    const entries = [
      makeEntry({ date: '2026-03-03' }),
      makeEntry({ date: '2026-03-01' }),
      makeEntry({ date: undefined }),
      makeEntry({ date: '2026-03-02' }),
    ]
    const { result } = renderHook(() => usePreviewFilters(entries))
    expect(result.current.distinctDates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
  })
})
