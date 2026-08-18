export type ContentStage =
  | 'idea'
  | 'outline'
  | 'script'
  | 'recording'
  | 'editing'
  | 'publishing'

export type ContentRole = 'acquisition' | 'trust' | 'conversion'
export type ContentTier = 'A' | 'B' | 'C'
export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type TaskStatus = 'unscheduled' | 'scheduled' | 'doing' | 'done'

export interface Content {
  id: string
  title: string
  summary: string
  rawIdea: string
  role: ContentRole
  tier: ContentTier
  type: string
  priority: Priority
  currentStage: ContentStage
  status:
    | 'planned'
    | 'in_production'
    | 'published'
    | 'review_pending'
    | 'reviewed'
    | 'archived'
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CalendarItem {
  id: string
  title: string
  date: string
  stage: ContentStage | 'review' | 'live'
  label: string
}

export interface StageTask {
  id: string
  contentId: string
  stage: ContentStage
  status: TaskStatus
  plannedDate: string | null
  startedAt?: string | null
  completedAt?: string | null
  order: number
  note?: string
}

export interface Goal {
  id: string
  title: string
  startDate: string
  endDate: string
  publishTarget: number
  publishCurrent: number
  followerTarget: number
  followerCurrent: number
  qualityTarget: number
  qualityCurrent: number
}

export interface Review {
  id: string
  contentId: string
  rating: number
  result: string
  reason: string
  didWell?: string
  improve?: string
  reusableRule?: string
  dueDate: string
  reviewedAt?: string
  views?: number
  saves?: number
}

export interface Rule {
  id: string
  text: string
  sourceContentId?: string
  createdAt: string
  usageCount: number
}

export interface NewContentPayload {
  title: string
  role: ContentRole
  tier: ContentTier
  type: string
  priority: Priority
  rawIdea: string
}

export interface ReviewItem {
  id: string
  title: string
  date: string
  rating?: number
  insight?: string
}

export interface RuleItem {
  id: string
  text: string
  source: string
  date: string
  usageCount: number
}
