/**
 * 项目导入：优先 DeepSeek 理解自然语言，失败时用本地规则兜底。
 * 整段 brief 视为「一个或多个完整项目」，绝不把每一行当成项目名。
 */
import { DOJO_TODAY, extractDateRange } from '@/utils/dojoDates'
import type { ProjectKpi, ProjectRuntime } from '@/store/dojoProjectRuntime'

export interface ParsedProjectImport {
  name: string
  brand?: string
  region?: string
  owner?: string
  clientContact?: string
  priority?: ProjectRuntime['priority']
  cycleStart?: string
  cycleEnd?: string
  accounts?: number
  videos?: number
  exposure?: number
  /** 脚本总目标 */
  scripts?: number
  /** @deprecated 旧每号脚本，导入时会折算进 scripts */
  scriptsPerAccount?: number
}

const SCHEMA = `{
  "projects": [
    {
      "name": "项目名",
      "brand": "品牌可选",
      "region": "投放区域",
      "cycleStart": "YYYY-MM-DD",
      "cycleEnd": "YYYY-MM-DD",
      "accounts": 4,
      "videos": 40,
      "exposure": 2600000,
      "scripts": 40,
      "priority": "high|medium|low",
      "owner": "",
      "clientContact": ""
    }
  ]
}`

/** 260w / 260万 / 1.5k / 30000 → 数字 */
export function parseCompactNumber(raw: string): number | null {
  const s = String(raw).trim().replace(/,/g, '').replace(/\s/g, '')
  if (!s) return null
  const m = s.match(/^([\d.]+)\s*([万wWkKmM亿])?$/)
  if (!m) {
    const n = Number(s)
    return Number.isFinite(n) ? Math.round(n) : null
  }
  const base = Number(m[1])
  if (!Number.isFinite(base)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit === 'w' || unit === '万') return Math.round(base * 10000)
  if (unit === 'k') return Math.round(base * 1000)
  if (unit === 'm') return Math.round(base * 1_000_000)
  if (unit === '亿') return Math.round(base * 100_000_000)
  return Math.round(base)
}

/** 7.1-8.20 / 8月二十到9月一号 / 2026-07-01~2026-08-20 */
export function parseFlexibleRange(
  raw: string,
  refYear = Number(DOJO_TODAY.slice(0, 4))
) {
  return extractDateRange(raw, refYear)
}

function pickField(text: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`${key}\\s*[:：]\\s*([^\\n;；]+)`, 'i')
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

/** 本地规则：一整段 brief → 一个项目（多项目用空行分隔） */
export function parseProjectBriefLocal(text: string): ParsedProjectImport[] {
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean)
  const blocks = chunks.length > 1 ? chunks : [text.trim()]
  const out: ParsedProjectImport[] = []

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) continue

    let name = ''
    const first = lines[0]
    if (!/[:：]/.test(first) || /^(xros|项目|dojo)/i.test(first)) {
      name = first.replace(/[;；]+$/, '').trim()
    }
    if (!name) {
      name =
        pickField(block, ['项目', '项目名', '名称', 'name']) ||
        lines.find((l) => !/[:：]/.test(l))?.replace(/[;；]+$/, '') ||
        '未命名项目'
    }

    const region =
      pickField(block, ['投放区域', '区域', '地区', 'region', '市场']) || undefined
    const dateRaw =
      pickField(block, ['投放日期', '周期', '日期', 'date', '时间']) || ''
    const range = dateRaw ? parseFlexibleRange(dateRaw) : null

    const accounts = parseCompactNumber(
      pickField(block, ['账号数', '账号', 'accounts', '号数']) || ''
    )
    const videos = parseCompactNumber(
      pickField(block, ['视频条数', '成片数', '成片', '视频数', 'videos', '片子']) || ''
    )
    const exposure = parseCompactNumber(
      pickField(block, ['播放量', '曝光量', '曝光', 'exposure', 'vv', 'views']) || ''
    )
    const scriptsRaw = parseCompactNumber(
      pickField(block, ['脚本数', '脚本目标', '脚本', 'scripts']) || ''
    )
    // 脚本总目标优先；没有则用成片数近似，不再强行 ÷ 账号
    const scripts = scriptsRaw ?? videos ?? 0
    const scriptsPerAccount =
      accounts && scripts ? Math.max(1, Math.round(scripts / accounts)) : 0

    const brand = pickField(block, ['品牌', 'brand']) || undefined
    const priority = suggestPriority({
      accounts: accounts ?? 0,
      videos: videos ?? 0,
      exposure: exposure ?? 0
    })

    const looksLikeFieldOnly =
      /^(投放|KPI|播放|视频|账号)/i.test(name) && /[:：]/.test(name)
    if (looksLikeFieldOnly && !accounts && !videos && !exposure && !range) continue

    out.push({
      name,
      brand,
      region,
      cycleStart: range?.start,
      cycleEnd: range?.end,
      accounts: accounts ?? 0,
      videos: videos ?? 0,
      exposure: exposure ?? 0,
      scripts,
      scriptsPerAccount,
      priority
    })
  }

  return out
}

export function suggestPriority(
  kpi: Pick<ProjectKpi, 'accounts' | 'videos' | 'exposure'>
): ProjectRuntime['priority'] {
  if (kpi.exposure >= 1_000_000 || kpi.accounts >= 8 || kpi.videos >= 80) return 'high'
  if (kpi.exposure >= 100_000 || kpi.accounts >= 3 || kpi.videos >= 20) return 'medium'
  return 'low'
}

/** 按今天相对周期推导运行状态 */
export function deriveRunStatus(
  cycleStart?: string,
  cycleEnd?: string,
  today: string = DOJO_TODAY
): string {
  if (!cycleStart || !cycleEnd) return '未开始'
  if (today < cycleStart) return '未开始'
  if (today > cycleEnd) return '完结'
  return '进行中'
}

function normalizeParsed(list: ParsedProjectImport[]): ParsedProjectImport[] {
  return list
    .map((p) => ({
      ...p,
      name: (p.name || '').trim(),
      accounts: Number(p.accounts) || 0,
      videos: Number(p.videos) || 0,
      exposure: Number(p.exposure) || 0,
      scripts:
        p.scripts != null
          ? Number(p.scripts) || 0
          : (Number(p.accounts) || 0) * (Number(p.scriptsPerAccount) || 0),
      scriptsPerAccount: Number(p.scriptsPerAccount) || 0,
      priority:
        p.priority ||
        suggestPriority({
          accounts: Number(p.accounts) || 0,
          videos: Number(p.videos) || 0,
          exposure: Number(p.exposure) || 0
        })
    }))
    .filter((p) => p.name && !/^(投放|KPI|播放|视频|账号)[:：]?$/i.test(p.name))
}

/**
 * AI + 本地双通道解析。返回 projects 与来源说明。
 * DeepSeek 按需动态加载，避免 store 间接依赖 llm。
 */
export async function parseProjectImportText(raw: string): Promise<{
  projects: ParsedProjectImport[]
  source: 'ai' | 'local'
  hint?: string
}> {
  const text = raw.trim()
  if (!text) return { projects: [], source: 'local' }

  try {
    const { aiParseStructured } = await import('@/api/llm')
    const ai = await aiParseStructured<{ projects?: ParsedProjectImport[] } | ParsedProjectImport[]>(
      `你是项目导入助手。把用户粘贴的项目 brief 解析成结构化项目列表。
规则：
1. 一整段描述通常是「一个项目」，不要把每一行拆成独立项目。
2. 播放量/曝光/vv/260w → exposure 数字（260w=2600000）。
3. 视频条数/成片 → videos；账号数 → accounts。
4. scripts 为脚本总目标（与账号数独立）；若只有成片/视频数，可令 scripts ≈ videos。不要用每号均分去反推总目标。
5. 日期支持 7.1-8.20（相对今年 ${DOJO_TODAY.slice(0, 4)}）。
6. 投放区域 → region。
只输出 JSON。`,
      text,
      SCHEMA
    )
    if (ai.ok) {
      const data = ai.data
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.projects)
          ? data.projects
          : []
      const projects = normalizeParsed(list)
      if (projects.length) return { projects, source: 'ai', hint: 'DeepSeek 已解析' }
    }
  } catch {
    /* fall through */
  }

  const local = normalizeParsed(parseProjectBriefLocal(text))
  return {
    projects: local,
    source: 'local',
    hint: 'AI 未可用或解析失败，已用本地规则识别'
  }
}
