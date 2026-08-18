<script setup lang="ts">
defineProps<{
  value: number
}>()
</script>

<template>
  <div
    class="progress-bar"
    role="progressbar"
    :aria-valuenow="value"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <span :style="{ width: `${value}%` }" />
  </div>
</template>
