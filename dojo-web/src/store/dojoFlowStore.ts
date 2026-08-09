import { reactive } from 'vue'

/**
 * Dojo 内容流转的六个阶段。节奏日历 / 时间规划 / 今日待办共用同一套阶段与配色，
 * 项目一旦启用标签，这三处就会显示同一批阶段标记。
 */
export interface FlowStage {
  key: string
  label: string
  sub: string
  color: string
}

export const FLOW_STAGES: FlowStage[] = [
  { key: 'activate', label: '起号', sub: '云机起号 / 账号准备', color: '#14b8a6' },
  { key: 'script', label: '脚本', sub: '选题结构 / 文案脚本', color: '#3b82f6' },
  { key: 'edit', label: '剪辑', sub: '拍剪成片 / 字幕调色', color: '#6366f1' },
  { key: 'approve', label: '过审', sub: '客户确认 / 合规过审', color: '#8b5cf6' },
  { key: 'distribute', label: '分发', sub: '成片上线 / 自然流', color: '#f59e0b' },
  { key: '投放', label: '投放', sub: '投流监控 / 曝光回收', color: '#ef4444' }
]

export const FLOW_TAGS = FLOW_STAGES.map((s) => ({ key: s.key, label: s.label, color: s.color }))

const VALID_TAG_KEYS = new Set(FLOW_STAGES.map((s) => s.key))

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.filter((t) => VALID_TAG_KEYS.has(t)))]
}

export function findFlowTag(key: string) {
  return FLOW_TAGS.find((t) => t.key === key)
}

/** 从任务标题猜阶段，用于把导入的里程碑归到流程里 */
export function stageFromTitle(title: string): string | null {
  if (/起号/.test(title)) return 'activate'
  if (/脚本/.test(title)) return 'script'
  if (/剪辑|成片|拍摄/.test(title)) return 'edit'
  if (/过审/.test(title)) return 'approve'
  if (/分发/.test(title)) return 'distribute'
  if (/投放|曝光|复盘/.test(title)) return '投放'
  if (/启动|前期/.test(title)) return 'activate'
  return null
}

export function stageFromBlockType(type: string): string {
  if (type === 'script') return 'script'
  if (type === 'publish') return 'distribute'
  if (type === 'ad') return '投放'
  return 'approve'
}

export interface FlowTagItem {
  id: string
  projectId: string
  date: string
  title: string
  tags: string[]
}

export const dojoTagStore = reactive({
  /** 每个项目启用了哪些阶段标签；同项目内共用 */
  projectTags: {
    'matrix-xros6-uk': ['activate', 'script', 'edit', 'approve', 'distribute', '投放'],
    'matrix-xros6-de': ['activate', 'script', 'edit', 'approve', 'distribute', '投放']
  } as Record<string, string[]>,
  items: [
    {
      id: 'tag-matrix-xros6-uk-1',
      projectId: 'matrix-xros6-uk',
      date: '2026-08-07',
      title: 'xros6 英国2.0 · 脚本/分发核对',
      tags: ['script', 'distribute']
    },
    {
      id: 'tag-matrix-xros6-de-1',
      projectId: 'matrix-xros6-de',
      date: '2026-08-07',
      title: 'xros6 德国2.0 · 脚本/分发核对',
      tags: ['script', 'distribute']
    }
  ] as FlowTagItem[]
})

export function getProjectTags(projectId: string): string[] {
  return dojoTagStore.projectTags[projectId] || []
}

export function setProjectTags(projectId: string, tags: string[]) {
  dojoTagStore.projectTags[projectId] = normalizeTags(tags)
}

/** 空数组 = 不限项目，返回全部阶段 */
export function tagsForProjects(projectIds: string[]): string[] {
  if (!projectIds.length) return FLOW_TAGS.map((t) => t.key)
  const set = new Set<string>()
  for (const id of projectIds) {
    for (const t of getProjectTags(id)) set.add(t)
  }
  return [...set]
}

export function upsertTagItem(item: FlowTagItem & { id?: string }): string {
  const id = item.id || `tag-${Date.now()}`
  const tags = normalizeTags(item.tags)
  const existing = dojoTagStore.items.find((t) => t.id === id)
  if (existing) {
    existing.projectId = item.projectId
    existing.date = item.date
    existing.title = item.title
    existing.tags = tags
    return id
  }
  dojoTagStore.items.push({ ...item, id, tags })
  return id
}

export function scheduleTagId(blockId: string): string {
  return `sched-tag-${blockId}`
}

/**
 * 用户在时间规划框选、或手工新建的任务，自动在流程里留一条对应标记。
 * 导入来源（calendar / distribution）不参与，避免历史数据把流程刷满。
 */
export function syncTagFromBlock(block: {
  id: string
  projectId: string
  title: string
  type: string
  start: string
  source: string
}) {
  if (block.source !== 'timeline' && block.source !== 'manual') return
  upsertTagItem({
    id: scheduleTagId(block.id),
    projectId: block.projectId,
    date: block.start,
    title: block.title,
    tags: [stageFromBlockType(block.type)]
  })
}

export function removeTagByBlockId(blockId: string) {
  const id = scheduleTagId(blockId)
  dojoTagStore.items = dojoTagStore.items.filter((t) => t.id !== id)
}
