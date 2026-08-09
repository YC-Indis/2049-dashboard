export interface TikTokAccountSnapshot {
  handle: string
  followers: number
  following?: number
  likes?: number
  posts?: number
  syncedAt: string
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

/** RapidAPI 通用搜索（程序侧查询入口） */
export async function rapidSearch(query: string, cursor = 0) {
  const useProxy = import.meta.env.DEV || import.meta.env.VITE_RAPIDAPI_PROXY === 'true'
  if (!useProxy && !RAPID_KEY) return null
  const url = useProxy
    ? '/api/rapidapi/search/general/query'
    : `https://${RAPID_HOST}/search/general/query`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (RAPID_KEY) {
    headers['x-rapidapi-host'] = RAPID_HOST
    headers['x-rapidapi-key'] = RAPID_KEY
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, cursor, sort_type: '0' })
  })
  if (!res.ok) return null
  return res.json()
}

/** RapidAPI TikTok 账号现状 */
export async function syncTikTokAccount(handle: string): Promise<TikTokAccountSnapshot> {
  const clean = handle.replace(/^@/, '')

  // 1) Dojo / Velix 后端代理
  try {
    const res = await fetch(`${DOJO_API}/tiktok/account/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: clean })
    })
    if (res.ok) {
      const data = (await res.json()) as TikTokAccountSnapshot
      return { ...data, source: 'rapidapi' }
    }
  } catch {
    /* next */
  }

  // 2) RapidAPI 搜索兜底：用 handle 搜，取第一条作者粉丝
  if (RAPID_KEY) {
    try {
      const data = (await rapidSearch(`@${clean}`)) as {
        data?: Array<{ author?: { unique_id?: string; follower_count?: number; following_count?: number; heart?: number; video_count?: number } }>
      }
      const hit = data?.data?.find((x) => x.author?.unique_id?.toLowerCase() === clean.toLowerCase()) || data?.data?.[0]
      if (hit?.author) {
        return {
          handle: `@${hit.author.unique_id || clean}`,
          followers: hit.author.follower_count ?? 0,
          following: hit.author.following_count,
          likes: hit.author.heart,
          posts: hit.author.video_count,
          syncedAt: nowStamp(),
          source: 'rapidapi'
        }
      }
    } catch {
      /* mock */
    }
  }

  const base = Math.abs(hashCode(handle)) % 50000 + 500
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

  const base = Math.abs(hashCode(videoUrl)) % 80000 + 500
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
