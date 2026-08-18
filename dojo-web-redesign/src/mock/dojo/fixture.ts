/** Dojo 前端骨架数据：对齐真实交付语义，后续接 Velix /api/dojo */

export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'pending_review' | 'done'
export type ConfirmState = 'draft' | 'awaiting_pm' | 'confirmed' | 'rejected'
export type ContentStage = 'script' | 'record' | 'edit' | 'publish' | 'review'
export type TaskType = 'script' | 'script_revise' | 'asset' | 'publish' | 'review' | 'plan'

export interface DojoTask {
  id: string
  title: string
  type: TaskType
  role: 'pm' | 'executor'
  owner: string
  due: string
  dueAt: string
  status: TaskStatus
  confirmState: ConfirmState
  progress: number
  priority: 'high' | 'medium' | 'low'
  note: string
  blockReason?: string
  project: string
  week: string
  linkHint: string
}

export interface DojoAccount {
  id: string
  handle: string
  stage: '待创建' | '养号' | '稳定运营' | '放量' | '暂停'
  followers: number
  posts7d: number
  views7d: number
  lastPost: string
  review: '待检阅' | '通过' | '需复检' | '异常'
  syncedAt?: string
}

export interface StageSpan {
  stage: ContentStage
  startDate: string
  endDate: string
}

export interface ContentFlowItem {
  id: string
  title: string
  stage: ContentStage
  grade: 'A' | 'B' | 'C'
  progress: number
  startDate: string
  endDate: string
  targetDate: string
  owner: string
  tags: string[]
  /** 各阶段起止 — 时间线滚动展示进程变化 */
  stageSpans: StageSpan[]
}

export interface PublishRecord {
  account: string
  publishDate: string
  videoUrl: string
  naturalViews?: number
  paidViews: number
  engagementRate?: number
  retention3s?: number
  note: string
}

export interface CalendarBacklogItem {
  id: string
  title: string
  grade: 'A' | 'B' | 'C'
  progress: number
  targetDate: string
  stages: ContentStage[]
  scheduledDate?: string
}

export interface CalendarEvent {
  id: string
  contentId: string
  title: string
  date: string
  stage: ContentStage
  color: string
}

export const demoProject = {
  name: 'Dojo UK 矩阵',
  platform: 'TikTok',
  weeks: 5,
  goalViews: 2_600_000,
  actualViews: 1_184_000,
  weekPlanDone: 3,
  weekPlanTotal: 5,
  risk: '内容运营细化方案确认待客户确认；脚本撰写/内容制作各 11 项进行中'
}

// 今日概览指标、三个最重要动作与建议语已迁至 store/dojoOverview.ts，改为从数据推导。

export const demoTasks: DojoTask[] = []

export const contentFlowItems: ContentFlowItem[] = []

export const stageLabels: Record<ContentStage, string> = {
  script: '脚本',
  record: '录制',
  edit: '剪辑',
  publish: '发布',
  review: '复盘'
}

export const stageColors: Record<ContentStage, string> = {
  script: '#4A90D9',
  record: '#e6a23c',
  edit: '#13c2c2',
  publish: '#f56c6c',
  review: '#909399'
}

export const demoAccounts: DojoAccount[] = []

export const agentStarterPrompts = [
  '今天具体做什么？',
  '按矩阵号周报格式总结本周',
  '@justdojoit 最近播放和互动率',
  '第三周脚本还差几条？'
]

/** 来自 dojo数据.xlsx 字段 — 平台日常录入 */
export const publishRecords: PublishRecord[] = []

/** 矩阵号周报说话结构 — Agent 有的放矢 */
export const weeklyReportTemplate = {
  sections: ['账号运营', '内容制作', '热点内容', '本周 todo'],
  example: `03/07-03/13
账号运营：12个账号入项目，6个稳定运营，共上线38条，总曝光398,828。
内容制作：截止03月13日完成素材23条；第三周脚本修改中；库存视频剩余3条。
热点内容：见 TikTok Creative Center。
本周todo：新一批账号分发；出第四周脚本；视频分发及统计。`
}

export const agentMemoryRules = [
  '已确认规则：英国市场脚本 Hook 必须在前 3 秒出现产品差异点',
  '候选规则：放量账号每周至少 5 条，待 PM 确认'
]
