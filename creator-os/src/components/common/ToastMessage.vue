<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { uiStore } from '../../stores/uiStore'
</script>

<template>
  <Transition name="toast-slide">
    <div v-if="uiStore.state.toast" class="toast-message" role="status">
      <span class="toast-message__icon">
        <Icon icon="ph:check" width="17" />
      </span>
      <span>{{ uiStore.state.toast.message }}</span>
      <button
        v-if="uiStore.state.toast.action"
        type="button"
        @click="uiStore.runToastAction"
      >
        {{ uiStore.state.toast.action }}
      </button>
      <button
        class="toast-message__close"
        type="button"
        aria-label="关闭提示"
        @click="uiStore.dismissToast"
      >
        <Icon icon="ph:x" width="15" />
      </button>
    </div>
  </Transition>
</template>
