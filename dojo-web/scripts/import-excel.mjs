/**
 * 从 docs/source 的 dojo 脚本.xlsx / dojo数据.xlsx 生成前端 mock 数据
 * 运行: node scripts/import-excel.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const sourceDir = path.join(root, 'docs/source')
const outDir = path.join(__dirname, '../src/mock/dojo/imported')

function findXlsx(matcher) {
  const files = fs.readdirSync(sourceDir)
  const hit = files.find((f) => matcher(f) && f.endsWith('.xlsx'))
  if (!hit) throw new Error(`找不到匹配的 xlsx: ${matcher}`)
  return path.join(sourceDir, hit)
}

function sheetRows(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
}

function fmtDate(v) {
  if (!v) return null
  const s = String(v).trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return s.slice(0, 10)
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function esc(s) {
  return JSON.stringify(s ?? '')
}

// ── dojo 脚本.xlsx ──
const scriptPath = findXlsx((f) => f.includes('脚本'))
const scriptWb = XLSX.readFile(scriptPath)

function parseStatus(raw) {
  const s = String(raw || '').trim()
  if (s === '已完成') return { status: '已完成', label: '已完成' }
  if (s === '待确认') return { status: '待确认', label: '待确认' }
  const m = s.match(/^\*(\d+)$/)
  if (m) return { status: '进行中', label: `进行中 · ${m[1]}项` }
  if (s) return { status: '进行中', label: s }
  return { status: '未开始', label: '未开始' }
}

/**
 * 时间规划 sheet 第 2 行是日期表头：首列是「13-26」这样的区间（2 月 13 到 26 日），
 * 之后 2/27、2/28，再往后都是 3 月的单日。
 * 每一列返回它覆盖的起止日，区间列不能塌缩成一天，否则甘特图会退化成单日方块。
 */
function buildTimelineColumns(dayRow) {
  const cols = []
  const feb = (d) => `2026-02-${String(d).padStart(2, '0')}`
  const mar = (d) => `2026-03-${String(d).padStart(2, '0')}`
  for (let c = 2; c < (dayRow?.length || 0); c++) {
    const v = dayRow[c]
    if (v == null || String(v).trim() === '') continue
    const s = String(v).trim()
    const range = s.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/)
    if (range) {
      cols.push({ col: c, start: feb(Number(range[1])), end: feb(Number(range[2])) })
      continue
    }
    const day = Number(s)
    if (!Number.isFinite(day)) continue
    const date = c <= 4 ? feb(day) : mar(day)
    cols.push({ col: c, start: date, end: date })
  }
  return cols
}

function colStart(cols, col) {
  return cols.find((d) => d.col === col)?.start ?? null
}

function colEnd(cols, col) {
  return cols.find((d) => d.col === col)?.end ?? null
}

const timeRows = sheetRows(scriptWb, '时间规划')
const timelineColumns = buildTimelineColumns(timeRows[1] || [])
const timelineDates = timelineColumns.map((c) => ({ col: c.col, date: c.start }))
const timelineStart = timelineColumns[0]?.start ?? '2026-02-13'
const timelineEnd = timelineColumns[timelineColumns.length - 1]?.end ?? '2026-03-23'

const workflowStages = []
for (let i = 2; i < timeRows.length; i++) {
  const row = timeRows[i]
  const item = row?.[0]
  if (!item) continue
  const ownerRaw = row[1]
  const owner = ownerRaw === '客户' || ownerRaw === '2049' ? String(ownerRaw) : ownerRaw != null ? String(ownerRaw) : '2049'

  const markCols = []
  let statusInfo = { status: '未开始', label: '未开始' }
  for (let c = 2; c < row.length; c++) {
    if (row[c] == null || String(row[c]).trim() === '') continue
    markCols.push(c)
    statusInfo = parseStatus(row[c])
  }

  const startDate = markCols.length ? colStart(timelineColumns, markCols[0]) : null
  const endDate = markCols.length ? colEnd(timelineColumns, markCols[markCols.length - 1]) : null

  workflowStages.push({
    id: `WF-${i}`,
    name: String(item),
    owner,
    status: statusInfo.status,
    statusLabel: statusInfo.label,
    startDate: startDate || (statusInfo.status === '已完成' ? timelineStart : null),
    endDate: endDate || startDate,
    markCols
  })
}

const accountPlanRows = sheetRows(scriptWb, '账号规划')
const accountPlans = []
let current = null
for (let i = 1; i < accountPlanRows.length; i++) {
  const row = accountPlanRows[i]
  const segment = row?.[0]
  if (segment) {
    current = {
      segment: String(segment),
      plannedCount: num(row[1]),
      activeCount: num(row[2]),
      sceneExample: row[3] ? String(row[3]) : '',
      accounts: []
    }
    accountPlans.push(current)
  }
  const name = row?.[4]
  const link = row?.[5]
  const note = row?.[6]
  if (current && (name || link)) {
    current.accounts.push({
      name: name ? String(name) : '',
      link: link ? String(link) : '',
      note: note ? String(note) : ''
    })
  }
}

const weekSheetNames = [
  ['第一周', 'W1'],
  ['第二周', 'W2'],
  ['第三周', 'W3'],
  ['第四周', 'W4'],
  ['第五周', 'W5']
]
const weeklyScripts = {}
for (const [wn, weekKey] of weekSheetNames) {
  const rows = sheetRows(scriptWb, wn)
  if (!rows.length) continue
  const header = rows[0] || []
  weeklyScripts[weekKey] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.some((c) => c != null && String(c).trim())) continue
    const obj = { week: weekKey, rowIndex: i }
    header.forEach((h, idx) => {
      if (!h) return
      obj[String(h)] = row[idx] != null ? String(row[idx]) : ''
    })
    if (obj['序号'] || obj['内容方向'] || obj['内容细分'] || obj['类别']) {
      weeklyScripts[weekKey].push(obj)
    }
  }
}

// ── dojo数据.xlsx ──
const dataPath = findXlsx((f) => f.includes('数据'))
const dataWb = XLSX.readFile(dataPath)
const dataSheet = dataWb.SheetNames[0]
const dataRows = sheetRows(dataWb, dataSheet)
const distributionRecords = []
for (let i = 1; i < dataRows.length; i++) {
  const row = dataRows[i]
  const account = row?.[0]
  if (!account) continue
  distributionRecords.push({
    id: `D-${String(i).padStart(3, '0')}`,
    account: String(account),
    publishDate: fmtDate(row[1]),
    videoUrl: row[2] ? String(row[2]) : '',
    naturalViews: num(row[3]),
    paidViews: num(row[4]) ?? 0,
    screenshot: row[5] ? String(row[5]) : '',
    adCompleteTime: row[6] ? String(row[6]) : '',
    note: row[7] ? String(row[7]) : '',
    engagementRate: num(row[8]),
    retention3s: num(row[9])
  })
}

// 账号汇总（用于监看面板）
const accountStats = {}
for (const r of distributionRecords) {
  const key = r.account
  if (!accountStats[key]) {
    accountStats[key] = {
      account: key,
      postCount: 0,
      totalPaidViews: 0,
      totalNaturalViews: 0,
      avgEngagement: [],
      avgRetention: [],
      lastPublish: r.publishDate
    }
  }
  const s = accountStats[key]
  s.postCount++
  s.totalPaidViews += r.paidViews || 0
  s.totalNaturalViews += r.naturalViews || 0
  if (r.engagementRate != null) s.avgEngagement.push(r.engagementRate)
  if (r.retention3s != null) s.avgRetention.push(r.retention3s)
  if (r.publishDate && r.publishDate > s.lastPublish) s.lastPublish = r.publishDate
}
const accountMonitor = Object.values(accountStats).map((s) => ({
  account: s.account,
  postCount: s.postCount,
  totalPaidViews: s.totalPaidViews,
  totalNaturalViews: s.totalNaturalViews,
  avgEngagementRate:
    s.avgEngagement.length > 0
      ? s.avgEngagement.reduce((a, b) => a + b, 0) / s.avgEngagement.length
      : null,
  avgRetention3s:
    s.avgRetention.length > 0
      ? s.avgRetention.reduce((a, b) => a + b, 0) / s.avgRetention.length
      : null,
  lastPublish: s.lastPublish
}))

fs.mkdirSync(outDir, { recursive: true })

const summary = {
  importedAt: new Date().toISOString(),
  scriptFile: path.basename(scriptPath),
  dataFile: path.basename(dataPath),
  counts: {
    workflowStages: workflowStages.length,
    accountPlans: accountPlans.length,
    weeklyScripts: Object.fromEntries(Object.entries(weeklyScripts).map(([k, v]) => [k, v.length])),
    distributionRecords: distributionRecords.length,
    accountMonitor: accountMonitor.length,
    timelineStart,
    timelineEnd
  }
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
fs.writeFileSync(path.join(outDir, 'workflowStages.json'), JSON.stringify(workflowStages, null, 2))
fs.writeFileSync(path.join(outDir, 'accountPlans.json'), JSON.stringify(accountPlans, null, 2))
fs.writeFileSync(path.join(outDir, 'weeklyScripts.json'), JSON.stringify(weeklyScripts, null, 2))
fs.writeFileSync(path.join(outDir, 'distributionRecords.json'), JSON.stringify(distributionRecords, null, 2))
fs.writeFileSync(path.join(outDir, 'accountMonitor.json'), JSON.stringify(accountMonitor, null, 2))

// 生成 TS 模块（避免 JSON import 配置问题）
const ts = `/** AUTO-GENERATED by scripts/import-excel.mjs — 勿手改，改 Excel 后重跑脚本 */
/* eslint-disable */

export interface WorkflowStage {
  id: string
  name: string
  owner: string
  status: string
  statusLabel: string
  startDate: string | null
  endDate: string | null
  markCols: number[]
}

export interface AccountPlanAccount {
  name: string
  link: string
  note: string
}

export interface AccountPlan {
  segment: string
  plannedCount: number | null
  activeCount: number | null
  sceneExample: string
  accounts: AccountPlanAccount[]
}

export interface WeeklyScriptRow {
  week: string
  rowIndex: number
  [key: string]: string | number
}

export interface DistributionRecord {
  id: string
  account: string
  publishDate: string | null
  videoUrl: string
  naturalViews: number | null
  paidViews: number
  screenshot: string
  adCompleteTime: string
  note: string
  engagementRate: number | null
  retention3s: number | null
}

export interface AccountMonitorRow {
  account: string
  postCount: number
  totalPaidViews: number
  totalNaturalViews: number
  avgEngagementRate: number | null
  avgRetention3s: number | null
  lastPublish: string | null
}

export const importSummary = ${JSON.stringify(summary, null, 2)} as const

export const timelineStart = ${JSON.stringify(timelineStart)}
export const timelineEnd = ${JSON.stringify(timelineEnd)}
export const timelineDates = ${JSON.stringify(timelineDates)}

export const workflowStages: WorkflowStage[] = ${JSON.stringify(workflowStages, null, 2)}

export const accountPlans: AccountPlan[] = ${JSON.stringify(accountPlans, null, 2)}

export const weeklyScripts: Record<string, WeeklyScriptRow[]> = ${JSON.stringify(weeklyScripts, null, 2)}

export const distributionRecords: DistributionRecord[] = ${JSON.stringify(distributionRecords, null, 2)}

export const accountMonitor: AccountMonitorRow[] = ${JSON.stringify(accountMonitor, null, 2)}
`

fs.writeFileSync(path.join(outDir, 'index.ts'), ts)
console.log(JSON.stringify(summary, null, 2))
