/**
 * 从任意文档/文本里把 TikTok 账号捞出来。
 *
 * 这里刻意不去认表格字段。各产品线的规划表、数据表列名都不一样，逐张表写
 * 映射规则既脆又没完；而账号本身的形态是固定的（@handle 或作品链接），
 * 认账号就够了 —— 账号入册后指标由 RapidAPI 补齐。
 */
import * as XLSX from 'xlsx'

/** TikTok 用户名允许字母、数字、下划线和点 */
const HANDLE_CHARS = '[A-Za-z0-9._]{2,24}'
const LINK_RE = new RegExp(`tiktok\\.com/@(${HANDLE_CHARS})`, 'gi')
const MENTION_RE = new RegExp(`(^|[^A-Za-z0-9._@])@(${HANDLE_CHARS})`, 'g')

export type CandidateConfidence = 'high' | 'low'

export interface AccountCandidate {
  handle: string
  link: string
  /** high：来自作品/主页链接；low：正文里的 @ 提及，可能只是品牌方或合作方 */
  confidence: CandidateConfidence
  /** 出现次数，多次出现的更可能是自家矩阵账号 */
  hits: number
  /** 第一次出现的上下文，供人工判断 */
  context: string
}

function trimContext(text: string, index: number, len: number) {
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + len + 40)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

/** 从纯文本抽取账号候选，链接型优先，正文 @ 提及降级 */
export function extractHandlesFromText(text: string): AccountCandidate[] {
  const found = new Map<string, AccountCandidate>()

  const record = (
    raw: string,
    confidence: CandidateConfidence,
    index: number,
    matchLen: number
  ) => {
    const handle = raw.toLowerCase()
    // 纯数字的多是 ID 片段，不是账号名
    if (/^\d+$/.test(handle)) return
    const existing = found.get(handle)
    if (existing) {
      existing.hits++
      if (confidence === 'high' && existing.confidence === 'low') {
        existing.confidence = 'high'
        existing.link = `https://www.tiktok.com/@${raw}`
      }
      return
    }
    found.set(handle, {
      handle: `@${raw}`,
      link: confidence === 'high' ? `https://www.tiktok.com/@${raw}` : '',
      confidence,
      hits: 1,
      context: trimContext(text, index, matchLen)
    })
  }

  for (const m of text.matchAll(LINK_RE)) {
    record(m[1], 'high', m.index ?? 0, m[0].length)
  }
  for (const m of text.matchAll(MENTION_RE)) {
    record(m[2], 'low', m.index ?? 0, m[0].length)
  }

  return [...found.values()].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1
    return b.hits - a.hits
  })
}

export interface ParsedDocument {
  name: string
  kind: 'excel' | 'word' | 'text' | 'unsupported'
  text: string
  /** Excel 的工作表名，用来告诉用户读到了什么 */
  sheets?: string[]
  error?: string
}

async function readExcel(file: File): Promise<ParsedDocument> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  // 整表转 CSV 后统一走文本抽取，省掉逐表认列名
  const text = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]
    return `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`
  }).join('\n\n')
  return { name: file.name, kind: 'excel', text, sheets: wb.SheetNames }
}

async function readWord(file: File): Promise<ParsedDocument> {
  const mammoth = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return { name: file.name, kind: 'word', text: result.value }
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const lower = file.name.toLowerCase()
  try {
    if (/\.(xlsx|xls|xlsm)$/.test(lower)) return await readExcel(file)
    if (/\.docx$/.test(lower)) return await readWord(file)
    if (/\.(csv|txt|json|md|tsv)$/.test(lower)) {
      return { name: file.name, kind: 'text', text: await file.text() }
    }
    if (/\.doc$/.test(lower)) {
      return {
        name: file.name,
        kind: 'unsupported',
        text: '',
        error: '旧版 .doc 无法在浏览器里解析，请另存为 .docx 后再上传'
      }
    }
    return {
      name: file.name,
      kind: 'unsupported',
      text: '',
      error: '暂不支持该格式，可支持 xlsx / xls / docx / csv / txt / json'
    }
  } catch (e) {
    return {
      name: file.name,
      kind: 'unsupported',
      text: '',
      error: e instanceof Error ? e.message : '解析失败'
    }
  }
}

export interface ExtractResult {
  documents: ParsedDocument[]
  candidates: AccountCandidate[]
}

/** 解析一批文件并汇总候选账号，跨文件出现的会累加命中次数 */
export async function extractAccountsFromFiles(files: File[]): Promise<ExtractResult> {
  const documents: ParsedDocument[] = []
  const merged = new Map<string, AccountCandidate>()

  for (const file of files) {
    const doc = await parseDocument(file)
    documents.push(doc)
    if (!doc.text) continue
    extractHandlesFromText(doc.text).forEach((c) => {
      const key = c.handle.toLowerCase()
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, c)
        return
      }
      existing.hits += c.hits
      if (c.confidence === 'high' && existing.confidence === 'low') {
        existing.confidence = 'high'
        existing.link = c.link
      }
    })
  }

  const candidates = [...merged.values()].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1
    return b.hits - a.hits
  })

  return { documents, candidates }
}
