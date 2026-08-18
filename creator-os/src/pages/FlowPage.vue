<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PageHeader from '../components/common/PageHeader.vue'
import GradientButton from '../components/common/GradientButton.vue'
import KanbanColumn from '../components/flow/KanbanColumn.vue'
import { STAGE_CONFIG } from '../constants/stages'
import { creatorStore } from '../stores/creatorStore'
import { uiStore } from '../stores/uiStore'
import type { ContentStage } from '../types'

defineEmits<{
  newContent: []
}>()

const searchQuery = ref('')
const typeFilter = ref('全部类型')

const filteredContents = computed(() =>
  creatorStore.state.contents.filter((content) => {
    const matchesSearch =
      !searchQuery.value ||
      content.title.includes(searchQuery.value) ||
      content.tags.some((tag) => tag.includes(searchQuery.value))
    const matchesType = typeFilter.value === '全部类型' || content.type === typeFilter.value

    return matchesSearch && matchesType
  }),
)

function getStageContents(stage: (typeof STAGE_CONFIG)[number]['id']) {
  return filteredContents.value.filter((content) => content.currentStage === stage)
}

function handleDragStart(event: DragEvent, contentId: string) {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-creator-content', contentId)
  event.dataTransfer.setData('text/plain', contentId)
}

function handleMove(contentId: string, stage: ContentStage, beforeContentId?: string) {
  const previousStage = creatorStore.getContent(contentId)?.currentStage
  creatorStore.moveContentStage(contentId, stage, beforeContentId)
  if (previousStage !== stage) {
    const stageLabel = STAGE_CONFIG.find((item) => item.id === stage)?.label ?? ''
    uiStore.showToast(`内容已进入${stageLabel}阶段`)
  }
}
</script>

<template>
  <div class="page page--flow">
    <PageHeader
      eyebrow="CONTENT FLOW"
      title="看清每一条内容，正停在哪一步。"
      description="拖动卡片改变制作环节；打开内容档案，补充从选题到复盘的关键信息。"
    />

    <div class="flow-toolbar">
      <label class="search-input">
        <Icon icon="ph:magnifying-glass" width="19" />
        <input v-model="searchQuery" type="search" placeholder="搜索标题或标签……" />
      </label>
      <select v-model="typeFilter" aria-label="内容类型">
        <option>全部类型</option>
        <option>方法拆解</option>
        <option>观点表达</option>
        <option>案例复盘</option>
      </select>
      <span class="flow-toolbar__spacer" />
      <GradientButton @click="$emit('newContent')">
        <Icon icon="ph:plus" width="18" />
        新增内容
      </GradientButton>
    </div>

    <div class="kanban-board">
      <KanbanColumn
        v-for="stage in STAGE_CONFIG"
        :key="stage.id"
        :stage="stage.id"
        :label="stage.label"
        :color="stage.color"
        :items="getStageContents(stage.id)"
        @view="uiStore.openContentDrawer"
        @drag-start="handleDragStart"
        @move="handleMove"
      />
    </div>
  </div>
</template>
