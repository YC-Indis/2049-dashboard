import { reactive } from 'vue'
import { dojoAccountStore, accountVideos, syncAccounts } from '@/store/dojoAccountStore'
import { loadTable, saveTable } from '@/utils/dojoPersist'

const TABLE_AUTO_REFRESH = 'accountAutoRefresh'
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000
const SCHEDULER_TICK_MS = 60 * 1000

interface AutoRefreshPersist {
  intervalMs: number
  lastRunAt?: string
  userConfigured?: boolean
}

const persisted = loadTable<AutoRefreshPersist>(TABLE_AUTO_REFRESH)
let userConfigured = persisted?.userConfigured ?? false
const persistedInterval = persisted?.intervalMs ?? 0
const initialInterval = userConfigured
  ? persistedInterval
  : persistedInterval > 0
    ? persistedInterval
    : DEFAULT_INTERVAL_MS

export const dojoAccountAutoSyncStore = reactive({
  intervalMs: initialInterval,
  lastRunAt: persisted?.lastRunAt || '',
  running: false,
  started: false,
  lastNewVideoCount: 0,
  lastAccountCount: 0
})

let schedulerTimer: ReturnType<typeof setInterval> | null = null

function persist(nextUserConfigured = userConfigured) {
  userConfigured = nextUserConfigured
  saveTable(TABLE_AUTO_REFRESH, {
    intervalMs: dojoAccountAutoSyncStore.intervalMs,
    lastRunAt: dojoAccountAutoSyncStore.lastRunAt || undefined,
    userConfigured: nextUserConfigured
  } satisfies AutoRefreshPersist)
}

function totalVideoCount(handles: string[]) {
  return handles.reduce((total, handle) => total + accountVideos(handle).length, 0)
}

function isDue() {
  if (dojoAccountAutoSyncStore.intervalMs <= 0) return false
  const last = dojoAccountAutoSyncStore.lastRunAt
    ? new Date(dojoAccountAutoSyncStore.lastRunAt).getTime()
    : 0
  return !last || Date.now() - last >= dojoAccountAutoSyncStore.intervalMs
}

export function setAccountAutoSyncInterval(intervalMs: number) {
  dojoAccountAutoSyncStore.intervalMs = Math.max(0, intervalMs)
  persist(true)
  if (dojoAccountAutoSyncStore.intervalMs > 0) void runAccountAutoSync()
}

export function recordFullAccountSyncCompleted() {
  dojoAccountAutoSyncStore.lastRunAt = new Date().toISOString()
  persist()
}

export async function runAccountAutoSync(force = false) {
  if (dojoAccountAutoSyncStore.running) return null
  if (!force && !isDue()) return null

  const handles = dojoAccountStore.accounts
    .filter((account) => account.status === 'active')
    .map((account) => account.handle)
  if (!handles.length) return null

  dojoAccountAutoSyncStore.running = true
  const beforeVideos = totalVideoCount(handles)
  try {
    await syncAccounts(handles)
    const afterVideos = totalVideoCount(handles)
    dojoAccountAutoSyncStore.lastNewVideoCount = Math.max(0, afterVideos - beforeVideos)
    dojoAccountAutoSyncStore.lastAccountCount = handles.length
    recordFullAccountSyncCompleted()
    return {
      accounts: handles.length,
      newVideos: dojoAccountAutoSyncStore.lastNewVideoCount
    }
  } finally {
    dojoAccountAutoSyncStore.running = false
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void runAccountAutoSync()
}

export function startAccountAutoSync() {
  if (dojoAccountAutoSyncStore.started) return
  dojoAccountAutoSyncStore.started = true
  persist()
  void runAccountAutoSync()
  schedulerTimer = setInterval(() => {
    void runAccountAutoSync()
  }, SCHEDULER_TICK_MS)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

export function stopAccountAutoSync() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  dojoAccountAutoSyncStore.started = false
}
