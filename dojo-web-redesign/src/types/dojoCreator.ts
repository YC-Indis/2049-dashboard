export type CreatorStage = 'idea' | 'outline' | 'script' | 'shooting' | 'editing' | 'publish'

export type CreatorRole = 'acquisition' | 'trust' | 'conversion'

export type CreatorPriority = 'urgent' | 'high' | 'normal' | 'low'

export type CreatorCalendarEventKind = 'batch-review' | 'live'

export type CreatorStageStatus = 'pending' | 'scheduled' | 'active' | 'done'

export type CreatorKnowledgeDimension = 'shot' | 'copy' | 'music'

export interface CreatorStageWindow {
  start: string
  end: string
  deadline: string
  status: CreatorStageStatus
  lane?: number
  owner?: string
  scheduleBlockId?: string
}

export interface CreatorContent {
  id: string
  projectId: string
  title: string
  summary: string
  role: CreatorRole
  type: string
  tier: 'A' | 'B' | 'C'
  priority: CreatorPriority
  currentStage: CreatorStage
  plannedDate: string | null
  scheduleBlockId?: string
  stagePlan?: Partial<Record<CreatorStage, CreatorStageWindow>>
  owner?: string
  createdAt: string
  updatedAt: string
}

export interface CreatorReview {
  id: string
  contentId: string
  inspirationId?: string
  dueDate: string
  title?: string
  rating: number
  result: string
  reason: string
  videoUrl?: string
  scriptSnapshot?: string
  manualNotes?: string
  shotNotes?: string
  copyNotes?: string
  musicNotes?: string
  aiSummary?: string
  nextAction?: string
  tags?: string[]
  reviewedAt?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
}

export interface CreatorPlanningItem {
  id: string
  projectId: string
  contentId?: string
  phaseBlockId?: string
  parentId?: string
  title: string
  detail: string
  priority: CreatorPriority
  owner?: string
  plannedDate: string | null
  scheduleBlockId?: string
  createdAt: string
  updatedAt: string
}

export interface CreatorRule {
  id: string
  text: string
  dimension?: CreatorKnowledgeDimension
  sourceContentId?: string
  createdAt: string
  usageCount: number
}

export interface CreatorCalendarEvent {
  id: string
  kind: CreatorCalendarEventKind
  title: string
  date: string
  createdAt: string
}

export interface CreateCreatorContentInput {
  projectId: string
  title: string
  summary?: string
  role?: CreatorRole
  type?: string
  tier?: 'A' | 'B' | 'C'
  priority?: CreatorPriority
  plannedDate?: string | null
  owner?: string
}

export interface CreateCreatorPlanningItemInput {
  projectId: string
  contentId?: string
  phaseBlockId?: string
  parentId?: string
  title: string
  detail?: string
  priority?: CreatorPriority
  owner?: string
}

export interface CompleteCreatorReviewInput {
  inspirationId?: string
  title?: string
  rating: number
  result: string
  reason: string
  videoUrl?: string
  scriptSnapshot?: string
  manualNotes?: string
  shotNotes?: string
  copyNotes?: string
  musicNotes?: string
  aiSummary?: string
  nextAction?: string
  tags?: string[]
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  reusableRule?: string
  knowledgeDimension?: CreatorKnowledgeDimension
}
