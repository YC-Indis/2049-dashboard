import { computed, reactive } from 'vue'

export interface DojoProject {
  id: string
  name: string
  /** 用于筛选投放/分发等：匹配 project / batch / name 片段 */
  aliases: string[]
  region?: string
  status?: string
  active: boolean
}

/**
 * 多项目上下文：时间规划 / 节奏日历 / 投放 / 分发都挂在项目上。
 */
export const dojoProjectStore = reactive({
  projects: [
    {
      id: 'dojo',
      name: 'Dojo',
      aliases: ['dojo', 'Dojo', 'dojo 矩阵'],
      region: '英国',
      status: '进行中',
      active: true
    },
    {
      id: 'blast-10k-v1',
      name: 'blast 10k v1.0',
      aliases: ['blast 10k v1', 'blast10k', 'dojo blast 10k Q1', 'blast 10k', 'blast 10k v1.0'],
      region: '英国',
      status: '已完结',
      active: true
    },
    {
      id: 'blast-10k-v2',
      name: 'blast 10k v2.0',
      aliases: ['blast 10k v2', 'dojo blast 10k Q2', 'blast10k 2.0', 'blast 10k v2.0'],
      region: '英国',
      status: '已完结',
      active: true
    },
    {
      id: 'purex-60k-v1',
      name: 'purex 60k v1.0',
      aliases: ['purex 60k v1', 'purex 60k 1.0', 'purex', 'purex 60k v1.0'],
      region: '美国',
      status: '已达标',
      active: true
    },
    {
      id: 'xros6-v1-us',
      name: 'xros6 v1.0 · 美国',
      aliases: ['xros6 v1', 'xros 6', 'xros6 美国', 'Xros6', 'xros6 v1.0'],
      region: '美国',
      status: '已完结',
      active: true
    },
    {
      id: 'xros6-v1-pl',
      name: 'xros6 v1.0 · 波兰',
      aliases: ['xros6 波兰', 'xros6 poland', 'XROS - 波兰'],
      region: '波兰',
      status: '已完结',
      active: true
    },
    {
      id: 'xros6-v1-uk',
      name: 'xros6 v1.0 · 英国',
      aliases: ['xros6 英国', 'xros6 uk', 'xros6 v1.0 英国', 'Xros 6 UK'],
      region: '英国',
      status: '进行中',
      active: true
    },
    {
      id: 'matrix-blast-10k-v3',
      name: '垂类矩阵 · blast 10k v3.0',
      aliases: [
        'balst 10k 3.0 垂类',
        'blast10k 英国3.0',
        'blast 10k v3',
        '垂类 blast 10k',
        'blast 10k v3.0'
      ],
      region: '英国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-purex-60k-v2',
      name: '垂类矩阵 · purex 60k v2.0',
      aliases: ['purex 60k 2.0 垂类', 'purex 德州 2.0', '垂类 purex', 'purex 60k v2.0'],
      region: '美国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-blast-x',
      name: '垂类矩阵 · blast X',
      aliases: ['blast X 垂类', 'blast X 德国', 'blast X'],
      region: '德国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-blast-15k',
      name: '垂类矩阵 · blast 15k',
      aliases: ['blast15k 垂类', 'blast15k 法国', 'blast 15k'],
      region: '法国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-xros6-us',
      name: '垂类矩阵 · Xros 6 · 美国',
      aliases: ['xros6 美国 2.0垂类', 'xros6 美国', 'Xros 6 美国'],
      region: '美国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-xros6-uk',
      name: '垂类矩阵 · Xros 6 · 英国',
      aliases: ['xros6 英国 2.0垂类', 'xros6 英国2.0', 'Xros 6 英国'],
      region: '英国',
      status: '进行中',
      active: true
    },
    {
      id: 'matrix-xros6-de',
      name: '垂类矩阵 · Xros 6 · 德国',
      aliases: ['xros6 德国 2.0垂类', 'xros6 德国1.0', 'Xros 6 德国'],
      region: '德国',
      status: '进行中',
      active: true
    },
    {
      id: 'elfbar',
      name: 'elfbar',
      aliases: ['elfbar', 'Elfbar'],
      region: '—',
      status: '进行中',
      active: true
    },
    {
      id: 'vibe-se',
      name: 'vibe se',
      aliases: ['vibe se', 'vibe', 'Vibe se'],
      region: '—',
      status: '进行中',
      active: true
    },
    {
      id: 'us-edge',
      name: '美国南美擦边',
      aliases: ['美国南美擦边', '美国 南美擦边', '南美擦边'],
      region: '美国',
      status: '进行中',
      active: true
    }
  ] as DojoProject[],
  /** 空数组 = 全部项目 */
  selectedIds: [] as string[]
})

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
  const id = name.trim().toLowerCase().replace(/\s+/g, '-') || `p-${Date.now()}`
  if (!dojoProjectStore.projects.some((p) => p.id === id || p.name === name)) {
    dojoProjectStore.projects.push({
      id,
      name: name.trim(),
      aliases: [name.trim()],
      active: true
    })
  }
  return id
}
