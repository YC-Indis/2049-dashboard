<script setup lang="ts">
import type { Content, ContentStage } from '../../types'
import ContentCard from './ContentCard.vue'

const props = defineProps<{
  stage: ContentStage
  label: string
  color: string
  items: Content[]
}>()

const emit = defineEmits<{
  move: [contentId: string, targetStage: ContentStage, beforeContentId?: string]
  view: [contentId: string]
  dragStart: [event: DragEvent, contentId: string]
}>()

function getDraggedContentId(event: DragEvent) {
  return event.dataTransfer?.getData('application/x-creator-content') || ''
}

function handleDrop(event: DragEvent) {
  const contentId = getDraggedContentId(event)
  if (contentId) {
    emit('move', contentId, props.stage)
  }
}

function handleDropBefore(event: DragEvent, beforeContentId: string) {
  const contentId = getDraggedContentId(event)
  if (contentId && contentId !== beforeContentId) {
    emit('move', contentId, props.stage, beforeContentId)
  }
}
</script>

<template>
  <section class="kanban-column" @dragover.prevent @drop="handleDrop">
    <header class="kanban-column__header">
      <span class="kanban-column__count">{{ items.length }}</span>
      <span class="kanban-column__dot" :style="{ backgroundColor: color }" />
      <h2>{{ label }}</h2>
      <button type="button" aria-label="列选项">•••</button>
    </header>
    <div class="kanban-column__body">
      <ContentCard
        v-for="content in items"
        :key="content.id"
        :content="content"
        @view="emit('view', $event)"
        @drag-start="emit('dragStart', $event, content.id)"
        @drop-before="handleDropBefore"
      />
      <div v-if="items.length === 0" class="kanban-empty">
        <p>还没有内容停在这里</p>
      </div>
    </div>
  </section>
</template>
