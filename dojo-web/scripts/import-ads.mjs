/**
 * 导入「2049 投流.xlsx」
 *  - 投放目标 sheet  → 项目级投放目标与进度（检阅面板数据源）
 *  - 其余 19 个 sheet → 每个项目的逐条视频投放记录
 *  - 由视频记录聚合出买量账号（云机编号 / 账号链接）监看数据
 *
 * 运行: npm run import:ads
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../src/mock/dojo/imported')

const SRC = process.argv[2] || 'C:/coding/2049 投流.xlsx'
const YEAR = 2026
const TARGET_SHEET = '投放目标'

// ── 基础解析 ──────────────────────────────────────────────

function sheetRows(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
}

function text(v) {
  return v == null ? '' : String(v).replace(/\s+/g, ' ').trim()
}

/** "3,486,098" / "1 240 653" → 3486098；非数值返回 null */
function num(v) {
  if (v == null) return null
  const s = String(v).replace(/[,\s]/g, '')
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** "69.72%" → 0.6972 */
function pct(v) {
  if (v == null) return null
  const s = String(v).replace(/[\s,]/g, '')
  const m = s.match(/^(-?\d+(?:\.\d+)?)%$/)
  if (m) return Number(m[1]) / 100
  return null
}

/**
 * 中文/斜杠混合日期 → YYYY-MM-DD
 * 支持 2026/4/15（暂定）、2026年7月30日、7月20日、4月28日
 * 「已完成」「已完结」等状态词返回 null，由 statusText 承载
 */
function parseDate(v) {
  const s = text(v)
  if (!s) return null
  let m = s.match(/(\d{4})\s*[年/-]\s*(\d{1,2})\s*[月/-]\s*(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/)
  if (m) return `${YEAR}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})$/)
  if (m) return `${YEAR}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

/** 归一化名称，用于把「投放目标」行和项目 sheet 对上 */
function normalizeName(s) {
  return text(s)
    .toLowerCase()
    .replace(/balst/g, 'blast')
    .replace(/xors/g, 'xros')
    .replace(/[（）()【】\[\]．.\s_\-—/\\&]/g, '')
    .replace(/垂类/g, '')
}

/** 拆成可比对的 token：英文数字串 + 单个汉字 */
function tokenize(s) {
  const n = normalizeName(s)
  const tokens = new Set()
  for (const m of n.matchAll(/[a-z]+|\d+(?:\.\d+)?/g)) tokens.add(m[0])
  for (const ch of n.replace(/[a-z0-9.]/g, '')) tokens.add(ch)
  return tokens
}

/** 共有 token 的字符总长，长词（产品名）权重自然更高 */
function matchScore(a, b) {
  let hit = 0
  for (const t of a) if (b.has(t)) hit += t.length
  return hit
}

// ── 投放目标 sheet ────────────────────────────────────────

/**
 * 源表「总播放量 / 目前播放量」两列人工填写时前后颠倒过，
 * 用同行的「播放进度」反推哪列是目标、哪列是实际。
 */
function resolveViews(a, b, progressPct) {
  if (a == null && b == null) return { current: null, target: null }
  if (a == null) return { current: null, target: b }
  if (b == null) return { current: a, target: null }
  if (progressPct == null || a === 0 || b === 0) {
    // 无进度可参照：较大者视为实际播放
    return { current: Math.max(a, b), target: Math.min(a, b) }
  }
  const errAB = Math.abs(a / b - progressPct)
  const errBA = Math.abs(b / a - progressPct)
  return errAB <= errBA ? { current: a, target: b } : { current: b, target: a }
}

function parseTargets(wb) {
  const rows = sheetRows(wb, TARGET_SHEET)
  const out = []
  let project = ''
  let region = ''

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || []
    if (!r.some((c) => text(c))) continue

    const ownsIdentity = !!(text(r[0]) || text(r[1]) || text(r[2]))
    if (text(r[0])) project = text(r[0])
    if (text(r[1])) region = text(r[1])
    const product = text(r[2])

    // 合并单元格下方的续行没有自己的项目/地区/产品，只有当它带日期时才算有效行，
    // 否则就是表尾那种游离的汇总数字
    if (!ownsIdentity && !text(r[11]) && !text(r[12])) continue

    const viewsProgress = pct(r[7])
    // 有一行把实际播放量误填进了「播放进度」列（原始数字而非百分比）
    const strayViews = pct(r[7]) == null ? num(r[7]) : null
    const { current, target } = resolveViews(
      num(r[3]) ?? strayViews,
      num(r[4]),
      viewsProgress ?? (strayViews != null && num(r[4]) ? strayViews / num(r[4]) : null)
    )

    const currentCount = num(r[5])
    const totalCount = num(r[6])
    const countDone = /已完成|已完结/.test(text(r[5]))

    // 只有项目名而无任何指标的行是分组表头，跳过
    if (!project) continue
    if (current == null && target == null && currentCount == null && totalCount == null) continue

    const deadline = parseDate(r[12])
    const deadlineText = text(r[12])
    const updatedAt = parseDate(r[11])
    const adPlatformViews = num(r[14])

    const finished = /已完成|已完结/.test(text(r[13])) || /已完成|已完结/.test(deadlineText)

    const viewsRate = target ? (current ?? 0) / target : viewsProgress
    const countRate =
      totalCount && currentCount != null ? currentCount / totalCount : pct(r[8])

    out.push({
      id: `AD-${String(out.length + 1).padStart(3, '0')}`,
      project,
      region,
      product,
      targetViews: target,
      currentViews: current,
      currentCount: countDone ? totalCount : currentCount,
      totalCount,
      countFinished: countDone,
      viewsRate: viewsRate ?? null,
      countRate: countRate ?? null,
      remainingViews: target != null ? target - (current ?? 0) : null,
      updatedAt,
      updatedAtText: text(r[11]),
      deadline,
      deadlineText,
      adPlatformViews,
      finished
    })
  }
  return out
}

// ── 项目视频 sheet ────────────────────────────────────────

const COL_ALIASES = {
  date: ['日期'],
  platform: ['平台'],
  device: ['云机编号'],
  accountUrl: ['账号链接'],
  videoUrl: ['视频链接'],
  content: ['内容'],
  naturalViews: ['自然流'],
  code: ['code'],
  region: ['投放区域'],
  note: ['备注'],
  views: ['播放量'],
  feedback: ['投流反馈'],
  status: ['状态（慧颖侧）', '初始投流状态（慧颖侧）']
}

function buildColumnMap(header) {
  const map = {}
  header.forEach((h, idx) => {
    const name = text(h)
    if (!name) return
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (map[key] != null) continue
      if (aliases.some((a) => a.toLowerCase() === name.toLowerCase())) map[key] = idx
    }
  })
  return map
}

/** 「0717已投」「已投放」→ 已投放；空 → 待投放 */
function normalizeStatus(feedback, status) {
  const s = `${text(feedback)} ${text(status)}`
  if (/已投|已完成/.test(s)) return '已投放'
  if (/暂不|停投|不投/.test(s)) return '暂不投放'
  if (text(feedback) || text(status)) return '跟进中'
  return '待投放'
}

function parseProjectSheet(wb, name) {
  const rows = sheetRows(wb, name)
  if (rows.length < 2) return null
  const cols = buildColumnMap(rows[0] || [])
  if (cols.videoUrl == null) return null

  const videos = []
  let lastDate = null

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || []
    const videoUrl = text(r[cols.videoUrl])
    if (!videoUrl) continue

    const d = cols.date != null ? parseDate(r[cols.date]) : null
    if (d) lastDate = d

    videos.push({
      id: `${normalizeName(name)}-${i}`,
      batch: text(name),
      date: d || lastDate,
      platform: cols.platform != null ? text(r[cols.platform]) : '',
      device: cols.device != null ? text(r[cols.device]) : '',
      accountUrl: cols.accountUrl != null ? text(r[cols.accountUrl]) : '',
      videoUrl,
      content: cols.content != null ? text(r[cols.content]) : '',
      naturalViews: cols.naturalViews != null ? num(r[cols.naturalViews]) : null,
      views: cols.views != null ? num(r[cols.views]) : null,
      code: cols.code != null ? text(r[cols.code]) : '',
      region: cols.region != null ? text(r[cols.region]) : '',
      note: cols.note != null ? text(r[cols.note]) : '',
      feedback: cols.feedback != null ? text(r[cols.feedback]) : '',
      status: normalizeStatus(
        cols.feedback != null ? r[cols.feedback] : null,
        cols.status != null ? r[cols.status] : null
      )
    })
  }
  if (!videos.length) return null

  const dates = videos.map((v) => v.date).filter(Boolean).sort()
  return {
    batch: text(name),
    videoCount: videos.length,
    deliveredCount: videos.filter((v) => v.status === '已投放').length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    totalNaturalViews: videos.reduce((n, v) => n + (v.naturalViews || 0), 0),
    totalViews: videos.reduce((n, v) => n + (v.views || 0), 0),
    videos
  }
}

// ── 主流程 ────────────────────────────────────────────────

const wb = XLSX.readFile(SRC)
const adTargets = parseTargets(wb)

const adBatches = []
for (const name of wb.SheetNames) {
  if (name === TARGET_SHEET) continue
  const parsed = parseProjectSheet(wb, name)
  if (parsed) adBatches.push(parsed)
}

// 把目标行与视频批次对上（名称归一化后互相包含即视为同一项目）
const batchTokens = adBatches.map((b) => ({ batch: b.batch, tokens: tokenize(b.batch) }))
for (const t of adTargets) {
  const tokens = tokenize(`${t.project} ${t.region} ${t.product}`)
  let best = null
  let bestScore = 0
  for (const b of batchTokens) {
    const score = matchScore(b.tokens, tokens)
    if (score > bestScore) {
      bestScore = score
      best = b.batch
    }
  }
  t.batch = bestScore >= 4 ? best : null
}

// 投放时间线：优先用视频批次的真实起止，缺失时回落到目标行的截止日
const adTimeline = adTargets
  .map((t) => {
    const b = adBatches.find((x) => x.batch === t.batch)
    const start = b?.firstDate || null
    const end = t.deadline || b?.lastDate || null
    if (!start && !end) return null
    return {
      id: t.id,
      name: [t.project, t.region].filter(Boolean).join(' · '),
      project: t.project,
      region: t.region,
      product: t.product || '未标注',
      startDate: start || end,
      endDate: end || start,
      status: t.finished ? '已完成' : (t.viewsRate ?? 0) >= 1 ? '已达标' : start ? '投放中' : '未开始',
      viewsRate: t.viewsRate,
      currentViews: t.currentViews,
      targetViews: t.targetViews,
      videoCount: b?.videoCount ?? null
    }
  })
  .filter(Boolean)
  .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

// 买量账号监看：按 云机编号 + 账号链接 聚合
const buyerMap = new Map()
for (const b of adBatches) {
  for (const v of b.videos) {
    const key = v.device || v.accountUrl
    if (!key) continue
    if (!buyerMap.has(key)) {
      buyerMap.set(key, {
        device: v.device,
        accountUrl: v.accountUrl,
        platform: v.platform || 'TikTok',
        batches: new Set(),
        videoCount: 0,
        deliveredCount: 0,
        totalNaturalViews: 0,
        totalViews: 0,
        naturalSamples: 0,
        firstDate: v.date,
        lastDate: v.date
      })
    }
    const a = buyerMap.get(key)
    a.batches.add(b.batch)
    a.videoCount++
    if (v.status === '已投放') a.deliveredCount++
    if (v.naturalViews != null) {
      a.totalNaturalViews += v.naturalViews
      a.naturalSamples++
    }
    if (v.views != null) a.totalViews += v.views
    if (v.accountUrl && !a.accountUrl) a.accountUrl = v.accountUrl
    if (v.date) {
      if (!a.firstDate || v.date < a.firstDate) a.firstDate = v.date
      if (!a.lastDate || v.date > a.lastDate) a.lastDate = v.date
    }
  }
}

const adAccounts = [...buyerMap.values()]
  .map((a) => ({
    device: a.device,
    accountUrl: a.accountUrl,
    platform: a.platform,
    batches: [...a.batches],
    videoCount: a.videoCount,
    deliveredCount: a.deliveredCount,
    totalNaturalViews: a.totalNaturalViews,
    totalViews: a.totalViews,
    avgNaturalViews: a.naturalSamples ? Math.round(a.totalNaturalViews / a.naturalSamples) : null,
    firstDate: a.firstDate,
    lastDate: a.lastDate
  }))
  .sort((x, y) => y.videoCount - x.videoCount)

const adVideos = adBatches.flatMap((b) => b.videos)

const summary = {
  importedAt: new Date().toISOString(),
  sourceFile: path.basename(SRC),
  counts: {
    targets: adTargets.length,
    batches: adBatches.length,
    videos: adVideos.length,
    accounts: adAccounts.length,
    timeline: adTimeline.length
  },
  totals: {
    targetViews: adTargets.reduce((n, t) => n + (t.targetViews || 0), 0),
    currentViews: adTargets.reduce((n, t) => n + (t.currentViews || 0), 0)
  }
}

fs.mkdirSync(outDir, { recursive: true })

const ts = `/** AUTO-GENERATED by scripts/import-ads.mjs — 勿手改，改 Excel 后重跑 npm run import:ads */
/* eslint-disable */

export interface AdTarget {
  id: string
  project: string
  region: string
  product: string
  targetViews: number | null
  currentViews: number | null
  currentCount: number | null
  totalCount: number | null
  countFinished: boolean
  viewsRate: number | null
  countRate: number | null
  remainingViews: number | null
  updatedAt: string | null
  updatedAtText: string
  deadline: string | null
  deadlineText: string
  adPlatformViews: number | null
  finished: boolean
  batch: string | null
}

export interface AdVideo {
  id: string
  batch: string
  date: string | null
  platform: string
  device: string
  accountUrl: string
  videoUrl: string
  content: string
  naturalViews: number | null
  views: number | null
  code: string
  region: string
  note: string
  feedback: string
  status: string
}

export interface AdBatch {
  batch: string
  videoCount: number
  deliveredCount: number
  firstDate: string | null
  lastDate: string | null
  totalNaturalViews: number
  totalViews: number
  videos: AdVideo[]
}

export interface AdTimelineItem {
  id: string
  name: string
  project: string
  region: string
  product: string
  startDate: string
  endDate: string
  status: string
  viewsRate: number | null
  currentViews: number | null
  targetViews: number | null
  videoCount: number | null
}

export interface AdAccount {
  device: string
  accountUrl: string
  platform: string
  batches: string[]
  videoCount: number
  deliveredCount: number
  totalNaturalViews: number
  totalViews: number
  avgNaturalViews: number | null
  firstDate: string | null
  lastDate: string | null
}

export const adSummary = ${JSON.stringify(summary, null, 2)} as const

export const adTargets: AdTarget[] = ${JSON.stringify(adTargets, null, 2)}

export const adTimeline: AdTimelineItem[] = ${JSON.stringify(adTimeline, null, 2)}

export const adAccounts: AdAccount[] = ${JSON.stringify(adAccounts, null, 2)}

export const adVideos: AdVideo[] = ${JSON.stringify(adVideos, null, 2)}

export const adBatches: Omit<AdBatch, 'videos'>[] = ${JSON.stringify(
  adBatches.map(({ videos, ...rest }) => rest),
  null,
  2
)}
`

fs.writeFileSync(path.join(outDir, 'ads.ts'), ts)
console.log(JSON.stringify(summary, null, 2))
console.log('\n未匹配到视频批次的目标行：')
adTargets.filter((t) => !t.batch).forEach((t) => console.log(' -', t.project, '|', t.region))
