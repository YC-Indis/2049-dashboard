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
