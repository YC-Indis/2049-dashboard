/**
 * 账号台账 —— 系统的核心实体。
 *
 * 思路上做了一次反转：过去是「先有表格再有中台」，表格里的播放量、发布日期
 * 都靠人手填。但表格也是人写的，真正不可替代的只有账号本身。只要账号在册，
 * RapidAPI 就能把作品、播放、粉丝拉回来，分发记录因此是算出来的而不是填出来的，
 * 表格反过来变成系统的导出物。
 *
 * 所以这里只维护「账号 + 归属 + 同步状态」，指标一律来自同步结果。
 */
import { computed, reactive } from 'vue'
import { accountPlans, accountMonitor, distributionRecords } from '@/mock/dojo/imported'
import { fetchAllAccountVideos, stripHandle, syncTikTokAccount } from '@/api/tiktok'
import type { TikTokAccountVideo } from '@/api/tiktok'
import { loadTable, saveTable } from '@/utils/dojoPersist'

export type AccountStatus = 'active' | 'paused' | 'dropped' | 'pending'
/** 账号是怎么进系统的：历史表格导入 / 手工录入 / 从文档抽取 */
export type AccountSource = 'excel' | 'manual' | 'document'

export interface MatrixAccount {
  /** @handle，全局唯一键 */
  handle: string
  projectId: string
  /** 内容细分，来自内容规划表 */
  segment: string
  status: AccountStatus
  source: AccountSource
  addedAt: string
  link: string
  note: string

  // 以下字段全部来自 RapidAPI 同步，不接受人工填写
  nickname?: string
  followers?: number
  following?: number
  totalVideos?: number
  totalHearts?: number
  region?: string
  verified?: boolean
  isPrivate?: boolean
  lastSyncedAt?: string
  syncSource?: 'rapidapi' | 'mock'
  syncError?: string
}

interface AccountState {
  accounts: MatrixAccount[]
  /** 按 handle 存同步回来的作品，分发数据由此派生 */
  videos: Record<string, TikTokAccountVideo[]>
  syncing: string[]
  revision: number
}

const TABLE_ACCOUNTS = 'accounts'
const TABLE_VIDEOS = 'accountVideos'

function normalize(handle: string) {
  return `@${stripHandle(handle).toLowerCase()}`
}

/**
 * 首次进入时用已有数据播种台账：内容规划表给出细分与链接，
 * 监看表和分发记录补上那些只在数据里出现过的账号。
 * 种子数据已清空时返回空台账，由账号接入 / 手工添加重新入库。
 */
function seedAccounts(): MatrixAccount[] {
  const map = new Map<string, MatrixAccount>()
  const addedAt = new Date().toISOString().slice(0, 10)

  const put = (handle: string, projectId: string, extra: Partial<MatrixAccount> = {}) => {
    const raw = handle.trim()
    if (!raw || !raw.replace(/^@/, '')) return
    const id = normalize(raw)
    const existing = map.get(id)
    if (existing) {
      // 后来的来源只补空字段，不覆盖内容规划表给出的细分
      if (!existing.segment && extra.segment) existing.segment = extra.segment
      if (!existing.link && extra.link) existing.link = extra.link
      return
    }
    map.set(id, {
      handle: `@${stripHandle(raw)}`,
      projectId,
      segment: '',
      status: 'active',
      source: 'excel',
      addedAt,
      link: '',
      note: '',
      ...extra
    })
  }

  accountPlans.forEach((plan) => {
    plan.accounts.forEach((a) => {
      put(a.name, plan.projectId, {
        segment: plan.segment,
        link: a.link || '',
        note: a.note || ''
      })
    })
  })

  accountMonitor.forEach((row) => put(row.account, row.projectId))
  distributionRecords.forEach((row) => put(row.account, row.projectId))

  return [...map.values()]
}

const persisted = loadTable<MatrixAccount[]>(TABLE_ACCOUNTS)

export const dojoAccountStore = reactive<AccountState>({
  accounts: persisted && persisted.length ? persisted : seedAccounts(),
  videos: loadTable<Record<string, TikTokAccountVideo[]>>(TABLE_VIDEOS) || {},
  syncing: [],
  revision: 0
})

function persist() {
  dojoAccountStore.revision++
  saveTable(TABLE_ACCOUNTS, dojoAccountStore.accounts)
  saveTable(TABLE_VIDEOS, dojoAccountStore.videos)
}

/** 账号台账变更后写入工作复盘（动态导入避免循环依赖） */
function touchWorklog() {
  void import('@/store/dojoWorklogStore').then(({ reconcileWorklog }) => {
    reconcileWorklog()
  })
}

export function findAccount(handle: string) {
  const id = normalize(handle)
  return dojoAccountStore.accounts.find((a) => normalize(a.handle) === id)
}

/** 入库或更新账号，返回是否为新增 */
export function upsertAccount(
  input: Partial<MatrixAccount> & { handle: string },
  opts?: { silent?: boolean }
) {
  const existing = findAccount(input.handle)
  if (existing) {
    Object.assign(existing, input, { handle: existing.handle })
    persist()
    if (!opts?.silent) touchWorklog()
    return false
  }
  dojoAccountStore.accounts.push({
    ...input,
    handle: `@${stripHandle(input.handle)}`,
    projectId: input.projectId || '',
    segment: input.segment || '',
    status: input.status || 'active',
    source: input.source || 'manual',
    addedAt: input.addedAt || new Date().toISOString().slice(0, 10),
    link: input.link || '',
    note: input.note || ''
  })
  persist()
  if (!opts?.silent) touchWorklog()
  return true
}

export function removeAccount(handle: string) {
  const id = normalize(handle)
  const i = dojoAccountStore.accounts.findIndex((a) => normalize(a.handle) === id)
  if (i >= 0) {
    const projectId = dojoAccountStore.accounts[i].projectId
    dojoAccountStore.accounts.splice(i, 1)
    delete dojoAccountStore.videos[id]
    persist()
    touchWorklog()
    void import('@/store/dojoAccountWow').then(({ clearWowBaseline }) => {
      clearWowBaseline(id)
    })
    if (projectId) {
      void import('@/store/dojoProjectMetrics').then(({ syncProjectCurrentFromLedger }) => {
        syncProjectCurrentFromLedger(projectId)
      })
    }
  }
}

/** 批量入库，返回新增与已存在的数量，供导入预览显示 */
export function importAccounts(rows: Array<Partial<MatrixAccount> & { handle: string }>) {
  let added = 0
  let updated = 0
  const projectIds = new Set<string>()
  rows.forEach((row) => {
    if (upsertAccount(row, { silent: true })) added++
    else updated++
    if (row.projectId) projectIds.add(row.projectId)
  })
  // 导入账号后回写项目「现状·账号数」
  if (projectIds.size) {
    void import('@/store/dojoProjectMetrics').then(({ syncProjectCurrentFromLedger }) => {
      projectIds.forEach((id) => syncProjectCurrentFromLedger(id))
    })
  }
  const projectId = projectIds.size === 1 ? [...projectIds][0] : undefined
  void import('@/store/dojoWorklogStore').then(({ logAccountImportSummary, reconcileWorklog }) => {
    logAccountImportSummary(added, updated, projectId)
    reconcileWorklog()
  })
  return { added, updated }
}

export interface ImportVideoRow {
  handle: string
  videoId: string
  videoUrl: string
  description?: string
  publishDate?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
}

function mergeVideoList(
  existing: TikTokAccountVideo[],
  incoming: TikTokAccountVideo[]
): TikTokAccountVideo[] {
  const map = new Map<string, TikTokAccountVideo>()
  existing.forEach((v) => map.set(v.videoId, v))
  incoming.forEach((v) => {
    const prev = map.get(v.videoId)
    if (!prev) {
      map.set(v.videoId, v)
      return
    }
    // API/导入互补：有值的字段覆盖空字段，指标取较大者
    map.set(v.videoId, {
      ...prev,
      ...v,
      views: Math.max(prev.views || 0, v.views || 0),
      likes: Math.max(prev.likes || 0, v.likes || 0),
      comments: Math.max(prev.comments || 0, v.comments || 0),
      shares: Math.max(prev.shares || 0, v.shares || 0),
      description: v.description || prev.description,
      publishDate: v.publishDate || prev.publishDate,
      cover: v.cover || prev.cover
    })
  })
  return [...map.values()].sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''))
}

/**
 * 导入作品链接：
 * - 按 videoId 合并进 videos[handle]
 * - 账号不在池里时自动补录（空有视频无账号的回归入库）
 */
export function importVideos(
  rows: ImportVideoRow[],
  opts: {
    projectId?: string
    segment?: string
    /** 默认 true：缺账号则从视频 handle 建档 */
    ensureAccount?: boolean
    source?: AccountSource
  } = {}
) {
  const ensureAccount = opts.ensureAccount !== false
  let videoAdded = 0
  let videoUpdated = 0
  let accountBackfilled = 0
  const projectIds = new Set<string>()
  if (opts.projectId) projectIds.add(opts.projectId)

  rows.forEach((row) => {
    const handle = row.handle?.trim()
    const videoId = String(row.videoId || '').trim()
    if (!handle || !videoId) return
    const id = normalize(handle)

    let account = findAccount(handle)
    if (!account && ensureAccount) {
      upsertAccount({
        handle,
        projectId: opts.projectId || '',
        segment: opts.segment || '',
        link: `https://www.tiktok.com/@${stripHandle(handle)}`,
        source: opts.source || 'document',
        status: 'active',
        note: '由视频导入自动补录'
      })
      account = findAccount(handle)
      accountBackfilled++
    }
    if (!account) return

    if (opts.projectId && !account.projectId) {
      account.projectId = opts.projectId
      if (opts.projectId) projectIds.add(opts.projectId)
    }

    const incoming: TikTokAccountVideo = {
      videoId,
      videoUrl: row.videoUrl || `https://www.tiktok.com/@${stripHandle(handle)}/video/${videoId}`,
      handle: account.handle,
      description: row.description || '',
      publishDate: row.publishDate || '',
      views: row.views || 0,
      likes: row.likes || 0,
      comments: row.comments || 0,
      shares: row.shares || 0,
      engagementRate: 0,
      isAd: false
    }
    const prev = dojoAccountStore.videos[id] || []
    const had = prev.some((v) => v.videoId === videoId)
    dojoAccountStore.videos[id] = mergeVideoList(prev, [incoming])
    if (had) videoUpdated++
    else videoAdded++
  })

  persist()
  if (projectIds.size) {
    void import('@/store/dojoProjectMetrics').then(({ syncProjectCurrentFromLedger }) => {
      projectIds.forEach((pid) => syncProjectCurrentFromLedger(pid))
    })
  }

  return { videoAdded, videoUpdated, accountBackfilled }
}

export function isSyncing(handle: string) {
  const id = normalize(handle)
  return dojoAccountStore.syncing.includes(id)
}

/**
 * 同步单个账号：先取粉丝等档案，再拉全部作品。
 * 作品落在 videos 里，分发口径由 accountVideoRows 派生。
 */
export async function syncAccount(handle: string) {
  const account = findAccount(handle)
  if (!account) return null
  const id = normalize(handle)
  if (dojoAccountStore.syncing.includes(id)) return null

  dojoAccountStore.syncing.push(id)
  try {
    const snapshot = await syncTikTokAccount(account.handle)
    const result = await fetchAllAccountVideos(account.handle)

    account.nickname = snapshot.nickname
    account.followers = snapshot.followers
    account.following = snapshot.following
    account.totalVideos = snapshot.posts
    account.totalHearts = snapshot.likes
    account.region = snapshot.region
    account.verified = snapshot.verified
    account.isPrivate = snapshot.isPrivate
    account.lastSyncedAt = snapshot.syncedAt
    account.syncSource = result.source === 'rapidapi' ? 'rapidapi' : snapshot.source
    account.syncError = undefined

    // 与导入作品按 videoId 合并，避免 Rapid 同步冲掉手工导入的链接
    if (result.videos.length) {
      dojoAccountStore.videos[id] = mergeVideoList(dojoAccountStore.videos[id] || [], result.videos)
    }
    persist()
    // Rapid 作品 → 分发量 / 曝光量
    if (account.projectId) {
      void import('@/store/dojoProjectMetrics').then(({ syncProjectCurrentFromLedger }) => {
        syncProjectCurrentFromLedger(account.projectId)
      })
    }
    touchWorklog()
    return { snapshot, videos: result.videos }
  } catch (e) {
    account.syncError = e instanceof Error ? e.message : '同步失败'
    persist()
    return null
  } finally {
    dojoAccountStore.syncing = dojoAccountStore.syncing.filter((h) => h !== id)
  }
}

/** 逐个同步，避免并发把 RapidAPI 配额打满或触发限流 */
export async function syncAccounts(
  handles: string[],
  onProgress?: (done: number, total: number, handle: string) => void
) {
  let done = 0
  for (const handle of handles) {
    await syncAccount(handle)
    done++
    onProgress?.(done, handles.length, handle)
  }
  // 批量结束后再对账一次，合并项目级指标变化
  touchWorklog()
  return done
}

export function accountVideos(handle: string) {
  return dojoAccountStore.videos[normalize(handle)] || []
}

/** 同步回来的作品换算成分发口径，替代人工填的分发表 */
export const syncedVideoRows = computed(() => {
  const rows: Array<TikTokAccountVideo & { projectId: string; segment: string }> = []
  dojoAccountStore.accounts.forEach((a) => {
    accountVideos(a.handle).forEach((v) => {
      rows.push({ ...v, projectId: a.projectId, segment: a.segment })
    })
  })
  return rows
})

export const accountsByProject = computed(() => {
  const map = new Map<string, MatrixAccount[]>()
  dojoAccountStore.accounts.forEach((a) => {
    const list = map.get(a.projectId) || []
    list.push(a)
    map.set(a.projectId, list)
  })
  return map
})

export const accountStats = computed(() => {
  const list = dojoAccountStore.accounts
  const synced = list.filter((a) => a.lastSyncedAt)
  return {
    total: list.length,
    active: list.filter((a) => a.status === 'active').length,
    synced: synced.length,
    neverSynced: list.length - synced.length,
    followers: synced.reduce((s, a) => s + (a.followers || 0), 0),
    videos: syncedVideoRows.value.length,
    views: syncedVideoRows.value.reduce((s, v) => s + v.views, 0)
  }
})
