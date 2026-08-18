import { aiParseStructured } from '@/api/llm'

export interface InspirationImportDraft {
  title: string
  referenceUrl?: string
  angle?: string
  hook?: string
  shotPlan?: string[]
  copyPlan?: string[]
  musicPlan?: string[]
  visualNotes?: string
  transcript?: string
}

const URL_RE =
  /https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|youtube\.com|youtu\.be|xiaohongshu\.com|xhslink\.com|instagram\.com)\/[^\s"'<>\]\)]+/gi

const PLACEHOLDER_RE =
  /^(灵感标题|可迁移角度|开头钩子|画面要求|口播\/字幕|话术要点|音乐建议|镜头\d+|https?:\/\/\.\.\.?)$/i

function cleanUrl(url: string) {
  return url.replace(/^["'`]+|["'`]+$/g, '').replace(/[),.;]+$/g, '')
}

function uniqueUrls(text: string) {
  const found = text.match(URL_RE) || []
  return [...new Set(found.map(cleanUrl).filter(Boolean))]
}

function isPlaceholder(value?: string) {
  if (!value) return true
  return PLACEHOLDER_RE.test(value.trim())
}

function splitBlocksByUrl(raw: string) {
  const urls = uniqueUrls(raw)
  if (!urls.length) return [] as Array<{ url: string; text: string }>

  const blocks: Array<{ url: string; text: string }> = []
  let rest = raw
  urls.forEach((url, index) => {
    const at = rest.indexOf(url)
    if (at < 0) {
      blocks.push({ url, text: '' })
      return
    }
    const before = rest.slice(0, at).trim()
    const afterStart = at + url.length
    const nextUrl = urls[index + 1]
    const nextAt = nextUrl ? rest.indexOf(nextUrl, afterStart) : -1
    const after = (nextAt >= 0 ? rest.slice(afterStart, nextAt) : rest.slice(afterStart)).trim()
    const text = [before, after].filter(Boolean).join('\n').trim()
    blocks.push({ url, text })
    rest = nextAt >= 0 ? rest.slice(nextAt) : ''
  })
  return blocks
}

function summarizeTitle(text: string, index: number) {
  const line =
    text
      .split(/\n+/)
      .map((item) => item.trim())
      .find((item) => item && !/^https?:\/\//i.test(item) && !isPlaceholder(item)) || ''
  if (!line) return `灵感素材 ${index + 1}`
  return line.replace(/^参考案例视频[，,：:\s]*/u, '').slice(0, 42) || `灵感素材 ${index + 1}`
}

function shotPlanFromText(text: string) {
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/["'`]/g, '')
    .trim()
  if (!cleaned) return [] as string[]
  const parts = cleaned
    .split(/[；;。\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 3 && !isPlaceholder(item))
  return [...new Set(parts)].slice(0, 6)
}

/** 程序先按链接硬拆，再可选让 AI 润色标题/镜头；绝不采信 schema 占位符 */
export function parseInspirationLinksFirst(raw: string): InspirationImportDraft[] {
  const blocks = splitBlocksByUrl(raw)
  if (!blocks.length) {
    return raw
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 4)
      .slice(0, 20)
      .map((chunk, index) => ({
        title: summarizeTitle(chunk, index),
        angle: chunk.slice(0, 120),
        shotPlan: shotPlanFromText(chunk),
        copyPlan: [],
        visualNotes: chunk
      }))
  }

  return blocks.map((block, index) => {
    const shots = shotPlanFromText(block.text)
    return {
      title: summarizeTitle(block.text, index),
      referenceUrl: block.url,
      angle: block.text.slice(0, 160) || '待补充可迁移角度',
      hook: '',
      shotPlan: shots,
      copyPlan: [],
      visualNotes: block.text || undefined
    }
  })
}

function normalizeDraft(
  item: Partial<InspirationImportDraft>,
  index: number
): InspirationImportDraft | null {
  const title = String(item.title || '').trim()
  const referenceUrl = cleanUrl(String(item.referenceUrl || '').trim())
  if (!title && !referenceUrl) return null
  if (isPlaceholder(title) && (!referenceUrl || referenceUrl.includes('...'))) return null

  const shotPlan = Array.isArray(item.shotPlan)
    ? item.shotPlan.map((v) => String(v).trim()).filter((v) => v && !isPlaceholder(v))
    : []
  const copyPlan = Array.isArray(item.copyPlan)
    ? item.copyPlan.map((v) => String(v).trim()).filter((v) => v && !isPlaceholder(v))
    : []
  const musicPlan = Array.isArray(item.musicPlan)
    ? item.musicPlan.map((v) => String(v).trim()).filter((v) => v && !isPlaceholder(v))
    : []

  return {
    title: isPlaceholder(title) ? `灵感素材 ${index + 1}` : title || `灵感素材 ${index + 1}`,
    referenceUrl: referenceUrl && !referenceUrl.includes('...') ? referenceUrl : undefined,
    angle: isPlaceholder(item.angle) ? undefined : String(item.angle || '').trim() || undefined,
    hook: isPlaceholder(item.hook) ? undefined : String(item.hook || '').trim() || undefined,
    shotPlan,
    copyPlan,
    musicPlan,
    visualNotes: isPlaceholder(item.visualNotes)
      ? undefined
      : String(item.visualNotes || '').trim() || undefined,
    transcript: isPlaceholder(item.transcript)
      ? undefined
      : String(item.transcript || '').trim() || undefined
  }
}

function mergeAiEnrichment(
  base: InspirationImportDraft[],
  aiItems: InspirationImportDraft[]
): InspirationImportDraft[] {
  if (!aiItems.length) return base
  return base.map((item, index) => {
    const byUrl = item.referenceUrl
      ? aiItems.find((ai) => ai.referenceUrl && cleanUrl(ai.referenceUrl) === item.referenceUrl)
      : undefined
    const ai = byUrl || aiItems[index]
    if (!ai) return item
    return {
      ...item,
      title: !isPlaceholder(ai.title) && ai.title ? ai.title : item.title,
      angle: !isPlaceholder(ai.angle) && ai.angle ? ai.angle : item.angle,
      hook: !isPlaceholder(ai.hook) && ai.hook ? ai.hook : item.hook,
      shotPlan: ai.shotPlan?.length ? ai.shotPlan : item.shotPlan,
      copyPlan: ai.copyPlan?.length ? ai.copyPlan : item.copyPlan,
      musicPlan: ai.musicPlan?.length ? ai.musicPlan : item.musicPlan,
      visualNotes: !isPlaceholder(ai.visualNotes) && ai.visualNotes ? ai.visualNotes : item.visualNotes,
      transcript: !isPlaceholder(ai.transcript) && ai.transcript ? ai.transcript : item.transcript
    }
  })
}

/** 批量导入：链接程序拆解为主，AI 只做润色 */
export async function parseInspirationBatchImport(raw: string) {
  const text = raw.trim()
  if (!text) return { ok: false as const, drafts: [] as InspirationImportDraft[], content: '请先粘贴内容' }

  const base = parseInspirationLinksFirst(text)
    .map((item, index) => normalizeDraft(item, index))
    .filter((item): item is InspirationImportDraft => Boolean(item))

  if (!base.length) {
    return { ok: false as const, drafts: [], content: '没有识别到链接或可用文本' }
  }

  // 有明确链接时，AI 失败也不影响条数
  try {
    const result = await aiParseStructured<{ items?: InspirationImportDraft[] } | InspirationImportDraft[]>(
      `你是内容运营助手。用户已经用程序拆出了链接，请只润色每条的标题、拍摄镜头和角度。
硬性规则：
1. items 数量必须与输入链接数一致，顺序一致
2. referenceUrl 必须原样保留，禁止改成 https://...
3. 禁止输出「灵感标题」「镜头1」「开头钩子」这类占位示例
4. shotPlan 从拍摄要求原文拆成具体动作步骤`,
      JSON.stringify(
        base.map((item) => ({
          referenceUrl: item.referenceUrl,
          text: item.visualNotes || item.angle || item.title
        })),
        null,
        2
      ),
      `{"items":[{"title":"真实标题","referenceUrl":"必须是完整真实链接","angle":"角度","hook":"","shotPlan":["动作1","动作2"],"copyPlan":[],"visualNotes":"拍摄要求原文"}]}`
    )

    if (result.ok) {
      const payload = result.data
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : []
      const aiDrafts = list
        .map((item, index) => normalizeDraft(item, index))
        .filter((item): item is InspirationImportDraft => Boolean(item))
      const merged = mergeAiEnrichment(base, aiDrafts)
      return { ok: true as const, drafts: merged, content: `已识别 ${merged.length} 条（链接优先）` }
    }
  } catch {
    /* ignore AI enrich errors */
  }

  return {
    ok: true as const,
    drafts: base,
    content: `已按链接拆出 ${base.length} 条（AI 润色跳过）`
  }
}
