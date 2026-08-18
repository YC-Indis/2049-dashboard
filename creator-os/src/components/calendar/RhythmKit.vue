<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { creatorStore } from '../../stores/creatorStore'
import { STAGE_LABELS } from '../../constants/stages'

const emit = defineEmits<{
  dragTask: [event: DragEvent, taskId: string]
  dragFixed: [event: DragEvent, kind: 'batch-review' | 'live']
  unschedule: [taskId: string]
  viewContent: [contentId: string]
  quickScheduleFixed: [kind: 'batch-review' | 'live']
}>()

const fixedTasks = [
  {
    id: 'batch-review' as const,
    title: '批量复盘',
    detail: '集中处理到期内容',
    icon: 'ph:stack',
  },
  {
    id: 'live' as const,
    title: '直播安排',
    detail: '补充主题、平台和时间',
    icon: 'ph:broadcast',
  },
]

function getContentTitle(contentId: string) {
  return creatorStore.getContent(contentId)?.title ?? '未命名内容'
}

function handleDrop(event: DragEvent) {
  const taskId = event.dataTransfer?.getData('application/x-creator-task')
  if (taskId) {
    emit('unschedule', taskId)
  }
}
</script>

<template>
  <aside class="rhythm-kit" @dragover.prevent @drop="handleDrop">
    <header class="rhythm-kit__header">
      <p class="eyebrow">RHYTHM KIT</p>
      <h2>可安排事项</h2>
      <p>固定动作可以重复安排；已安排的阶段会显示对应日期。</p>
    </header>

    <div class="rhythm-kit__scroll">
      <section class="rhythm-kit__section">
        <h3>固定动作</h3>
        <article
          v-for="task in fixedTasks"
          :key="task.title"
          class="fixed-task"
          draggable="true"
          @dragstart="emit('dragFixed', $event, task.id)"
        >
          <span class="fixed-task__icon">
            <Icon :icon="task.icon" width="20" />
          </span>
          <span class="fixed-task__copy">
            <strong>{{ task.title }}</strong>
            <small>{{ task.detail }}</small>
          </span>
          <button
            type="button"
            @click.stop="emit('quickScheduleFixed', task.id)"
          >
            安排到今天
          </button>
        </article>
      </section>

      <section class="rhythm-kit__section">
        <h3>制作环节</h3>
        <article
          v-for="task in creatorStore.unscheduledTasks.value"
          :key="task.id"
          class="production-task"
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
          <span class="drag-handle">
            <Icon icon="ph:dots-six-vertical" width="18" />
          </span>
          <span>
            <small>{{ STAGE_LABELS[task.stage] }}</small>
            <strong>{{ getContentTitle(task.contentId) }}</strong>
          </span>
        </article>
        <div v-if="creatorStore.unscheduledTasks.value.length === 0" class="rhythm-empty">
          <Icon icon="ph:calendar-check" width="24" />
          <p>所有制作环节都已经排好</p>
        </div>
      </section>
    </div>
  </aside>
</template>
