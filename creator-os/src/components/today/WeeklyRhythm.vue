<script setup lang="ts">
import { creatorStore } from '../../stores/creatorStore'
import { STAGE_LABELS } from '../../constants/stages'
import { uiStore } from '../../stores/uiStore'

const weekDays = [
  { day: 'MON', date: '10', fullDate: '2026-08-10' },
  { day: 'TUE', date: '11', fullDate: '2026-08-11' },
  { day: 'WED', date: '12', fullDate: '2026-08-12' },
  { day: 'THU', date: '13', fullDate: '2026-08-13' },
  { day: 'FRI', date: '14', fullDate: '2026-08-14' },
  { day: 'SAT', date: '15', fullDate: '2026-08-15' },
  { day: 'SUN', date: '16', fullDate: '2026-08-16' },
]

function getTasks(date: string) {
  return creatorStore.scheduledTasks.value.filter((task) => task.plannedDate === date)
}

function getEvents(date: string) {
  return creatorStore.state.calendarEvents.filter((event) => event.date === date)
}

function getContentTitle(contentId: string) {
  return creatorStore.getContent(contentId)?.title ?? '未命名内容'
}
</script>

<template>
  <section class="weekly-rhythm panel">
    <header class="section-heading">
      <div>
        <p class="eyebrow">WEEKLY RHYTHM</p>
        <h2>这一周，内容正在向前走</h2>
      </div>
      <RouterLink to="/calendar">
        打开完整日历
        <span aria-hidden="true">→</span>
      </RouterLink>
    </header>

    <div class="week-grid">
      <article
        v-for="day in weekDays"
        :key="day.fullDate"
        class="week-day"
        :class="{ 'week-day--today': day.fullDate === '2026-08-14' }"
      >
        <header>
          <small>{{ day.day }}</small>
          <strong>{{ day.date }}</strong>
        </header>
        <div class="week-day__events">
          <div
            v-for="task in getTasks(day.fullDate)"
            :key="task.id"
            class="mini-event"
            :class="`stage-${task.stage}`"
            role="button"
            tabindex="0"
            :aria-label="`打开内容档案：${getContentTitle(task.contentId)}`"
            @click="uiStore.openContentDrawer(task.contentId)"
            @keydown.enter="uiStore.openContentDrawer(task.contentId)"
            @keydown.space.prevent="uiStore.openContentDrawer(task.contentId)"
          >
            <small>{{ STAGE_LABELS[task.stage] }}</small>
            <p>{{ getContentTitle(task.contentId) }}</p>
          </div>
          <div
            v-for="event in getEvents(day.fullDate)"
            :key="event.id"
            class="mini-event"
            :class="`stage-${event.stage}`"
          >
            <small>{{ event.label }}</small>
            <p>{{ event.title }}</p>
          </div>
          <p
            v-if="getTasks(day.fullDate).length === 0 && getEvents(day.fullDate).length === 0"
            class="week-day__empty"
          >
            留一点空白
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
