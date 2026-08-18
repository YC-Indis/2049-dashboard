/**
 * 检索只打用户写下的独立词。
 * 不补项目名、品牌名，也不把一条线索拆成多次品牌搜索。
 * TikTok 上若原词是中文，会另外换成对应的英文检索词。
 */

import { rememberedTikTokQuery } from '@/services/inspirationSearchAdapt'

const RESTRICTED_TERMS = [
  '电子烟',
  '电子菸',
  '烟油',
  '烟弹',
  '香烟',
  '尼古丁',
  '尼古丁盐',
  '雾化弹',
  '烟草'
]

const PROJECT_TITLE_MARKERS = /规划|项目|矩阵|一期|二期|英国\d|德国\d|脚本规划/

export interface ResolvedSearchQueries {
  original: string
  primary: string
  tiktokQuery: string
  weights: string[]
  queries: string[]
  rewritten: boolean
  hint?: string
}

export function splitQueryTokens(query: string) {
  return query
    .split(/[\n,，#]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
}

export function isRestrictedQueryTerm(term: string) {
  const compact = term.toLowerCase().replace(/[\s_-]+/g, '')
  return RESTRICTED_TERMS.some((item) => compact.includes(item.toLowerCase()))
}

export function looksLikeProjectTitle(value: string) {
  const text = value.trim()
  if (!text) return false
  return PROJECT_TITLE_MARKERS.test(text) || /[A-Za-z]+\s+\d+\.\d+/.test(text)
}

export function sanitizeSearchToken(term: string) {
  let next = term.trim()
  RESTRICTED_TERMS.forEach((restricted) => {
    next = next.replace(new RegExp(restricted, 'gi'), ' ')
  })
  next = next.replace(/\s+/g, ' ').trim()
  if (next.length > 1 && !looksLikeProjectTitle(next)) return next
  return ''
}

export function sourceSearchText(source: { query?: string }) {
  return String(source.query || '').trim()
}

export function resolveSearchQueries(
  raw: string,
  options?: { expand?: boolean }
): ResolvedSearchQueries {
  const original = raw.trim()
  const tokens = splitQueryTokens(original)
    .map((token) => sanitizeSearchToken(token))
    .filter(Boolean)
  const hitRestricted = isRestrictedQueryTerm(original) ||
    splitQueryTokens(original).some((token) => isRestrictedQueryTerm(token))
  const primary = tokens[0] || ''
  const weights = tokens.slice(1)
  const queries = options?.expand ? uniqueQueries(tokens) : primary ? [primary] : []
  const tiktokQuery = rememberedTikTokQuery(primary) || primary

  return {
    original,
    primary,
    tiktokQuery,
    weights,
    queries,
    rewritten: hitRestricted,
    hint: !primary && hitRestricted
      ? '这个词不能直接打到平台。请换一个独立检索词，系统不会改搜品牌或项目名'
      : tiktokQuery && tiktokQuery !== primary
        ? `TikTok 将搜「${tiktokQuery}」`
        : undefined
  }
}

function uniqueQueries(queries: string[]) {
  const seen = new Set<string>()
  return queries.filter((query) => {
    const key = query.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
