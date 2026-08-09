import { reactive } from 'vue'

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
}

/**
 * 跨模块同步的日期焦点：分发筛选日期区间 → 日历 / 时间规划可对齐。
 */
export const dojoScheduleStore = reactive({
  blocks: [] as ScheduleBlock[],
  /** 分发页等写入的全局日期焦点 */
  focusRange: null as null | { start: string; end: string }
})

export function setFocusRange(start: string, end: string) {
  dojoScheduleStore.focusRange = { start, end }
}

export function clearFocusRange() {
  dojoScheduleStore.focusRange = null
}

export function addScheduleBlock(block: Omit<ScheduleBlock, 'id'>) {
  const id = `SB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  dojoScheduleStore.blocks.push({ ...block, id })
  return id
}

export function removeScheduleBlock(id: string) {
  dojoScheduleStore.blocks = dojoScheduleStore.blocks.filter((b) => b.id !== id)
}
