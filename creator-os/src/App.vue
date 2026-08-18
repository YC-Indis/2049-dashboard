<script setup lang="ts">
import AppShell from './components/layout/AppShell.vue'
import NewContentModal from './components/content/NewContentModal.vue'
import ContentDrawer from './components/content/ContentDrawer.vue'
import ToastMessage from './components/common/ToastMessage.vue'
import { creatorStore } from './stores/creatorStore'
import { uiStore } from './stores/uiStore'
import type { NewContentPayload } from './types'

function openNewContentModal() {
  uiStore.openNewContentModal()
}

function handleCreateContent(payload: NewContentPayload) {
  const content = creatorStore.createContent(payload)
  uiStore.closeNewContentModal()
  uiStore.openContentDrawer(content.id)
  uiStore.showToast('内容已进入选题池')
}
</script>

<template>
  <AppShell @new-content="openNewContentModal">
    <RouterView @new-content="openNewContentModal" />
  </AppShell>

  <NewContentModal
    :open="uiStore.state.newContentModalOpen"
    @close="uiStore.closeNewContentModal"
    @submit="handleCreateContent"
  />
  <ContentDrawer />
  <ToastMessage />
</template>
