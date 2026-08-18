/**
 * 业务数据备份 / 恢复（localStorage 中的 dojo:v1:* 等）。
 * 网吧等环境关浏览器即清空，离开前导出 JSON，回来再导入即可。
 */

const PREFIX = 'dojo:v1:'
const EXTRA_KEYS = ['dojo-agent-panel']

export interface DojoSeedSummary {
  keyCount: number
  projects: number
  accounts: number
  videoHandles: number
  scheduleBlocks: number
  worklogEvents: number
  latestSavedAt: string | null
  bytes: number
}

function isDojoKey(key: string) {
  return key.startsWith(PREFIX) || EXTRA_KEYS.includes(key)
}

function parseEnvelope(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as { version?: number; savedAt?: string; data?: unknown }
  } catch {
    return null
  }
}

/** 收集当前浏览器里所有 Dojo 业务键 */
export function collectDojoSeed(): Record<string, string> {
  const dump: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isDojoKey(key)) continue
    const value = localStorage.getItem(key)
    if (value != null) dump[key] = value
  }
  return dump
}

/** 写入 localStorage（会先清掉旧的 dojo 键） */
export function applyDojoSeed(dump: Record<string, string>) {
  const remove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && isDojoKey(key)) remove.push(key)
  }
  remove.forEach((k) => localStorage.removeItem(k))
  Object.entries(dump).forEach(([k, v]) => {
    if (typeof v === 'string' && v.length) localStorage.setItem(k, v)
  })
}

export function summarizeDojoSeed(dump: Record<string, string>): DojoSeedSummary {
  let latestSavedAt: string | null = null
  let bytes = 0

  const readCount = (tableKey: string): number => {
    const env = parseEnvelope(dump[`${PREFIX}${tableKey}`] ?? null)
    if (!env) return 0
    if (env.savedAt && (!latestSavedAt || env.savedAt > latestSavedAt)) {
      latestSavedAt = env.savedAt
    }
    const data = env.data
    if (Array.isArray(data)) return data.length
    if (data && typeof data === 'object') return Object.keys(data as object).length
    return 0
  }

  Object.entries(dump).forEach(([k, v]) => {
    bytes += k.length + v.length
    const env = parseEnvelope(v)
    if (env?.savedAt && (!latestSavedAt || env.savedAt > latestSavedAt)) {
      latestSavedAt = env.savedAt
    }
  })

  return {
    keyCount: Object.keys(dump).length,
    projects: readCount('projects'),
    accounts: readCount('accounts'),
    videoHandles: readCount('accountVideos'),
    scheduleBlocks: readCount('scheduleBlocks'),
    worklogEvents: readCount('worklogEvents'),
    latestSavedAt,
    bytes
  }
}

export function parseDojoBackupText(text: string): Record<string, string> {
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('备份文件格式不对：需要 JSON 对象')
  }
  const dump: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isDojoKey(k)) continue
    if (typeof v !== 'string') {
      throw new Error(`键 ${k} 的值必须是字符串`)
    }
    if (!EXTRA_KEYS.includes(k) && !parseEnvelope(v)) {
      throw new Error(`键 ${k} 的内容不是有效的 Dojo 存储格式`)
    }
    dump[k] = v
  }
  if (!Object.keys(dump).length) {
    throw new Error('文件里没有 dojo:v1:* 业务数据')
  }
  return dump
}

function stampFilename() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `dojo-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}

/** 触发下载备份 JSON */
export function downloadDojoBackup(filename?: string) {
  const dump = collectDojoSeed()
  if (!Object.keys(dump).length) {
    throw new Error('当前没有可导出的业务数据')
  }
  const body = JSON.stringify(dump, null, 2)
  const blob = new Blob([body], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || stampFilename()
  a.click()
  URL.revokeObjectURL(url)
  return summarizeDojoSeed(dump)
}
