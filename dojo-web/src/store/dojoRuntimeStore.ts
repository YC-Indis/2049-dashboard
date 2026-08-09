import { computed, reactive } from 'vue'
import { accountMonitor, accountPlans, distributionRecords } from '@/mock/dojo/imported'
import type {
  AdAccount,
  AdBatch,
  AdTarget,
  AdTimelineItem,
  AdVideo
} from '@/mock/dojo/imported/ads'
import { getProjectById } from '@/store/dojoProjectStore'
import { patchProjectCurrent } from '@/store/dojoProjectRuntime'
import { removeScheduleBlock, upsertScheduleBlock } from '@/store/dojoScheduleStore'
import { normalizeDateString } from '@/utils/dojoDates'

/**
 * 分发数据的运行时层。
 *
 * Excel 导入的 `distributionRecords` 是只读原始数据；这里在它之上做一层可写视图，
 * 让投放检阅 / 视频监控 / 买量监看 / 时间规划读到的都是同一份、且能被页面上的
 * 增删改实时刷新。写入分发记录会顺带在排期里留一条「分发跟进」，并回写项目
 * 的分发量与曝光量。
 */

export type FlowType = '自然流' | '投流' | '自然流+投流' | '纯自然流' | '未确定'

export interface DistributionRow {
  id: string
  projectId?: string
  account: string
  /** 已规范成 YYYY-MM-DD，无日期时为 '—' */
  publishDate: string
  videoUrl: string
  naturalViews: number | null
  paidViews: number
  adCompleteTime: string
  note: string
  engagementRate: number | null
  retention3s: number | null
  flowType: FlowType
  status: '投放中' | '已完成'
  syncSource: 'excel' | 'manual'
}

/** 从备注与投放完成时间里判断这条是自然流、投流还是两者都有 */
export function resolveFlowType(note?: string, adCompleteTime?: string): FlowType {
  const text = `${note || ''} ${adCompleteTime || ''}`
  if (/自然流\s*\+\s*投流/.test(text)) return '自然流+投流'
  if (/纯自然流/.test(text)) return '纯自然流'
  if (/^自然流$/.test((note || '').trim())) return '自然流'
  if (/^投流$/.test((note || '').trim())) return '投流'
  if (/自然流/.test(text) && /投流/.test(text)) return '自然流+投流'
  return '未确定'
}

function toPublishDate(raw: string | number | null | undefined): string {
  return normalizeDateString(raw) || '—'
}

interface BatchMeta {
  id: string
  batch: string
  region: string
  targetViews: number
  deadline: string
  totalCount: number
}

/** 目前有周期目标的两个在跑项目 */
const RUNTIME_PROJECT_IDS = ['matrix-xros6-uk', 'matrix-xros6-de'] as const

function batchMeta(projectId?: string): BatchMeta {
  if (projectId === 'matrix-xros6-de') {
    return {
      id: 'matrix-xros6-de',
      batch: 'xros6 德国2.0',
      region: '德国',
      targetViews: 15000,
      deadline: '2026-08-31',
      totalCount: 16
    }
  }
  return {
    id: 'matrix-xros6-uk',
    batch: 'xros6 英国2.0',
    region: '英国',
    targetViews: 30000,
    deadline: '2026-08-31',
    totalCount: 40
  }
}

function toHandle(account: string): string {
  return account.startsWith('@') ? account : `@${account.replace(/^@/, '')}`
}

/** 账号没带项目时，回查矩阵规划与监控表把它归到某个项目 */
export function resolveProjectId(account: string, projectId?: string): string | undefined {
  if (projectId) return projectId
  const handle = toHandle(account)
  const plan = accountPlans.find((p) =>
    p.accounts.some((a) => toHandle(a.name || '').toLowerCase() === handle.toLowerCase())
  )
  if (plan?.projectId) return plan.projectId
  const monitored = accountMonitor.find((m) => m.account.toLowerCase() === handle.toLowerCase())
  return monitored?.projectId
}

function toRow(r: (typeof distributionRecords)[number]): DistributionRow {
  const note = r.note || ''
  const adCompleteTime = r.adCompleteTime || ''
  return {
    id: r.id,
    projectId: r.projectId,
    account: r.account,
    publishDate: toPublishDate(r.publishDate),
    videoUrl: r.videoUrl,
    naturalViews: r.naturalViews,
    paidViews: r.paidViews || 0,
    adCompleteTime,
    note,
    engagementRate: r.engagementRate,
    retention3s: r.retention3s,
    flowType: resolveFlowType(note, adCompleteTime),
    status: /投放中|暂未开始投放/.test(adCompleteTime || note) ? '投放中' : '已完成',
    syncSource: 'excel'
  }
}

export const dojoRuntimeStore = reactive({
  distributions: distributionRecords.map(toRow),
  /** 显式的失效计数：整表替换时用它统一触发下游 computed 重算 */
  revision: 0
})

function touch() {
  dojoRuntimeStore.revision += 1
  syncScheduleProgress()
}

function sortedDates(dates: (string | null)[]): string[] {
  return dates.filter((d): d is string => !!d && d !== '—').sort()
}

export const runtimeDistributions = computed(() => {
  void dojoRuntimeStore.revision
  return dojoRuntimeStore.distributions
})

export const runtimeAdVideos = computed<AdVideo[]>(() => {
  void dojoRuntimeStore.revision
  return dojoRuntimeStore.distributions.map((d, i) => {
    const meta = batchMeta(d.projectId)
    const views = (d.naturalViews || 0) + (d.paidViews || 0)
    const device = (d.account || '').replace(/^@/, '')
    return {
      id: d.id || `AV-${i + 1}`,
      batch: meta.batch,
      date: d.publishDate === '—' ? null : d.publishDate,
      platform: 'TikTok',
      device,
      accountUrl: device ? `https://www.tiktok.com/@${device}` : '',
      videoUrl: d.videoUrl || '',
      content: d.account || '',
      naturalViews: d.naturalViews ?? 0,
      views,
      code: '',
      region: meta.region,
      note: d.note || '',
      feedback: '',
      status: views > 0 ? '已投放' : '跟进中'
    }
  })
})

export const runtimeAdBatches = computed<Omit<AdBatch, 'videos'>[]>(() => {
  const videos = runtimeAdVideos.value
  return RUNTIME_PROJECT_IDS.map((projectId) => {
    const meta = batchMeta(projectId)
    const rows = videos.filter((v) => v.batch === meta.batch)
    const dates = sortedDates(rows.map((v) => v.date))
    return {
      batch: meta.batch,
      videoCount: rows.length,
      deliveredCount: rows.filter((v) => v.status === '已投放').length,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      totalNaturalViews: rows.reduce((sum, v) => sum + (v.naturalViews || 0), 0),
      totalViews: rows.reduce((sum, v) => sum + (v.views || 0), 0)
    }
  })
})

export const runtimeAdAccounts = computed<(AdAccount & { id: string; custom: boolean })[]>(() => {
  void dojoRuntimeStore.revision
  const accounts = [...new Set(dojoRuntimeStore.distributions.map((d) => d.account))].filter(
    Boolean
  )
  return accounts.map((account, i) => {
    const rows = dojoRuntimeStore.distributions.filter((d) => d.account === account)
    const meta = batchMeta(rows[0]?.projectId)
    const dates = sortedDates(rows.map((d) => d.publishDate))
    const totalNaturalViews = rows.reduce((sum, d) => sum + (d.naturalViews || 0), 0)
    const totalViews = rows.reduce((sum, d) => sum + (d.naturalViews || 0) + (d.paidViews || 0), 0)
    const device = account.replace(/^@/, '')
    return {
      id: `AA-${device || i + 1}`,
      device,
      accountUrl: `https://www.tiktok.com/@${device}`,
      platform: 'TikTok',
      batches: [meta.batch],
      videoCount: rows.length,
      deliveredCount: rows.length,
      totalNaturalViews,
      totalViews,
      avgNaturalViews: rows.length ? Math.round(totalNaturalViews / rows.length) : null,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      custom: false
    }
  })
})

/** 投放目标带上 projectId，预警时才能和项目的时间进度对比 */
export type RuntimeAdTarget = AdTarget & { projectId: string }

export const runtimeAdTargets = computed<RuntimeAdTarget[]>(() => {
  const batches = runtimeAdBatches.value
  return RUNTIME_PROJECT_IDS.map((projectId) => {
    const meta = batchMeta(projectId)
    const batch = batches.find((b) => b.batch === meta.batch)!
    const currentViews = batch.totalViews
    const targetViews = meta.targetViews
    const viewsRate = targetViews ? currentViews / targetViews : null
    const currentCount = batch.videoCount
    return {
      id: `AD-${projectId}`,
      projectId,
      project: meta.batch,
      region: meta.region,
      product: 'XROS 6',
      targetViews,
      currentViews,
      currentCount,
      totalCount: meta.totalCount,
      countFinished: currentCount >= meta.totalCount,
      viewsRate,
      countRate: meta.totalCount ? currentCount / meta.totalCount : null,
      remainingViews: Math.max(0, targetViews - currentViews),
      updatedAt: batch.lastDate,
      updatedAtText: batch.lastDate || '—',
      deadline: meta.deadline,
      deadlineText: meta.deadline,
      adPlatformViews: null,
      finished: (viewsRate ?? 0) >= 1,
      batch: meta.batch
    }
  })
})

export const runtimeAdTimeline = computed<AdTimelineItem[]>(() =>
  runtimeAdTargets.value.map((t) => {
    const batch = runtimeAdBatches.value.find((b) => b.batch === t.batch)
    return {
      id: `AT-${t.id}`,
      name: t.project,
      project: t.project,
      region: t.region,
      product: t.product,
      startDate: batch?.firstDate || '2026-07-01',
      endDate: batch?.lastDate || t.deadline || '2026-08-07',
      status: t.finished ? '已完成' : '投放中',
      viewsRate: t.viewsRate,
      currentViews: t.currentViews,
      targetViews: t.targetViews,
      videoCount: t.currentCount
    }
  })
)

function scheduleBlockId(distributionId: string): string {
  return `rt-dist-${distributionId}`
}

/** 把分发量 / 曝光量 / 账号数回写到项目 KPI，健康诊断随之更新 */
function syncScheduleProgress() {
  for (const projectId of RUNTIME_PROJECT_IDS) {
    const rows = dojoRuntimeStore.distributions.filter(
      (d) => (d.projectId || resolveProjectId(d.account)) === projectId
    )
    const accounts = new Set(rows.map((d) => d.account))
    patchProjectCurrent(projectId, {
      distributed: rows.length,
      exposure: rows.reduce((sum, d) => sum + (d.naturalViews || 0) + (d.paidViews || 0), 0),
      ...(accounts.size ? { accounts: accounts.size } : {})
    })
  }
}

function syncScheduleBlock(row: DistributionRow) {
  const date = row.publishDate
  if (!date || date === '—') return
  const projectId = resolveProjectId(row.account, row.projectId) || 'matrix-xros6-uk'
  const project = getProjectById(projectId)
  upsertScheduleBlock({
    id: scheduleBlockId(row.id),
    projectId,
    projectName: project?.name || projectId,
    title: `分发跟进 ${row.account}`,
    type: 'publish',
    start: date,
    end: date,
    note: row.naturalViews != null ? `自然播 ${row.naturalViews}` : row.note || '',
    source: 'distribution',
    status: '进行中'
  })
}

export function upsertDistribution(row: DistributionRow): DistributionRow {
  const next = { ...row, projectId: resolveProjectId(row.account, row.projectId) }
  const idx = dojoRuntimeStore.distributions.findIndex((d) => d.id === next.id)
  if (idx >= 0) dojoRuntimeStore.distributions[idx] = next
  else dojoRuntimeStore.distributions.unshift(next)
  syncScheduleBlock(next)
  touch()
  return next
}

/** 批量导入：倒序写入，保证页面上看到的顺序与文件一致 */
export function importDistributions(rows: DistributionRow[]): DistributionRow[] {
  const out: DistributionRow[] = []
  for (const row of [...rows].reverse()) out.push(upsertDistribution(row))
  return out
}

export function removeDistribution(id: string) {
  dojoRuntimeStore.distributions = dojoRuntimeStore.distributions.filter((d) => d.id !== id)
  removeScheduleBlock(scheduleBlockId(id))
  touch()
}

export function refreshRuntime() {
  touch()
}

syncScheduleProgress()
