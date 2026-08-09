/**
 * 全站「今天」基准。历史数据截止到这一天，改这里即可整体对齐，
 * 不要再在页面里各写一份 todayKey。
 */
export const DOJO_TODAY = '2026-08-07'

/** Excel 序列日（如 46091）→ YYYY-MM-DD */
export function excelSerialToIso(serial: number): string {
  // Excel 以 1899-12-30 为 0（含 1900 闰年兼容）
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 把分发日期里的序列数 / 杂乱字符串规范成 YYYY-MM-DD 或原样 */
export function normalizeDateString(raw: string | number | null | undefined): string {
  if (raw == null || raw === '' || raw === '—') return ''
  if (typeof raw === 'number' && Number.isFinite(raw)) return excelSerialToIso(raw)
  const s = String(raw).trim()
  if (/^\d{5}$/.test(s)) return excelSerialToIso(Number(s))
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

export function formatDateDisplay(raw: string | number | null | undefined): string {
  const iso = normalizeDateString(raw)
  return iso || '—'
}

/** 两个 ISO 日期相差的天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()
  return Math.round(ms / 86400000)
}

/** ISO 日期加减天数 */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 2026-08-04 → 8月4日 */
export function formatMonthDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}月${Number(d)}日`
}
