import {
  listProjectPhaseBlocks,
  phaseKeyFromBlockId,
  type PlanPhaseKey
} from '@/store/dojoKpiSchedule'
import { getProjectRuntime, plannedScripts, type ProjectRuntime } from '@/store/dojoProjectRuntime'
import type { ScheduleBlock } from '@/store/dojoScheduleStore'
import { DOJO_TODAY, daysBetween, formatMonthDay } from '@/utils/dojoDates'

export interface ExecutionPhaseGuide {
  key: PlanPhaseKey
  label: string
  objective: string
  actions: string[]
  monitors: string[]
  actionLabel: string
  route: string
}

export type ExecutionTiming = 'active' | 'overdue' | 'upcoming' | 'complete'

export interface ExecutionBrief {
  projectId: string
  blockId: string
  phaseKey: PlanPhaseKey
  phaseLabel: string
  objective: string
  actions: string[]
  monitors: string[]
  monitorSummary: string
  kpiLabel: string
  kpiText: string
  progressPct: number
  timing: ExecutionTiming
  timingLabel: string
  scheduleLabel: string
  actionLabel: string
  route: string
}

export const EXECUTION_PHASE_GUIDES: Record<PlanPhaseKey, ExecutionPhaseGuide> = {
  scripts: {
    key: 'scripts',
    label: '脚本',
    objective: '把已验证案例转成可拍摄、可分发的脚本批次。',
    actions: ['检索与筛选案例', '拆解母题并写脚本', '送审并处理修改'],
    monitors: ['案例质量', '脚本产出', '审核节奏'],
    actionLabel: '进入灵感与脚本',
    route: '/inspiration'
  },
  accounts: {
    key: 'accounts',
    label: '起号',
    objective: '准备能够承接首批内容测试的账号矩阵。',
    actions: ['创建或接入账号', '完善资料与账号环境', '安排首批测试内容'],
    monitors: ['账号状态', '首发反馈', '可用账号缺口'],
    actionLabel: '管理账号接入',
    route: '/account-intake'
  },
  shoot: {
    key: 'shoot',
    label: '拍摄',
    objective: '把脚本批次稳定转化为可剪辑素材库存。',
    actions: ['确认场景与道具', '执行拍摄或补拍', '整理素材并移交剪辑'],
    monitors: ['可拍库存', '素材完整度', '拍摄阻塞'],
    actionLabel: '安排拍摄事项',
    route: '/calendar'
  },
  edit: {
    key: 'edit',
    label: '剪辑',
    objective: '完成成片、过审和返修，形成可分发库存。',
    actions: ['剪辑成片', '提交客户过审', '返修并锁定终版'],
    monitors: ['成片产能', '待审数量', '返修积压'],
    actionLabel: '安排剪辑与过审',
    route: '/calendar'
  },
  distribute: {
    key: 'distribute',
    label: '分发',
    objective: '按账号状态和内容类型安排发布节奏。',
    actions: ['分配账号与素材', '控制单账号发布频次', '回填发布与自然播放'],
    monitors: ['发布频次', '自然播放', '账号承接状态'],
    actionLabel: '进入分发执行',
    route: '/distribution'
  },
  ads: {
    key: 'ads',
    label: '投放',
    objective: '筛选可放大素材，并跟踪后台数据与曝光目标。',
    actions: ['筛选投放素材', '启动或调整投放', '记录后台数据并复盘'],
    monitors: ['自然播放', '后台放大', '累计曝光'],
    actionLabel: '查看投放运营',
    route: '/operations'
  }
}

function normalizePhaseKey(block: ScheduleBlock): PlanPhaseKey | null {
  const key = phaseKeyFromBlockId(block.id, block.projectId)
  if (key === 'approve') return 'edit'
  if (key === 'cycle' || key == null) return null
  return key
}

function pct(current: number, target: number) {
  return target ? Math.min(100, Math.max(0, Math.round((current / target) * 100))) : 0
}

function formatValue(value: number) {
  return value.toLocaleString()
}

function kpiSnapshot(key: PlanPhaseKey, runtime: ProjectRuntime) {
  const { current, kpi } = runtime
  const videoTarget = kpi.videos || 0
  if (key === 'scripts') {
    const target = plannedScripts(kpi)
    const gap = Math.max(0, target - current.scripts)
    return {
      label: '脚本目标',
      text: `${formatValue(current.scripts)}/${formatValue(target)}`,
      monitor: `脚本缺口 ${formatValue(gap)}`,
      progress: pct(current.scripts, target)
    }
  }
  if (key === 'accounts') {
    const gap = Math.max(0, kpi.accounts - current.accounts)
    return {
      label: '账号目标',
      text: `${formatValue(current.accounts)}/${formatValue(kpi.accounts)}`,
      monitor: `可用账号缺口 ${formatValue(gap)}`,
      progress: pct(current.accounts, kpi.accounts)
    }
  }
  if (key === 'shoot') {
    const gap = Math.max(0, videoTarget - current.edited)
    return {
      label: '成片目标',
      text: `${formatValue(current.edited)}/${formatValue(videoTarget)}`,
      monitor: `待形成成片 ${formatValue(gap)}`,
      progress: pct(current.edited, videoTarget)
    }
  }
  if (key === 'edit') {
    const waiting = Math.max(0, current.edited - current.approved)
    return {
      label: '过审目标',
      text: `${formatValue(current.approved)}/${formatValue(videoTarget)}`,
      monitor: `待审或返修 ${formatValue(waiting)}`,
      progress: pct(current.approved, videoTarget)
    }
  }
  if (key === 'distribute') {
    const inventory = Math.max(0, current.approved - current.distributed)
    return {
      label: '已发视频',
      text: `${formatValue(current.distributed)}/${formatValue(videoTarget)}`,
      monitor: `视频监控条数；待分发库存 ${formatValue(inventory)}`,
      progress: pct(current.distributed, videoTarget)
    }
  }
  return {
    label: '播放目标',
    text: `${formatValue(current.exposure)}/${formatValue(kpi.exposure)}`,
    monitor: `视频监控播放完成 ${pct(current.exposure, kpi.exposure)}%`,
    progress: pct(current.exposure, kpi.exposure)
  }
}

function timingFor(
  block: ScheduleBlock,
  today: string
): Pick<ExecutionBrief, 'timing' | 'timingLabel'> {
  const done =
    block.status === '已完成' || Boolean(block.target && Number(block.done || 0) >= block.target)
  if (done) return { timing: 'complete', timingLabel: '已完成' }
  if (block.start <= today && block.end >= today) {
    return { timing: 'active', timingLabel: '当前阶段' }
  }
  if (block.end < today) {
    return {
      timing: 'overdue',
      timingLabel: `已逾期 ${Math.max(1, daysBetween(block.end, today))} 天`
    }
  }
  return {
    timing: 'upcoming',
    timingLabel: `${Math.max(1, daysBetween(today, block.start))} 天后开始`
  }
}

const GUIDE_OVERRIDE_KEY = 'dojo.execution.guide.overrides.v1'

export type PhaseGuideOverride = {
  objective?: string
  actions?: string[]
  monitors?: string[]
  /** 覆盖「重点监看」主文案；不填则仍用 KPI 现状自动算 */
  monitorSummary?: string
}

type GuideOverrideMap = Record<string, PhaseGuideOverride>

function overrideKey(projectId: string, phaseKey: PlanPhaseKey) {
  return `${projectId}:${phaseKey}`
}

function readGuideOverrides(): GuideOverrideMap {
  try {
    const raw = localStorage.getItem(GUIDE_OVERRIDE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as GuideOverrideMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeGuideOverrides(map: GuideOverrideMap) {
  localStorage.setItem(GUIDE_OVERRIDE_KEY, JSON.stringify(map))
}

export function getPhaseGuideOverride(
  projectId: string,
  phaseKey: PlanPhaseKey
): PhaseGuideOverride | null {
  return readGuideOverrides()[overrideKey(projectId, phaseKey)] || null
}

export function upsertPhaseGuideOverride(
  projectId: string,
  phaseKey: PlanPhaseKey,
  patch: PhaseGuideOverride
) {
  const map = readGuideOverrides()
  const key = overrideKey(projectId, phaseKey)
  const prev = map[key] || {}
  const next: PhaseGuideOverride = { ...prev }

  if ('objective' in patch) {
    const value = String(patch.objective || '').trim()
    if (value) next.objective = value
    else delete next.objective
  }
  if ('monitorSummary' in patch) {
    const value = String(patch.monitorSummary || '').trim()
    if (value) next.monitorSummary = value
    else delete next.monitorSummary
  }
  if ('actions' in patch) {
    next.actions = (patch.actions || []).map((x) => String(x || '').trim()).filter(Boolean)
  }
  if ('monitors' in patch) {
    next.monitors = (patch.monitors || []).map((x) => String(x || '').trim()).filter(Boolean)
  }

  if (!Object.keys(next).length) {
    delete map[key]
  } else {
    map[key] = next
  }
  writeGuideOverrides(map)
}

export function resetPhaseGuideOverride(projectId: string, phaseKey: PlanPhaseKey) {
  const map = readGuideOverrides()
  delete map[overrideKey(projectId, phaseKey)]
  writeGuideOverrides(map)
}

export function resolvePhaseGuide(projectId: string, phaseKey: PlanPhaseKey) {
  const base = EXECUTION_PHASE_GUIDES[phaseKey]
  const override = getPhaseGuideOverride(projectId, phaseKey)
  return {
    ...base,
    objective: override?.objective?.trim() || base.objective,
    actions: override && 'actions' in override ? [...(override.actions || [])] : [...base.actions],
    monitors:
      override && 'monitors' in override ? [...(override.monitors || [])] : [...base.monitors],
    monitorSummaryOverride: override?.monitorSummary?.trim() || '',
    hasOverride: Boolean(override && Object.keys(override).length)
  }
}

export function executionBriefForBlock(
  block: ScheduleBlock,
  today: string = DOJO_TODAY
): ExecutionBrief | null {
  const phaseKey = normalizePhaseKey(block)
  const runtime = getProjectRuntime(block.projectId)
  if (!phaseKey || !runtime) return null
  const guide = resolvePhaseGuide(block.projectId, phaseKey)
  const kpi = kpiSnapshot(phaseKey, runtime)
  const timing = timingFor(block, today)
  return {
    projectId: block.projectId,
    blockId: block.id,
    phaseKey,
    phaseLabel: guide.label,
    objective: guide.objective,
    actions: guide.actions,
    monitors: guide.monitors,
    monitorSummary: guide.monitorSummaryOverride || kpi.monitor,
    kpiLabel: kpi.label,
    kpiText: kpi.text,
    progressPct: kpi.progress,
    timing: timing.timing,
    timingLabel: timing.timingLabel,
    scheduleLabel: `${formatMonthDay(block.start)} - ${formatMonthDay(block.end)}`,
    actionLabel: guide.actionLabel,
    route: guide.route
  }
}

export function projectExecutionBrief(
  projectId: string,
  today: string = DOJO_TODAY
): ExecutionBrief | null {
  const briefs = listProjectPhaseBlocks(projectId)
    .map((block) => executionBriefForBlock(block, today))
    .filter((brief): brief is ExecutionBrief => Boolean(brief))

  const active = briefs.find((brief) => brief.timing === 'active')
  if (active) return active

  const overdue = briefs
    .filter((brief) => brief.timing === 'overdue')
    .sort((left, right) => right.scheduleLabel.localeCompare(left.scheduleLabel))[0]
  if (overdue) return overdue

  const upcoming = briefs
    .filter((brief) => brief.timing === 'upcoming')
    .sort((left, right) => left.scheduleLabel.localeCompare(right.scheduleLabel))[0]
  if (upcoming) return upcoming

  return briefs.at(-1) || null
}
