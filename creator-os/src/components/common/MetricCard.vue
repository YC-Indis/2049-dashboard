<script setup lang="ts">
defineProps<{
  value: string | number
  label: string
  detail?: string
  tone?: 'coral' | 'purple' | 'green' | 'blue'
}>()
</script>

<template>
  <article class="metric-card" :class="`metric-card--${tone ?? 'coral'}`">
    <span class="metric-card__accent" />
    <strong>{{ value }}</strong>
    <p>{{ label }}</p>
    <small v-if="detail">{{ detail }}</small>
  </article>
</template>
