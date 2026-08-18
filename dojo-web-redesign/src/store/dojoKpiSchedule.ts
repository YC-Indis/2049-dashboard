/**
 * 项目周期与细项排期。
 * - 周期条 KPI-CYCLE-*：与 runtime.kpi 同源，甘特拖父条改它
 * - 细项条 KPI-{phase}-*：按需添加（脚本/起号/拍摄/剪辑/分发/投放），拖子条只改自身
 * 导入 / 同步 KPI 不必划满所有细项。
 */
import { getProjectById } from '@/store/dojoProjectStore'
import {
  getProjectRuntime,
  plannedScripts,
  upsertProjectRuntime,
  type ProjectRuntime
} from '@/store/dojoProjectRuntime'
import {
  dojoScheduleStore,
  patchManyScheduleBlocks,
  patchScheduleBlock,
  removeScheduleBlock,
  setFocusRange,
  upsertScheduleBlock,
  type ScheduleBlock
} from '@/store/dojoScheduleStore'
import { addDays, daysBetween } from '@/utils/dojoDates'

const KPI_NOTE = '[kpi-sync]'

/** 可规划细项（导入不必全开，甘特里按需加条） */
export type PlanPhaseKey = 'scripts' | 'accounts' | 'shoot' | 'edit' | 'distribute' | 'ads'

/** 含历史过审块，便于进度刷新 */
type PhaseKey = PlanPhaseKey | 'approve'

export interface PlanPhaseDef {
  key: PlanPhaseKey
  label: string
  type: ScheduleBlock['type']
  color: string
  done: number
  target: number
}

export const PLAN_PHASE_META: Array<{
  key: PlanPhaseKey
  label: string
  type: ScheduleBlock['type']
  color: string
}> = [
  { key: 'scripts', label: '脚本', type: 'script', color: '#5E6AD2' },
  { key: 'accounts', label: '起号', type: 'other', color: '#8E8E93' },
  { key: 'shoot', label: '拍摄', type: 'other', color: '#FF9F0A' },
  { key: 'edit', label: '剪辑', type: 'other', color: '#FF375F' },
  { key: 'distribute', label: '分发', type: 'publish', color: '#32ADE6' },
  { key: 'ads', label: '投放', type: 'ad', color: '#FFD60A' }
]

export function isKpiSyncedBlock(id: string) {
  return id.startsWith('KPI-')
}

export function isKpiCycleBlock(id: string) {
  return id.startsWith('KPI-CYCLE-')
}

export function phaseBlockId(projectId: string, key: PlanPhaseKey | PhaseKey) {
  return `KPI-${key}-${projectId}`
}

export function cycleBlockId(projectId: string) {
  return `KPI-CYCLE-${projectId}`
}

function fmtQty(n: number) {
  return n.toLocaleString()
}

export function phaseDefs(runtime: ProjectRuntime): PlanPhaseDef[] {
  const scripts = plannedScripts(runtime.kpi)
  const { kpi, current } = runtime
  return PLAN_PHASE_META.map((meta) => {
    if (meta.key === 'accounts') {
      return { ...meta, done: current.accounts, target: kpi.accounts }
    }
    if (meta.key === 'scripts') {
      return { ...meta, done: current.scripts, target: scripts }
    }
    if (meta.key === 'shoot') {
      // 暂无独立拍摄完成量，用成片目标做规划量；完成量先跟剪辑同源偏低估
      return { ...meta, done: Math.min(current.edited, kpi.videos), target: kpi.videos }
    }
    if (meta.key === 'edit') {
      return { ...meta, done: current.edited, target: kpi.videos }
    }
    if (meta.key === 'distribute') {
      return { ...meta, done: current.distributed, target: kpi.videos }
    }
    return { ...meta, done: current.exposure, target: kpi.exposure }
  })
}

function legacyApprove(runtime: ProjectRuntime) {
  return {
    key: 'approve' as const,
    label: '过审',
    type: 'milestone' as const,
    color: '#4ea7fc',
    done: runtime.current.approved,
    target: runtime.kpi.videos
  }
}

function phaseTitle(label: string, done: number, target: number) {
  if (!target) return label
  return `${label} ${fmtQty(done)}/${fmtQty(target)}`
}

export function phaseKeyFromBlockId(id: string, projectId: string): PhaseKey | 'cycle' | null {
  if (id === cycleBlockId(projectId)) return 'cycle'
  const prefix = 'KPI-'
  const suffix = `-${projectId}`
  if (!id.startsWith(prefix) || !id.endsWith(suffix)) return null
  const key = id.slice(prefix.length, id.length - suffix.length)
  if (
    key === 'accounts' ||
    key === 'scripts' ||
    key === 'shoot' ||
    key === 'edit' ||
    key === 'approve' ||
    key === 'distribute' ||
    key === 'ads'
  ) {
    return key
  }
  return null
}

function cycleProgress(runtime: ProjectRuntime) {
  const phases = phaseDefs(runtime).filter((p) => p.target > 0)
  if (!phases.length) return { done: 0, target: 100 }
  const avg = phases.reduce((a, p) => a + Math.min(1, p.done / p.target), 0) / phases.length
  return { done: Math.round(avg * 100), target: 100 }
}

/** 综合完成率 0–100 */
export function overallKpiProgressPct(runtime: ProjectRuntime): number {
  return cycleProgress(runtime).done
}

function cycleTitle(projectName: string, runtime: ProjectRuntime) {
  const { done } = cycleProgress(runtime)
  return `${projectName} · 周期 · 综合 ${done}%`
}

/** 列出某项目已规划的细项块（不含周期主条） */
export function listProjectPhaseBlocks(projectId: string): ScheduleBlock[] {
  return dojoScheduleStore.blocks
    .filter((b) => {
      if (b.projectId !== projectId || !isKpiSyncedBlock(b.id) || isKpiCycleBlock(b.id)) {
        return false
      }
      return Boolean(phaseKeyFromBlockId(b.id, projectId))
    })
    .sort((a, b) => {
      const order = PLAN_PHASE_META.map((p) => p.key)
      const ka = phaseKeyFromBlockId(a.id, projectId)
      const kb = phaseKeyFromBlockId(b.id, projectId)
      const ia = ka && ka !== 'approve' && ka !== 'cycle' ? order.indexOf(ka) : 99
      const ib = kb && kb !== 'approve' && kb !== 'cycle' ? order.indexOf(kb) : 99
      if (ia !== ib) return ia - ib
      return a.start.localeCompare(b.start)
    })
}

/** 该项目尚未添加的细项 */
export function availablePhasesToAdd(projectId: string): PlanPhaseDef[] {
  const runtime = getProjectRuntime(projectId)
  if (!runtime) return []
  const existing = new Set(
    listProjectPhaseBlocks(projectId)
      .map((b) => phaseKeyFromBlockId(b.id, projectId))
      .filter(Boolean)
  )
  return phaseDefs(runtime).filter((p) => !existing.has(p.key))
}

export function suggestProjectPhaseRange(projectId: string): { start: string; end: string } | null {
  const runtime = getProjectRuntime(projectId)
  if (!runtime) return null
  const cycleStart = runtime.kpi.cycleStart
  const cycleEnd = runtime.kpi.cycleEnd
  if (!cycleStart || !cycleEnd) return null

  const existing = listProjectPhaseBlocks(projectId)
  const latestEnd = existing.reduce(
    (latest, block) => (block.end > latest ? block.end : latest),
    ''
  )
  const naturalStart = latestEnd ? addDays(latestEnd, 1) : cycleStart
  const start = naturalStart > cycleEnd ? cycleEnd : naturalStart
  const end = addDays(start, Math.min(6, daysBetween(start, cycleEnd)))
  return { start, end }
}

/**
 * 在项目下新增一条细项时间条（同一步骤只允许一条）。
 * 默认落在周期内前 7 天（或整段周期）。
 */
export function addProjectPhaseBar(
  projectId: string,
  phaseKey: PlanPhaseKey,
  range?: { start?: string; end?: string }
): ScheduleBlock | null {
  const project = getProjectById(projectId)
  const runtime = getProjectRuntime(projectId)
  if (!project || !runtime) return null

  const id = phaseBlockId(projectId, phaseKey)
  if (dojoScheduleStore.blocks.some((b) => b.id === id)) {
    return dojoScheduleStore.blocks.find((b) => b.id === id) || null
  }

  const phase = phaseDefs(runtime).find((p) => p.key === phaseKey)
  if (!phase) return null

  const cycleStart = runtime.kpi.cycleStart
  const cycleEnd = runtime.kpi.cycleEnd
  if (!cycleStart || !cycleEnd) return null

  const suggestedRange = suggestProjectPhaseRange(projectId)
  let start = range?.start || suggestedRange?.start || cycleStart
  let end = range?.end || suggestedRange?.end || start
  if (start > end) [start, end] = [end, start]
  if (start < cycleStart) start = cycleStart
  if (end > cycleEnd) end = cycleEnd
  if (end < start) end = start

  upsertScheduleBlock({
    id,
    projectId,
    projectName: project.name,
    title: phaseTitle(phase.label, phase.done, phase.target),
    type: phase.type,
    start,
    end,
    lane: nextOpenLane(projectId, start, end),
    note: `${KPI_NOTE} phase=${phase.key}`,
    source: 'timeline',
    owner: runtime.owner,
    status: runtime.runStatus,
    done: phase.done,
    target: phase.target
  })

  return dojoScheduleStore.blocks.find((b) => b.id === id) || null
}

function nextOpenLane(projectId: string, start: string, end: string) {
  const occupied = new Set(
    listProjectPhaseBlocks(projectId)
      .filter((block) => start <= block.end && end >= block.start)
      .map((block) => Math.max(0, Math.floor(block.lane ?? 0)))
  )
  let lane = 0
  while (occupied.has(lane)) lane += 1
  return lane
}

/** 删除细项时间条（不影响项目周期） */
export function removeProjectPhaseBar(projectId: string, phaseKey: PlanPhaseKey | PhaseKey) {
  removeScheduleBlock(phaseBlockId(projectId, phaseKey))
}

/** 拖细项条：只改该条起止 */
export function applyPhaseDates(
  projectId: string,
  phaseKey: PlanPhaseKey | PhaseKey,
  start: string,
  end: string
): boolean {
  const id = phaseBlockId(projectId, phaseKey)
  const cycleStart = start <= end ? start : end
  const cycleEnd = start <= end ? end : start
  return Boolean(patchScheduleBlock(id, { start: cycleStart, end: cycleEnd }))
}

function upsertCycleBlock(projectId: string) {
  const project = getProjectById(projectId)
  const runtime = getProjectRuntime(projectId)
  if (!project || !runtime) return 0
  const { cycleStart, cycleEnd } = runtime.kpi
  if (!cycleStart || !cycleEnd) return 0

  const cycle = cycleProgress(runtime)
  upsertScheduleBlock({
    id: cycleBlockId(projectId),
    projectId,
    projectName: project.name,
    title: cycleTitle(project.name, runtime),
    type: 'milestone',
    start: cycleStart,
    end: cycleEnd,
    note: `${KPI_NOTE} 账号${runtime.kpi.accounts} · 脚本${plannedScripts(runtime.kpi)} · 成片${runtime.kpi.videos} · 曝光${runtime.kpi.exposure}`,
    source: 'manual',
    owner: runtime.owner,
    status: runtime.runStatus,
    done: cycle.done,
    target: cycle.target
  })
  setFocusRange(cycleStart, cycleEnd)
  return 1
}

/**
 * 项目排期拖父条改期：回写 runtime.kpi，只更新周期块，不重切细项。
 */
export function applyProjectCycle(projectId: string, start: string, end: string): boolean {
  const project = getProjectById(projectId)
  const runtime = getProjectRuntime(projectId)
  if (!project || !runtime) return false
  const cycleStart = start <= end ? start : end
  const cycleEnd = start <= end ? end : start
  if (runtime.kpi.cycleStart !== cycleStart || runtime.kpi.cycleEnd !== cycleEnd) {
    const next = upsertProjectRuntime(projectId, {
      kpi: { cycleStart, cycleEnd }
    })
    project.status = next.runStatus
  }
  upsertCycleBlock(projectId)
  refreshKpiProgress(projectId)
  return true
}

/**
 * 若 KPI-CYCLE 与 runtime 不一致，以排期块回写 runtime（修复旧数据）。
 */
export function reconcileCycleFromSchedule(projectId: string): boolean {
  const project = getProjectById(projectId)
  const runtime = getProjectRuntime(projectId)
  if (!project || !runtime) return false
  const cycleBlock = dojoScheduleStore.blocks.find((b) => b.id === cycleBlockId(projectId))
  if (!cycleBlock?.start || !cycleBlock.end) return false
  if (cycleBlock.start === runtime.kpi.cycleStart && cycleBlock.end === runtime.kpi.cycleEnd) {
    return false
  }
  const next = upsertProjectRuntime(projectId, {
    kpi: { cycleStart: cycleBlock.start, cycleEnd: cycleBlock.end }
  })
  project.status = next.runStatus
  upsertCycleBlock(projectId)
  refreshKpiProgress(projectId)
  return true
}

/**
 * 同步周期主条 + 刷新已有细项进度。
 * 不再自动均分创建全部阶段（导入/保存不必划满时间）。
 */
export function syncProjectKpiToSchedule(projectId: string): number {
  const n = upsertCycleBlock(projectId)
  if (!n) return 0
  refreshKpiProgress(projectId)
  return n + listProjectPhaseBlocks(projectId).length
}

/** 只刷新完成量/标题，保留用户拖过的起止 */
export function refreshKpiProgress(projectId: string): number {
  const project = getProjectById(projectId)
  const runtime = getProjectRuntime(projectId)
  if (!project || !runtime) return 0

  const byKey = Object.fromEntries(phaseDefs(runtime).map((p) => [p.key, p])) as Record<
    PlanPhaseKey,
    PlanPhaseDef
  >
  const approve = legacyApprove(runtime)
  const cycle = cycleProgress(runtime)

  return patchManyScheduleBlocks((b) => {
    if (b.projectId !== projectId || !isKpiSyncedBlock(b.id)) return null
    const key = phaseKeyFromBlockId(b.id, projectId)
    if (!key) return null
    if (key === 'cycle') {
      return {
        title: cycleTitle(project.name, runtime),
        done: cycle.done,
        target: cycle.target,
        status: runtime.runStatus
      }
    }
    if (key === 'approve') {
      return {
        title: phaseTitle(approve.label, approve.done, approve.target),
        done: approve.done,
        target: approve.target,
        status: runtime.runStatus
      }
    }
    const phase = byKey[key]
    if (!phase) return null
    return {
      title: phaseTitle(phase.label, phase.done, phase.target),
      done: phase.done,
      target: phase.target,
      status: runtime.runStatus
    }
  })
}

export function refreshKpiProgressMany(projectIds: string[]) {
  projectIds.forEach((id) => refreshKpiProgress(id))
}
