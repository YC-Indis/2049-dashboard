import { formatAiText } from '@/utils/formatAiText'
import {
  activeLlmProvider,
  resolveLlmRequestBase,
  type LlmProviderConfig
} from '@/store/dojoLlmSettings'

const DOJO_API = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'
const VELIX_LLM = '/api/v1/llm/chat'

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
 * - AI：自然语言理解、表格粘贴解析、缺失字段补全、时间线脏数据梳理
 */
export async function chatAgent(
  message: string,
  context: Record<string, unknown> = {},
  history: ChatTurn[] = []
): Promise<LlmReply> {
  const system = buildSystemPrompt(context)
  const provider = activeLlmProvider.value

  if (provider?.apiKey) {
    try {
      const reply = await callConfiguredProvider(provider, system, message, history, {
        expectJson: Boolean(context.expectJson)
      })
      if (reply) return reply
    } catch {
      /* try next */
    }
  }

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
    content: formatAiText(localAgentFallback(message, context)),
    sources: [],
    memoryHint: provider?.apiKey
      ? `${provider.name} 暂不可用，已用本地规则兜底`
      : '未配置模型 API Key，请在 SixNine49 设置里填写'
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

async function callConfiguredProvider(
  provider: LlmProviderConfig,
  system: string,
  message: string,
  history: ChatTurn[],
  opts: { expectJson?: boolean } = {}
): Promise<LlmReply | null> {
  if (provider.style === 'anthropic') {
    return callAnthropic(provider, system, message, history)
  }
  return callOpenAiCompatible(provider, system, message, history, opts)
}

async function callOpenAiCompatible(
  provider: LlmProviderConfig,
  system: string,
  message: string,
  history: ChatTurn[],
  opts: { expectJson?: boolean } = {}
): Promise<LlmReply | null> {
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ]
  const { base, targetHeader } = resolveLlmRequestBase(provider)
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      ...(targetHeader ? { 'x-llm-target': targetHeader } : {})
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: opts.expectJson ? 0.1 : 0.55,
      ...(opts.expectJson ? { response_format: { type: 'json_object' } } : {})
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
    memoryHint: provider.name
  }
}

async function callAnthropic(
  provider: LlmProviderConfig,
  system: string,
  message: string,
  history: ChatTurn[]
): Promise<LlmReply | null> {
  const { base, targetHeader } = resolveLlmRequestBase(provider)
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      ...(targetHeader ? { 'x-llm-target': targetHeader } : {})
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 2048,
      system,
      messages: [
        ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ]
    })
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const content = data.content?.find((item) => item.type === 'text')?.text
  if (!content) return null
  return {
    content: formatAiText(content),
    sources: [],
    memoryHint: provider.name
  }
}

function buildSystemPrompt(context: Record<string, unknown>) {
  return `你是 2049 工作台里的 SixNine49 悬浮窗搭档。
你能看见执行（项目/排期/日历）、内容（灵感采集/灵感库/脚本/固定榜单/检索词池/算法榜）和运营（账号矩阵/视频监控/同步数据）的真实快照。
回答时要像运营搭档：先给结论，再引用上下文里的真实数字、榜单名、项目名；不要空喊口号，不要编造未出现的数据。
若用户问异常榜、加速榜、小号逆袭、方向榜、某项目进度，直接基于上下文里的 boards / rankPool / projects 做分析与排序建议。
前端负责真正改数据。写操作（新建项目/建任务/改期/采集/删除/同步/改现状）必须先复述你的理解、列出将改的字段，等用户确认后前端才会执行。
拿不准意图时先追问，不要猜测后直接声称已执行。缺参数就问缺的那几项，并复述已经记下的字段。
建采集时，关键词必须是用户明确给出的独立检索词。禁止把当前项目名、品牌名或竞品品牌自动加进检索。
中台会同时对接很多项目。selectedProject 只是界面焦点，不是唯一对象。项目级写操作必须带项目名；没点名且项目多于 1 个时先问，不要默认写进当前选中项。
前端已能执行：项目/任务/环节日期/现状的增删改查，采集线索、灵感库、脚本、对标库的增删改查，以及账号同步与运营查询。
当前工作区上下文：${JSON.stringify(context).slice(0, 14000)}`
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() || text.trim()
  const start = raw.search(/[[{]/)
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

function localAgentFallback(message: string, context: Record<string, unknown>): string {
  const schedule = (context.schedule || {}) as Record<string, unknown>
  const creator = (context.creator || {}) as Record<string, unknown>
  const accounts = (context.accounts || {}) as Record<string, unknown>
  const inspiration = (context.inspiration || {}) as Record<string, unknown>
  const operations = (context.operations || {}) as Record<string, unknown>
  const projects = Array.isArray(context.projects) ? context.projects : []
  const project = context.selectedProject
    ? `手头项目是「${String(context.selectedProject)}」`
    : '这会儿还没锁定具体项目'

  if (/几个项目|项目数量|有多少项目/.test(message)) {
    const names = projects
      .map((item) => {
        const row = item as { name?: string }
        return row.name
      })
      .filter(Boolean)
    return names.length
      ? `当前共有 ${names.length} 个项目：${names.join('、')}。`
      : '当前工作台还没有项目。可以直接说「新建项目」让我帮你建。'
  }

  return `模型暂时连不上，我先按工作台真实数据跟你对齐。${project}：排期 ${Number(schedule.total || 0)} 项（逾期 ${Number(schedule.overdue || 0)}），灵感库 ${Number(inspiration.libraryCount || 0)} 条，账号 ${Number(accounts.total || 0)} 个，监控视频 ${Number(operations.monitoredVideos || creator.total || 0)} 条。\n\n你刚问的是：“${message}”。可以直接说：新建项目、把某项目投放改到某日期、建采集（关键词/条数/天数）、账号运营怎么样、同步全部账号。`
}
