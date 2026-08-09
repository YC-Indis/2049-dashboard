import { reactive } from 'vue'

/**
 * 投放侧 RapidAPI 同步时间戳，供「总账号预览」穿透跳过已同步账号。
 */
export const dojoSyncStore = reactive({
  /** handle(@xxx) → ISO 时间 */
  accountSyncedAt: {} as Record<string, string>,
  /** 视频 URL → ISO 时间 */
  videoSyncedAt: {} as Record<string, string>
})

export function markAccountsSynced(handles: string[], at = new Date().toISOString()) {
  for (const h of handles) {
    const key = normalizeHandle(h)
    if (key) dojoSyncStore.accountSyncedAt[key] = at
  }
}

export function markVideosSynced(urls: string[], at = new Date().toISOString()) {
  for (const u of urls) {
    if (u) dojoSyncStore.videoSyncedAt[u] = at
  }
}

export function normalizeHandle(raw: string) {
  const m = raw.match(/@([\w.]+)/)
  return m ? `@${m[1]}` : raw.trim().startsWith('@') ? raw.trim() : raw.trim() ? `@${raw.trim()}` : ''
}

export function isAccountRecentlySynced(handle: string, withinMs = 6 * 60 * 60 * 1000) {
  const at = dojoSyncStore.accountSyncedAt[normalizeHandle(handle)]
  if (!at) return false
  return Date.now() - new Date(at).getTime() < withinMs
}
