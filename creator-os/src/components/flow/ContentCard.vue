<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { Content } from '../../types'

defineProps<{
  content: Content
}>()

const emit = defineEmits<{
  view: [contentId: string]
  dragStart: [event: DragEvent, contentId: string]
  dropBefore: [event: DragEvent, contentId: string]
}>()

const roleLabels = {
  acquisition: '获客',
  trust: '信任',
  conversion: '转化',
}
</script>

<template>
  <article
    class="content-card"
    draggable="true"
    role="button"
    tabindex="0"
    :aria-label="`打开内容档案：${content.title}`"
    @click="emit('view', content.id)"
    @keydown.enter="emit('view', content.id)"
    @keydown.space.prevent="emit('view', content.id)"
    @dragstart="emit('dragStart', $event, content.id)"
    @dragover.prevent
    @drop.stop="emit('dropBefore', $event, content.id)"
  >
    <header>
      <span class="role-badge">{{ roleLabels[content.role] }}</span>
      <span class="tier-badge">{{ content.tier }}</span>
    </header>
    <h3>{{ content.title }}</h3>
    <p>{{ content.summary }}</p>
    <footer>
      <span>{{ content.updatedAt.slice(5).replace('-', '月') }}日</span>
      <button type="button" @click.stop="emit('view', content.id)">
        查看档案
        <Icon icon="ph:arrow-right" width="15" />
      </button>
    </footer>
  </article>
</template>
