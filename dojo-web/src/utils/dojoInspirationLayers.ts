export const INSPIRATION_CATEGORIES = [
  '产品',
  '开箱',
  '玩法',
  '口味',
  '钩子',
  '对标账号',
  '未分类'
] as const

export const SCRIPT_DIRECTIONS = [
  '产品展示',
  '开箱测评',
  '玩法转场',
  '口味种草',
  '钩子开场',
  '生活场景',
  '未指定'
] as const

export type ScriptDirection = (typeof SCRIPT_DIRECTIONS)[number]

export type InspirationCategory = (typeof INSPIRATION_CATEGORIES)[number]

export type LibraryGroupBy = 'time' | 'category' | 'tag'

export type LibraryTimeLayer = 'today' | 'week' | 'month' | 'older'

export const TIME_LAYER_META: Record<LibraryTimeLayer, { label: string; maxDays: number }> = {
  today: { label: '今天', maxDays: 1 },
  week: { label: '近 7 天', maxDays: 7 },
  month: { label: '近 30 天', maxDays: 30 },
  older: { label: '更早', maxDays: Number.POSITIVE_INFINITY }
}

export const DEFAULT_INSPIRATION_TAGS = [
  '开箱',
  '转场',
  '口味',
  '钩子',
  '日常',
  'POV',
  '对标'
]

export const LIBRARY_GROUP_LABELS: Record<LibraryGroupBy, string> = {
  time: '入库日',
  category: '类目',
  tag: '标签'
}

const CATEGORY_HINTS: Array<{ category: InspirationCategory; tokens: string[] }> = [
  { category: '产品', tokens: ['产品', 'device', 'product'] },
  { category: '开箱', tokens: ['unbox', 'teardown', 'review', 'first look', '开箱', '测评'] },
  { category: '玩法', tokens: ['transition', 'pov', 'edit', 'gameplay', '转场', '玩法'] },
  { category: '口味', tokens: ['flavor', 'taste', '口味', '种草'] },
  { category: '钩子', tokens: ['hook', 'relatable', '钩子'] },
  { category: '对标账号', tokens: ['对标', '竞品', 'benchmark'] }
]

export interface LibraryLayerItem {
  id: string
  title: string
  subtitle?: string
  createdAt: string
  category: InspirationCategory
  tags: string[]
}

export interface LibraryLayerGroup {
  key: string
  label: string
  items: LibraryLayerItem[]
}

export function normalizeTags(tags?: string[]) {
  return [...new Set((tags || []).map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))]
}

export function parseTagInput(raw: string) {
  return normalizeTags(raw.split(/[\s,，#]+/))
}

export function isInspirationCategory(value: string): value is InspirationCategory {
  return INSPIRATION_CATEGORIES.includes(value as InspirationCategory)
}

export function mapBoardCategory(raw?: string): InspirationCategory | undefined {
  if (!raw) return undefined
  if (raw.includes('产品')) return '产品'
  if (raw.includes('开箱') || raw.includes('测评')) return '开箱'
  if (raw.includes('玩法') || raw.includes('转场')) return '玩法'
  if (raw.includes('口味') || raw.includes('卖点')) return '口味'
  if (raw.includes('钩子')) return '钩子'
  if (raw.includes('对标') || raw.includes('账号')) return '对标账号'
  return undefined
}

export function inferCategory(text: string, tags: string[] = []): InspirationCategory {
  const haystack = `${text} ${tags.join(' ')}`.toLowerCase()
  const hit = CATEGORY_HINTS.find((entry) =>
    entry.tokens.some((token) => haystack.includes(token.toLowerCase()))
  )
  return hit?.category || '未分类'
}

export function timeLayerOf(iso: string, now = Date.now()): LibraryTimeLayer {
  const stamp = Date.parse(iso)
  if (!Number.isFinite(stamp)) return 'older'
  const ageDays = Math.max(0, (now - stamp) / 86400000)
  if (ageDays < 1) return 'today'
  if (ageDays < 7) return 'week'
  if (ageDays < 30) return 'month'
  return 'older'
}

export function ingestDayKey(iso: string) {
  const stamp = Date.parse(iso)
  if (!Number.isFinite(stamp)) return 'unknown'
  const date = new Date(stamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ingestDayLabel(isoOrKey: string) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey) ? isoOrKey : ingestDayKey(isoOrKey)
  if (key === 'unknown') return '日期未知'
  const [, month, day] = key.split('-')
  return `${Number(month)}月${Number(day)}日`
}

export function groupLibraryItems(
  items: LibraryLayerItem[],
  groupBy: LibraryGroupBy
): LibraryLayerGroup[] {
  if (groupBy === 'time') {
    const groups = new Map<string, LibraryLayerItem[]>()
    items.forEach((item) => {
      const key = ingestDayKey(item.createdAt)
      const bucket = groups.get(key) || []
      bucket.push(item)
      groups.set(key, bucket)
    })
    return [...groups.entries()]
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([key, groupItems]) => ({
        key,
        label: ingestDayLabel(key),
        items: groupItems
      }))
  }

  if (groupBy === 'category') {
    return INSPIRATION_CATEGORIES.map((category) => ({
      key: category,
      label: category,
      items: items.filter((item) => item.category === category)
    })).filter((group) => group.items.length)
  }

  const tagKeys = [...new Set(items.flatMap((item) => item.tags))].sort((left, right) =>
    left.localeCompare(right, 'zh-CN')
  )
  const tagged = tagKeys.map((tag) => ({
    key: tag,
    label: `#${tag}`,
    items: items.filter((item) => item.tags.includes(tag))
  }))
  const untagged = items.filter((item) => !item.tags.length)
  return [
    ...tagged,
    ...(untagged.length ? [{ key: 'untagged', label: '未打标签', items: untagged }] : [])
  ]
}
