/**
 * 全站「今天」基准。历史数据截止到这一天，改这里即可整体对齐，
 * 不要再在页面里各写一份 todayKey。
 */
export const DOJO_TODAY = '2026-08-16'

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

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
}

const DATE_TOKEN =
  /(?:\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)|(?:\d{1,2}[:.．]\d{1,2}月\s*[0-9一二三四五六七八九十廿卅两]+[日号]?)|(?:[0-9一二三四五六七八九十两]+月\s*[0-9一二三四五六七八九十廿卅两]+[日号]?)|(?:\d{1,2}[.．／/\-]\d{1,2}日?)/g

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toIso(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function parseChineseInt(raw: string) {
  const text = raw.replace(/[号日天]/g, '').trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  if (text === '十') return 10
  if (text === '廿') return 20
  if (text === '卅') return 30
  if (text.startsWith('廿')) return 20 + (CN_DIGIT[text.slice(1)] ?? 0)
  if (text.startsWith('卅')) return 30 + (CN_DIGIT[text.slice(1)] ?? 0)
  if (text.startsWith('十')) return 10 + (CN_DIGIT[text.slice(1)] ?? 0)
  if (text.endsWith('十') && text.length === 2) return (CN_DIGIT[text[0]] ?? 0) * 10
  if (text.includes('十')) {
    const [head, tail] = text.split('十')
    return (head ? CN_DIGIT[head] || 0 : 1) * 10 + (CN_DIGIT[tail] || 0)
  }
  if (text.length === 1 && CN_DIGIT[text] != null) return CN_DIGIT[text]
  return null
}

export function parseFlexibleDate(
  raw: string,
  refYear = Number(DOJO_TODAY.slice(0, 4))
) {
  const text = raw.trim()
  if (!text) return null
  const iso = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/)
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const messy = text.match(
    /^(\d{1,2})[:.．](\d{1,2})月\s*([0-9一二三四五六七八九十廿卅两]+)[日号]?$/
  )
  if (messy) {
    const first = Number(messy[1])
    const day = parseChineseInt(messy[3])
    if (day && first >= 1 && first <= 12) return toIso(refYear, first, day)
  }

  const monthDay = text.match(
    /^([0-9一二三四五六七八九十两]+)月\s*([0-9一二三四五六七八九十廿卅两]+)[日号]?$/
  )
  if (monthDay) {
    const month = parseChineseInt(monthDay[1])
    const day = parseChineseInt(monthDay[2])
    if (month && day) return toIso(refYear, month, day)
  }

  const dotted = text.match(/^(\d{1,2})[.．／/\-](\d{1,2})日?$/)
  if (dotted) return toIso(refYear, Number(dotted[1]), Number(dotted[2]))
  return null
}

export function extractDateRange(
  raw: string,
  refYear = Number(DOJO_TODAY.slice(0, 4))
) {
  const text = String(raw || '').trim()
  if (!text) return null
  const hits: Array<{ iso: string; index: number; end: number }> = []
  const pattern = new RegExp(DATE_TOKEN.source, 'g')
  let match = pattern.exec(text)
  while (match) {
    const iso = parseFlexibleDate(match[0], refYear)
    if (iso) {
      hits.push({
        iso,
        index: match.index,
        end: match.index + match[0].length
      })
    }
    match = pattern.exec(text)
  }
  if (hits.length < 2) return null
  for (let index = 0; index < hits.length - 1; index += 1) {
    const left = hits[index]
    const right = hits[index + 1]
    const gap = text.slice(left.end, right.index)
    if (!/^\s*[-~～—–至到、]\s*$/.test(gap) && !/到|至/.test(gap)) continue
    const start = left.iso
    let end = right.iso
    if (end < start) {
      const next = toIso(Number(end.slice(0, 4)) + 1, Number(end.slice(5, 7)), Number(end.slice(8, 10)))
      if (next) end = next
    }
    return { start, end }
  }
  return null
}
