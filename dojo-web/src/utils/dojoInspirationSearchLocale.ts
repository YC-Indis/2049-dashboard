/**
 * TikTok 检索用语。只把用户写下的独立词换成平台上能搜到的英文，
 * 不补项目名、品牌名或竞品名。
 */

const FORMAT_EN: Record<string, string> = {
  开箱: 'unboxing',
  开箱测评: 'unboxing',
  测评: 'review',
  首发: 'first look',
  日常: 'vlog',
  日常vlog: 'vlog',
  '日常 vlog': 'vlog',
  pov日常: 'pov',
  'POV 日常': 'pov',
  海外热点: 'viral',
  热点: 'trending',
  转场: 'transition',
  剪辑: 'edit',
  口味: 'taste test',
  口味测评: 'taste test',
  种草: 'review',
  钩子: 'hook',
  开场: 'hook',
  生活: 'day in the life'
}

/** 默认固定榜方向；界面上常驻展示，添加自定义时不再用这些当「点选模板」 */
export const SUGGESTED_DIRECTIONS = [
  { name: '开箱测评', queries: 'unboxing\nfirst look\nreview' },
  { name: '日常 vlog', queries: 'vlog\nday in the life' },
  { name: 'POV 日常', queries: 'pov\ngrwm' },
  { name: '转场剪辑', queries: 'transition\njump cut' },
  { name: '口味测评', queries: 'taste test\nflavor review' },
  { name: '钩子开场', queries: 'hook\nplot twist' },
  { name: '海外热点', queries: 'viral\ntrending' }
]

export const FALLBACK_OVERSEAS_SEEDS = [
  'unboxing',
  'vlog',
  'pov',
  'first look',
  'transition',
  'taste test'
]

export function hasCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

export function compactLocaleKey(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

export function mapToTikTokQuery(term: string) {
  const trimmed = term.trim()
  if (!trimmed) return ''
  if (!hasCjk(trimmed)) return trimmed
  const compact = compactLocaleKey(trimmed)
  return (
    FORMAT_EN[trimmed] ||
    FORMAT_EN[compact] ||
    Object.entries(FORMAT_EN).find(([key]) => compact.includes(compactLocaleKey(key)))?.[1] ||
    ''
  )
}
