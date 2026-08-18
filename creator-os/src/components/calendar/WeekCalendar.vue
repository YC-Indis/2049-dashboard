<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { creatorStore } from '../../stores/creatorStore'
import { STAGE_LABELS } from '../../constants/stages'

const emit = defineEmits<{
  newContent: []
  dragTask: [event: DragEvent, taskId: string]
  dragEvent: [event: DragEvent, eventId: string]
  viewContent: [contentId: string]
  schedule: [taskId: string, date: string]
  scheduleFixed: [kind: 'batch-review' | 'live', date: string]
  rescheduleEvent: [eventId: string, date: string]
}>()

const weekDays = [
  { weekday: 'MON', label: '周一', date: '2026-08-10', day: 10 },
  { weekday: 'TUE', label: '周二', date: '2026-08-11', day: 11 },
  { weekday: 'WED', label: '周三', date: '2026-08-12', day: 12 },
  { weekday: 'THU', label: '周四', date: '2026-08-13', day: 13 },
  { weekday: 'FRI', label: '周五', date: '2026-08-14', day: 14 },
  { weekday: 'SAT', label: '周六', date: '2026-08-15', day: 15 },
  { weekday: 'SUN', label: '周日', date: '2026-08-16', day: 16 },
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

function handleDrop(event: DragEvent, date: string) {
  const taskId = event.dataTransfer?.getData('application/x-creator-task')
  if (taskId) {
    emit('schedule', taskId, date)
    return
  }
  const fixedKind = event.dataTransfer?.getData('application/x-creator-fixed')
  if (fixedKind === 'batch-review' || fixedKind === 'live') {
    emit('scheduleFixed', fixedKind, date)
    return
  }
  const eventId = event.dataTransfer?.getData('application/x-creator-event')
  if (eventId) {
    emit('rescheduleEvent', eventId, date)
  }
}
</script>

<template>
  <section class="month-calendar week-calendar">
    <header class="calendar-toolbar">
      <div class="calendar-toolbar__navigation">
        <button type="button" aria-label="上一周">
          <Icon icon="ph:caret-left" width="18" />
        </button>
        <button type="button">今</button>
        <button type="button" aria-label="下一周">
          <Icon icon="ph:caret-right" width="18" />
        </button>
      </div>
      <h2>8月10日 - 8月16日</h2>
      <button class="calendar-add" type="button" @click="emit('newContent')">
        <Icon icon="ph:plus" width="17" />
        新增内容
      </button>
    </header>

    <div class="week-calendar__grid">
      <article
        v-for="day in weekDays"
        :key="day.date"
        class="week-calendar__day"
        :class="{ 'week-calendar__day--today': day.day === 14 }"
        @dragover.prevent
        @drop="handleDrop($event, day.date)"
      >
        <header>
          <span>
            <small>{{ day.weekday }}</small>
            <b>{{ day.label }}</b>
          </span>
          <strong>{{ day.day }}</strong>
        </header>
        <div class="week-calendar__events">
          <div
            v-for="task in getTasks(day.date)"
            :key="task.id"
            class="calendar-event week-calendar__event"
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
            v-for="event in getEvents(day.date)"
            :key="event.id"
            class="calendar-event week-calendar__event"
            :class="`stage-${event.stage}`"
            draggable="true"
            @dragstart="emit('dragEvent', $event, event.id)"
          >
            <small>{{ event.label }}</small>
            <p>{{ event.title }}</p>
          </div>
          <p
            v-if="getTasks(day.date).length === 0 && getEvents(day.date).length === 0"
            class="week-calendar__empty"
          >
            暂无安排
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
