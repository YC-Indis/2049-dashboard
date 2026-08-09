/**
 * 全局概览指标：今日页与 AI 助手上下文共用同一份推导结果。
 *
 * 这些数字过去写死在 fixture.ts 里（9 阶段 / 166 条分发），换数据后就和实际
 * 内容对不上，助手也会照着旧数字回答。改为从导入数据与运行时层推导，
 * 后续文档入账后能自动跟着变。
 */
import { computed } from 'vue'
import { workflowStages, weeklyScripts } from '@/mock/dojo/imported'
import { runtimeDistributions } from '@/store/dojoRuntimeStore'
import { demoTasks } from '@/mock/dojo/fixture'
import { DOJO_TODAY } from '@/utils/dojoDates'

export const milestonesTotal = computed(() => workflowStages.length)
export const milestonesDone = computed(
  () => workflowStages.filter((s) => s.status === '已完成').length
)

/** 首个未完成阶段，作为「今天该推什么」的落点 */
export const pendingStage = computed(
  () => workflowStages.find((s) => s.status !== '已完成')?.name || '无待办阶段'
)

export const scriptItems = computed(() =>
  Object.values(weeklyScripts).reduce((sum, rows) => sum + rows.length, 0)
)

/** 逾期由截止时间与今天比对得出，任务状态里没有 overdue 这一档 */
const isOverdue = (dueAt: string, status: string) =>
  Boolean(dueAt) && dueAt.slice(0, 10) < DOJO_TODAY && status !== 'done'

export const overviewStats = computed(() => ({
  todayTasks: demoTasks.filter((t) => t.due === '今天').length,
  overdue: demoTasks.filter((t) => isOverdue(t.dueAt, t.status)).length,
  pendingReview: demoTasks.filter((t) => t.status === 'pending_review').length,
  blocked: demoTasks.filter((t) => t.status === 'blocked').length,
  unfinished: milestonesTotal.value - milestonesDone.value,
  milestonesDone: milestonesDone.value,
  milestonesTotal: milestonesTotal.value,
  scriptItems: scriptItems.value,
  distributionRows: runtimeDistributions.value.length
}))

export const todayAdvice = computed(
  () =>
    `dojo脚本 ${milestonesTotal.value} 阶段中 ${milestonesDone.value} 项已完成。` +
    `今天优先处理「${pendingStage.value}」，并在内容流转页同步分发指标。`
)

export const topActions = computed(() => {
  const awaiting = demoTasks.filter((t) => t.confirmState === 'awaiting_pm').length
  return [
    { text: `确认「${pendingStage.value}」— 待项目经理确认`, tone: 'warning' as const },
    {
      text: `推进未完成里程碑 ${overviewStats.value.unfinished} 项`,
      tone: 'danger' as const
    },
    {
      text:
        `PM 监看：${overviewStats.value.distributionRows} 条分发可用 RapidAPI 同步` +
        (awaiting ? `，${awaiting} 条待确认` : ''),
      tone: 'warning' as const
    }
  ]
})
