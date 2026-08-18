<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { creatorStore } from '../../stores/creatorStore'
import { STAGE_LABELS } from '../../constants/stages'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const calendarDays = [
  { date: 27, month: 7 },
  { date: 28, month: 7 },
  { date: 29, month: 7 },
  { date: 30, month: 7 },
  { date: 31, month: 7 },
  ...Array.from({ length: 31 }, (_, index) => ({ date: index + 1, month: 8 })),
  { date: 1, month: 9 },
  { date: 2, month: 9 },
  { date: 3, month: 9 },
  { date: 4, month: 9 },
  { date: 5, month: 9 },
  { date: 6, month: 9 },
]

function getDateString(day: number, month = 8) {
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getScheduledTasks(day: number) {
  const date = getDateString(day)
  return creatorStore.scheduledTasks.value.filter((task) => task.plannedDate === date)
}

function getFixedEvents(day: number) {
  const date = getDateString(day)
  return creatorStore.state.calendarEvents.filter((event) => event.date === date)
}

function getContentTitle(contentId: string) {
  return creatorStore.getContent(contentId)?.title ?? '未命名内容'
}

function handleDrop(event: DragEvent, day: number, month: number) {
  if (month !== 8) {
    return
  }
  const taskId = event.dataTransfer?.getData('application/x-creator-task')
  if (taskId) {
    emit('schedule', taskId, getDateString(day, month))
    return
  }
  const fixedKind = event.dataTransfer?.getData('application/x-creator-fixed')
  if (fixedKind === 'batch-review' || fixedKind === 'live') {
    emit('scheduleFixed', fixedKind, getDateString(day, month))
    return
  }
  const eventId = event.dataTransfer?.getData('application/x-creator-event')
  if (eventId) {
    emit('rescheduleEvent', eventId, getDateString(day, month))
  }
}

const emit = defineEmits<{
  newContent: []
  dragTask: [event: DragEvent, taskId: string]
  dragEvent: [event: DragEvent, eventId: string]
  viewContent: [contentId: string]
  schedule: [taskId: string, date: string]
  scheduleFixed: [kind: 'batch-review' | 'live', date: string]
  rescheduleEvent: [eventId: string, date: string]
}>()
</script>

<template>
  <section class="month-calendar">
    <header class="calendar-toolbar">
      <div class="calendar-toolbar__navigation">
        <button type="button" aria-label="上一个月">
          <Icon icon="ph:caret-left" width="18" />
        </button>
        <button type="button">今</button>
        <button type="button" aria-label="下一个月">
          <Icon icon="ph:caret-right" width="18" />
        </button>
      </div>
      <h2>2026年8月</h2>
      <button class="calendar-add" type="button" @click="$emit('newContent')">
        <Icon icon="ph:plus" width="17" />
        新增内容
      </button>
    </header>

    <div class="calendar-grid">
      <div v-for="weekday in weekdays" :key="weekday" class="weekday-label">
        {{ weekday }}
      </div>

      <article
        v-for="(day, index) in calendarDays"
        :key="`${day.month}-${day.date}-${index}`"
        class="calendar-day"
        :class="{
          'calendar-day--outside': day.month !== 8,
          'calendar-day--today': day.month === 8 && day.date === 14,
        }"
        @dragover.prevent
        @drop="handleDrop($event, day.date, day.month)"
      >
        <header>
          <span>{{ day.date }}</span>
          <small v-if="day.month === 8 && day.date === 14">今天</small>
        </header>
        <div v-if="day.month === 8" class="calendar-day__events">
          <div
            v-for="task in getScheduledTasks(day.date)"
            :key="task.id"
            class="calendar-event"
            :class="`stage-${task.stage}`"
            draggable="true"
            role="button"
            tabindex="0"
            :aria-label="`打开内容档案：${getContentTitle(task.contentId)}`"
            @click="emit('viewContent', task.contentId)"
            @keydown.enter="emit('viewContent', task.contentId)"
            @keydown.space.prevent="emit('viewContent', task.contentId)"
            @dragstart="emit('dragTask', $event, task.id)"
          >
            <small>{{ STAGE_LABELS[task.stage] }}</small>
            <p>{{ getContentTitle(task.contentId) }}</p>
          </div>
          <div
            v-for="event in getFixedEvents(day.date)"
            :key="event.id"
            class="calendar-event"
            :class="`stage-${event.stage}`"
            draggable="true"
            @dragstart="emit('dragEvent', $event, event.id)"
          >
            <small>{{ event.label }}</small>
            <p>{{ event.title }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
