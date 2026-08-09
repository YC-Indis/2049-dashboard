import { reactive } from 'vue'
import { DOJO_TODAY, daysBetween, formatMonthDay } from '@/utils/dojoDates'

/**
 * 项目周期目标与当前完成量。完成率一律由这里按代码算，AI 只负责解释，
 * 不参与计算（见 docs/00_START_HERE.md 强制原则第 6 条）。
 */
export interface ProjectKpi {
  cycleStart: string
  cycleEnd: string
  accounts: number
  videos: number
  exposure: number
  /** 每个账号要出多少条脚本，脚本总目标 = accounts × scriptsPerAccount */
  scriptsPerAccount: number
}

export interface ProjectCurrent {
  accounts: number
  scripts: number
  edited: number
  approved: number
  distributed: number
  exposure: number
}

export interface ProjectRuntime {
  projectId: string
  brand: string
  priority: 'high' | 'medium' | 'low'
  runStatus: string
  kpi: ProjectKpi
  current: ProjectCurrent
}

export const dojoProjectRuntime = reactive<Record<string, ProjectRuntime>>({
  'matrix-xros6-uk': {
    projectId: 'matrix-xros6-uk',
    brand: 'smoore',
    priority: 'high',
    runStatus: '进行中',
    kpi: {
      cycleStart: '2026-08-04',
      cycleEnd: '2026-08-07',
      accounts: 4,
      videos: 20,
      exposure: 31826,
      scriptsPerAccount: 10
    },
    current: {
      accounts: 3,
      scripts: 40,
      edited: 17,
      approved: 40,
      distributed: 24,
      exposure: 21217
    }
  },
  'matrix-xros6-de': {
    projectId: 'matrix-xros6-de',
    brand: 'smoore',
    priority: 'medium',
    runStatus: '进行中',
    kpi: {
      cycleStart: '2026-08-04',
      cycleEnd: '2026-08-07',
      accounts: 4,
      videos: 8,
      exposure: 10317,
      scriptsPerAccount: 4
    },
    current: { accounts: 2, scripts: 16, edited: 7, approved: 16, distributed: 10, exposure: 6878 }
  }
})

export function activeProjectRuntimes(): ProjectRuntime[] {
  return Object.values(dojoProjectRuntime).filter((p) => p.runStatus === '进行中')
}

export function patchProjectCurrent(projectId: string, patch: Partial<ProjectCurrent>) {
  const p = dojoProjectRuntime[projectId]
  if (p) Object.assign(p.current, patch)
}

export function priorityLabel(priority: string): string {
  if (priority === 'high') return '高'
  if (priority === 'medium') return '中'
  return '低'
}

export function plannedScripts(kpi: ProjectKpi): number {
  return kpi.accounts * kpi.scriptsPerAccount
}

export function cycleLabel(kpi: ProjectKpi): string {
  return `${formatMonthDay(kpi.cycleStart)} – ${formatMonthDay(kpi.cycleEnd)}`
}

function pct(current: number, target: number): number {
  return target ? Math.min(100, Math.round((current / target) * 100)) : 0
}

/** 周期内已经走过百分之多少 */
export function timeProgress(kpi: ProjectKpi, today: string = DOJO_TODAY): number {
  const total = Math.max(1, daysBetween(kpi.cycleStart, kpi.cycleEnd))
  const passed = Math.max(0, Math.min(total, daysBetween(kpi.cycleStart, today)))
  return Math.round((passed / total) * 100)
}

export interface RuntimeRow {
  label: string
  value: number
  tip: string
}

/** 健康诊断：各环节相对 KPI 的完成率 */
export function progressRows(p: ProjectRuntime, today: string = DOJO_TODAY): RuntimeRow[] {
  const { kpi, current } = p
  const scriptTarget = plannedScripts(kpi)
  return [
    {
      label: '时间进度',
      value: timeProgress(kpi, today),
      tip: `${kpi.cycleStart} → ${today} / ${kpi.cycleEnd}`
    },
    {
      label: '账号数',
      value: pct(current.accounts, kpi.accounts),
      tip: `${current.accounts}/${kpi.accounts}`
    },
    {
      label: '脚本完成量',
      value: pct(current.scripts, scriptTarget),
      tip: `${current.scripts}/${scriptTarget}`
    },
    {
      label: '片子完成量',
      value: pct(current.edited, kpi.videos),
      tip: `${current.edited}/${kpi.videos}`
    },
    {
      label: '过审片子量',
      value: pct(current.approved, kpi.videos),
      tip: `${current.approved}/${kpi.videos}`
    },
    {
      label: '分发量',
      value: pct(current.distributed, kpi.videos),
      tip: `${current.distributed}/${kpi.videos}`
    },
    {
      label: '曝光量',
      value: pct(current.exposure, kpi.exposure),
      tip: `${current.exposure.toLocaleString()}/${kpi.exposure.toLocaleString()}`
    }
  ]
}

/** 当前现状：绝对值而非完成率 */
export function currentRows(p: ProjectRuntime): RuntimeRow[] {
  const { kpi, current } = p
  return [
    {
      label: '当前日期 · 周期',
      value: timeProgress(kpi),
      tip: `${DOJO_TODAY} · ${cycleLabel(kpi)}`
    },
    { label: '账号数', value: current.accounts, tip: '已起号 / 在手' },
    { label: '脚本条数', value: current.scripts, tip: '已完成脚本' },
    { label: '剪辑片数', value: current.edited, tip: '已剪辑成片' },
    { label: '过审片数', value: current.approved, tip: '审核通过' },
    { label: '分发量', value: current.distributed, tip: '已分发' },
    { label: '曝光量', value: current.exposure, tip: current.exposure.toLocaleString() }
  ]
}
