import { reactive } from 'vue'
import {
  collectByQueries,
  ProviderNotConfiguredError
} from '@/services/inspirationCollectionService'
import type { InspirationCandidate, InspirationSource } from '@/types/dojoInspiration'
import type {
  InspirationRankState,
  RankBoardKind,
  RankBoardPref,
  RankPost,
  RankQuery,
  RankQueryOrigin,
  VelocityWindowHours
} from '@/types/dojoInspirationRank'
import {
  appendSnapshot,
  breakoutBoard,
  clusterTopics,
  compactQueryKey,
  extractQueryCandidates,
  outlierBoard,
  queryNovelty,
  queryScore,
  RANK_BOARD_KINDS,
  RANK_BOARD_META,
  scorePosts,
  velocityBoard
} from '@/utils/dojoInspirationRank'
import { FALLBACK_OVERSEAS_SEEDS } from '@/utils/dojoInspirationSearchLocale'
import { resolveSearchQueries } from '@/utils/dojoInspirationQueries'
import { collectProjectOwnedTokens } from '@/utils/dojoInspirationTags'
import { loadTable, saveTable } from '@/utils/dojoPersist'
import { dojoProjectStore } from '@/store/dojoProjectStore'
import { dojoProjectRuntime } from '@/store/dojoProjectRuntime'

const TABLE = 'inspirationRank'
const MAX_POSTS = 600
const MAX_QUERIES = 64
const LOW_YIELD = 0.03

const persisted = loadTable<InspirationRankState>(TABLE)

function defaultBoardPrefs(): RankBoardPref[] {
  return RANK_BOARD_KINDS.map((kind) => ({
    kind,
    name: RANK_BOARD_META[kind].name,
    hint: RANK_BOARD_META[kind].hint,
    enabled: true,
    hidden: false
  }))
}

function mergeBoardPrefs(saved?: RankBoardPref[]): RankBoardPref[] {
  const map = new Map((saved || []).map((item) => [item.kind, item]))
  return defaultBoardPrefs().map((base) => {
    const hit = map.get(base.kind)
    const next = hit
      ? {
          kind: base.kind,
          name: hit.name?.trim() || base.name,
          hint: hit.hint?.trim() || base.hint,
          enabled: hit.enabled !== false,
          hidden: Boolean(hit.hidden)
        }
      : base
    // 群体趋势已下线：话题跟着检索词走，不再单独成榜
    if (base.kind === 'trend') {
      return { ...next, enabled: false, hidden: true }
    }
    return next
  })
}

export const dojoInspirationRankStore = reactive<
  InspirationRankState & { cycling: boolean; cycleMessage: string }
>({
  posts: persisted?.posts || [],
  queries: persisted?.queries || [],
  velocityWindowHours: persisted?.velocityWindowHours || 24,
  lastCycle: persisted?.lastCycle,
  boardPrefs: mergeBoardPrefs(persisted?.boardPrefs),
  cycling: false,
  cycleMessage: ''
})

function persist() {
  saveTable(TABLE, {
    posts: dojoInspirationRankStore.posts,
    queries: dojoInspirationRankStore.queries,
    velocityWindowHours: dojoInspirationRankStore.velocityWindowHours,
    lastCycle: dojoInspirationRankStore.lastCycle,
    boardPrefs: dojoInspirationRankStore.boardPrefs
  } satisfies InspirationRankState)
}

persist()

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function ownedTokens() {
  return collectProjectOwnedTokens(
    dojoProjectStore.projects.map((project) => ({
      name: project.name,
      aliases: project.aliases,
      brand: dojoProjectRuntime[project.id]?.brand
    }))
  )
}

export function setVelocityWindow(hours: VelocityWindowHours) {
  dojoInspirationRankStore.velocityWindowHours = hours
  persist()
}

export function patchRankBoardPref(
  kind: RankBoardKind,
  patch: Partial<Pick<RankBoardPref, 'name' | 'hint' | 'enabled' | 'hidden'>>
) {
  const pref = dojoInspirationRankStore.boardPrefs.find((item) => item.kind === kind)
  if (!pref) return
  if (patch.name !== undefined) pref.name = patch.name.trim() || RANK_BOARD_META[kind].name
  if (patch.hint !== undefined) pref.hint = patch.hint.trim() || RANK_BOARD_META[kind].hint
  if (patch.enabled !== undefined) pref.enabled = patch.enabled
  if (patch.hidden !== undefined) {
    pref.hidden = patch.hidden
    if (patch.hidden) pref.enabled = false
  }
  persist()
}

export function toggleRankBoardEnabled(kind: RankBoardKind) {
  const pref = dojoInspirationRankStore.boardPrefs.find((item) => item.kind === kind)
  if (!pref || pref.hidden) return
  pref.enabled = !pref.enabled
  persist()
}

export function hideRankBoard(kind: RankBoardKind) {
  patchRankBoardPref(kind, { hidden: true })
}

export function restoreRankBoard(kind: RankBoardKind) {
  patchRankBoardPref(kind, { hidden: false, enabled: true })
}

export function enabledRankBoardKinds() {
  return new Set(
    dojoInspirationRankStore.boardPrefs
      .filter((item) => !item.hidden && item.enabled)
      .map((item) => item.kind)
  )
}

export function addSeedQueries(texts: string[], origin: RankQueryOrigin = 'seed') {
  const resolved = texts
    .flatMap((text) => resolveSearchQueries(text, { expand: true }).queries)
    .filter(Boolean)
  let added = 0
  resolved.forEach((text) => {
    const key = compactQueryKey(text)
    const existing = dojoInspirationRankStore.queries.find(
      (item) => compactQueryKey(item.text) === key
    )
    if (existing) {
      if (existing.status === 'paused' && origin === 'seed') existing.status = 'active'
      return
    }
    if (dojoInspirationRankStore.queries.length >= MAX_QUERIES) return
    dojoInspirationRankStore.queries.push({
      id: createId('query'),
      text,
      origin,
      status: origin === 'seed' ? 'active' : 'exploring',
      createdAt: new Date().toISOString(),
      runCount: 0,
      resultCount: 0,
      boardHits: 0,
      yield: 0,
      score: origin === 'seed' ? 1 : 0.6,
      novelty: 1,
      lowYieldStreak: 0
    })
    added += 1
  })
  persist()
  return added
}

export function pauseRankQuery(queryId: string) {
  const query = dojoInspirationRankStore.queries.find((item) => item.id === queryId)
  if (!query) return
  query.status = query.status === 'paused' ? 'active' : 'paused'
  persist()
}

export function removeRankQuery(queryId: string) {
  dojoInspirationRankStore.queries = dojoInspirationRankStore.queries.filter(
    (item) => item.id !== queryId
  )
  persist()
}

export function ingestRankCandidates(candidates: InspirationCandidate[], querySource?: string) {
  const now = new Date().toISOString()
  candidates.forEach((candidate) => {
    const postId =
      String(candidate.rawPayload?.videoId || '') || candidate.id.replace(/^rapid-/, '')
    if (!postId) return
    const snapshot = {
      views: candidate.views,
      likes: candidate.likes,
      comments: candidate.comments,
      fetchedAt: candidate.collectedAt || now
    }
    const existing = dojoInspirationRankStore.posts.find((item) => item.postId === postId)
    const next: RankPost = {
      postId,
      creatorId: String(candidate.rawPayload?.creatorId || candidate.author || postId),
      creatorHandle: candidate.author,
      followers: Number(candidate.rawPayload?.followers || 0),
      caption: candidate.summary || candidate.title,
      title: candidate.title,
      hashtags: candidate.tags || [],
      publishTime: candidate.publishedAt,
      views: candidate.views,
      likes: candidate.likes,
      comments: candidate.comments,
      url: candidate.url,
      cover: String(candidate.rawPayload?.cover || ''),
      querySource: querySource || String(candidate.rawPayload?.sourceQuery || ''),
      fetchedAt: snapshot.fetchedAt,
      snapshots: existing?.snapshots || []
    }
    const merged = appendSnapshot(existing || next, snapshot)
    merged.creatorHandle = next.creatorHandle
    merged.caption = next.caption
    merged.title = next.title
    merged.hashtags = next.hashtags.length ? next.hashtags : merged.hashtags
    merged.url = next.url || merged.url
    merged.cover = next.cover || merged.cover
    merged.querySource = next.querySource || merged.querySource
    if (next.followers) merged.followers = next.followers
    if (next.publishTime) merged.publishTime = next.publishTime
    if (existing) {
      Object.assign(existing, merged)
    } else {
      dojoInspirationRankStore.posts.unshift(merged)
    }
  })
  if (dojoInspirationRankStore.posts.length > MAX_POSTS) {
    dojoInspirationRankStore.posts = dojoInspirationRankStore.posts
      .sort((left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt))
      .slice(0, MAX_POSTS)
  }
  persist()
}

export function rankedRows() {
  return scorePosts(dojoInspirationRankStore.posts, dojoInspirationRankStore.velocityWindowHours)
}

export function boardRows() {
  const rows = rankedRows()
  const topics = clusterTopics(rows, ownedTokens())
  return {
    outlier: outlierBoard(rows),
    velocity: velocityBoard(rows),
    breakout: breakoutBoard(rows),
    topics
  }
}

function rankSource(query: string): InspirationSource {
  return {
    id: `rank:${compactQueryKey(query)}`,
    name: query,
    platform: 'TikTok',
    kind: 'keyword',
    query,
    timeWindowDays: 7,
    ranking: 'hot',
    defaultLimit: 40,
    enabled: true,
    createdAt: new Date().toISOString()
  }
}

function pickQueries(limit: number) {
  const active = dojoInspirationRankStore.queries.filter((item) => item.status !== 'paused')
  return [...active]
    .sort((left, right) => right.score - left.score || right.novelty - left.novelty)
    .slice(0, limit)
}

function updateQueryYield(query: RankQuery, resultCount: number, boardHits: number) {
  const runYield = resultCount ? boardHits / resultCount : 0
  query.resultCount += resultCount
  query.boardHits += boardHits
  query.yield = query.resultCount ? query.boardHits / query.resultCount : 0
  query.novelty = queryNovelty(query.runCount)
  query.score = queryScore(query)
  if (runYield < LOW_YIELD) query.lowYieldStreak += 1
  else query.lowYieldStreak = 0
  if (query.lowYieldStreak >= 3) query.status = 'paused'
  else if (query.yield >= 0.12) query.status = 'active'
}

export async function runRankCycle(input?: { maxQueries?: number; limitPerQuery?: number }) {
  if (dojoInspirationRankStore.cycling) return dojoInspirationRankStore.lastCycle
  const maxQueries = input?.maxQueries || 8
  const limitPerQuery = input?.limitPerQuery || 40
  dojoInspirationRankStore.cycling = true
  dojoInspirationRankStore.cycleMessage = '正在按检索词池抓取'
  let ingested = 0
  let queriesRun = 0
  try {
    if (!pickQueries(maxQueries).length) {
      addSeedQueries(FALLBACK_OVERSEAS_SEEDS, 'seed')
    }
    const selected = pickQueries(maxQueries)
    if (!selected.length) {
      throw new Error('检索词池是空的。先加人工 Seed，或从一个检索方向带入独立词。')
    }
    const runCounts = new Map<string, number>()
    for (const query of selected) {
      dojoInspirationRankStore.cycleMessage = `正在搜「${query.text}」`
      const resolved = resolveSearchQueries(query.text)
      if (!resolved.primary) continue
      const result = await collectByQueries(
        { source: rankSource(resolved.primary), limit: limitPerQuery },
        [resolved.primary],
        resolved.hint
      )
      ingestRankCandidates(result.items, resolved.primary)
      ingested += result.items.length
      query.lastRunAt = new Date().toISOString()
      query.runCount += 1
      runCounts.set(query.id, result.items.length)
      queriesRun += 1
    }

    const boards = boardRows()
    const enabled = enabledRankBoardKinds()
    const boardPostIds = new Set([
      ...(enabled.has('outlier') ? boards.outlier.map((item) => item.post.postId) : []),
      ...(enabled.has('velocity') ? boards.velocity.map((item) => item.post.postId) : []),
      ...(enabled.has('breakout') ? boards.breakout.map((item) => item.post.postId) : [])
    ])
    selected.forEach((query) => {
      const hits = dojoInspirationRankStore.posts.filter(
        (post) =>
          compactQueryKey(post.querySource) === compactQueryKey(query.text) &&
          boardPostIds.has(post.postId)
      ).length
      updateQueryYield(query, runCounts.get(query.id) || 0, hits)
    })

    const extracted = extractQueryCandidates(
      [
        ...(enabled.has('outlier') ? boards.outlier : []),
        ...(enabled.has('velocity') ? boards.velocity : []),
        ...(enabled.has('breakout') ? boards.breakout : [])
      ],
      [],
      ownedTokens()
    )
    const newQueries = addSeedQueries(extracted, 'board')
    dojoInspirationRankStore.lastCycle = {
      ranAt: new Date().toISOString(),
      queriesRun,
      postsIngested: ingested,
      newQueries
    }
    persist()
    return dojoInspirationRankStore.lastCycle
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) throw error
    throw error
  } finally {
    dojoInspirationRankStore.cycling = false
    dojoInspirationRankStore.cycleMessage = ''
  }
}

export function rankedCandidate(post: RankPost): InspirationCandidate {
  return {
    id: `rapid-${post.postId}`,
    sourceId: `rank:${post.querySource || 'pool'}`,
    platform: 'TikTok',
    author: post.creatorHandle,
    title: post.title,
    summary: post.caption,
    url: post.url,
    publishedAt: post.publishTime,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    saves: 0,
    growthRate: 0,
    matchScore: 70,
    tags: post.hashtags,
    status: 'new',
    rawPayload: {
      videoId: post.postId,
      creatorId: post.creatorId,
      followers: post.followers,
      sourceQuery: post.querySource,
      cover: post.cover
    }
  }
}
