import { reactive } from 'vue'
import { fetchAllAccountVideos, stripHandle, syncTikTokAccount } from '@/api/tiktok'
import {
  inspirationHotBoardFixtures,
  LEGACY_HOT_BOARD_IDS
} from '@/mock/dojo/inspirationExploreFixtures'
import {
  accountVideoToCandidate,
  collectByQueries,
  ProviderNotConfiguredError
} from '@/services/inspirationCollectionService'
import {
  promoteCandidate,
  upsertInspirationCandidates
} from '@/store/dojoInspirationStore'
import type { InspirationCandidate, InspirationSource } from '@/types/dojoInspiration'
import type {
  BenchmarkSavedVideo,
  BenchmarkTier,
  HotBoardDayRecord,
  HotBoardWindow,
  InspirationBenchmarkAccount,
  InspirationExploreState,
  InspirationHotBoard
} from '@/types/dojoInspirationExplore'
import { ingestRankCandidates, addSeedQueries } from '@/store/dojoInspirationRankStore'
import { ingestDayKey } from '@/utils/dojoInspirationLayers'
import { resolveSearchQueries } from '@/utils/dojoInspirationQueries'
import { loadTable, saveTable } from '@/utils/dojoPersist'

const TABLE_EXPLORE = 'inspirationExplore'
const STALE_MS = 8 * 60 * 60 * 1000

const persisted = loadTable<InspirationExploreState>(TABLE_EXPLORE)

function remapLegacyBoardRecords<T>(records: Record<string, T> | undefined) {
  if (!records) return {} as Record<string, T>
  const next: Record<string, T> = {}
  for (const [id, value] of Object.entries(records)) {
    const targetId = LEGACY_HOT_BOARD_IDS[id] || id
    if (next[targetId] === undefined) next[targetId] = value
  }
  return next
}

export const dojoInspirationExplore = reactive({
  boards: mergeBoards(persisted?.boards),
  accounts: persisted?.accounts || [],
  boardItems: remapLegacyBoardRecords(persisted?.boardItems),
  accountVideos: persisted?.accountVideos || {},
  savedVideos: persisted?.savedVideos || [],
  boardHistory: remapLegacyBoardRecords(persisted?.boardHistory),
  refreshingBoardId: '',
  syncingAccountId: '',
  focusedAccountId: ''
})

function persist() {
  saveTable(TABLE_EXPLORE, {
    boards: dojoInspirationExplore.boards,
    accounts: dojoInspirationExplore.accounts,
    boardItems: dojoInspirationExplore.boardItems,
    accountVideos: dojoInspirationExplore.accountVideos,
    savedVideos: dojoInspirationExplore.savedVideos,
    boardHistory: dojoInspirationExplore.boardHistory
  } satisfies InspirationExploreState)
}

// 把默认榜写回本地，避免下次仍按旧「人工添加」结构读
persist()

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function mergeBoards(saved?: InspirationHotBoard[]) {
  const byId = new Map<string, InspirationHotBoard>()
  for (const board of saved || []) {
    const nextId = LEGACY_HOT_BOARD_IDS[board.id] || board.id
    const existing = byId.get(nextId)
    if (existing) continue
    byId.set(nextId, {
      ...board,
      id: nextId,
      limit: 10
    })
  }

  const presets = inspirationHotBoardFixtures.map((fixture) => {
    const existing = byId.get(fixture.id)
    byId.delete(fixture.id)
    if (!existing) {
      return {
        ...fixture,
        preset: true,
        collectEnabled: true,
        limit: 10
      }
    }
    return {
      ...existing,
      id: fixture.id,
      name: fixture.name,
      category: fixture.category,
      platform: fixture.platform,
      queries: fixture.queries,
      timeWindowDays: existing.timeWindowDays || fixture.timeWindowDays,
      limit: 10,
      preset: true,
      collectEnabled: existing.collectEnabled !== false,
      lastRefreshedAt: existing.lastRefreshedAt,
      message: existing.message
    }
  })

  // 自定义方向必须保留；和默认榜同名也照样留下，绝不能静默丢掉
  const custom = [...byId.values()].map((board) => ({
    ...board,
    preset: false,
    collectEnabled: board.collectEnabled !== false,
    limit: 10
  }))

  return [...presets, ...custom]
}

function boardSource(board: InspirationHotBoard): InspirationSource {
  return {
    id: `board:${board.id}`,
    name: board.name,
    platform: board.platform,
    kind: 'trend',
    query: board.queries.join('\n'),
    timeWindowDays: board.timeWindowDays,
    ranking: 'hot',
    defaultLimit: board.limit,
    enabled: true,
    createdAt: board.lastRefreshedAt || new Date().toISOString()
  }
}

function accountSource(account: InspirationBenchmarkAccount): InspirationSource {
  return {
    id: `bench:${account.id}`,
    name: account.handle,
    platform: 'TikTok',
    kind: 'account',
    query: account.handle,
    timeWindowDays: 90,
    ranking: 'hot',
    defaultLimit: 40,
    enabled: true,
    createdAt: account.lastSyncedAt || new Date().toISOString()
  }
}

export function isBoardStale(board: InspirationHotBoard) {
  if (!board.lastRefreshedAt) return true
  const stamp = Date.parse(board.lastRefreshedAt)
  if (!Number.isFinite(stamp)) return true
  return Date.now() - stamp > STALE_MS
}

export function createHotBoard(input: {
  name: string
  category?: string
  queries: string
  timeWindowDays: HotBoardWindow
}) {
  const resolved = resolveSearchQueries(input.queries, { expand: true })
  if (!resolved.queries.length) {
    throw new Error(resolved.hint || '请填写独立检索词，不要用项目名或品牌名凑数')
  }
  const board: InspirationHotBoard = {
    id: createId('board'),
    name: input.name.trim() || resolved.queries[0] || '未命名榜单',
    category: input.category?.trim() || '自定义',
    platform: 'TikTok',
    queries: resolved.queries,
    timeWindowDays: input.timeWindowDays,
    limit: 10,
    preset: false,
    collectEnabled: true
  }
  dojoInspirationExplore.boards.push(board)
  addSeedQueries(board.queries, 'seed')
  persist()
  return board
}

export function patchHotBoard(
  boardId: string,
  patch: Partial<
    Pick<
      InspirationHotBoard,
      'timeWindowDays' | 'limit' | 'name' | 'queries' | 'category' | 'collectEnabled'
    >
  >
) {
  const board = dojoInspirationExplore.boards.find((item) => item.id === boardId)
  if (!board) return null
  if (patch.timeWindowDays) board.timeWindowDays = patch.timeWindowDays
  if (patch.limit) board.limit = patch.limit
  if (patch.name) board.name = patch.name.trim()
  if (patch.category !== undefined) board.category = patch.category.trim() || '自定义'
  if (patch.queries?.length) board.queries = patch.queries
  if (patch.collectEnabled !== undefined) board.collectEnabled = patch.collectEnabled
  persist()
  return board
}

export function removeHotBoard(boardId: string) {
  const board = dojoInspirationExplore.boards.find((item) => item.id === boardId)
  if (!board) return false
  if (board.preset) return false
  dojoInspirationExplore.boards = dojoInspirationExplore.boards.filter((item) => item.id !== boardId)
  delete dojoInspirationExplore.boardItems[boardId]
  delete dojoInspirationExplore.boardHistory[boardId]
  persist()
  return true
}

export async function refreshHotBoard(boardId: string) {
  const board = dojoInspirationExplore.boards.find((item) => item.id === boardId)
  if (!board) return null
  dojoInspirationExplore.refreshingBoardId = boardId
  try {
    const resolved = resolveSearchQueries(board.queries.join('\n'), { expand: true })
    const result = await collectByQueries(
      {
        source: boardSource(board),
        limit: board.limit
      },
      resolved.queries,
      resolved.hint
    )
    const items = result.items.slice(0, 10).map((item, index) => ({
      ...item,
      sourceId: `board:${board.id}`,
      tags: [...new Set([board.category, ...item.tags])],
      rawPayload: {
        ...item.rawPayload,
        boardId: board.id,
        boardCategory: board.category,
        rank: index + 1
      }
    }))
    dojoInspirationExplore.boardItems[board.id] = items
    recordBoardHistory(board.id, items)
    upsertInspirationCandidates(items)
    ingestRankCandidates(items, board.queries[0])
    board.lastRefreshedAt = new Date().toISOString()
    board.message =
      result.searchQuery && result.searchQuery !== board.queries[0]
        ? `TikTok 搜「${result.searchQuery}」，近 ${board.timeWindowDays} 天排出前 ${items.length} 名`
        : resolved.hint ||
          `按「${board.queries.join(' / ')}」近 ${board.timeWindowDays} 天热度排出前 ${items.length} 名`
    persist()
    return items
  } catch (error) {
    board.message =
      error instanceof ProviderNotConfiguredError
        ? error.message
        : error instanceof Error
          ? error.message
          : '榜单更新失败'
    persist()
    throw error
  } finally {
    dojoInspirationExplore.refreshingBoardId = ''
  }
}

function recordBoardHistory(boardId: string, items: InspirationCandidate[]) {
  const capturedAt = new Date().toISOString()
  const snapshot: HotBoardDayRecord = {
    dayKey: ingestDayKey(capturedAt),
    capturedAt,
    items
  }
  const previous = dojoInspirationExplore.boardHistory[boardId] || []
  dojoInspirationExplore.boardHistory[boardId] = [
    snapshot,
    ...previous.filter((item) => item.dayKey !== snapshot.dayKey)
  ].slice(0, 7)
}

export function boardHistoryDays(boardId: string) {
  return dojoInspirationExplore.boardHistory[boardId] || []
}

export async function refreshEnabledBoards() {
  const enabled = dojoInspirationExplore.boards.filter((board) => board.collectEnabled !== false)
  for (const board of enabled) {
    try {
      await refreshHotBoard(board.id)
    } catch {
      /* 单个失败不打断其余榜单 */
    }
  }
}

export async function refreshStaleBoards() {
  const stale = dojoInspirationExplore.boards.filter(
    (board) => board.collectEnabled !== false && isBoardStale(board)
  )
  for (const board of stale) {
    try {
      await refreshHotBoard(board.id)
    } catch {
      /* 单个失败不打断其余榜单 */
    }
  }
}

export function addBenchmarkAccount(input: {
  handle: string
  tier?: BenchmarkTier
  market?: string
  note?: string
}) {
  const handle = `@${stripHandle(input.handle)}`
  if (!/^@[A-Za-z0-9._]{2,24}$/.test(handle)) return null
  const existing = dojoInspirationExplore.accounts.find(
    (item) => item.handle.toLowerCase() === handle.toLowerCase()
  )
  if (existing) return existing
  const account: InspirationBenchmarkAccount = {
    id: createId('bench'),
    handle,
    tier: input.tier || 'core',
    market: input.market?.trim() || undefined,
    note: input.note?.trim() || undefined
  }
  dojoInspirationExplore.accounts.unshift(account)
  persist()
  return account
}

export function patchBenchmarkAccount(
  accountId: string,
  patch: Partial<Pick<InspirationBenchmarkAccount, 'tier' | 'market' | 'note' | 'nickname'>>
) {
  const account = dojoInspirationExplore.accounts.find((item) => item.id === accountId)
  if (!account) return null
  if (patch.tier) account.tier = patch.tier
  if (patch.market !== undefined) account.market = patch.market.trim() || undefined
  if (patch.note !== undefined) account.note = patch.note.trim() || undefined
  if (patch.nickname !== undefined) account.nickname = patch.nickname.trim() || undefined
  persist()
  return account
}

export function removeBenchmarkAccount(accountId: string) {
  dojoInspirationExplore.accounts = dojoInspirationExplore.accounts.filter(
    (item) => item.id !== accountId
  )
  delete dojoInspirationExplore.accountVideos[accountId]
  persist()
}

export async function syncBenchmarkAccount(accountId: string) {
  const account = dojoInspirationExplore.accounts.find((item) => item.id === accountId)
  if (!account) return null
  dojoInspirationExplore.syncingAccountId = accountId
  try {
    const [profile, videos] = await Promise.all([
      syncTikTokAccount(account.handle),
      fetchAllAccountVideos(account.handle, 3)
    ])
    const items = videos.videos.map((video) =>
      accountVideoToCandidate(video, accountSource(account))
    )
    dojoInspirationExplore.accountVideos[account.id] = items
    upsertInspirationCandidates(items)
    account.nickname = profile.nickname || account.nickname
    account.followers = profile.followers
    account.videoCount = items.length
    account.lastSyncedAt = new Date().toISOString()
    account.message =
      videos.source === 'mock'
        ? '接口未回真实作品，当前是占位数据'
        : `已同步 ${items.length} 条作品`
    persist()
    return items
  } catch (error) {
    account.message = error instanceof Error ? error.message : '同步失败'
    persist()
    throw error
  } finally {
    dojoInspirationExplore.syncingAccountId = ''
  }
}

export function promoteExploreCandidate(candidate: InspirationCandidate) {
  upsertInspirationCandidates([candidate])
  return promoteCandidate(candidate.id)
}

export function boardCandidates(boardId: string) {
  return dojoInspirationExplore.boardItems[boardId] || []
}

export function accountCandidates(accountId: string) {
  return dojoInspirationExplore.accountVideos[accountId] || []
}

export function focusBenchmarkAccount(accountId: string) {
  dojoInspirationExplore.focusedAccountId = accountId
}

export function savedVideoOf(candidateId: string) {
  return dojoInspirationExplore.savedVideos.find((item) => item.candidateId === candidateId) || null
}

export function accountSavedVideos(accountId: string) {
  return dojoInspirationExplore.savedVideos.filter((item) => item.accountId === accountId)
}

export function saveBenchmarkVideo(
  candidate: InspirationCandidate,
  account: InspirationBenchmarkAccount,
  input?: Partial<Pick<BenchmarkSavedVideo, 'category' | 'scriptDirection' | 'tags' | 'note'>>
) {
  const existing = savedVideoOf(candidate.id)
  if (existing) return existing
  const saved: BenchmarkSavedVideo = {
    id: createId('saved'),
    accountId: account.id,
    handle: account.handle,
    candidateId: candidate.id,
    title: candidate.title,
    url: candidate.url,
    cover: String(candidate.rawPayload?.cover || ''),
    publishedAt: candidate.publishedAt,
    views: candidate.views,
    likes: candidate.likes,
    comments: candidate.comments,
    category: input?.category || candidate.tags[0] || '未分类',
    scriptDirection: input?.scriptDirection || '未指定',
    tags: input?.tags || [...candidate.tags],
    note: input?.note,
    savedAt: new Date().toISOString()
  }
  dojoInspirationExplore.savedVideos.unshift(saved)
  persist()
  return saved
}

export function unsaveBenchmarkVideo(candidateId: string) {
  dojoInspirationExplore.savedVideos = dojoInspirationExplore.savedVideos.filter(
    (item) => item.candidateId !== candidateId
  )
  persist()
}

export function patchBenchmarkSavedVideo(
  savedId: string,
  patch: Partial<Pick<BenchmarkSavedVideo, 'category' | 'scriptDirection' | 'tags' | 'note'>>
) {
  const saved = dojoInspirationExplore.savedVideos.find((item) => item.id === savedId)
  if (!saved) return null
  if (patch.category !== undefined) saved.category = patch.category
  if (patch.scriptDirection !== undefined) saved.scriptDirection = patch.scriptDirection
  if (patch.tags) saved.tags = patch.tags
  if (patch.note !== undefined) saved.note = patch.note
  persist()
  return saved
}

export function addBenchmarkAccountFromInspiration(input: {
  handle: string
  note?: string
}) {
  const account = addBenchmarkAccount({
    handle: input.handle,
    tier: 'watch',
    note: input.note || '从灵感库加入'
  })
  if (account) focusBenchmarkAccount(account.id)
  return account
}
