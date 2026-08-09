import { timelineStart } from '@/mock/dojo/imported'

export interface WeekOption {
  key: string
  start: string
  end: string
  rangeLabel: string
  count?: number
}

function fmtIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return fmtIso(d)
}

export function fmtShortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function sortWeekKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 0
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
    return na - nb || a.localeCompare(b)
  })
}

export function buildWeekRanges(weekKeys: string[], anchorStart = timelineStart) {
  const map = new Map<string, { start: string; end: string }>()
  for (const [i, key] of sortWeekKeys(weekKeys).entries()) {
    const start = addDays(anchorStart, i * 7)
    map.set(key, { start, end: addDays(start, 6) })
  }
  return map
}

export function buildWeekOptions(
  weekKeys: string[],
  countFn?: (key: string) => number,
  anchorStart = timelineStart
): WeekOption[] {
  const ranges = buildWeekRanges(weekKeys, anchorStart)
  return sortWeekKeys(weekKeys).map((key) => {
    const range = ranges.get(key)!
    return {
      key,
      start: range.start,
      end: range.end,
      rangeLabel: `${fmtShortDate(range.start)} – ${fmtShortDate(range.end)}`,
      count: countFn?.(key)
    }
  })
}

export function deriveWeekLabel(
  dateStr: string,
  weekKeys: string[],
  anchorStart = timelineStart
): string {
  if (!dateStr) return ''
  for (const [key, range] of buildWeekRanges(weekKeys, anchorStart)) {
    if (dateStr >= range.start && dateStr <= range.end) return key
  }
  const anchor = new Date(`${anchorStart}T00:00:00`)
  const d = new Date(`${dateStr}T00:00:00`)
  const diffDays = Math.floor((d.getTime() - anchor.getTime()) / 86400000)
  if (diffDays >= 0) return `第 ${Math.floor(diffDays / 7) + 1} 周`
  return ''
}

export function monthsInWeekRange(
  weekKey: string,
  weekKeys: string[],
  anchorStart = timelineStart
): string[] {
  const range = buildWeekRanges(weekKeys, anchorStart).get(weekKey)
  if (!range) return []
  const months = new Set<string>()
  const d = new Date(`${range.start}T00:00:00`)
  const end = new Date(`${range.end}T00:00:00`)
  while (d <= end) {
    months.add(fmtIso(d).slice(0, 7))
    d.setDate(d.getDate() + 1)
  }
  return [...months]
}
