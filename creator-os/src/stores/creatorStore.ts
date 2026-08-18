import { computed, reactive, toRaw } from 'vue'
import { CALENDAR_ITEMS, MOCK_CONTENTS, REVIEW_ITEMS, RULE_ITEMS } from '../data/mock'
import { STAGE_CONFIG } from '../constants/stages'
import type {
  CalendarItem,
  Content,
  ContentStage,
  Goal,
  NewContentPayload,
  Review,
  Rule,
  StageTask,
} from '../types'

const STORAGE_KEY = 'xia-creator-os-v1'

interface CreatorState {
  contents: Content[]
  stageTasks: StageTask[]
  calendarEvents: CalendarItem[]
  reviews: Review[]
  rules: Rule[]
  goal: Goal
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function createInitialTasks(): StageTask[] {
  const scheduledDates: Record<string, string> = {
    'content-03': '2026-08-18',
    'content-04': '2026-08-11',
    'content-05': '2026-08-20',
    'content-07': '2026-08-05',
    'content-08': '2026-08-12',
    'content-09': '2026-08-06',
    'content-10': '2026-08-15',
    'content-11': '2026-08-08',
  }

  const activeTasks = MOCK_CONTENTS.map<StageTask>((content, index) => ({
    id: `task-active-${content.id}`,
    contentId: content.id,
    stage: content.currentStage,
    status: scheduledDates[content.id] ? 'scheduled' : 'unscheduled',
    plannedDate: scheduledDates[content.id] ?? null,
    order: index,
    note: '',
  }))

  const historyTasks: StageTask[] = [
    ['content-05', 'outline'],
    ['content-05', 'idea'],
    ['content-07', 'script'],
    ['content-07', 'outline'],
    ['content-09', 'recording'],
    ['content-11', 'editing'],
  ].map(([contentId, stage], index) => ({
    id: `task-history-${index + 1}`,
    contentId,
    stage: stage as ContentStage,
    status: 'done',
    plannedDate: null,
    completedAt: `2026-08-${String(index + 2).padStart(2, '0')}T12:00:00.000Z`,
    order: index,
  }))

  return [...activeTasks, ...historyTasks]
}

function createInitialReviews(): Review[] {
  return REVIEW_ITEMS.map((item, index) => {
    const content = MOCK_CONTENTS.find((entry) => entry.title === item.title)
    return {
      id: item.id,
      contentId: content?.id ?? `content-${index + 1}`,
      rating: item.rating ?? 0,
      result: item.insight ?? '',
      reason: item.insight ?? '',
      dueDate: item.rating ? `2026-07-${23 + index}` : '2026-08-15',
      reviewedAt: item.rating ? `2026-07-${23 + index}` : undefined,
      views: item.rating ? (index === 1 ? 12800 : 14900) : 0,
      saves: item.rating ? (index === 1 ? 780 : 1090) : 0,
    }
  })
}

function createInitialRules(): Rule[] {
  return RULE_ITEMS.map((item) => ({
    id: item.id,
    text: item.text,
    sourceContentId: MOCK_CONTENTS.find((content) => content.title === item.source)?.id,
    createdAt: `2026-${item.date.replace('月', '-').replace('日', '')}`,
    usageCount: item.usageCount,
  }))
}

function getDefaultState(): CreatorState {
  return {
    contents: structuredClone(MOCK_CONTENTS),
    stageTasks: createInitialTasks(),
    calendarEvents: structuredClone(
      CALENDAR_ITEMS.filter((item) => item.stage === 'review' || item.stage === 'live'),
    ),
    reviews: createInitialReviews(),
    rules: createInitialRules(),
    goal: {
      id: 'goal-current',
      title: '稳定发布 11 篇有证据的内容，吸引真正匹配的客户。',
      startDate: '2026-07-17',
      endDate: '2026-08-16',
      publishTarget: 11,
      publishCurrent: 2,
      followerTarget: 4000,
      followerCurrent: 3618,
      qualityTarget: 4,
      qualityCurrent: 2,
    },
  }
}

function loadState(): CreatorState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return getDefaultState()
    }
    return JSON.parse(saved) as CreatorState
  } catch {
    return getDefaultState()
  }
}

const state = reactive<CreatorState>(loadState())

function persist() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toRaw(state)))
}

function getContent(contentId: string) {
  return state.contents.find((content) => content.id === contentId)
}

function getCurrentTask(contentId: string) {
  const content = getContent(contentId)
  if (!content) {
    return undefined
  }
  return state.stageTasks.find(
    (task) => task.contentId === contentId && task.stage === content.currentStage && task.status !== 'done',
  )
}

function createStageTask(contentId: string, stage: ContentStage) {
  const existing = state.stageTasks.find(
    (task) => task.contentId === contentId && task.stage === stage && task.status !== 'done',
  )
  if (existing) {
    existing.status = 'unscheduled'
    existing.plannedDate = null
    return existing
  }

  const task: StageTask = {
    id: createId('task'),
    contentId,
    stage,
    status: 'unscheduled',
    plannedDate: null,
    order: state.stageTasks.filter((entry) => entry.stage === stage).length,
  }
  state.stageTasks.push(task)
  return task
}

function createContent(payload: NewContentPayload) {
  const now = new Date().toISOString()
  const content: Content = {
    id: createId('content'),
    title: payload.title.trim(),
    summary: payload.rawIdea.trim() || '刚刚捕捉的新内容，等待补充更多细节。',
    rawIdea: payload.rawIdea.trim(),
    role: payload.role,
    tier: payload.tier,
    type: payload.type,
    priority: payload.priority,
    currentStage: 'idea',
    status: 'planned',
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
  state.contents.unshift(content)
  createStageTask(content.id, 'idea')
  persist()
  return content
}

function moveContentStage(
  contentId: string,
  targetStage: ContentStage,
  beforeContentId?: string,
) {
  const content = getContent(contentId)
  if (!content) {
    return
  }

  if (content.currentStage !== targetStage) {
    const currentTask = getCurrentTask(contentId)
    if (currentTask) {
      currentTask.status = 'done'
      currentTask.completedAt = new Date().toISOString()
    }
    content.currentStage = targetStage
    content.status = targetStage === 'idea' ? 'planned' : 'in_production'
    createStageTask(contentId, targetStage)
  }

  const fromIndex = state.contents.findIndex((entry) => entry.id === contentId)
  const [moved] = state.contents.splice(fromIndex, 1)
  const beforeIndex = beforeContentId
    ? state.contents.findIndex((entry) => entry.id === beforeContentId)
    : -1
  if (beforeIndex >= 0) {
    state.contents.splice(beforeIndex, 0, moved)
  } else {
    let lastTargetIndex = -1
    state.contents.forEach((entry, index) => {
      if (entry.currentStage === targetStage) {
        lastTargetIndex = index
      }
    })
    state.contents.splice(lastTargetIndex + 1, 0, moved)
  }
  content.updatedAt = new Date().toISOString()
  persist()
}

function scheduleTask(taskId: string, date: string) {
  const task = state.stageTasks.find((entry) => entry.id === taskId)
  if (!task) {
    return
  }
  task.plannedDate = date
  task.status = 'scheduled'
  persist()
}

function unscheduleTask(taskId: string) {
  const task = state.stageTasks.find((entry) => entry.id === taskId)
  if (!task) {
    return
  }
  task.plannedDate = null
  task.status = 'unscheduled'
  persist()
}

function scheduleFixedEvent(kind: 'batch-review' | 'live', date: string) {
  const event: CalendarItem = {
    id: createId('event'),
    title: kind === 'batch-review' ? '集中处理到期内容' : '内容节奏直播答疑',
    date,
    stage: kind === 'batch-review' ? 'review' : 'live',
    label: kind === 'batch-review' ? '复盘' : '直播',
  }
  state.calendarEvents.push(event)
  persist()
  return event
}

function rescheduleCalendarEvent(eventId: string, date: string) {
  const event = state.calendarEvents.find((entry) => entry.id === eventId)
  if (!event) {
    return
  }
  event.date = date
  persist()
}

function completeTask(taskId: string) {
  const task = state.stageTasks.find((entry) => entry.id === taskId)
  const content = task ? getContent(task.contentId) : undefined
  if (!task || !content) {
    return
  }

  task.status = 'done'
  task.completedAt = new Date().toISOString()
  task.plannedDate = null

  const currentIndex = STAGE_CONFIG.findIndex((stage) => stage.id === task.stage)
  const nextStage = STAGE_CONFIG[currentIndex + 1]?.id
  if (nextStage) {
    content.currentStage = nextStage
    content.status = 'in_production'
    createStageTask(content.id, nextStage)
  } else {
    content.status = 'review_pending'
    state.goal.publishCurrent += 1
    const dueDate = addDays(new Date().toISOString().slice(0, 10), 3)
    if (!state.reviews.some((review) => review.contentId === content.id)) {
      state.reviews.push({
        id: createId('review'),
        contentId: content.id,
        rating: 0,
        result: '',
        reason: '',
        dueDate,
      })
    }
  }
  content.updatedAt = new Date().toISOString()
  persist()
}

function completeReview(reviewId: string, reusableRule?: string) {
  const review = state.reviews.find((entry) => entry.id === reviewId)
  if (!review) {
    return
  }
  review.rating = review.rating || 5
  review.result = review.result || '内容完成目标，并留下了一条可复用判断。'
  review.reason = review.reason || '真实场景与清晰判断让用户更容易理解。'
  review.reviewedAt = new Date().toISOString().slice(0, 10)
  review.reusableRule = reusableRule
  const content = getContent(review.contentId)
  if (content) {
    content.status = 'reviewed'
  }
  if (reusableRule?.trim()) {
    state.rules.unshift({
      id: createId('rule'),
      text: reusableRule.trim(),
      sourceContentId: review.contentId,
      createdAt: review.reviewedAt,
      usageCount: 0,
    })
  }
  persist()
}

function resetDemo() {
  Object.assign(state, getDefaultState())
  persist()
}

const unscheduledTasks = computed(() =>
  state.stageTasks.filter((task) => task.status === 'unscheduled'),
)

const scheduledTasks = computed(() =>
  state.stageTasks.filter((task) => task.status === 'scheduled' && task.plannedDate),
)

const activeContents = computed(() =>
  state.contents.filter((content) => content.status === 'planned' || content.status === 'in_production'),
)

export const creatorStore = {
  state,
  unscheduledTasks,
  scheduledTasks,
  activeContents,
  getContent,
  getCurrentTask,
  createContent,
  moveContentStage,
  scheduleTask,
  rescheduleTask: scheduleTask,
  unscheduleTask,
  scheduleFixedEvent,
  rescheduleCalendarEvent,
  completeTask,
  completeReview,
  resetDemo,
}
