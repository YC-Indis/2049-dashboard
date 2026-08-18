import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

function includesAll(label, value, fragments) {
  for (const fragment of fragments) {
    assert.ok(value.includes(fragment), `${label} missing contract: ${fragment}`)
  }
}

const app = await source('src/App.vue')
const store = await source('src/stores/creatorStore.ts')
const contentCard = await source('src/components/flow/ContentCard.vue')
const kanbanColumn = await source('src/components/flow/KanbanColumn.vue')
const flowPage = await source('src/pages/FlowPage.vue')
const rhythmKit = await source('src/components/calendar/RhythmKit.vue')
const monthCalendar = await source('src/components/calendar/MonthCalendar.vue')
const weekCalendar = await source('src/components/calendar/WeekCalendar.vue')
const calendarPage = await source('src/pages/CalendarPage.vue')
const todayPage = await source('src/pages/TodayPage.vue')
const goalsPage = await source('src/pages/GoalsPage.vue')
const reviewPage = await source('src/pages/ReviewPage.vue')
const sidebar = await source('src/components/layout/Sidebar.vue')
const profilePage = await source('src/pages/ProfilePage.vue')

includesAll('app creation and drawer', app, [
  'creatorStore.createContent(payload)',
  '<ContentDrawer />',
  '<ToastMessage />',
])

includesAll('shared store', store, [
  "const STORAGE_KEY = 'xia-creator-os-v1'",
  'window.localStorage.getItem',
  'window.localStorage.setItem',
  'moveContentStage',
  'scheduleTask',
  'unscheduleTask',
  'completeTask',
  'completeReview',
])

includesAll('flow drag wiring', contentCard, ['draggable="true"', '@dragstart', '@drop.stop'])
includesAll('flow whole-card activation', contentCard, [
  'role="button"',
  '@click="emit(\'view\'',
  '@keydown.enter',
  '@keydown.space.prevent',
])
includesAll('flow column drop wiring', kanbanColumn, ['@dragover.prevent', '@drop="handleDrop"'])
includesAll('flow store action', flowPage, ['creatorStore.moveContentStage', '@move="handleMove"'])

includesAll('rhythm kit drag wiring', rhythmKit, [
  '@drop="handleDrop"',
  "emit('unschedule', taskId)",
  "emit('dragFixed'",
])
includesAll('rhythm kit content activation', rhythmKit, [
  "emit('viewContent'",
  '@keydown.enter',
  '@keydown.space.prevent',
])
includesAll('month calendar drop wiring', monthCalendar, [
  "emit('schedule', taskId",
  "emit('rescheduleEvent'",
  '@dragstart',
])
includesAll('week calendar drop wiring', weekCalendar, [
  "emit('schedule', taskId",
  "emit('scheduleFixed'",
  "emit('rescheduleEvent'",
])
includesAll('calendar store actions', calendarPage, [
  'creatorStore.scheduleTask',
  'creatorStore.unscheduleTask',
  'creatorStore.scheduleFixedEvent',
  'creatorStore.rescheduleCalendarEvent',
])

includesAll('today derived state', todayPage, ['creatorStore.activeContents', 'creatorStore.state.reviews'])
includesAll('goals derived state', goalsPage, ['creatorStore.state.goal', 'const health = computed'])
includesAll('review derived state', reviewPage, [
  'creatorStore.state.reviews',
  'creatorStore.state.rules',
  'creatorStore.completeReview',
])
includesAll('sidebar destinations', sidebar, ['to="/profile"', ':to="item.path"'])
includesAll('profile destination', profilePage, [
  'creatorStore.state.contents.length',
  '本地数据已自动保存',
])

console.log('UI contract tests passed')
