/** 内容流转明细 — 来自 dojo脚本.xlsx / dojo数据.xlsx（scripts/import-excel.mjs 生成） */
import {
  accountPlans,
  accountMonitor,
  distributionRecords,
  weeklyScripts,
  workflowStages,
  type DistributionRecord,
  type WeeklyScriptRow
} from './imported'

export type { DistributionRecord, WeeklyScriptRow }
export { accountPlans, accountMonitor, distributionRecords, weeklyScripts, workflowStages }

export interface ScriptProgressRow {
  id: string
  week: string
  seq: string
  category: string
  title: string
  refLink: string
  shootReq: string
  clientConfirm: string
  stage: string
  note: string
}

export interface DistributionProgressRow {
  id: string
  account: string
  publishDate: string
  videoUrl: string
  naturalViews?: number | null
  paidViews: number
  adCompleteTime: string
  note: string
  engagementRate?: number | null
  retention3s?: number | null
  flowType: string
  status: string
  syncSource?: 'excel' | 'rapidapi' | 'mock'
}

export interface ExecutionProgressRow {
  id: string
  title: string
  type: string
  owner: string
  progress: number
  dueAt: string
  status: 'todo' | 'doing' | 'blocked' | 'done'
  blockReason?: string
}

function pickTitle(row: WeeklyScriptRow) {
  return (
    String(row['内容方向'] || row['内容细分'] || row['类别'] || row['序号'] || '未命名').trim() ||
    '未命名'
  )
}

export const scriptProgressRows: ScriptProgressRow[] = Object.entries(weeklyScripts).flatMap(
  ([week, rows]) =>
    rows.map((row, idx) => ({
      id: `${week}-${row.rowIndex ?? idx}`,
      week,
      seq: String(row['序号'] || ''),
      category: String(row['类别'] || row['内容细分'] || ''),
      title: pickTitle(row),
      refLink: String(row['参考链接'] || ''),
      shootReq: String(row['拍摄要求'] || row['注意事项'] || '').slice(0, 120),
      clientConfirm: String(row['客户确认'] || '—'),
      stage: String(row['阶段'] || row['状态'] || '脚本库'),
      note: String(row['注意事项'] || row['备注'] || '')
    }))
)

/** 流量类型 ≠ 投放状态。「投放中」是状态，不能当流量类型。 */
function inferFlowType(r: DistributionRecord) {
  const note = r.note || ''
  const ad = r.adCompleteTime || ''
  if (/自然流\s*\+\s*投流/.test(note)) return '自然流+投流'
  if (/纯自然流/.test(note)) return '纯自然流'
  if (/^自然流$/.test(note.trim()) || note === '自然流') return '自然流'
  if (/^投流$/.test(note.trim())) return '投流'
  if (/自然流/.test(note) && /投流/.test(note)) return '自然流+投流'
  if (/自然流/.test(ad) && !/投/.test(note)) return '纯自然流'
  return '未确定'
}

function normalizePublishDate(raw: string) {
  if (!raw || raw === '—') return '—'
  if (/^\d{5}$/.test(raw.trim())) {
    const serial = Number(raw.trim())
    const ms = Date.UTC(1899, 11, 30) + serial * 86400000
    const d = new Date(ms)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return raw
}

export const distributionProgressRows: DistributionProgressRow[] = distributionRecords.map((r) => ({
  id: r.id,
  account: r.account,
  publishDate: normalizePublishDate(r.publishDate || '—'),
  videoUrl: r.videoUrl,
  naturalViews: r.naturalViews,
  paidViews: r.paidViews,
  adCompleteTime: r.adCompleteTime,
  note: r.note,
  engagementRate: r.engagementRate,
  retention3s: r.retention3s,
  flowType: inferFlowType(r),
  status: /投放中|暂未开始投放/.test(r.adCompleteTime || r.note) ? '投放中' : '已完成',
  syncSource: 'excel'
}))

/** 执行进度 — 由时间规划 9 阶段 + Excel 待办推导 */
export const executionProgressRows: ExecutionProgressRow[] = workflowStages.map((s, i) => {
  let progress = 0
  let status: ExecutionProgressRow['status'] = 'todo'
  if (s.status === '已完成') {
    progress = 100
    status = 'done'
  } else if (s.status === '进行中') {
    progress = s.statusLabel.includes('11') ? 55 : 40
    status = 'doing'
  } else if (s.status === '待确认') {
    progress = 90
    status = 'blocked'
  }
  return {
    id: s.id,
    title: s.name,
    type: 'milestone',
    owner: s.owner,
    progress,
    dueAt: s.endDate || '—',
    status,
    blockReason: s.status === '待确认' ? '等待客户确认' : undefined
  }
})
