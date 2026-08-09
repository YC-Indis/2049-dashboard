import { reactive } from 'vue'

/** 将表格行导出为 CSV 并触发下载 */
export function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** 6 小时内同步过的账号不再重复拉取，避免把 RapidAPI 配额刷光 */
const RECENT_SYNC_MS = 6 * 60 * 60 * 1000

/** 账号 / 视频最近一次拉取指标的时间，用来在检阅页显示「尚未更新」并跳过重复同步 */
export const dojoSyncStore = reactive({
  accountSyncedAt: {} as Record<string, string>,
  videoSyncedAt: {} as Record<string, string>
})

/** 从主页链接、纯用户名等各种写法里抠出规范的 @handle */
export function normalizeHandle(raw: string): string {
  const matched = raw.match(/@([\w.]+)/)
  if (matched) return `@${matched[1]}`
  const trimmed = raw.trim()
  if (trimmed.startsWith('@')) return trimmed
  return trimmed ? `@${trimmed}` : ''
}

export function markAccountsSynced(accounts: string[], at: string = new Date().toISOString()) {
  for (const account of accounts) {
    const handle = normalizeHandle(account)
    if (handle) dojoSyncStore.accountSyncedAt[handle] = at
  }
}

export function markVideosSynced(videoIds: string[], at: string = new Date().toISOString()) {
  for (const id of videoIds) {
    if (id) dojoSyncStore.videoSyncedAt[id] = at
  }
}

export function isRecentlySynced(account: string, withinMs: number = RECENT_SYNC_MS): boolean {
  const at = dojoSyncStore.accountSyncedAt[normalizeHandle(account)]
  if (!at) return false
  return Date.now() - new Date(at).getTime() < withinMs
}
