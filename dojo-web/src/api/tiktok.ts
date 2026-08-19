export interface TikTokAccountSnapshot {
  handle: string
  followers: number
  following?: number
  likes?: number
  posts?: number
  nickname?: string
  region?: string
  verified?: boolean
  bioLink?: string
  isPrivate?: boolean
  syncedAt: string
  source: 'rapidapi'
}

/** 账号名下的单条视频（RapidAPI /user/videos 返回，无需事先知道视频链接） */
export interface TikTokAccountVideo {
  videoId: string
  videoUrl: string
  handle: string
  description: string
  publishDate: string
  views: number
  likes: number
  comments: number
  shares: number
  engagementRate: number
  duration?: number
  cover?: string
  isAd: boolean
}

export interface TikTokAccountVideosResult {
  handle: string
  videos: TikTokAccountVideo[]
  /** RapidAPI 翻页游标，为空表示已到底 */
  continuationToken?: string
  /** empty 表示接口通了但这个号没有作品，跟「没查成」是两回事 */
  source: 'rapidapi' | 'empty'
}

export interface TikTokVideoMetrics {
  videoUrl: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  engagementRate?: number
  retention3s?: number
  syncedAt: string
  source: 'rapidapi'
}

const DOJO_API = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'

/**
 * RapidAPI 一律走代理，浏览器里不再持有密钥。
 *
 * dev 由 vite 注入，生产由 nginx 注入（见 deploy/nginx-dojo.conf.template）。
 * 之前是从 VITE_RAPIDAPI_KEY 读出来塞进请求头的，那个值会被打进产物，
 * 任何人打开控制台就能拿走。
 */
const RAPID_PROXY = '/api/rapidapi'

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

/** 同步失败。上游有多种失败方式，调用方需要区分是没配好还是这个号本身有问题。 */
export class TikTokSyncError extends Error {
  constructor(
    message: string,
    readonly handle: string
  ) {
    super(message)
    this.name = 'TikTokSyncError'
  }
}

async function rapidGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${RAPID_PROXY}${path}`, {
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

/** RapidAPI 通用搜索（程序侧查询入口） */
export async function rapidSearch(query: string, cursor = 0) {
  const res = await fetch(`${RAPID_PROXY}/search/general/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, cursor, sort_type: '0' })
  })
  if (!res.ok) return null
  return res.json()
}

export function stripHandle(handle: string) {
  const value = handle.trim()
  const urlMatch = value.match(
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,24})/i
  )
  if (urlMatch?.[1]) return urlMatch[1]

  const plain = value.replace(/^@/, '')
  const handleMatch = plain.match(/^([A-Za-z0-9._]{2,24})/)
  return handleMatch?.[1] || plain
}

export function extractAccountHandle(author?: string, url?: string) {
  const fromUrl = url ? stripHandle(url) : ''
  if (fromUrl && /^[A-Za-z0-9._]{2,24}$/.test(fromUrl) && /tiktok\.com/i.test(url || '')) {
    return fromUrl
  }
  const fromAuthor = author ? stripHandle(author) : ''
  if (fromAuthor && /^[A-Za-z0-9._]{2,24}$/.test(fromAuthor)) return fromAuthor
  return ''
}

interface RapidUserDetails {
  username?: string
  nickname?: string
  followers?: number
  following?: number
  total_videos?: number
  total_heart?: number
  region?: string
  verified?: boolean
  bio_link?: string
  is_private?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number >= 0) return number
  }
  return undefined
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

/** 兼容 Rapid / 嵌套 user / stats / follower_count 等字段别名 */
function normalizeUserDetails(payload: unknown, fallbackHandle: string): TikTokAccountSnapshot | null {
  const root = asRecord(payload)
  if (!root) return null
  const data = asRecord(root.data) || root
  const user = asRecord(data.user) || asRecord(data.userInfo) || asRecord(data.user_info) || data
  const stats =
    asRecord(user.stats) ||
    asRecord(user.statistics) ||
    asRecord(data.stats) ||
    asRecord(data.statistics) ||
    user

  const username = pickString(
    user.username,
    user.unique_id,
    user.uniqueId,
    data.username,
    root.username
  )
  const followers = pickNumber(
    user.followers,
    stats.followers,
    stats.follower_count,
    stats.followerCount,
    user.follower_count,
    user.followerCount,
    data.followers,
    data.follower_count
  )
  if (followers === undefined) return null

  const handle = username ? `@${username.replace(/^@/, '')}` : `@${fallbackHandle.replace(/^@/, '')}`
  return {
    handle,
    followers,
    following: pickNumber(
      user.following,
      stats.following,
      stats.following_count,
      stats.followingCount,
      user.following_count
    ),
    likes: pickNumber(
      user.total_heart,
      user.likes,
      stats.heart_count,
      stats.heartCount,
      stats.total_heart,
      stats.likes_count,
      user.likes_count
    ),
    posts: pickNumber(
      user.total_videos,
      user.video_count,
      stats.video_count,
      stats.videoCount,
      user.videoCount
    ),
    nickname: pickString(user.nickname, user.display_name, user.displayName, data.nickname),
    region: pickString(user.region, data.region),
    verified: Boolean(user.verified ?? user.is_verified ?? data.verified),
    bioLink: pickString(user.bio_link, user.bioLink, user.bio_url),
    isPrivate: Boolean(user.is_private ?? user.private_account ?? user.isPrivate),
    syncedAt: nowStamp(),
    source: 'rapidapi'
  }
}

function isValidSnapshot(snapshot: TikTokAccountSnapshot | null | undefined): snapshot is TikTokAccountSnapshot {
  return Boolean(
    snapshot &&
      Number.isFinite(snapshot.followers) &&
      snapshot.followers >= 0 &&
      snapshot.handle
  )
}

interface RapidUserVideo {
  video_id?: string
  description?: string
  create_time?: number
  author?: string
  duration?: number
  cover?: string
  is_ad?: boolean
  statistics?: {
    number_of_plays?: number
    number_of_hearts?: number
    number_of_comments?: number
    number_of_reposts?: number
  }
}

interface RapidUserVideosResponse {
  username?: string
  continuation_token?: string
  videos?: RapidUserVideo[]
}

/**
 * 拉取账号名下的视频列表。
 *
 * 这是「有账号就有数据」的关键：不需要先攒视频链接，给一个用户名即可拿到
 * 全部作品与播放/互动，分发记录因此可以自动生成而不靠人工填表。
 */
export async function fetchAccountVideos(
  handle: string,
  continuationToken?: string
): Promise<TikTokAccountVideosResult> {
  const clean = stripHandle(handle)
  const query = continuationToken
    ? `/user/videos?username=${encodeURIComponent(clean)}&continuation_token=${encodeURIComponent(continuationToken)}`
    : `/user/videos?username=${encodeURIComponent(clean)}`

  const data = await rapidGet<RapidUserVideosResponse>(query)
  if (!data?.videos?.length) {
    return { handle: `@${clean}`, videos: [], source: 'empty' }
  }

  const videos = data.videos.map((v) => {
    const author = v.author || clean
    const plays = v.statistics?.number_of_plays ?? 0
    const likes = v.statistics?.number_of_hearts ?? 0
    const comments = v.statistics?.number_of_comments ?? 0
    const shares = v.statistics?.number_of_reposts ?? 0
    return {
      videoId: v.video_id || '',
      videoUrl: `https://www.tiktok.com/@${author}/video/${v.video_id}`,
      handle: `@${author}`,
      description: v.description || '',
      publishDate: v.create_time ? new Date(v.create_time * 1000).toISOString().slice(0, 10) : '',
      views: plays,
      likes,
      comments,
      shares,
      engagementRate: plays > 0 ? (likes + comments + shares) / plays : 0,
      duration: v.duration,
      cover: v.cover,
      isAd: Boolean(v.is_ad)
    }
  })

  return {
    handle: `@${clean}`,
    videos,
    continuationToken: data.continuation_token,
    source: 'rapidapi'
  }
}

/** 翻页拉完一个账号的全部视频，maxPages 兜住异常游标导致的死循环 */
export async function fetchAllAccountVideos(handle: string, maxPages = 10) {
  const all: TikTokAccountVideo[] = []
  let token: string | undefined
  let source: 'rapidapi' | 'empty' = 'empty'

  for (let page = 0; page < maxPages; page++) {
    const res = await fetchAccountVideos(handle, token)
    if (res.source === 'rapidapi') source = 'rapidapi'
    if (!res.videos.length) break
    const seen = new Set(all.map((v) => v.videoId))
    all.push(...res.videos.filter((v) => !seen.has(v.videoId)))
    if (!res.continuationToken || res.continuationToken === token) break
    token = res.continuationToken
  }

  return { handle: `@${stripHandle(handle)}`, videos: all, source }
}

/**
 * 拉账号现状。
 *
 * 拿不到就抛错，不返回估算值。老版本在这里用 handle 的 hash 拼过一个粉丝数，
 * 界面上看不出真假，运营照着那个数判断过账号表现——这种兜底比直接报错有害得多。
 */
export async function syncTikTokAccount(handle: string): Promise<TikTokAccountSnapshot> {
  const clean = stripHandle(handle)

  // 服务端优先：它持有密钥，也会把这次同步记进 sync_runs
  try {
    const res = await fetch(`${DOJO_API}/tiktok/account/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: clean })
    })
    if (res.ok) {
      const normalized = normalizeUserDetails(await res.json(), clean)
      if (isValidSnapshot(normalized)) return normalized
    }
  } catch {
    /* 后端没起就退到代理直查 */
  }

  // 按用户名精确查，比搜索里猜作者可靠
  const detail = await rapidGet<RapidUserDetails | Record<string, unknown>>(
    `/user/details?username=${encodeURIComponent(clean)}`
  ).catch(() => null)

  const normalized = normalizeUserDetails(detail, clean)
  if (isValidSnapshot(normalized)) return normalized

  throw new TikTokSyncError(
    `没拿到 @${clean} 的粉丝数，可能是私密号、已改名，或接口配额用完了`,
    clean
  )
}

/** 拉单条视频的播放/互动。拿不到返回 null，调用方保留原值。 */
export async function syncVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics | null> {
  if (!videoUrl) return null

  try {
    const res = await fetch(`${DOJO_API}/tiktok/video/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl })
    })
    if (!res.ok) return null
    const data = (await res.json()) as TikTokVideoMetrics
    return { ...data, source: 'rapidapi' }
  } catch {
    return null
  }
}
