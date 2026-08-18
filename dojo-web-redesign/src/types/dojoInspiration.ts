export type InspirationPlatform = 'TikTok' | 'YouTube' | 'Instagram' | '小红书'

export type InspirationSourceKind = 'keyword' | 'account' | 'hashtag' | 'trend' | 'local-import'

export type InspirationLens =
  | 'topic'
  | 'hook'
  | 'transition'
  | 'format'
  | 'gameplay'
  | 'visual-audio'

export type InspirationRanking = 'balanced' | 'fresh' | 'hot'

export type CollectionJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'awaiting-provider'
  | 'failed'

export type CandidateStatus = 'new' | 'qualified' | 'rejected' | 'promoted'

export type ScriptAssetStatus = 'draft' | 'confirmed' | 'scheduled'

export type ScriptMessageRole = 'user' | 'assistant' | 'system'

export interface InspirationSource {
  id: string
  name: string
  platform: InspirationPlatform
  kind: InspirationSourceKind
  query: string
  lenses?: InspirationLens[]
  timeWindowDays?: 7 | 30 | 90 | 0
  ranking?: InspirationRanking
  defaultLimit: number
  enabled: boolean
  createdAt: string
}

export interface CollectionJob {
  id: string
  sourceId: string
  requestedCount: number
  status: CollectionJobStatus
  provider: 'local-import' | 'rapidapi'
  resultCount: number
  startedAt: string
  completedAt?: string
  message?: string
}

export interface InspirationCandidate {
  id: string
  sourceId: string
  collectionJobId?: string
  collectedAt?: string
  platform: InspirationPlatform
  author: string
  title: string
  summary: string
  url: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  saves: number
  growthRate: number
  matchScore: number
  heatScore?: number
  freshnessScore?: number
  trendScore?: number
  lenses?: InspirationLens[]
  tags: string[]
  status: CandidateStatus
  rawPayload?: Record<string, unknown>
}

export interface ExecutableInspiration {
  id: string
  candidateId?: string
  blueprintId?: string
  title: string
  angle: string
  hook: string
  referenceUrl?: string
  /** 原视频账号 / 创作者，进入脚本库时一并保留 */
  sourceAuthor?: string
  sourcePlatform?: InspirationPlatform
  transcript?: string
  visualNotes?: string
  shotPlan: string[]
  copyPlan: string[]
  musicPlan: string[]
  annotations: InspirationAnnotation[]
  category?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface ScriptAsset {
  id: string
  inspirationId?: string
  referenceUrl?: string
  sourceAuthor?: string
  sourcePlatform?: InspirationPlatform
  title: string
  status: ScriptAssetStatus
  hook: string
  body: string
  transcript?: string
  visualNotes?: string
  shots: string[]
  music: string
  notes: string
  category?: string
  tags?: string[]
  /** 完成至少一次「拆解原版 → 转化成我方产品脚本」的 AI 写入后才可确认入库 */
  aiAdaptedAt?: string
  creatorContentId?: string
  createdAt: string
  updatedAt: string
}

export interface ScriptConversationMessage {
  id: string
  scriptId: string
  role: ScriptMessageRole
  content: string
  createdAt: string
}

export type InspirationStatus = 'new' | 'saved' | 'ignored' | 'task-created'

export interface InspirationAnalysis {
  hook: string
  structure: string[]
  transferableRules: string[]
  risk: string
  nextAngle: string
}

export interface InspirationItem {
  id: string
  platform: InspirationPlatform
  author: string
  title: string
  summary: string
  url: string
  publishedAt: string
  topic: string
  views: number
  saves: number
  comments: number
  growthRate: number
  programScore: number
  aiScore: number
  duplicateScore: number
  tags: string[]
  analysis: InspirationAnalysis
}

export interface InspirationLocalState {
  statusById: Record<string, InspirationStatus>
  notesById: Record<string, string>
  annotationsById: Record<string, InspirationAnnotation[]>
  sources: InspirationSource[]
  jobs: CollectionJob[]
  candidates: InspirationCandidate[]
  executableInspirations: ExecutableInspiration[]
  scripts: ScriptAsset[]
  conversations: ScriptConversationMessage[]
  revision: number
}

export interface InspirationAnnotation {
  id: string
  text: string
  createdAt: string
}

export type MatrixMarket = '美国' | '英国' | '波兰'

export interface MatrixVariant {
  market: MatrixMarket
  hook: string
  distribution: string
  hashtags: string
}

/** 从矩阵规划中归纳的“证据到脚本”生产蓝图。 */
export interface MatrixBlueprint {
  id: string
  motif: string
  format: string
  promise: string
  evidenceUrl?: string
  shotRequirement: string
  beats: string[]
  productRule: string
  visual: string
  audio: string
  variants: MatrixVariant[]
  completeness: number
}
