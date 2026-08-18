<!--
  THESIS: A warm editorial workbench: paper canvas beside a plum console, coral for human next actions, purple for AI transformation.
  OWN-WORLD: Warm paper #f5f0ee, plum sidebar #211d39, coral #e8685e, Noto Serif SC for page direction, MiSans for operations.
  STORY: Operators scan candidates, promote inspiration, write scripts, and schedule work without leaving this desk.
  FIRST VIEWPORT: 240px plum nav, then the task-owned work surface without a global topbar.
  FORM: User-pinned executable-inspiration-warm-v1, warm editorial workbench.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
<template>
  <div class="app-layout">
    <WorkspaceSidebar :open="mobileMenuOpen" @close="mobileMenuOpen = false" />

    <main id="app-main">
      <button
        type="button"
        class="workspace-mobile-menu"
        aria-label="打开导航"
        @click="mobileMenuOpen = true"
      >
        <Icon icon="ph:list" width="20" />
      </button>
      <div id="app-content">
        <ArtPageContent />
      </div>
    </main>

    <div id="app-global">
      <ArtGlobalComponent />
      <DojoFloatingAgent />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import DojoFloatingAgent from '@/components/dojo/DojoFloatingAgent.vue'
  import WorkspaceSidebar from '@/components/dojo/WorkspaceSidebar.vue'
  import { startAccountAutoSync, stopAccountAutoSync } from '@/store/dojoAccountAutoSync'

  defineOptions({ name: 'AppLayout' })

  const mobileMenuOpen = ref(false)

  onMounted(startAccountAutoSync)
  onBeforeUnmount(stopAccountAutoSync)
</script>

<style lang="scss" scoped>
  @use './style';
</style>
