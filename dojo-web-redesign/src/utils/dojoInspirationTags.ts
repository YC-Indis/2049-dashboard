/**
 * 内容方向标签：从灵感视频 / 对标作品里反复出现的话题里长出来。
 * 项目名、品牌、型号只属于那个项目，不当检索方向。
 */

const PLATFORM_NOISE = new Set(
  [
    'fyp',
    'foryou',
    'foryoupage',
    'foryoupageシ',
    'viral',
    'tiktok',
    'trending',
    'recommended',
    'xyzbca',
    'fypシ',
    'capcut',
    'duet',
    'stitch'
  ].map(compactTag)
)

export interface ProjectTagSource {
  name?: string
  aliases?: string[]
  brand?: string
}

export interface RankedTag {
  tag: string
  count: number
}

export function compactTag(value: string) {
  return value.toLowerCase().replace(/[\s_\-.]+/g, '')
}

export function collectProjectOwnedTokens(projects: ProjectTagSource[]) {
  const tokens = new Set<string>()
  projects.forEach((project) => {
    const raw = [project.name, project.brand, ...(project.aliases || [])]
    raw.forEach((item) => {
      const text = String(item || '').trim()
      if (!text || text === '—') return
      tokens.add(compactTag(text))
      text.split(/[\s/_·,，]+/).forEach((part) => {
        const compact = compactTag(part)
        if (compact.length >= 3) tokens.add(compact)
      })
    })
  })
  return [...tokens].filter((token) => token.length >= 3)
}

export function isOwnedProjectTag(tag: string, ownedTokens: string[]) {
  const key = compactTag(tag)
  if (!key) return false
  return ownedTokens.some(
    (token) =>
      key === token ||
      (token.length >= 4 && key.startsWith(token)) ||
      (key.length >= 4 && token.startsWith(key))
  )
}

export function isPlatformNoiseTag(tag: string) {
  const key = compactTag(tag)
  return !key || key.length < 2 || PLATFORM_NOISE.has(key)
}

export function withoutOwnedTags(tags: string[], ownedTokens: string[]) {
  return tags.filter(
    (tag) => tag.trim() && !isOwnedProjectTag(tag, ownedTokens) && !isPlatformNoiseTag(tag)
  )
}

export function rankDirectionalTags(
  tagLists: string[][],
  options?: {
    ownedTokens?: string[]
    minCount?: number
    limit?: number
  }
): RankedTag[] {
  const ownedTokens = options?.ownedTokens || []
  const minCount = options?.minCount ?? 2
  const limit = options?.limit ?? 16
  const counts = new Map<string, { tag: string; count: number }>()

  tagLists.forEach((list) => {
    const seen = new Set<string>()
    withoutOwnedTags(list || [], ownedTokens).forEach((tag) => {
      const key = compactTag(tag)
      if (!key || seen.has(key)) return
      seen.add(key)
      const hit = counts.get(key)
      if (hit) hit.count += 1
      else counts.set(key, { tag, count: 1 })
    })
  })

  return [...counts.values()]
    .filter((item) => item.count >= minCount)
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag, 'zh-CN'))
    .slice(0, limit)
}
