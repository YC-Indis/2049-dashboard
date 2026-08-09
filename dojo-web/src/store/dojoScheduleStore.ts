import { reactive } from 'vue'
import { DOJO_TODAY } from '@/utils/dojoDates'
import { removeTagByBlockId, syncTagFromBlock } from '@/store/dojoFlowStore'

/** 用户在时间规划 / 日历上框选添加的任务块 */
export interface ScheduleBlock {
  id: string
  projectId: string
  projectName: string
  title: string
  type: 'script' | 'publish' | 'ad' | 'milestone' | 'other'
  start: string
  end: string
  note?: string
  source: 'timeline' | 'calendar' | 'distribution' | 'manual'
  owner?: string
  status?: string
}

/**
 * 跨模块同步的排期与日期焦点：时间规划框选、节奏日历添加、分发页写入
 * 都落在这里，日历 / 时间规划 / 今日待办读同一份数据。
 */
export const dojoScheduleStore = reactive({
  blocks: [
    {
      id: 'imp-matrix-xros6-uk-D-006',
      projectId: 'matrix-xros6-uk',
      projectName: 'xros6 英国2.0',
      title: '分发跟进 @elliottlan3',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 757',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-matrix-xros6-uk-D-007',
      projectId: 'matrix-xros6-uk',
      projectName: 'xros6 英国2.0',
      title: '分发跟进 @elliottlan3',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 1',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-matrix-xros6-uk-D-008',
      projectId: 'matrix-xros6-uk',
      projectName: 'xros6 英国2.0',
      title: '分发跟进 @elliottlan3',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 727',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-script-matrix-xros6-uk-1',
      projectId: 'matrix-xros6-uk',
      projectName: 'xros6 英国2.0',
      title: '脚本 · A little coffee break with XROS 6 ☕✨',
      type: 'script',
      start: '2026-07-14',
      end: '2026-07-14',
      note: 'Coffee/drink UGC/Flower',
      source: 'timeline',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-script-matrix-xros6-uk-2',
      projectId: 'matrix-xros6-uk',
      projectName: 'xros6 英国2.0',
      title: '脚本 · Morning ritual: coffee & XROS 6 ☀️💨',
      type: 'script',
      start: '2026-07-14',
      end: '2026-07-14',
      note: 'Coffee/drink UGC/Flower',
      source: 'timeline',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-matrix-xros6-de-D-003',
      projectId: 'matrix-xros6-de',
      projectName: 'xros6 德国2.0',
      title: '分发跟进 @daisylok21',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 425',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-matrix-xros6-de-D-004',
      projectId: 'matrix-xros6-de',
      projectName: 'xros6 德国2.0',
      title: '分发跟进 @daisylok21',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 1,098',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-matrix-xros6-de-D-005',
      projectId: 'matrix-xros6-de',
      projectName: 'xros6 德国2.0',
      title: '分发跟进 @daisylok21',
      type: 'publish',
      start: '2026-08-07',
      end: '2026-08-07',
      note: '自然播 868',
      source: 'calendar',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-script-matrix-xros6-de-1',
      projectId: 'matrix-xros6-de',
      projectName: 'xros6 德国2.0',
      title: '脚本 · Mein perfekter Kaffeemoment mit XROS 6 ☕',
      type: 'script',
      start: '2026-07-14',
      end: '2026-07-14',
      note: 'Coffee/drink UGC/Flower',
      source: 'timeline',
      owner: '2049',
      status: '进行中'
    },
    {
      id: 'imp-script-matrix-xros6-de-2',
      projectId: 'matrix-xros6-de',
      projectName: 'xros6 德国2.0',
      title: '脚本 · Gemütliche Momente mit Kaffee und XROS 6',
      type: 'script',
      start: '2026-07-14',
      end: '2026-07-14',
      note: 'Coffee/drink UGC/Flower',
      source: 'timeline',
      owner: '2049',
      status: '进行中'
    }
  ] as ScheduleBlock[],
  /** 分发页等写入的全局日期焦点 */
  focusRange: null as null | { start: string; end: string }
})

export function setFocusRange(start: string, end: string) {
  dojoScheduleStore.focusRange = { start, end }
}

export function clearFocusRange() {
  dojoScheduleStore.focusRange = null
}

/** 带 id 则覆盖，不带则新建；写入后自动同步流程标记 */
export function upsertScheduleBlock(block: Omit<ScheduleBlock, 'id'> & { id?: string }): string {
  const id = block.id || `SB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const next: ScheduleBlock = { status: '已安排', ...block, id }
  const idx = dojoScheduleStore.blocks.findIndex((b) => b.id === id)
  if (idx >= 0) dojoScheduleStore.blocks[idx] = next
  else dojoScheduleStore.blocks.push(next)
  syncTagFromBlock(next)
  return id
}

/** @deprecated 用 upsertScheduleBlock */
export function addScheduleBlock(block: Omit<ScheduleBlock, 'id'>) {
  return upsertScheduleBlock(block)
}

export function removeScheduleBlock(id: string) {
  dojoScheduleStore.blocks = dojoScheduleStore.blocks.filter((b) => b.id !== id)
  removeTagByBlockId(id)
}

/** 拖拽改期等局部更新，返回更新后的块 */
export function patchScheduleBlock(id: string, patch: Partial<ScheduleBlock>): ScheduleBlock | null {
  const idx = dojoScheduleStore.blocks.findIndex((b) => b.id === id)
  if (idx < 0) return null
  const next = { ...dojoScheduleStore.blocks[idx], ...patch, id }
  dojoScheduleStore.blocks[idx] = next
  syncTagFromBlock(next)
  return next
}

/** 某一天覆盖到的任务块（含跨天的） */
export function blocksOnDate(date: string = DOJO_TODAY): ScheduleBlock[] {
  return dojoScheduleStore.blocks.filter((b) => b.start <= date && b.end >= date)
}
