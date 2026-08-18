<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { creatorStore } from '../../stores/creatorStore'
import { uiStore } from '../../stores/uiStore'
import type { ContentRole } from '../../types'

const title = ref('')
const role = ref<ContentRole>('acquisition')

function handleSubmit() {
  if (!title.value.trim()) {
    return
  }
  creatorStore.createContent({
    title: title.value,
    role: role.value,
    tier: 'B',
    type: '快速灵感',
    priority: 'normal',
    rawIdea: title.value,
  })
  title.value = ''
  uiStore.showToast('灵感已进入选题池')
}
</script>

<template>
  <form class="quick-capture" @submit.prevent="handleSubmit">
    <span class="quick-capture__icon">
      <Icon icon="ph:sparkle" width="20" />
    </span>
    <input
      v-model="title"
      type="text"
      aria-label="快速记录灵感"
      placeholder="刚想到什么？输入一句话，直接放进选题池……"
    />
    <select v-model="role" aria-label="内容角色">
      <option value="acquisition">获客</option>
      <option value="trust">信任</option>
      <option value="conversion">转化</option>
    </select>
    <button type="submit">捕捉灵感</button>
  </form>
</template>
