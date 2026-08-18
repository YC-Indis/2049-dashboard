import { reactive } from 'vue'
import { DOJO_TODAY } from '@/utils/dojoDates'
import { removeTagByBlockId, syncTagFromBlock } from '@/store/dojoFlowStore'
import { loadTable, saveTable } from '@/utils/dojoPersist'

/** 日历 / 项目排期共用的日期事项（KPI 同步块 + 用户自建任务） */
export interface ScheduleBlock {
  id: string
  projectId: string
  projectName: string
  title: string
  type: 'script' | 'publish' | 'ad' | 'milestone' | 'other' | 'task'
  start: string
  end: string
  note?: string
  source: 'timeline' | 'calendar' | 'distribution' | 'manual'
  owner?: string
  status?: string
  /** 已完成量（与项目总览 current 同源） */
  done?: number
  /** 目标量 */
  target?: number
  /** 同一项目内的可视轨道；只影响时间线排布，不改变日期。 */
  lane?: number
}

const TABLE = 'scheduleBlocks'

/**
 * 跨模块同步的排期与日期焦点：时间规划框选、节奏日历增删改、KPI 同步
 * 都落在这里，日历 / 时间规划读同一份数据。
 */
export const dojoScheduleStore = reactive({
  blocks: (loadTable<ScheduleBlock[]>(TABLE) || []) as ScheduleBlock[],
  focusRange: null as null | { start: string; end: string },
  laneOrder: [] as string[],
  revision: 0
})

function persist() {
  dojoScheduleStore.revision++
  saveTable(TABLE, dojoScheduleStore.blocks)
}

export function isKpiBlock(block: ScheduleBlock) {
  return block.id.startsWith('KPI-')
}

export function isUserTask(block: ScheduleBlock) {
  return !isKpiBlock(block)
}

export function moveLane(id: string, delta: -1 | 1) {
  const ids = dojoScheduleStore.laneOrder.length
    ? [...dojoScheduleStore.laneOrder]
    : dojoScheduleStore.blocks.map((b) => b.id)
  if (!ids.includes(id)) ids.push(id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (to < 0 || to >= ids.length) return
  const [row] = ids.splice(from, 1)
  ids.splice(to, 0, row)
  dojoScheduleStore.laneOrder = ids
}

export function reorderLane(
  dragId: string,
  targetId: string,
  place: 'before' | 'after' = 'before'
) {
  if (dragId === targetId) return
  const ids = dojoScheduleStore.laneOrder.length
    ? [...dojoScheduleStore.laneOrder]
    : dojoScheduleStore.blocks.map((b) => b.id)
  if (!ids.includes(dragId)) ids.push(dragId)
  if (!ids.includes(targetId)) ids.push(targetId)
  const from = ids.indexOf(dragId)
  ids.splice(from, 1)
  let to = ids.indexOf(targetId)
  if (place === 'after') to += 1
  ids.splice(to, 0, dragId)
  dojoScheduleStore.laneOrder = ids
}

export function ensureLaneOrder(ids: string[]) {
  const cur = dojoScheduleStore.laneOrder.filter((id) => ids.includes(id))
  ids.forEach((id) => {
    if (!cur.includes(id)) cur.push(id)
  })
  const prev = dojoScheduleStore.laneOrder
  if (prev.length === cur.length && prev.every((id, i) => id === cur[i])) return
  dojoScheduleStore.laneOrder = cur
}

export function setFocusRange(start: string, end: string) {
  dojoScheduleStore.focusRange = { start, end }
}

export function clearFocusRange() {
  dojoScheduleStore.focusRange = null
}

export function upsertScheduleBlock(block: Omit<ScheduleBlock, 'id'> & { id?: string }): string {
  const id = block.id || `SB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const next: ScheduleBlock = {
    status: '进行中',
    ...block,
    id,
    type: block.type ?? 'task'
  }
  const idx = dojoScheduleStore.blocks.findIndex((b) => b.id === id)
  if (idx >= 0) dojoScheduleStore.blocks[idx] = next
  else dojoScheduleStore.blocks.push(next)
  syncTagFromBlock(next)
  persist()
  return id
}

/** @deprecated 用 upsertScheduleBlock */
export function addScheduleBlock(block: Omit<ScheduleBlock, 'id'>) {
  return upsertScheduleBlock(block)
}

export function removeScheduleBlock(id: string) {
  dojoScheduleStore.blocks = dojoScheduleStore.blocks.filter((b) => b.id !== id)
  removeTagByBlockId(id)
  dojoScheduleStore.laneOrder = dojoScheduleStore.laneOrder.filter((x) => x !== id)
  persist()
}

/** 项目删除时一并清排期（KPI 块 + 自建），保证日历/项目排期联动 */
export function removeScheduleBlocksByProject(projectId: string) {
  const keep: ScheduleBlock[] = []
  const removedIds: string[] = []
  dojoScheduleStore.blocks.forEach((b) => {
    if (b.projectId === projectId) removedIds.push(b.id)
    else keep.push(b)
  })
  if (!removedIds.length) return 0
  dojoScheduleStore.blocks = keep
  removedIds.forEach((id) => removeTagByBlockId(id))
  const gone = new Set(removedIds)
  dojoScheduleStore.laneOrder = dojoScheduleStore.laneOrder.filter((id) => !gone.has(id))
  persist()
  return removedIds.length
}

/** 清理已无对应项目的孤儿排期 */
export function purgeOrphanScheduleBlocks(validProjectIds: Set<string> | string[]) {
  const valid = validProjectIds instanceof Set ? validProjectIds : new Set(validProjectIds)
  const orphanIds = dojoScheduleStore.blocks
    .filter((b) => b.projectId && !valid.has(b.projectId))
    .map((b) => b.id)
  if (!orphanIds.length) return 0
  const gone = new Set(orphanIds)
  dojoScheduleStore.blocks = dojoScheduleStore.blocks.filter((b) => !gone.has(b.id))
  orphanIds.forEach((id) => removeTagByBlockId(id))
  dojoScheduleStore.laneOrder = dojoScheduleStore.laneOrder.filter((id) => !gone.has(id))
  persist()
  return orphanIds.length
}

export function patchScheduleBlock(
  id: string,
  patch: Partial<ScheduleBlock>
): ScheduleBlock | null {
  const idx = dojoScheduleStore.blocks.findIndex((b) => b.id === id)
  if (idx < 0) return null
  const next = { ...dojoScheduleStore.blocks[idx], ...patch, id }
  dojoScheduleStore.blocks[idx] = next
  syncTagFromBlock(next)
  persist()
  return next
}

/** 批量补丁，只落盘一次（用于 KPI 进度刷新） */
export function patchManyScheduleBlocks(
  match: (block: ScheduleBlock) => Partial<ScheduleBlock> | null
): number {
  let n = 0
  dojoScheduleStore.blocks = dojoScheduleStore.blocks.map((b) => {
    const patch = match(b)
    if (!patch) return b
    const next = { ...b, ...patch, id: b.id }
    const same =
      next.title === b.title &&
      next.done === b.done &&
      next.target === b.target &&
      next.note === b.note &&
      next.status === b.status
    if (same) return b
    n++
    syncTagFromBlock(next)
    return next
  })
  if (n) persist()
  return n
}

/** 某一天覆盖到的事项（含跨天） */
export function blocksOnDate(date: string = DOJO_TODAY): ScheduleBlock[] {
  return dojoScheduleStore.blocks.filter((b) => b.start <= date && b.end >= date)
}

/** 某月有起/止/跨天事项的日期集合，供月条 BI */
export function monthEventDates(monthKey: string): string[] {
  const dates = new Set<string>()
  dojoScheduleStore.blocks.forEach((b) => {
    if (b.start.startsWith(monthKey)) dates.add(b.start)
    if (b.end.startsWith(monthKey)) dates.add(b.end)
  })
  return [...dates].sort()
}
