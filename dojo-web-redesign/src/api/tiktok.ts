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
  source: 'rapidapi' | 'mock'
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
  source: 'rapidapi' | 'mock'
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
  source: 'rapidapi' | 'mock'
}

const DOJO_API = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'
const RAPID_KEY = import.meta.env.VITE_RAPIDAPI_KEY as string | undefined
const RAPID_HOST = (import.meta.env.VITE_RAPIDAPI_HOST as string) || 'tiktok-api6.p.rapidapi.com'

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function hashCode(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/** dev 走 vite 代理避开 CORS；生产直连，需带 key */
function useProxy() {
  return import.meta.env.DEV || import.meta.env.VITE_RAPIDAPI_PROXY === 'true'
}

function rapidUrl(path: string) {
  return useProxy() ? `/api/rapidapi${path}` : `https://${RAPID_HOST}${path}`
}

function rapidHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (RAPID_KEY) {
    headers['x-rapidapi-host'] = RAPID_HOST
    headers['x-rapidapi-key'] = RAPID_KEY
  }
  return headers
}

async function rapidGet<T>(path: string): Promise<T | null> {
  if (!useProxy() && !RAPID_KEY) return null
  const res = await fetch(rapidUrl(path), { headers: rapidHeaders() })
  if (!res.ok) return null
  return (await res.json()) as T
}

/** RapidAPI 通用搜索（程序侧查询入口） */
export async function rapidSearch(query: string, cursor = 0) {
  if (!useProxy() && !RAPID_KEY) return null
  const res = await fetch(rapidUrl('/search/general/query'), {
    method: 'POST',
    headers: rapidHeaders(),
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
    return { handle: `@${clean}`, videos: [], source: 'mock' }
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
  let source: 'rapidapi' | 'mock' = 'mock'

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

/** RapidAPI TikTok 账号现状 */
export async function syncTikTokAccount(handle: string): Promise<TikTokAccountSnapshot> {
  const clean = stripHandle(handle)

  // 1) Dojo / Velix 后端代理（必须带有效粉丝数字才采信）
  try {
    const res = await fetch(`${DOJO_API}/tiktok/account/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: clean })
    })
    if (res.ok) {
      const data = await res.json()
      const normalized = normalizeUserDetails(data, clean)
      if (isValidSnapshot(normalized)) return normalized
    }
  } catch {
    /* next */
  }

  // 2) RapidAPI /user/details：按用户名精确查，比搜索猜作者可靠
  try {
    const d = await rapidGet<RapidUserDetails | Record<string, unknown>>(
      `/user/details?username=${encodeURIComponent(clean)}`
    )
    const normalized = normalizeUserDetails(d, clean)
    if (isValidSnapshot(normalized)) return normalized
  } catch {
    /* mock */
  }

  const base = (Math.abs(hashCode(handle)) % 50000) + 500
  return {
    handle: handle.startsWith('@') ? handle : `@${clean}`,
    followers: base + Math.floor(Math.random() * 800),
    following: 120 + (hashCode(handle) % 80),
    likes: base * 12,
    posts: 20 + (hashCode(handle) % 40),
    syncedAt: nowStamp(),
    source: 'mock'
  }
}

/** RapidAPI 拉取单条视频播放/互动 */
export async function syncVideoMetrics(videoUrl: string): Promise<TikTokVideoMetrics | null> {
  if (!videoUrl) return null

  try {
    const res = await fetch(`${DOJO_API}/tiktok/video/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl })
    })
    if (res.ok) {
      const data = (await res.json()) as TikTokVideoMetrics
      return { ...data, source: 'rapidapi' }
    }
  } catch {
    /* next */
  }

  const base = (Math.abs(hashCode(videoUrl)) % 80000) + 500
  const likes = Math.floor(base * (0.02 + (hashCode(videoUrl) % 30) / 1000))
  const comments = Math.floor(likes * 0.08)
  return {
    videoUrl,
    views: base + Math.floor(Math.random() * 1200),
    likes,
    comments,
    engagementRate: (likes + comments) / base,
    retention3s: 0.08 + (hashCode(videoUrl) % 12) / 100,
    syncedAt: nowStamp(),
    source: 'mock'
  }
}
