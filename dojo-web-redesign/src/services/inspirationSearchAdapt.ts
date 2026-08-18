import type { InspirationCandidate } from '@/types/dojoInspiration'
import { compactLocaleKey, hasCjk, mapToTikTokQuery } from '@/utils/dojoInspirationSearchLocale'
import { loadTable, saveTable } from '@/utils/dojoPersist'

const TABLE = 'inspirationSearchLocale'
const MAX_AI_CANDIDATES = 24

const localeStore = loadTable<{ map: Record<string, string> }>(TABLE) || { map: {} }

function persistLocale() {
  saveTable(TABLE, { map: localeStore.map })
}

export function rememberedTikTokQuery(term: string) {
  const mapped = mapToTikTokQuery(term)
  if (mapped) return mapped
  return localeStore.map[compactLocaleKey(term)] || ''
}

export async function adaptQueriesForTikTok(queries: string[]) {
  const adapted: string[] = []
  for (const query of queries) {
    const next = await adaptOneQuery(query)
    if (next) adapted.push(next)
  }
  return uniqueKeep(adapted)
}

/** 主词搜不出时再用：AI 联想相近英文检索词，不掺品牌/项目名 */
export async function suggestAssociateQueries(primary: string) {
  const seed = primary.trim()
  if (!seed) return []
  try {
    const answer = await chatDeepSeek(
      '你在帮 TikTok 检索补近义词。用户已经有一个主检索词，但结果太少。请给出 3 个相近、可单独搜索的英文短语。只要成品内容方向，不要品牌、项目名或解释。只输出 JSON 字符串数组。',
      seed
    )
    const match = answer.match(/\[[\s\S]*?\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as unknown
    if (!Array.isArray(parsed)) return []
    return uniqueKeep(
      parsed
        .map((item) => String(item || '').trim())
        .filter((item) => item && !hasCjk(item) && item.length <= 40)
    ).slice(0, 3)
  } catch {
    return []
  }
}

async function adaptOneQuery(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return ''
  const remembered = rememberedTikTokQuery(trimmed)
  if (remembered) return remembered
  if (!hasCjk(trimmed)) return trimmed
  const translated = await translateQueryToEnglish(trimmed)
  if (!translated) return trimmed
  localeStore.map[compactLocaleKey(trimmed)] = translated
  persistLocale()
  return translated
}

export async function pickTopMatches(
  query: string,
  items: InspirationCandidate[],
  limit: number
) {
  if (items.length <= limit) return items
  const sample = items.slice(0, MAX_AI_CANDIDATES)
  try {
    const answer = await chatDeepSeek(
      '你在帮短视频采集做筛选。只根据标题和作者判断。丢掉广告、带货硬广、和检索方向无关的内容。只输出 JSON 数组，里面是要留下的编号，最多指定条数。不要解释。',
      [
        `检索方向：${query}`,
        `留下 ${limit} 条最符合的成品内容。`,
        ...sample.map(
          (item, index) =>
            `${index + 1}. ${item.author} / 播放 ${item.views} / ${item.title.slice(0, 80)}`
        )
      ].join('\n')
    )
    const picked = parseIndexList(answer, sample.length)
      .slice(0, limit)
      .map((index) => sample[index])
      .filter(Boolean)
    if (picked.length) {
      const rest = items.filter((item) => !picked.includes(item))
      return [...picked, ...rest].slice(0, limit)
    }
  } catch {
    /* AI 失败时退回热度排序 */
  }
  return items.slice(0, limit)
}

export function looksLikeAd(candidate: InspirationCandidate) {
  if (candidate.rawPayload?.isAd) return true
  const text = `${candidate.title} ${candidate.summary} ${candidate.tags.join(' ')}`.toLowerCase()
  return /#ad\b|#sponsored\b|sponsored|shop now|limited offer|buy now|promo code|affiliate/.test(
    text
  )
}

async function translateQueryToEnglish(term: string) {
  try {
    const answer = await chatDeepSeek(
      '把用户给的独立检索词译成 TikTok 上常用的英文搜索短语。只要词本身，不要加品牌、项目名或解释。只输出英文。',
      term
    )
    const cleaned = answer
      .replace(/^["'`]+|["'`]+$/g, '')
      .split(/[\n,，]/)[0]
      ?.trim()
    if (!cleaned || hasCjk(cleaned) || cleaned.length > 40) return ''
    return cleaned
  } catch {
    return ''
  }
}

async function chatDeepSeek(system: string, user: string) {
  const response = await fetch('/api/local/deepseek/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: string | { message?: string }
  }
  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || `DeepSeek 请求失败（${response.status}）`
    throw new Error(message)
  }
  const answer = payload.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('DeepSeek 没有返回有效内容')
  return answer
}

function parseIndexList(raw: string, max: number) {
  const match = raw.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0]) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => Number(item) - 1)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < max)
  } catch {
    return []
  }
}

function uniqueKeep(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
