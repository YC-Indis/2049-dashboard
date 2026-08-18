<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'

defineEmits<{
  newContent: []
}>()
</script>

<template>
  <div class="app-shell">
    <Sidebar />
    <div class="main-shell">
      <Topbar @new-content="$emit('newContent')" />
      <main class="page-scroll">
        <slot />
      </main>
    </div>
  </div>
</template>
