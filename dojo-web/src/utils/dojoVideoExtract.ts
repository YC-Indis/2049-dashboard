/**
 * 从文本/文档抽取 TikTok 作品链接，并反推账号 handle。
 * 用于「只导视频」时把空有视频、未入池的账号一并补进账号池。
 */
import { parseDocument, type ParsedDocument } from '@/utils/dojoAccountExtract'

const HANDLE_CHARS = '[A-Za-z0-9._]{2,24}'
/** https://www.tiktok.com/@user/video/1234567890 */
const VIDEO_URL_RE = new RegExp(
  `https?:\\/\\/(?:www\\.)?tiktok\\.com\\/@(${HANDLE_CHARS})\\/video\\/(\\d+)[^\\s,;，；"'<>]*`,
  'gi'
)
/** 宽松：行内只有 @user/video/id 或 tiktok.com/@user/video/id */
const VIDEO_LOOSE_RE = new RegExp(
  `(?:tiktok\\.com\\/)?@?(${HANDLE_CHARS})\\/video\\/(\\d+)`,
  'gi'
)

export interface VideoCandidate {
  handle: string
  videoId: string
  videoUrl: string
  /** 是否会触发「补录账号」 */
  accountMissingHint?: boolean
  hits: number
  context: string
}

function trimContext(text: string, index: number, len: number) {
  const start = Math.max(0, index - 36)
  const end = Math.min(text.length, index + len + 36)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

export function parseTikTokVideoUrl(
  raw: string
): { handle: string; videoId: string; videoUrl: string } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const m =
    s.match(
      new RegExp(`tiktok\\.com/@(${HANDLE_CHARS})/video/(\\d+)`, 'i')
    ) || s.match(new RegExp(`@?(${HANDLE_CHARS})/video/(\\d+)`, 'i'))
  if (!m) return null
  const handle = m[1].toLowerCase()
  if (/^\d+$/.test(handle)) return null
  const videoId = m[2]
  return {
    handle: `@${handle}`,
    videoId,
    videoUrl: `https://www.tiktok.com/@${handle}/video/${videoId}`
  }
}

/** 从纯文本抽作品；同一 videoId 去重 */
export function extractVideosFromText(text: string): VideoCandidate[] {
  const found = new Map<string, VideoCandidate>()

  const record = (handleRaw: string, videoId: string, index: number, matchLen: number) => {
    const handle = handleRaw.toLowerCase()
    if (/^\d+$/.test(handle)) return
    const key = videoId
    const existing = found.get(key)
    if (existing) {
      existing.hits++
      return
    }
    found.set(key, {
      handle: `@${handle}`,
      videoId,
      videoUrl: `https://www.tiktok.com/@${handle}/video/${videoId}`,
      hits: 1,
      context: trimContext(text, index, matchLen)
    })
  }

  for (const m of text.matchAll(VIDEO_URL_RE)) {
    record(m[1], m[2], m.index ?? 0, m[0].length)
  }
  // 宽松规则只补严格规则没扫到的（避免同一链接计两次）
  for (const m of text.matchAll(VIDEO_LOOSE_RE)) {
    if (found.has(m[2])) continue
    record(m[1], m[2], m.index ?? 0, m[0].length)
  }

  return [...found.values()].sort((a, b) => b.hits - a.hits)
}

export interface VideoExtractResult {
  documents: ParsedDocument[]
  videos: VideoCandidate[]
  /** 作品里出现过的账号（去重） */
  handlesFromVideos: string[]
}

export async function extractVideosFromFiles(files: File[]): Promise<VideoExtractResult> {
  const documents: ParsedDocument[] = []
  const merged = new Map<string, VideoCandidate>()

  for (const file of files) {
    const doc = await parseDocument(file)
    documents.push(doc)
    if (!doc.text) continue
    extractVideosFromText(doc.text).forEach((v) => {
      const existing = merged.get(v.videoId)
      if (!existing) merged.set(v.videoId, v)
      else existing.hits += v.hits
    })
  }

  const videos = [...merged.values()].sort((a, b) => b.hits - a.hits)
  const handleSet = new Set(videos.map((v) => v.handle.toLowerCase()))
  return {
    documents,
    videos,
    handlesFromVideos: [...handleSet]
  }
}
