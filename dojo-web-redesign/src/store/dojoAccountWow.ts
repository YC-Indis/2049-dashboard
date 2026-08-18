/**
 * 账号周环比透视：保存「上次」指标快照，与当前 live 指标对比。
 */
import { reactive } from 'vue'
import { stripHandle } from '@/api/tiktok'
import { loadTable, saveTable } from '@/utils/dojoPersist'

export interface AccountWowMetrics {
  at: string
  followers: number
  posts: number
  avgViews: number
  avgLikes: number
  /** 0–1 */
  engagementRate: number
  spreadScore: number
}

interface WowEntry {
  /** 上周 / 上次对比基线 */
  baseline: AccountWowMetrics
}

const TABLE = 'accountWow'

function normalize(handle: string) {
  return `@${stripHandle(handle).toLowerCase()}`
}

export const dojoAccountWow = reactive({
  byHandle: (loadTable<Record<string, WowEntry>>(TABLE) || {}) as Record<string, WowEntry>,
  revision: 0
})

function persist() {
  dojoAccountWow.revision++
  saveTable(TABLE, { ...dojoAccountWow.byHandle })
}

export function getWowBaseline(handle: string): AccountWowMetrics | null {
  return dojoAccountWow.byHandle[normalize(handle)]?.baseline || null
}

/** 把当前指标记为「上次」基线（刷新对比前调用） */
export function saveWowBaseline(handle: string, metrics: AccountWowMetrics) {
  const id = normalize(handle)
  dojoAccountWow.byHandle[id] = { baseline: { ...metrics } }
  persist()
}

export function clearWowBaseline(handle: string) {
  const id = normalize(handle)
  if (!dojoAccountWow.byHandle[id]) return
  delete dojoAccountWow.byHandle[id]
  persist()
}
