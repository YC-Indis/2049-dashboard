/**
 * 本地留存适配层。
 *
 * 目前落在 localStorage，接口刻意按「一张表一个 key、整表读写」的形状设计，
 * 之后补上 FastAPI + SQLite 时只替换这个文件的实现，调用方不动。
 */

const PREFIX = 'dojo:v1:'

/** 存储层版本，结构不兼容时递增，旧数据会被丢弃而不是报错 */
const SCHEMA_VERSION = 1

interface Envelope<T> {
  version: number
  savedAt: string
  data: T
}

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

export function clearTable(table: string) {
  localStorage.removeItem(key(table))
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
