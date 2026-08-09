import { formatAiText } from '@/utils/formatAiText'

const DOJO_API = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'
const VELIX_LLM = '/api/v1/llm/chat'
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined
// 开发走 Vite 代理 /api/deepseek，生产可配完整 Base
const DEEPSEEK_BASE =
  (import.meta.env.VITE_DEEPSEEK_BASE_URL as string) ||
  (import.meta.env.DEV ? '/api/deepseek' : 'https://api.deepseek.com')
const DEEPSEEK_MODEL = (import.meta.env.VITE_DEEPSEEK_MODEL as string) || 'deepseek-chat'

export type LlmScene = 'agent' | 'report' | 'production' | 'import' | 'timeline'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmSource {
  platform: string
  title: string
  link: string
}

export interface LlmReply {
  content: string
  sources: LlmSource[]
  memoryHint?: string
  /** AI 结构化结果（导入 / 梳理时用） */
  data?: unknown
}

/**
 * 分工：
 * - 程序：表格筛选、分页、日期对齐、CRUD、RapidAPI 同步、导出
 * - AI（DeepSeek）：自然语言理解、表格粘贴解析、缺失字段补全、时间线脏数据梳理
 */
export async function chatAgent(
  message: string,
  context: Record<string, unknown> = {},
  history: ChatTurn[] = []
): Promise<LlmReply> {
  const system = buildSystemPrompt(context)

  // 1) 直接 DeepSeek（本地 .env.local）
  if (DEEPSEEK_KEY) {
    try {
      const reply = await callDeepSeek(system, message, history)
      if (reply) return reply
    } catch {
      /* try next */
    }
  }

  // 2) Velix / Dojo 后端代理
  for (const [url, body] of [
    [VELIX_LLM, { scene: 'agent', message, context, history }],
    [`${DOJO_API}/agent/chat`, { message, context, history }]
  ] as const) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        content: string
        sources?: LlmSource[]
        memory_hint?: string
      }
      return {
        content: formatAiText(data.content),
        sources: data.sources ?? [],
        memoryHint: data.memory_hint
      }
    } catch {
      /* try next */
    }
  }

  return {
    content: formatAiText(localAgentFallback(message)),
    sources: [],
    memoryHint: DEEPSEEK_KEY
      ? 'DeepSeek 暂不可用，已用本地规则兜底'
      : '未配置 VITE_DEEPSEEK_API_KEY，已用本地规则兜底'
  }
}

/** 让 AI 把脏文本 / 粘贴表格解析成结构化 JSON */
export async function aiParseStructured<T = unknown>(
  instruction: string,
  raw: string,
  schemaHint: string
): Promise<{ ok: true; data: T; content: string } | { ok: false; content: string }> {
  const prompt = `${instruction}

请只输出 JSON（不要 markdown 围栏），结构参考：
${schemaHint}

原始输入：
---
${raw}
---`

  const reply = await chatAgent(prompt, { scene: 'import', expectJson: true })
  const json = extractJson(reply.content)
  if (json == null) return { ok: false, content: reply.content }
  return { ok: true, data: json as T, content: reply.content }
}

async function callDeepSeek(
  system: string,
  message: string,
  history: ChatTurn[]
): Promise<LlmReply | null> {
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ]

  const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(DEEPSEEK_KEY ? { Authorization: `Bearer ${DEEPSEEK_KEY}` } : {})
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.3
    })
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) return null
  return {
    content: formatAiText(content),
    sources: [],
    memoryHint: 'DeepSeek'
  }
}

function buildSystemPrompt(context: Record<string, unknown>) {
  return `你是 Dojo 中控台的 Velix Agent。只做数据查询、现状汇总、导入解析与字段补全，不替老板做业务决策。
程序已负责：表格 CRUD、筛选、分页、RapidAPI 同步、导出。你负责程序不好做的自然语言整理。
当前页上下文：${JSON.stringify(context).slice(0, 1200)}
回答用简洁中文。涉及写入时先给出预览，等用户确认。`
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() || text.trim()
  const start = raw.search(/[\[{]/)
  if (start < 0) return null
  const slice = raw.slice(start)
  try {
    return JSON.parse(slice)
  } catch {
    const endObj = slice.lastIndexOf('}')
    const endArr = slice.lastIndexOf(']')
    const end = Math.max(endObj, endArr)
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function localAgentFallback(message: string): string {
  const q = message.toLowerCase()
  if (q.includes('justdojoit') || q.includes('播放') || q.includes('互动')) {
    return `@justdojoit 近期（dojo数据）：
· 2/12 投流 25,900 vv · 互动率 0.73%
· 2/14 投流 17,100 vv · 互动率 1.38%
· 3/10 自然 1,904 + 投流 66,100 · 3s留存 13%`
  }
  if (q.includes('今天') || q.includes('现状')) {
    return `当前数据现状：
1) 分发记录可查账号 / 视频 / 播放
2) 时间规划可看里程碑与投放时间条
3) 总账号预览可同步未投放账号粉丝`
  }
  return '我已读取 dojo数据 / 脚本结构。程序负责增删改查与同步；我负责解析自然语言与补全字段。写入会先预览。'
}
