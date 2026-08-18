<script setup lang="ts">
import PageHeader from '../components/common/PageHeader.vue'
import RhythmKit from '../components/calendar/RhythmKit.vue'
import MonthCalendar from '../components/calendar/MonthCalendar.vue'
import WeekCalendar from '../components/calendar/WeekCalendar.vue'
import { creatorStore } from '../stores/creatorStore'
import { uiStore } from '../stores/uiStore'

defineEmits<{
  newContent: []
}>()

function handleDragTask(event: DragEvent, taskId: string) {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-creator-task', taskId)
  event.dataTransfer.setData('text/plain', taskId)
}

function handleDragFixed(event: DragEvent, kind: 'batch-review' | 'live') {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-creator-fixed', kind)
}

function handleDragEvent(event: DragEvent, eventId: string) {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-creator-event', eventId)
}

function formatDate(date: string) {
  const day = Number(date.slice(-2))
  return `8月${day}日`
}

function handleSchedule(taskId: string, date: string) {
  const task = creatorStore.state.stageTasks.find((entry) => entry.id === taskId)
  const previousDate = task?.plannedDate ?? null
  creatorStore.scheduleTask(taskId, date)
  uiStore.showToast(`已安排到 ${formatDate(date)}`, '撤销', () => {
    if (previousDate) {
      creatorStore.scheduleTask(taskId, previousDate)
    } else {
      creatorStore.unscheduleTask(taskId)
    }
  })
}

function handleUnschedule(taskId: string) {
  creatorStore.unscheduleTask(taskId)
  uiStore.showToast('任务已回到待安排池')
}

function handleScheduleFixed(kind: 'batch-review' | 'live', date: string) {
  creatorStore.scheduleFixedEvent(kind, date)
  uiStore.showToast(`${kind === 'batch-review' ? '批量复盘' : '直播安排'}已加入 ${formatDate(date)}`)
}

function handleRescheduleEvent(eventId: string, date: string) {
  const event = creatorStore.state.calendarEvents.find((entry) => entry.id === eventId)
  const previousDate = event?.date
  creatorStore.rescheduleCalendarEvent(eventId, date)
  uiStore.showToast(`已改期到 ${formatDate(date)}`, '撤销', () => {
    if (previousDate) {
      creatorStore.rescheduleCalendarEvent(eventId, previousDate)
    }
  })
}
</script>

<template>
  <div class="page page--calendar">
    <PageHeader
      eyebrow="CONTENT RHYTHM"
      title="把内容节奏，安排进真实的一周。"
      description="拖动大纲、脚本、录制、剪辑、发布，也能灵活加入批量复盘和直播安排。"
    >
      <template #actions>
        <div class="segmented-control" aria-label="日历视图">
          <button
            type="button"
            :class="{ 'is-active': uiStore.state.calendarView === 'week' }"
            @click="uiStore.setCalendarView('week')"
          >
            周
          </button>
          <button
            type="button"
            :class="{ 'is-active': uiStore.state.calendarView === 'month' }"
            @click="uiStore.setCalendarView('month')"
          >
            月
          </button>
        </div>
      </template>
    </PageHeader>

    <section class="calendar-workspace panel">
      <RhythmKit
        @drag-task="handleDragTask"
        @drag-fixed="handleDragFixed"
        @unschedule="handleUnschedule"
        @view-content="uiStore.openContentDrawer"
        @quick-schedule-fixed="handleScheduleFixed($event, '2026-08-14')"
      />
      <MonthCalendar
        v-if="uiStore.state.calendarView === 'month'"
        @new-content="$emit('newContent')"
        @drag-task="handleDragTask"
        @drag-event="handleDragEvent"
        @view-content="uiStore.openContentDrawer"
        @schedule="handleSchedule"
        @schedule-fixed="handleScheduleFixed"
        @reschedule-event="handleRescheduleEvent"
      />
      <WeekCalendar
        v-else
        @new-content="$emit('newContent')"
        @drag-task="handleDragTask"
        @drag-event="handleDragEvent"
        @view-content="uiStore.openContentDrawer"
        @schedule="handleSchedule"
        @schedule-fixed="handleScheduleFixed"
        @reschedule-event="handleRescheduleEvent"
      />
    </section>
  </div>
</template>
