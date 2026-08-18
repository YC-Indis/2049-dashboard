import { fetchAllAccountVideos, type TikTokAccountVideo } from '@/api/tiktok'
import type { InspirationCandidate, InspirationSource } from '@/types/dojoInspiration'
import { adaptQueriesForTikTok, looksLikeAd, pickTopMatches, suggestAssociateQueries } from '@/services/inspirationSearchAdapt'
import { freshnessScore, heatScore, trendScore } from '@/utils/dojoInspirationRanking'
import { resolveSearchQueries, sourceSearchText } from '@/utils/dojoInspirationQueries'

export interface CollectionRequest {
  source: InspirationSource
  limit: number
}

export interface CollectionResult {
  items: InspirationCandidate[]
  provider: 'rapidapi'
  rawFetched: number
  filteredOut: number
  searchQuery: string
}

export interface InspirationCollectionService {
  collect(request: CollectionRequest): Promise<CollectionResult>
}

interface SearchPage {
  items: Record<string, unknown>[]
  nextCursor: number | null
}

export class ProviderNotConfiguredError extends Error {
  constructor(message = 'TikTok / RapidAPI 尚未配置。') {
    super(message)
    this.name = 'ProviderNotConfiguredError'
  }
}

export const inspirationCollectionService: InspirationCollectionService = {
  async collect(request) {
    if (request.source.kind === 'account') {
      return collectFromAccount(request)
    }
    if (request.source.kind === 'local-import') {
      throw new Error('这条是本地规划线索，不会拿去检索。请新建一条只填独立检索词的线索。')
    }
    const expand = request.source.kind === 'trend'
    const resolved = resolveSearchQueries(sourceSearchText(request.source), { expand })
    const queries = expand ? resolved.queries.slice(0, 4) : resolved.primary ? [resolved.primary] : []
    if (!queries.length) {
      throw new Error(
        resolved.hint ||
          '没有可用的独立检索词。线索名称、项目名、品牌名都不会自动带上，请只填要搜的那个词。'
      )
    }
    return collectByQueries(request, queries, resolved.hint)
  }
}

export async function collectByQueries(
  request: CollectionRequest,
  queries: string[],
  hint?: string
): Promise<CollectionResult> {
  const limit = Math.min(100, Math.max(1, request.limit))
  const adapted = await adaptQueriesForTikTok(queries)
  const primaryList = adapted.length ? adapted : queries.filter(Boolean)
  const primary = primaryList[0] || ''
  if (!primary) {
    return {
      provider: 'rapidapi',
      items: [],
      rawFetched: 0,
      filteredOut: 0,
      searchQuery: hint || ''
    }
  }

  const seenIds = new Set<string>()
  const records: Array<{ record: Record<string, unknown>; query: string }> = []
  const usedTerms: string[] = []

  // 一词一搜：先主词，不够再用备用词；仍不够才 AI 联想。绝不把一串词捆成一次搜。
  const queue = [primary, ...primaryList.slice(1)]
  let aiTried = false

  while (queue.length) {
    const term = queue.shift()
    if (!term || usedTerms.some((item) => item.toLowerCase() === term.toLowerCase())) continue
    usedTerms.push(term)
    const pageSize = Math.min(80, Math.max(24, limit * 3))
    const pageRecords = await fetchSearchRecords(term, pageSize)
    pageRecords.forEach((record) => {
      const id = videoId(record)
      if (!id || seenIds.has(id)) return
      seenIds.add(id)
      records.push({ record, query: term })
    })

    const enough = countUsableCandidates(records, request, limit) >= limit
    if (enough) break

    if (!queue.length && !aiTried && records.length < Math.max(4, Math.ceil(limit / 2))) {
      aiTried = true
      const associates = await suggestAssociateQueries(primary)
      associates.forEach((item) => queue.push(item))
    }
  }

  const windowDays = request.source.timeWindowDays ?? 90
  let scoped = records
    .map(({ record, query }) => toCandidate(record, request.source, query))
    .sort((left, right) => (right.trendScore || 0) - (left.trendScore || 0))

  const inWindow = scoped.filter((candidate) => isInsideTimeWindow(candidate, windowDays))
  // 近窗不够数时放宽，避免榜单只剩一两天
  if (inWindow.length >= Math.min(limit, 5)) scoped = inWindow

  const withoutAds = scoped.filter((candidate) => !looksLikeAd(candidate))
  if (withoutAds.length) scoped = withoutAds

  const items = await pickTopMatches(primary, scoped, limit)
  const searchLabel =
    usedTerms.length > 1 ? `${primary}（备用 ${usedTerms.slice(1).join(' / ')}）` : primary
  return {
    provider: 'rapidapi',
    items,
    rawFetched: records.length,
    filteredOut: Math.max(0, records.length - items.length),
    searchQuery: searchLabel || hint || ''
  }
}

function countUsableCandidates(
  records: Array<{ record: Record<string, unknown>; query: string }>,
  request: CollectionRequest,
  limit: number
) {
  const windowDays = request.source.timeWindowDays ?? 90
  const scoped = records.map(({ record, query }) => toCandidate(record, request.source, query))
  const inWindow = scoped.filter((candidate) => isInsideTimeWindow(candidate, windowDays))
  const base = inWindow.length >= Math.min(limit, 5) ? inWindow : scoped
  return base.filter((candidate) => !looksLikeAd(candidate)).length || base.length
}

async function collectFromAccount(request: CollectionRequest): Promise<CollectionResult> {
  const handle = request.source.query.trim() || request.source.name
  const result = await fetchAllAccountVideos(handle, 4)
  const windowDays = request.source.timeWindowDays ?? 90
  let items = result.videos.map((video) => accountVideoToCandidate(video, request.source))
  const inWindow = items.filter((candidate) => isInsideTimeWindow(candidate, windowDays))
  if (inWindow.length) items = inWindow
  items = items
    .sort((left, right) => (right.trendScore || 0) - (left.trendScore || 0))
    .slice(0, Math.min(100, Math.max(1, request.limit)))
  return {
    provider: 'rapidapi',
    items,
    rawFetched: result.videos.length,
    filteredOut: Math.max(0, result.videos.length - items.length),
    searchQuery: handle
  }
}

export function accountVideoToCandidate(
  video: TikTokAccountVideo,
  source: InspirationSource
): InspirationCandidate {
  const heat = heatScore(video.views, video.likes, video.comments, 0)
  const freshness = freshnessScore(video.publishDate)
  return {
    id: `rapid-${video.videoId || video.videoUrl}`,
    sourceId: source.id,
    platform: 'TikTok',
    author: video.handle.startsWith('@') ? video.handle : `@${video.handle}`,
    title: video.description || '未命名 TikTok 视频',
    summary: video.description || '',
    url: video.videoUrl,
    publishedAt: video.publishDate,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    saves: 0,
    growthRate: 0,
    matchScore: 70,
    heatScore: heat,
    freshnessScore: freshness,
    trendScore: trendScore(heat, freshness, 70, source.ranking || 'hot'),
    tags: video.description.match(/#[\p{L}\p{N}_]+/gu)?.map((tag) => tag.slice(1)) || [],
    status: 'new',
    rawPayload: {
      provider: 'rapidapi',
      videoId: video.videoId,
      cover: video.cover,
      sourceQuery: source.query
    }
  }
}

async function fetchSearchRecords(query: string, targetRecords: number) {
  const records: Record<string, unknown>[] = []
  const seenIds = new Set<string>()
  let cursor = 0
  let emptyStreak = 0

  for (let page = 0; page < 8 && records.length < targetRecords; page += 1) {
    const result = await searchPage(query, cursor)
    let added = 0
    result.items.forEach((item) => {
      const id = videoId(item)
      if (!id || seenIds.has(id)) return
      seenIds.add(id)
      records.push(item)
      added += 1
    })

    if (!added) emptyStreak += 1
    else emptyStreak = 0

    if (result.nextCursor === null || result.nextCursor === cursor) break
    if (emptyStreak >= 3) break
    cursor = result.nextCursor
  }

  return records
}

async function searchPage(query: string, cursor: number): Promise<SearchPage> {
  const general = await postSearch('/api/local/tiktok/search', query, cursor)
  if (general.items.length) return general
  const videos = await postSearch('/api/local/tiktok/search-videos', query, cursor)
  if (videos.items.length) return videos
  return general.items.length || general.nextCursor !== null ? general : videos
}

async function postSearch(path: string, query: string, cursor: number): Promise<SearchPage> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, cursor, sort_type: '0' })
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message = stringValue(payload.error) || `TikTok 检索失败（${response.status}）`
    if (response.status === 503) throw new ProviderNotConfiguredError(message)
    // 备用端点不存在时不要把整次采集打挂
    if (response.status === 404) return { items: [], nextCursor: null }
    throw new Error(message)
  }

  const data = recordValue(payload.data)
  return {
    items: findVideoArray(payload),
    nextCursor: numberOrNull(
      data?.next_cursor ?? data?.cursor ?? payload.next_cursor ?? payload.cursor
    )
  }
}

function findVideoArray(payload: Record<string, unknown>) {
  const data = recordValue(payload.data)
  const nestedData = recordValue(data?.data)
  const candidates = [
    payload.items,
    payload.videos,
    payload.aweme_list,
    data?.items,
    data?.videos,
    data?.aweme_list,
    data?.data,
    nestedData?.items,
    nestedData?.videos,
    nestedData?.aweme_list
  ]
  const list = candidates.find((value) => Array.isArray(value))
  return Array.isArray(list)
    ? list.filter((item): item is Record<string, unknown> => Boolean(recordValue(item)))
    : []
}

function toCandidate(
  record: Record<string, unknown>,
  source: InspirationSource,
  searchQuery: string
) {
  const author = recordValue(record.author) || recordValue(record.author_info)
  const stats =
    recordValue(record.statistics) || recordValue(record.stats) || recordValue(record.stats_info)
  const id = videoId(record)
  const authorHandle =
    stringValue(author?.unique_id) ||
    stringValue(author?.uniqueId) ||
    stringValue(author?.nickname) ||
    stringValue(record.author) ||
    stringValue(record.author_name) ||
    '未知作者'
  const creatorId =
    stringValue(author?.uid) ||
    stringValue(author?.id) ||
    stringValue(author?.sec_uid) ||
    stringValue(author?.unique_id) ||
    authorHandle
  const followers = numberValue(
    author?.follower_count ??
      author?.followerCount ??
      author?.followers ??
      record.follower_count ??
      record.followers
  )
  const description =
    stringValue(record.desc) ||
    stringValue(record.description) ||
    stringValue(record.title) ||
    '未命名 TikTok 视频'
  const views = numberValue(
    stats?.play_count ?? stats?.playCount ?? stats?.number_of_plays ?? record.play_count
  )
  const likes = numberValue(
    stats?.digg_count ?? stats?.diggCount ?? stats?.number_of_hearts ?? record.digg_count
  )
  const comments = numberValue(
    stats?.comment_count ?? stats?.commentCount ?? stats?.number_of_comments ?? record.comment_count
  )
  const saves = numberValue(
    stats?.collect_count ?? stats?.collectCount ?? stats?.number_of_saves ?? record.collect_count
  )
  const hashtags = description.match(/#[\p{L}\p{N}_]+/gu)?.map((tag) => tag.slice(1)) || []
  const publishedAt = timestampToIso(record.create_time ?? record.createTime)
  const url =
    stringValue(record.share_url) ||
    stringValue(record.url) ||
    (authorHandle !== '未知作者' && id
      ? `https://www.tiktok.com/@${authorHandle.replace(/^@/, '')}/video/${id}`
      : '')
  const relevance = relevanceScore(description, searchQuery)
  const heat = heatScore(views, likes, comments, saves)
  const freshness = freshnessScore(publishedAt)
  return {
    id: `rapid-${id}`,
    sourceId: source.id,
    platform: 'TikTok' as const,
    author: authorHandle.startsWith('@') ? authorHandle : `@${authorHandle}`,
    title: description,
    summary: description,
    url,
    publishedAt,
    views,
    likes,
    comments,
    saves,
    growthRate: 0,
    matchScore: relevance,
    heatScore: heat,
    freshnessScore: freshness,
    trendScore: trendScore(heat, freshness, relevance, source.ranking || 'balanced'),
    tags: hashtags,
    status: 'new' as const,
    rawPayload: {
      provider: 'rapidapi',
      videoId: id,
      creatorId,
      followers,
      sourceQuery: searchQuery,
      isAd: Boolean(record.is_ad || record.isAd || record.is_ads),
      cover: stringValue(record.cover),
      previewUrl: stringValue(record.unwatermarked_download_url) || stringValue(record.download_url)
    }
  }
}

function queryTokens(query: string) {
  return query
    .toLowerCase()
    .split(/[\n,，#]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
}

function isInsideTimeWindow(candidate: InspirationCandidate, days: number) {
  if (!days || !candidate.publishedAt) return true
  const published = Date.parse(candidate.publishedAt)
  if (!Number.isFinite(published)) return true
  return Date.now() - published <= days * 24 * 60 * 60 * 1000
}

function relevanceScore(description: string, primary: string) {
  const main = queryTokens(primary)
  if (!main.length) return 50
  const text = description.toLowerCase()
  let score = 0
  main.forEach((token) => {
    if (tokenHits(text, token)) score += 55
  })
  return Math.min(100, Math.max(30, score || 30))
}

function tokenHits(text: string, token: string) {
  const parts = token.split(/\s+/).filter((part) => part.length > 1)
  return (
    text.includes(token) ||
    (parts.length > 1 && parts.some((part) => text.includes(part))) ||
    compact(text).includes(compact(token))
  )
}

function compact(value: string) {
  return value.replace(/[\s_-]+/g, '')
}

function videoId(record: Record<string, unknown>) {
  return (
    stringValue(record.aweme_id) ||
    stringValue(record.video_id) ||
    stringValue(record.id) ||
    stringValue(record.item_id)
  )
}

function timestampToIso(value: unknown) {
  const timestamp = numberValue(value)
  if (!timestamp) return ''
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  return new Date(milliseconds).toISOString()
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
