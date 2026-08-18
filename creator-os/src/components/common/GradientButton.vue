<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
  }>(),
  {
    type: 'button',
  },
)
</script>

<template>
  <button class="gradient-button" :type="type">
    <slot />
  </button>
</template>
