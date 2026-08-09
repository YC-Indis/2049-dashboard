import { computed, reactive } from 'vue'
import {
  getProjectRuntime,
  removeProjectRuntime,
  upsertProjectRuntime,
  type ProjectKpi,
  type ProjectRuntime
} from '@/store/dojoProjectRuntime'
import { removeScheduleBlocksByProject } from '@/store/dojoScheduleStore'
import { DOJO_TODAY } from '@/utils/dojoDates'
import { deriveRunStatus } from '@/utils/dojoProjectImport'
import { loadTable, saveTable } from '@/utils/dojoPersist'

export interface DojoProject {
  id: string
  name: string
  /** 用于筛选投放/分发等：匹配 project / batch / name 片段 */
  aliases: string[]
  region?: string
  status?: string
  active: boolean
}

export interface CreateProjectInput {
  name: string
  brand?: string
  region?: string
  priority?: ProjectRuntime['priority']
  cycleStart?: string
  cycleEnd?: string
  aliases?: string[]
  owner?: string
  clientContact?: string
  /** 创建时可一并写入的 KPI 目标 */
  kpi?: Partial<ProjectKpi>
}

const TABLE_PROJECTS = 'projects'

/**
 * 多项目上下文：时间规划 / 节奏日历 / 投放 / 分发都挂在项目上。
 * 空壳起步：无预置项目，从项目总览新建。
 */
export const dojoProjectStore = reactive({
  projects: (loadTable<DojoProject[]>(TABLE_PROJECTS) || []) as DojoProject[],
  /** 空数组 = 全部项目 */
  selectedIds: [] as string[]
})

function persistProjects() {
  saveTable(TABLE_PROJECTS, dojoProjectStore.projects)
}

/** @deprecated 兼容旧代码：取第一个选中项 */
export const currentProject = computed(() => {
  const id = dojoProjectStore.selectedIds[0]
  return id ? dojoProjectStore.projects.find((p) => p.id === id) || null : null
})

/** @deprecated 兼容：单选写入 */
export function setCurrentProject(id: string) {
  dojoProjectStore.selectedIds = id ? [id] : []
}

export function setSelectedProjects(ids: string[]) {
  dojoProjectStore.selectedIds = [...ids]
}

export function getProjectById(id: string) {
  return dojoProjectStore.projects.find((p) => p.id === id) || null
}

function slugId(name: string) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fff\-]/gi, '') || `p-${Date.now()}`
  let id = base
  let n = 2
  while (dojoProjectStore.projects.some((p) => p.id === id)) {
    id = `${base}-${n++}`
  }
  return id
}

/** 新建项目并写入空 KPI/现状 runtime */
export function createProject(input: CreateProjectInput): DojoProject {
  const name = input.name.trim()
  if (!name) throw new Error('项目名称不能为空')
  const id = slugId(name)
  const project: DojoProject = {
    id,
    name,
    aliases: input.aliases?.length ? [...input.aliases] : [name],
    region: input.region || '—',
    status: '进行中',
    active: true
  }
  const cycleStart = input.cycleStart || input.kpi?.cycleStart || DOJO_TODAY
  const cycleEnd = input.cycleEnd || input.kpi?.cycleEnd || input.cycleStart || DOJO_TODAY
  project.status = deriveRunStatus(cycleStart, cycleEnd)
  dojoProjectStore.projects.push(project)
  persistProjects()
  upsertProjectRuntime(id, {
    brand: input.brand || '—',
    priority: input.priority || 'medium',
    owner: input.owner || '',
    clientContact: input.clientContact || '',
    kpi: {
      cycleStart,
      cycleEnd,
      accounts: input.kpi?.accounts ?? 0,
      videos: input.kpi?.videos ?? 0,
      exposure: input.kpi?.exposure ?? 0,
      scripts:
        input.kpi?.scripts ??
        (input.kpi?.accounts || 0) * (input.kpi?.scriptsPerAccount || 0),
      scriptsPerAccount: input.kpi?.scriptsPerAccount ?? 0
    },
    current: {
      accounts: 0,
      scripts: 0,
      edited: 0,
      approved: 0,
      distributed: 0,
      exposure: 0
    }
  })
  return project
}

/** 更新项目基础信息与 KPI / 现状（总览编辑用） */
export function updateProject(
  id: string,
  input: Partial<CreateProjectInput> & {
    runStatus?: string
    current?: Partial<ProjectRuntime['current']>
  }
) {
  const project = getProjectById(id)
  if (!project) return null
  if (input.name?.trim()) {
    project.name = input.name.trim()
    if (!project.aliases.includes(project.name)) project.aliases.push(project.name)
  }
  if (input.region != null) project.region = input.region
  persistProjects()
  const runtime = upsertProjectRuntime(id, {
    brand: input.brand,
    priority: input.priority,
    owner: input.owner,
    clientContact: input.clientContact,
    kpi: {
      cycleStart: input.cycleStart ?? input.kpi?.cycleStart,
      cycleEnd: input.cycleEnd ?? input.kpi?.cycleEnd,
      accounts: input.kpi?.accounts,
      videos: input.kpi?.videos,
      exposure: input.kpi?.exposure,
      scripts: input.kpi?.scripts,
      scriptsPerAccount: input.kpi?.scriptsPerAccount
    },
    current: input.current
  })
  project.status = runtime.runStatus
  persistProjects()
  return project
}

/** 删除项目：runtime + 项目排期/日历块一并清掉 */
export function removeProject(id: string) {
  const idx = dojoProjectStore.projects.findIndex((p) => p.id === id)
  if (idx < 0) return false
  dojoProjectStore.projects.splice(idx, 1)
  dojoProjectStore.selectedIds = dojoProjectStore.selectedIds.filter((x) => x !== id)
  persistProjects()
  removeProjectRuntime(id)
  removeScheduleBlocksByProject(id)
  return true
}

/**
 * 隐藏 / 恢复显示项目。
 * active=false 时：今日待办、排期等默认不展示；项目总览可在「已隐藏」里恢复。
 */
export function setProjectActive(id: string, active: boolean) {
  const project = getProjectById(id)
  if (!project) return false
  if (project.active === active) return true
  project.active = active
  if (!active) {
    dojoProjectStore.selectedIds = dojoProjectStore.selectedIds.filter((x) => x !== id)
  }
  persistProjects()
  return true
}

/** 批量隐藏已结束（完结）项目 */
export function hideEndedProjects() {
  let n = 0
  dojoProjectStore.projects.forEach((p) => {
    if (p.active === false) return
    const status = getProjectRuntime(p.id)?.runStatus || p.status
    if (status === '完结' || status === '已完成') {
      if (setProjectActive(p.id, false)) n++
    }
  })
  return n
}

/** 按 projectId 字段筛选 */
export function matchesProjectIds(projectId: string, filterIds?: string[]) {
  const ids = filterIds ?? dojoProjectStore.selectedIds
  if (!ids.length) return true
  return ids.includes(projectId)
}

/** 按文本模糊匹配任一选中项目 */
export function matchesAnyProject(text: string, filterIds?: string[]) {
  const ids = filterIds ?? dojoProjectStore.selectedIds
  if (!ids.length) return true
  return ids.some((id) => {
    const p = getProjectById(id)
    return p ? matchProjectText(text, p) : false
  })
}

export function matchProjectText(text: string, project: DojoProject | null) {
  if (!project) return true
  const t = text.toLowerCase()
  if (project.aliases.some((a) => a && t.includes(a.toLowerCase()))) return true
  if (t.includes(project.name.toLowerCase())) return true
  if (project.region && project.region !== '—' && t.includes(project.region.toLowerCase())) {
    const base = project.name.split('·')[0].trim().toLowerCase()
    const token = base.split(' ').find((w) => w.length > 3)
    if (token && t.includes(token)) return true
  }
  return false
}

export function ensureProject(name: string) {
  const trimmed = name.trim()
  const existing = dojoProjectStore.projects.find(
    (p) => p.name === trimmed || p.id === trimmed.toLowerCase().replace(/\s+/g, '-')
  )
  if (existing) return existing.id
  return createProject({ name: trimmed }).id
}
