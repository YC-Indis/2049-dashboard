/**
 * 本地留存适配层。
 *
 * 对调用方仍然是同步的「一张表一个 key、整表读写」，签名没变——各个 store 都在
 * 模块加载时同步读表，改成异步要动几十处。
 *
 * 实际落点有两个：
 *   localStorage  始终写，是唯一的同步数据源，也是后端连不上时的离线模式
 *   服务端 SQLite 启动时灌一次进来，之后每次 saveTable 防抖推上去
 *
 * 后端不可用时整个模块退化成纯 localStorage，行为跟以前完全一样，页面照常能用。
 */

const PREFIX = 'dojo:v1:'
const API_BASE = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'

/** 存储层版本，结构不兼容时递增，旧数据会被丢弃而不是报错 */
const SCHEMA_VERSION = 2

/** 攒够这段时间没有新的写入才推送。连续拖动排期会触发大量 saveTable */
const FLUSH_DELAY = 800

/** 首屏不能被后端拖住，超过这个时间就先按离线起，数据回头再对 */
const HYDRATE_TIMEOUT = 2500

interface Envelope<T> {
  version: number
  savedAt: string
  data: T
}

let online = false
const pending = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function key(table: string) {
  return `${PREFIX}${table}`
}

export function loadTable<T>(table: string): T | null {
  try {
    const raw = localStorage.getItem(key(table))
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope<T>
    if (env.version !== SCHEMA_VERSION) return null
    return env.data
  } catch {
    return null
  }
}

export function saveTable<T>(table: string, data: T) {
  const ok = writeLocal(table, data)
  if (online) {
    pending.add(table)
    scheduleFlush()
  }
  return ok
}

export function clearTable(table: string) {
  localStorage.removeItem(key(table))
  if (online) {
    void request(`${API_BASE}/tables/${table}`, { method: 'DELETE' })
  }
}

export function tableSavedAt(table: string): string | null {
  try {
    const raw = localStorage.getItem(key(table))
    if (!raw) return null
    return (JSON.parse(raw) as Envelope<unknown>).savedAt || null
  } catch {
    return null
  }
}

/** 后端此刻是否在用。界面上要能看出现在是联机还是单机。 */
export function isBackendOnline() {
  return online
}

/**
 * 启动时调用一次，必须在任何 store 模块求值之前完成。
 *
 * 拉到数据就整个覆盖 localStorage：服务端是权威副本，本地这份可能是上次离线时
 * 改的。真要做双向合并得给每条记录带上修改时间，那是另一个量级的工程，眼下
 * 单人使用场景不需要。
 */
export async function hydrateFromServer(): Promise<boolean> {
  const health = await request(`${API_BASE}/health`, {}, HYDRATE_TIMEOUT)
  if (!health?.ok) {
    online = false
    return false
  }

  const payload = await request(`${API_BASE}/tables?full=true`, {}, HYDRATE_TIMEOUT)
  const tables = payload?.tables as Record<string, Envelope<unknown>> | undefined
  if (!tables) {
    online = false
    return false
  }

  let restored = 0
  for (const [name, env] of Object.entries(tables)) {
    if (env?.data == null) continue
    writeLocal(name, env.data)
    restored += 1
  }

  online = true
  // 首次接后端时库是空的，把本地已有的数据推上去，否则用户会以为数据丢了
  if (restored === 0) {
    for (const name of localTableNames()) pending.add(name)
    scheduleFlush()
  }
  return true
}

function writeLocal<T>(table: string, data: T): boolean {
  try {
    const env: Envelope<T> = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data
    }
    localStorage.setItem(key(table), JSON.stringify(env))
    return true
  } catch {
    // 超配额或隐私模式下写不进去，不该让页面挂掉
    return false
  }
}

function localTableNames(): string[] {
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const raw = localStorage.key(i)
    if (raw?.startsWith(PREFIX)) names.push(raw.slice(PREFIX.length))
  }
  return names
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_DELAY)
}

async function flush() {
  const batch = [...pending]
  pending.clear()

  for (const table of batch) {
    const data = loadTable(table)
    if (data === null) continue
    const res = await request(`${API_BASE}/tables/${table}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: SCHEMA_VERSION, data })
    })
    if (res === null) {
      // 推不上去就放回队列，等下一次写入时连带重试；本地那份始终是好的
      pending.add(table)
      online = false
    }
  }
}

async function request(url: string, init: RequestInit = {}, timeout = 8000) {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeout)
  try {
    const res = await fetch(url, { ...init, signal: abort.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
