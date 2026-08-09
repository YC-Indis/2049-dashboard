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

export const demoTasks: DojoTask[] = [
  {
    id: 'T-104',
    title: '确认第 4 周发布计划（12 条）',
    type: 'plan',
    role: 'pm',
    owner: 'pm_lucas',
    due: '今天',
    dueAt: '2026-08-07T18:00:00',
    status: 'pending_review',
    confirmState: 'awaiting_pm',
    progress: 100,
    priority: 'high',
    note: 'Agent 已拆解草案，等待项目经理确认后下发执行',
    project: 'Dojo',
    week: 'W4',
    linkHint: '关联：周计划 / 脚本 8 份'
  },
  {
    id: 'T-105',
    title: '审核 3 条待过审脚本',
    type: 'script',
    role: 'pm',
    owner: 'pm_lucas',
    due: '今天',
    dueAt: '2026-08-07T20:00:00',
    status: 'pending_review',
    confirmState: 'awaiting_pm',
    progress: 60,
    priority: 'high',
    note: 'Hook 与产品卖点需对照项目记忆规则',
    project: 'Dojo',
    week: 'W4',
    linkHint: '关联：脚本库'
  },
  {
    id: 'T-211',
    title: '完成脚本 XR-UK-041 拍摄素材上传',
    type: 'asset',
    role: 'executor',
    owner: 'Ken',
    due: '今天',
    dueAt: '2026-08-07T22:00:00',
    status: 'doing',
    confirmState: 'confirmed',
    progress: 40,
    priority: 'medium',
    note: '缺 B-roll，预计今晚补齐',
    project: 'Dojo',
    week: 'W4',
    linkHint: '关联：脚本 XR-UK-041'
  },
  {
    id: 'T-212',
    title: '发布 @vape.uk.daily 今日 2 条',
    type: 'publish',
    role: 'executor',
    owner: 'Mia',
    due: '今天',
    dueAt: '2026-08-07T18:00:00',
    status: 'blocked',
    confirmState: 'confirmed',
    progress: 20,
    priority: 'high',
    note: '阻塞：总账号预览未通过（异常互动）',
    blockReason: '账号 @vape.uk.daily 检阅异常',
    project: 'Dojo',
    week: 'W4',
    linkHint: '关联：总账号预览'
  },
  {
    id: 'T-213',
    title: '逾期：第 3 周脚本修补',
    type: 'script_revise',
    role: 'executor',
    owner: 'pm_lucas',
    due: '昨天',
    dueAt: '2026-08-04T18:00:00',
    status: 'todo',
    confirmState: 'confirmed',
    progress: 0,
    priority: 'high',
    note: '逾期：需补进度与实际发布时间',
    project: 'Dojo',
    week: 'W3',
    linkHint: '关联：脚本库'
  },
  {
    id: 'T-214',
    title: '素材包交付',
    type: 'asset',
    role: 'executor',
    owner: 'pm_lucas',
    due: '昨天',
    dueAt: '2026-08-04T18:00:00',
    status: 'todo',
    confirmState: 'confirmed',
    progress: 0,
    priority: 'medium',
    note: '等待剪辑接手',
    project: 'Dojo',
    week: 'W3',
    linkHint: '关联：内容流转'
  }
]

export const contentFlowItems: ContentFlowItem[] = [
  {
    id: 'C-04',
    title: 'XR-UK-041 开箱对比',
    stage: 'edit',
    grade: 'A',
    progress: 62,
    startDate: '2026-02-25',
    endDate: '2026-03-08',
    targetDate: '2026-03-08',
    owner: '2049',
    tags: ['剪辑', '产品'],
    stageSpans: [
      { stage: 'script', startDate: '2026-02-25', endDate: '2026-02-27' },
      { stage: 'record', startDate: '2026-02-28', endDate: '2026-03-02' },
      { stage: 'edit', startDate: '2026-03-03', endDate: '2026-03-07' },
      { stage: 'publish', startDate: '2026-03-08', endDate: '2026-03-08' }
    ]
  },
  {
    id: 'C-05',
    title: '英国市场口味偏好测试',
    stage: 'publish',
    grade: 'B',
    progress: 88,
    startDate: '2026-02-22',
    endDate: '2026-03-06',
    targetDate: '2026-03-06',
    owner: '2049',
    tags: ['发布'],
    stageSpans: [
      { stage: 'script', startDate: '2026-02-22', endDate: '2026-02-24' },
      { stage: 'record', startDate: '2026-02-25', endDate: '2026-02-27' },
      { stage: 'edit', startDate: '2026-02-28', endDate: '2026-03-03' },
      { stage: 'publish', startDate: '2026-03-04', endDate: '2026-03-06' },
      { stage: 'review', startDate: '2026-03-06', endDate: '2026-03-06' }
    ]
  }
]

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

export const demoAccounts: DojoAccount[] = [
  {
    id: 'A-01',
    handle: '@vape.uk.daily',
    stage: '放量',
    followers: 18240,
    posts7d: 9,
    views7d: 126000,
    lastPost: '1 天前',
    review: '异常',
    syncedAt: '2026-08-07 09:12'
  },
  {
    id: 'A-02',
    handle: '@xros.uk.tips',
    stage: '稳定运营',
    followers: 9630,
    posts7d: 7,
    views7d: 54000,
    lastPost: '今天',
    review: '通过',
    syncedAt: '2026-08-07 09:12'
  },
  {
    id: 'A-03',
    handle: '@cloud.puff.uk',
    stage: '养号',
    followers: 1280,
    posts7d: 3,
    views7d: 4200,
    lastPost: '2 天前',
    review: '待检阅',
    syncedAt: '2026-08-06 18:40'
  },
  {
    id: 'A-04',
    handle: '@uk.device.lab',
    stage: '待创建',
    followers: 0,
    posts7d: 0,
    views7d: 0,
    lastPost: '未发布',
    review: '待检阅'
  }
]

export const agentStarterPrompts = [
  '今天具体做什么？',
  '按矩阵号周报格式总结本周',
  '@justdojoit 最近播放和互动率',
  '第三周脚本还差几条？'
]

/** 来自 dojo数据.xlsx 字段 — 平台日常录入 */
export const publishRecords: PublishRecord[] = [
  {
    account: 'tiktok.com/@justdojoit',
    publishDate: '2026-02-12',
    videoUrl: 'https://www.tiktok.com/@user977543303451666/video/7605744864243797270',
    paidViews: 25900,
    engagementRate: 0.0073,
    note: '自然流+投流'
  },
  {
    account: 'tiktok.com/@justdojoit',
    publishDate: '2026-02-14',
    videoUrl: 'https://www.tiktok.com/@user977543303451666/video/7606700315831799062',
    paidViews: 17100,
    engagementRate: 0.0138,
    note: '自然流+投流'
  },
  {
    account: 'tiktok.com/@justdojoit',
    publishDate: '2026-03-10',
    videoUrl: 'https://www.tiktok.com/@user977543303451666/video/7615080782259883286',
    naturalViews: 1904,
    paidViews: 66100,
    engagementRate: 0.0082,
    retention3s: 0.13,
    note: '自然流+投流，投放中'
  }
]

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
