import { reactive } from 'vue'
import { DOJO_TODAY, daysBetween, formatMonthDay } from '@/utils/dojoDates'
import { deriveRunStatus } from '@/utils/dojoProjectImport'
import { loadTable, saveTable } from '@/utils/dojoPersist'

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
  /** 脚本总目标（与账号数独立，不要求均分到每号） */
  scripts: number
  /**
   * @deprecated 旧「每号脚本」字段，仅兼容历史数据；展示与计算以 scripts 为准
   */
  scriptsPerAccount?: number
}

export interface ProjectCurrent {
  accounts: number
  scripts: number
  edited: number
  approved: number
  distributed: number
  exposure: number
}

export type TodoTaskStatus = '未开始' | '已安排' | '进行中' | '已完成'

/** 今日待办行上可手改的字段（数量默认由 KPI/现状推算） */
export interface ProjectTodoMeta {
  owner?: string
  clientContact?: string
  status?: TodoTaskStatus
  note?: string
}

export interface ProjectRuntime {
  projectId: string
  brand: string
  priority: 'high' | 'medium' | 'low'
  runStatus: string
  /** 项目侧默认负责人 */
  owner: string
  /** 客户对接人 */
  clientContact: string
  kpi: ProjectKpi
  current: ProjectCurrent
  /** key → 待办行覆盖（负责人/客户对接人/状态/备注） */
  todoMeta: Record<string, ProjectTodoMeta>
}

export interface RuntimeRow {
  label: string
  /** 百分比或绝对值；日期格用 text */
  value: number
  tip: string
  /** 优先展示的文本（如现状行的日期） */
  text?: string
}

const TABLE_RUNTIME = 'projectRuntime'

/** 空壳：有业务项目后再写入目标与进度 */
export const dojoProjectRuntime = reactive<Record<string, ProjectRuntime>>(
  loadTable<Record<string, ProjectRuntime>>(TABLE_RUNTIME) || {}
)

/** 供页面 computed 订阅深层字段变更（负责人 / 对接人 / 待办覆盖） */
export const projectRuntimeRevision = reactive({ value: 0 })

function bumpRuntimeRevision() {
  projectRuntimeRevision.value++
  saveTable(TABLE_RUNTIME, { ...dojoProjectRuntime })
}

/** 现状/目标变更后刷新排期 KPI 条完成量（动态导入避免循环依赖） */
function scheduleKpiProgressRefresh(projectId: string) {
  void import('@/store/dojoKpiSchedule').then(({ refreshKpiProgress }) => {
    refreshKpiProgress(projectId)
  })
}

function ensureKpiShape(kpi: ProjectKpi) {
  // 旧数据只有 scriptsPerAccount：迁移成独立脚本总目标
  if (kpi.scripts == null || Number.isNaN(Number(kpi.scripts))) {
    kpi.scripts = (kpi.accounts || 0) * (kpi.scriptsPerAccount || 0)
  } else {
    kpi.scripts = Number(kpi.scripts) || 0
  }
  if (kpi.scriptsPerAccount == null) kpi.scriptsPerAccount = 0
}

function ensureRuntimeShape(p: ProjectRuntime) {
  if (p.owner == null) p.owner = ''
  if (p.clientContact == null) p.clientContact = ''
  if (!p.todoMeta) p.todoMeta = {}
  if (p.kpi) ensureKpiShape(p.kpi)
  return p
}

export function activeProjectRuntimes(): ProjectRuntime[] {
  return Object.values(dojoProjectRuntime)
    .map(ensureRuntimeShape)
    .filter((p) => p.runStatus === '进行中')
}

export function getProjectRuntime(projectId: string) {
  const p = dojoProjectRuntime[projectId]
  if (!p) return null
  ensureRuntimeShape(p)
  // 展示用：状态跟周期走（不在此处 persist，避免 computed 内反复写盘）
  p.runStatus = deriveRunStatus(p.kpi.cycleStart, p.kpi.cycleEnd)
  return p
}

export function removeProjectRuntime(projectId: string) {
  if (!dojoProjectRuntime[projectId]) return
  delete dojoProjectRuntime[projectId]
  bumpRuntimeRevision()
}

export function upsertProjectRuntime(
  projectId: string,
  input: Partial<Omit<ProjectRuntime, 'projectId' | 'kpi' | 'current' | 'todoMeta'>> & {
    kpi?: Partial<ProjectKpi>
    current?: Partial<ProjectCurrent>
    todoMeta?: Record<string, ProjectTodoMeta>
  } = {}
): ProjectRuntime {
  const existing = dojoProjectRuntime[projectId]
  const baseKpi: ProjectKpi = {
    cycleStart: DOJO_TODAY,
    cycleEnd: DOJO_TODAY,
    accounts: 0,
    videos: 0,
    exposure: 0,
    scripts: 0,
    scriptsPerAccount: 0
  }
  const baseCurrent: ProjectCurrent = {
    accounts: 0,
    scripts: 0,
    edited: 0,
    approved: 0,
    distributed: 0,
    exposure: 0
  }
  if (existing) {
    Object.assign(existing, {
      brand: input.brand ?? existing.brand,
      priority: input.priority ?? existing.priority,
      owner: input.owner ?? existing.owner,
      clientContact: input.clientContact ?? existing.clientContact
    })
    if (input.kpi) {
      const kpiPatch = Object.fromEntries(
        Object.entries(input.kpi).filter(([, v]) => v !== undefined)
      ) as Partial<ProjectKpi>
      Object.assign(existing.kpi, kpiPatch)
      ensureKpiShape(existing.kpi)
    }
    if (input.current) {
      const curPatch = Object.fromEntries(
        Object.entries(input.current).filter(([, v]) => v !== undefined)
      ) as Partial<ProjectCurrent>
      Object.assign(existing.current, curPatch)
    }
    if (input.todoMeta) Object.assign(existing.todoMeta, input.todoMeta)
    // 周期变了状态必变；忽略手填 runStatus
    existing.runStatus = deriveRunStatus(existing.kpi.cycleStart, existing.kpi.cycleEnd)
    bumpRuntimeRevision()
    if (input.current || input.kpi) scheduleKpiProgressRefresh(projectId)
    return existing
  }
  const kpi = { ...baseKpi, ...input.kpi }
  ensureKpiShape(kpi)
  const created: ProjectRuntime = {
    projectId,
    brand: input.brand || '—',
    priority: input.priority || 'medium',
    runStatus: deriveRunStatus(kpi.cycleStart, kpi.cycleEnd),
    owner: input.owner || '',
    clientContact: input.clientContact || '',
    kpi,
    current: { ...baseCurrent, ...input.current },
    todoMeta: { ...(input.todoMeta || {}) }
  }
  dojoProjectRuntime[projectId] = created
  bumpRuntimeRevision()
  return created
}

export function patchTodoMeta(projectId: string, taskKey: string, patch: ProjectTodoMeta) {
  const p = getProjectRuntime(projectId)
  if (!p) return
  p.todoMeta[taskKey] = { ...p.todoMeta[taskKey], ...patch }
  bumpRuntimeRevision()
}

/**
 * 今日待办改「数量」= 改项目现状（与项目总览编辑同一套 current/kpi）。
 * 数量为缺口值：改缺口会反推 current，保存后项目总览同步更新。
 */
export function applyTodoQuantity(projectId: string, key: TodayTodoKey, value: number | string) {
  const p = dojoProjectRuntime[projectId]
  if (!p) return
  ensureRuntimeShape(p)
  const { kpi, current } = p
  const scriptTarget = plannedScripts(kpi)

  if (key === 'ads_progress') {
    if (!kpi.exposure) return
    const pct =
      typeof value === 'string'
        ? parseFloat(value.replace('%', '').trim())
        : Number(value)
    if (!Number.isFinite(pct)) return
    const clamped = Math.min(100, Math.max(0, pct))
    current.exposure = Math.max(0, Math.round((kpi.exposure * clamped) / 100))
  } else {
    const gap = Math.max(0, Math.floor(Number(value)) || 0)
    switch (key) {
      case 'scripts_review':
        current.scripts = Math.max(0, scriptTarget - gap)
        break
      case 'accounts_start':
        current.accounts = Math.max(0, kpi.accounts - gap)
        break
      case 'shoot_pending':
        current.edited = Math.max(0, kpi.videos - gap)
        break
      case 'approve_pending':
        current.approved = Math.max(0, current.edited - gap)
        break
      case 'distribute_pending':
        current.distributed = Math.max(0, current.approved - gap)
        break
    }
  }
  bumpRuntimeRevision()
  scheduleKpiProgressRefresh(projectId)
}

export const TODAY_TODO_DEFS = [
  { key: 'scripts_review', task: '待审核的脚本条数' },
  { key: 'accounts_start', task: '账号起号个数' },
  { key: 'shoot_pending', task: '待拍摄片子量' },
  { key: 'approve_pending', task: '待过审片子数' },
  { key: 'distribute_pending', task: '待分发视频数' },
  { key: 'ads_progress', task: '视频投放进度' }
] as const

export type TodayTodoKey = (typeof TODAY_TODO_DEFS)[number]['key']

export interface TodayTodoRow {
  key: TodayTodoKey
  projectId: string
  projectName: string
  task: string
  quantity: string | number
  owner: string
  status: TodoTaskStatus
  clientContact: string
  note: string
}

function defaultTodoStatus(qty: number | string, runStatus: string): TodoTaskStatus {
  if (typeof qty === 'string') {
    if (qty === '—' || qty === '0%') return '未开始'
    return runStatus === '进行中' ? '进行中' : '已安排'
  }
  if (qty <= 0) return '已安排'
  return runStatus === '进行中' ? '进行中' : '未开始'
}

/** 按 KPI/现状推算今日待办明细；负责人/客户对接人按行覆盖，未填时回退项目默认值 */
export function buildTodayTodos(
  projectId: string,
  projectName: string,
  runtime: ProjectRuntime
): TodayTodoRow[] {
  const { kpi, current } = runtime
  const scriptGap = Math.max(0, plannedScripts(kpi) - current.scripts)
  const accountGap = Math.max(0, kpi.accounts - current.accounts)
  const shootGap = Math.max(0, kpi.videos - current.edited)
  const approveGap = Math.max(0, current.edited - current.approved)
  const distGap = Math.max(0, current.approved - current.distributed)
  const adText = kpi.exposure
    ? `${Math.min(100, Math.round((current.exposure / kpi.exposure) * 100))}%`
    : '—'

  const qtyMap: Record<TodayTodoKey, number | string> = {
    scripts_review: scriptGap,
    accounts_start: accountGap,
    shoot_pending: shootGap,
    approve_pending: approveGap,
    distribute_pending: distGap,
    ads_progress: adText
  }

  return TODAY_TODO_DEFS.map((def) => {
    const meta = runtime.todoMeta[def.key] || {}
    const quantity = qtyMap[def.key]
    return {
      key: def.key,
      projectId,
      projectName,
      task: def.task,
      quantity,
      owner: meta.owner ?? runtime.owner,
      status: meta.status ?? defaultTodoStatus(quantity, runtime.runStatus),
      clientContact: meta.clientContact ?? runtime.clientContact,
      note: meta.note ?? ''
    }
  })
}

export function patchProjectCurrent(projectId: string, patch: Partial<ProjectCurrent>) {
  const p = dojoProjectRuntime[projectId]
  if (!p) return
  Object.assign(p.current, patch)
  bumpRuntimeRevision()
  scheduleKpiProgressRefresh(projectId)
}

export function priorityLabel(priority: string): string {
  if (priority === 'high') return '高'
  if (priority === 'medium') return '中'
  return '低'
}

/** 脚本总目标；与账号数无关，旧数据可从 scriptsPerAccount 回退 */
export function plannedScripts(kpi: ProjectKpi): number {
  if (kpi.scripts != null) return kpi.scripts
  return (kpi.accounts || 0) * (kpi.scriptsPerAccount || 0)
}

export function cycleLabel(kpi: ProjectKpi): string {
  return `${formatMonthDay(kpi.cycleStart)} – ${formatMonthDay(kpi.cycleEnd)}`
}

function pct(current: number, target: number): number {
  return target ? Math.min(100, Math.round((current / target) * 100)) : 0
}

/** 周期时间已经走过百分之几 */
export function timeProgress(kpi: ProjectKpi, today: string = DOJO_TODAY): number {
  const total = Math.max(1, daysBetween(kpi.cycleStart, kpi.cycleEnd))
  const passed = Math.max(0, Math.min(total, daysBetween(kpi.cycleStart, today)))
  return Math.round((passed / total) * 100)
}

/** 进度行：相对 KPI 的完成率（%） */
export function progressRows(p: ProjectRuntime, today: string = DOJO_TODAY): RuntimeRow[] {
  const { kpi, current } = p
  const scriptTarget = plannedScripts(kpi)
  return [
    {
      label: '时间进度',
      value: timeProgress(kpi, today),
      tip: `${kpi.cycleStart} → ${today} / ${kpi.cycleEnd}`
    },
    { label: '账号数', value: pct(current.accounts, kpi.accounts), tip: `账号矩阵 ${current.accounts}/${kpi.accounts}` },
    { label: '脚本完成', value: pct(current.scripts, scriptTarget), tip: `${current.scripts}/${scriptTarget}` },
    { label: '剪辑完成', value: pct(current.edited, kpi.videos), tip: `${current.edited}/${kpi.videos}` },
    { label: '过审完成', value: pct(current.approved, kpi.videos), tip: `${current.approved}/${kpi.videos}` },
    {
      label: '已发视频',
      value: pct(current.distributed, kpi.videos),
      tip: `视频监控条数 ${current.distributed}/${kpi.videos}`
    },
    {
      label: '播放量',
      value: pct(current.exposure, kpi.exposure),
      tip: `视频监控播放合计 ${current.exposure.toLocaleString()}/${kpi.exposure.toLocaleString()}`
    }
  ]
}

/** KPI 行：周期目标绝对值（第一格为周期文案） */
export function kpiRows(p: ProjectRuntime): RuntimeRow[] {
  const { kpi } = p
  const scriptTarget = plannedScripts(kpi)
  return [
    { label: '周期', value: 0, tip: cycleLabel(kpi), text: cycleLabel(kpi) },
    { label: '账号数', value: kpi.accounts, tip: '目标：账号矩阵内活跃账号数' },
    {
      label: '脚本目标',
      value: scriptTarget,
      tip:
        kpi.accounts > 0
          ? `总目标 ${scriptTarget}（约 ${(scriptTarget / kpi.accounts).toFixed(1)}/号，不要求均分）`
          : `总目标 ${scriptTarget}`
    },
    { label: '成片目标', value: kpi.videos, tip: '剪辑成片目标' },
    { label: '过审目标', value: kpi.videos, tip: '客户过审目标' },
    { label: '视频目标', value: kpi.videos, tip: '应对齐视频监控中的已发条数' },
    { label: '播放目标', value: kpi.exposure, tip: '应对齐视频监控播放量合计' }
  ]
}

/** 现状行：当前绝对值；第一格为今天日期 */
export function currentRows(p: ProjectRuntime, today: string = DOJO_TODAY): RuntimeRow[] {
  const { current } = p
  return [
    { label: '当前日期', value: 0, tip: `${today} · ${cycleLabel(p.kpi)}`, text: formatMonthDay(today) },
    { label: '账号数', value: current.accounts, tip: '账号矩阵 · 本项目活跃账号' },
    { label: '脚本产出', value: current.scripts, tip: '可手填' },
    { label: '成片数', value: current.edited, tip: '可手填' },
    { label: '过审数', value: current.approved, tip: '可手填' },
    {
      label: '已发视频',
      value: current.distributed,
      tip: '视频监控 · 本项目已同步视频条数'
    },
    {
      label: '播放量',
      value: current.exposure,
      tip: `视频监控 · 播放合计 ${current.exposure.toLocaleString()}`
    }
  ]
}
