import { computed, reactive } from 'vue'
import { CREATOR_STAGES, creatorStageLabel } from '@/constants/dojoCreator'
import { buildCreatorFixture } from '@/mock/dojo/creatorFixtures'
import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
import {
  patchScheduleBlock,
  removeScheduleBlock,
  upsertScheduleBlock
} from '@/store/dojoScheduleStore'
import type {
  CompleteCreatorReviewInput,
  CreateCreatorContentInput,
  CreateCreatorPlanningItemInput,
  CreatorCalendarEvent,
  CreatorCalendarEventKind,
  CreatorContent,
  CreatorPlanningItem,
  CreatorReview,
  CreatorRule,
  CreatorStage,
  CreatorStageWindow
} from '@/types/dojoCreator'
import { loadTable, saveTable } from '@/utils/dojoPersist'

const CONTENT_TABLE = 'creatorContents'
const REVIEW_TABLE = 'creatorReviews'
const RULE_TABLE = 'creatorRules'
const CALENDAR_EVENT_TABLE = 'creatorCalendarEvents'
const PLANNING_ITEM_TABLE = 'creatorPlanningItems'

const CREATOR_STAGE_DURATIONS: Record<CreatorStage, number> = {
  idea: 1,
  outline: 1,
  script: 2,
  shooting: 1,
  editing: 2,
  publish: 1
}

const savedContents = loadTable<CreatorContent[]>(CONTENT_TABLE) || []
const savedReviews = loadTable<CreatorReview[]>(REVIEW_TABLE) || []
const savedRules = loadTable<CreatorRule[]>(RULE_TABLE) || []
const savedCalendarEvents = loadTable<CreatorCalendarEvent[]>(CALENDAR_EVENT_TABLE) || []
const savedPlanningItems = loadTable<CreatorPlanningItem[]>(PLANNING_ITEM_TABLE) || []

export const dojoCreatorStore = reactive({
  contents: savedContents,
  reviews: savedReviews,
  rules: savedRules,
  calendarEvents: savedCalendarEvents,
  planningItems: savedPlanningItems,
  revision: 0
})

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T12:00:00`).getTime()
  const endTime = new Date(`${end}T12:00:00`).getTime()
  return Math.max(0, Math.round((endTime - startTime) / 86400000))
}

function derivedStagePlan(content: CreatorContent): Record<CreatorStage, CreatorStageWindow> {
  const currentIndex = Math.max(
    0,
    CREATOR_STAGES.findIndex((stage) => stage.key === content.currentStage)
  )
  const anchor = content.plannedDate || content.createdAt.slice(0, 10)
  const daysBeforeCurrent = CREATOR_STAGES.slice(0, currentIndex).reduce(
    (total, stage) => total + CREATOR_STAGE_DURATIONS[stage.key],
    0
  )
  let start = addDays(anchor, -daysBeforeCurrent)
  const plan = {} as Record<CreatorStage, CreatorStageWindow>

  CREATOR_STAGES.forEach((stage, index) => {
    const end = addDays(start, CREATOR_STAGE_DURATIONS[stage.key] - 1)
    plan[stage.key] = {
      start,
      end,
      deadline: end,
      status: index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending',
      owner: content.owner
    }
    start = addDays(end, 1)
  })

  return plan
}

function persist() {
  dojoCreatorStore.revision++
  saveTable(CONTENT_TABLE, dojoCreatorStore.contents)
  saveTable(REVIEW_TABLE, dojoCreatorStore.reviews)
  saveTable(RULE_TABLE, dojoCreatorStore.rules)
  saveTable(CALENDAR_EVENT_TABLE, dojoCreatorStore.calendarEvents)
  saveTable(PLANNING_ITEM_TABLE, dojoCreatorStore.planningItems)
}

function ensureInitialFixture() {
  if (dojoCreatorStore.contents.length || !dojoProjectStore.projects.length) return
  const firstProject = dojoProjectStore.projects.find((project) => project.active !== false)
  if (!firstProject) return
  const fixture = buildCreatorFixture(firstProject.id)
  dojoCreatorStore.contents = fixture.contents
  dojoCreatorStore.reviews = fixture.reviews
  dojoCreatorStore.rules = fixture.rules
  persist()
}

ensureInitialFixture()

export function getCreatorContent(contentId: string) {
  return dojoCreatorStore.contents.find((content) => content.id === contentId) || null
}

export function getCreatorStagePlan(content: CreatorContent) {
  const fallback = derivedStagePlan(content)
  const plan = {} as Record<CreatorStage, CreatorStageWindow>

  CREATOR_STAGES.forEach((stage) => {
    const saved = content.stagePlan?.[stage.key]
    plan[stage.key] = saved ? { ...fallback[stage.key], ...saved } : fallback[stage.key]
  })

  if (
    content.scheduleBlockId &&
    content.plannedDate &&
    !content.stagePlan?.[content.currentStage]
  ) {
    plan[content.currentStage] = {
      ...plan[content.currentStage],
      start: content.plannedDate,
      end: content.plannedDate,
      deadline: content.plannedDate,
      scheduleBlockId: content.scheduleBlockId
    }
  }

  return plan
}

export function isCreatorStageScheduled(content: CreatorContent, stage: CreatorStage) {
  return Boolean(getCreatorStagePlan(content)[stage].scheduleBlockId)
}

export function createCreatorContent(input: CreateCreatorContentInput) {
  const now = new Date().toISOString()
  const content: CreatorContent = {
    id: createId('creator'),
    projectId: input.projectId,
    title: input.title.trim(),
    summary: input.summary?.trim() || '',
    role: input.role || 'trust',
    type: input.type || '项目事项',
    tier: input.tier || 'B',
    priority: input.priority || 'normal',
    currentStage: 'idea',
    plannedDate: input.plannedDate || null,
    owner: input.owner?.trim(),
    createdAt: now,
    updatedAt: now
  }
  dojoCreatorStore.contents.unshift(content)
  if (input.plannedDate) syncCreatorSchedule(content)
  persist()
  return content
}

export function removeCreatorContent(contentId: string) {
  const index = dojoCreatorStore.contents.findIndex((item) => item.id === contentId)
  if (index < 0) return false
  const content = dojoCreatorStore.contents[index]
  const scheduleIds = new Set<string>()
  if (content.scheduleBlockId) scheduleIds.add(content.scheduleBlockId)
  Object.values(content.stagePlan || {}).forEach((window) => {
    if (window?.scheduleBlockId) scheduleIds.add(window.scheduleBlockId)
  })
  dojoCreatorStore.planningItems
    .filter((item) => item.contentId === contentId)
    .forEach((item) => {
      if (item.scheduleBlockId) scheduleIds.add(item.scheduleBlockId)
    })
  scheduleIds.forEach((scheduleId) => removeScheduleBlock(scheduleId))
  dojoCreatorStore.contents.splice(index, 1)
  dojoCreatorStore.planningItems = dojoCreatorStore.planningItems.filter(
    (item) => item.contentId !== contentId
  )
  dojoCreatorStore.reviews = dojoCreatorStore.reviews.filter(
    (review) => review.contentId !== contentId
  )
  dojoCreatorStore.rules = dojoCreatorStore.rules.filter(
    (rule) => rule.sourceContentId !== contentId
  )
  persist()
  return true
}

export function moveCreatorContent(contentId: string, stage: CreatorStage) {
  const content = getCreatorContent(contentId)
  if (!content || content.currentStage === stage) return
  content.currentStage = stage
  content.scheduleBlockId = content.stagePlan?.[stage]?.scheduleBlockId
  content.plannedDate = content.stagePlan?.[stage]?.start || null
  content.updatedAt = new Date().toISOString()
  persist()
}

export function scheduleCreatorStage(
  contentId: string,
  stage: CreatorStage,
  start: string,
  requestedEnd?: string,
  requestedLane?: number
) {
  const content = getCreatorContent(contentId)
  const project = content ? getProjectById(content.projectId) : null
  if (!content || !project) return null

  const currentWindow = getCreatorStagePlan(content)[stage]
  const duration = Math.max(
    CREATOR_STAGE_DURATIONS[stage] - 1,
    daysBetween(currentWindow.start, currentWindow.end)
  )
  const end = requestedEnd && requestedEnd >= start ? requestedEnd : addDays(start, duration)
  const status =
    currentWindow.status === 'done'
      ? 'done'
      : stage === content.currentStage
        ? 'active'
        : 'scheduled'
  const scheduleBlockId = upsertScheduleBlock({
    id: currentWindow.scheduleBlockId,
    projectId: content.projectId,
    projectName: project.name,
    title: `${creatorStageLabel(stage)} · ${content.title}`,
    type:
      stage === 'script' || stage === 'outline'
        ? 'script'
        : stage === 'publish'
          ? 'publish'
          : 'task',
    start,
    end,
    note: `Creator OS 步骤 · ${content.type} · 截止 ${end}`,
    source: 'manual',
    owner: currentWindow.owner || content.owner,
    status: status === 'done' ? '已完成' : status === 'active' ? '进行中' : '已安排'
  })
  const nextWindow: CreatorStageWindow = {
    ...currentWindow,
    start,
    end,
    deadline: end,
    lane: requestedLane ?? currentWindow.lane,
    status,
    scheduleBlockId
  }
  content.stagePlan = {
    ...content.stagePlan,
    [stage]: nextWindow
  }
  if (stage === content.currentStage) {
    content.plannedDate = start
    content.scheduleBlockId = scheduleBlockId
  }
  content.updatedAt = new Date().toISOString()
  persist()
  return nextWindow
}

export function unscheduleCreatorStage(contentId: string, stage: CreatorStage) {
  const content = getCreatorContent(contentId)
  if (!content) return false
  const window = content.stagePlan?.[stage]
  if (window?.scheduleBlockId) removeScheduleBlock(window.scheduleBlockId)
  if (content.stagePlan) {
    const nextPlan = { ...content.stagePlan }
    delete nextPlan[stage]
    content.stagePlan = nextPlan
  }
  if (stage === content.currentStage) {
    content.plannedDate = null
    content.scheduleBlockId = undefined
  }
  content.updatedAt = new Date().toISOString()
  persist()
  return true
}

export function scheduleCreatorContent(contentId: string, date: string | null) {
  const content = getCreatorContent(contentId)
  if (!content) return
  if (date) scheduleCreatorStage(contentId, content.currentStage, date)
  else unscheduleCreatorStage(contentId, content.currentStage)
}

export function toggleCreatorStageDone(contentId: string, stage: CreatorStage) {
  const content = getCreatorContent(contentId)
  if (!content) return null
  const currentWindow = getCreatorStagePlan(content)[stage]
  const isDone = currentWindow.status === 'done'
  const status = isDone ? (stage === content.currentStage ? 'active' : 'scheduled') : 'done'
  const nextWindow: CreatorStageWindow = {
    ...currentWindow,
    status
  }
  content.stagePlan = {
    ...content.stagePlan,
    [stage]: nextWindow
  }
  if (currentWindow.scheduleBlockId) {
    patchScheduleBlock(currentWindow.scheduleBlockId, {
      status: status === 'done' ? '已完成' : status === 'active' ? '进行中' : '已安排'
    })
  }
  content.updatedAt = new Date().toISOString()
  persist()
  return nextWindow
}

export function createCreatorPlanningItem(input: CreateCreatorPlanningItemInput) {
  const now = new Date().toISOString()
  const item: CreatorPlanningItem = {
    id: createId('creator-task'),
    projectId: input.projectId,
    contentId: input.contentId || undefined,
    phaseBlockId: input.phaseBlockId || undefined,
    parentId: input.parentId || undefined,
    title: input.title.trim(),
    detail: input.detail?.trim() || '',
    priority: input.priority || 'normal',
    owner: input.owner?.trim() || undefined,
    plannedDate: null,
    createdAt: now,
    updatedAt: now
  }
  dojoCreatorStore.planningItems.unshift(item)
  persist()
  return item
}

export function getCreatorPlanningItem(itemId: string) {
  return dojoCreatorStore.planningItems.find((item) => item.id === itemId) || null
}

export function scheduleCreatorPlanningItem(itemId: string, date: string) {
  const item = getCreatorPlanningItem(itemId)
  const project = item ? getProjectById(item.projectId) : null
  if (!item || !project) return null
  const content = item.contentId ? getCreatorContent(item.contentId) : null
  const scheduleBlockId = upsertScheduleBlock({
    id: item.scheduleBlockId,
    projectId: item.projectId,
    projectName: project.name,
    title: item.title,
    type: 'task',
    start: date,
    end: date,
    note: [content ? `内容：${content.title}` : '', item.detail].filter(Boolean).join(' · '),
    source: 'manual',
    owner: item.owner,
    status: '已安排'
  })
  item.plannedDate = date
  item.scheduleBlockId = scheduleBlockId
  item.updatedAt = new Date().toISOString()
  persist()
  return item
}

export function unscheduleCreatorPlanningItem(itemId: string) {
  const item = getCreatorPlanningItem(itemId)
  if (!item) return false
  if (item.scheduleBlockId) removeScheduleBlock(item.scheduleBlockId)
  item.plannedDate = null
  item.scheduleBlockId = undefined
  item.updatedAt = new Date().toISOString()
  persist()
  return true
}

export function shiftCreatorPlanningItemsForPhase(phaseBlockId: string, dayDelta: number) {
  if (!dayDelta) return 0
  let shifted = 0
  dojoCreatorStore.planningItems.forEach((item) => {
    if (item.phaseBlockId !== phaseBlockId || !item.plannedDate) return
    item.plannedDate = addDays(item.plannedDate, dayDelta)
    item.updatedAt = new Date().toISOString()
    if (item.scheduleBlockId) {
      patchScheduleBlock(item.scheduleBlockId, {
        start: item.plannedDate,
        end: item.plannedDate
      })
    }
    shifted++
  })
  if (shifted) persist()
  return shifted
}

export function removeCreatorPlanningItem(itemId: string) {
  const index = dojoCreatorStore.planningItems.findIndex((item) => item.id === itemId)
  if (index < 0) return false
  const item = dojoCreatorStore.planningItems[index]
  if (item.scheduleBlockId) removeScheduleBlock(item.scheduleBlockId)
  dojoCreatorStore.planningItems.splice(index, 1)
  dojoCreatorStore.planningItems.forEach((child) => {
    if (child.parentId === itemId) child.parentId = undefined
  })
  persist()
  return true
}

export function scheduleCreatorCalendarEvent(kind: CreatorCalendarEventKind, date: string) {
  const event: CreatorCalendarEvent = {
    id: createId('creator-calendar'),
    kind,
    title: kind === 'batch-review' ? '批量复盘' : '直播安排',
    date,
    createdAt: new Date().toISOString()
  }
  dojoCreatorStore.calendarEvents.push(event)
  persist()
  return event
}

export function rescheduleCreatorCalendarEvent(eventId: string, date: string) {
  const event = dojoCreatorStore.calendarEvents.find((item) => item.id === eventId)
  if (!event) return
  event.date = date
  persist()
}

export function removeCreatorCalendarEvent(eventId: string) {
  const index = dojoCreatorStore.calendarEvents.findIndex((item) => item.id === eventId)
  if (index < 0) return
  dojoCreatorStore.calendarEvents.splice(index, 1)
  persist()
}

export function clearCreatorCalendarEvents() {
  if (!dojoCreatorStore.calendarEvents.length) return false
  dojoCreatorStore.calendarEvents = []
  persist()
  return true
}

function syncCreatorSchedule(content: CreatorContent) {
  if (!content.plannedDate) return
  scheduleCreatorStage(content.id, content.currentStage, content.plannedDate)
}

export function markCreatorPublished(contentId: string) {
  const content = getCreatorContent(contentId)
  if (!content) return
  content.currentStage = 'publish'
  content.updatedAt = new Date().toISOString()
  if (content.scheduleBlockId) {
    patchScheduleBlock(content.scheduleBlockId, { status: '已完成' })
  }
  if (
    !dojoCreatorStore.reviews.some((review) => review.contentId === contentId && !review.reviewedAt)
  ) {
    const today = new Date().toISOString().slice(0, 10)
    dojoCreatorStore.reviews.unshift({
      id: createId('creator-review'),
      contentId,
      dueDate: addDays(today, 3),
      rating: 0,
      result: '',
      reason: ''
    })
  }
  persist()
}

export function createCreatorReview(
  contentId: string,
  dueDate?: string,
  inspirationId?: string,
  sourceTitle?: string
) {
  const content = getCreatorContent(contentId)
  if (!content && !inspirationId) return null
  const today = new Date().toISOString().slice(0, 10)
  const review: CreatorReview = {
    id: createId('creator-review'),
    contentId,
    inspirationId,
    dueDate: dueDate || today,
    title: `${content?.title || sourceTitle || '灵感'} 记录`,
    rating: 0,
    result: '',
    reason: ''
  }
  dojoCreatorStore.reviews.unshift(review)
  persist()
  return review
}

export function completeCreatorReview(reviewId: string, input: CompleteCreatorReviewInput) {
  const review = dojoCreatorStore.reviews.find((item) => item.id === reviewId)
  if (!review) return
  review.rating = input.rating
  review.inspirationId = input.inspirationId || review.inspirationId
  review.title = input.title?.trim() || review.title
  review.result = input.result.trim()
  review.reason = input.reason.trim()
  review.videoUrl = input.videoUrl?.trim() || undefined
  review.scriptSnapshot = input.scriptSnapshot?.trim() || undefined
  review.manualNotes = input.manualNotes?.trim() || undefined
  review.shotNotes = input.shotNotes?.trim() || undefined
  review.copyNotes = input.copyNotes?.trim() || undefined
  review.musicNotes = input.musicNotes?.trim() || undefined
  review.aiSummary = input.aiSummary?.trim() || undefined
  review.nextAction = input.nextAction?.trim() || undefined
  review.tags = input.tags?.map((tag) => tag.trim()).filter(Boolean) || []
  review.views = Math.max(0, input.views || 0)
  review.likes = Math.max(0, input.likes || 0)
  review.comments = Math.max(0, input.comments || 0)
  review.shares = Math.max(0, input.shares || 0)
  review.saves = Math.max(0, input.saves || 0)
  review.reviewedAt = new Date().toISOString().slice(0, 10)
  if (input.reusableRule?.trim()) {
    dojoCreatorStore.rules.unshift({
      id: createId('creator-rule'),
      text: input.reusableRule.trim(),
      dimension: input.knowledgeDimension || 'copy',
      sourceContentId: review.contentId,
      createdAt: review.reviewedAt,
      usageCount: 0
    })
  }
  persist()
}

export const activeCreatorContents = computed(() => dojoCreatorStore.contents)

export const scheduledCreatorContents = computed(() =>
  dojoCreatorStore.contents
    .filter((content) => content.plannedDate)
    .sort((left, right) => String(left.plannedDate).localeCompare(String(right.plannedDate)))
)

export const pendingCreatorReviews = computed(() =>
  dojoCreatorStore.reviews.filter((review) => !review.reviewedAt)
)

export function nextCreatorStage(stage: CreatorStage) {
  const index = CREATOR_STAGES.findIndex((item) => item.key === stage)
  return CREATOR_STAGES[index + 1]?.key || null
}
