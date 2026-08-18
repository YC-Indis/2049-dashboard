<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ROUTE_META } from '../../constants/navigation'
import GradientButton from '../common/GradientButton.vue'

defineEmits<{
  newContent: []
}>()

const route = useRoute()
const currentMeta = computed(() => ROUTE_META[route.path] ?? ROUTE_META['/today'])
</script>

<template>
  <header class="topbar">
    <div class="topbar__context">
      <small>{{ currentMeta.eyebrow }}</small>
      <strong>{{ currentMeta.title }}</strong>
    </div>

    <div class="topbar__actions">
      <button class="topbar-link" type="button">
        <Icon icon="ph:question" width="18" />
        使用指南
      </button>
      <button class="topbar-link" type="button">
        <kbd>⌘</kbd>
        快速操作
      </button>
      <GradientButton @click="$emit('newContent')">
        <Icon icon="ph:plus" width="18" />
        新增内容
      </GradientButton>
      <div class="mascot" aria-label="Creator OS 吉祥物">
        <span class="mascot__ear mascot__ear--left" />
        <span class="mascot__ear mascot__ear--right" />
        <span class="mascot__face">x</span>
      </div>
    </div>
  </header>
</template>
