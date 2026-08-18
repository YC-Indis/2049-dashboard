<script setup lang="ts">
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRoute, useRouter } from 'vue-router'

  const route = useRoute()
  const router = useRouter()

  const items = [
    { path: '/creator/today', label: '创作中枢', icon: 'ph:sparkle' },
    { path: '/calendar', label: '执行日历', icon: 'ph:calendar-dots' },
    { path: '/today', label: '今日时间线', icon: 'ph:path' },
    { path: '/creator/review', label: '复盘实验室', icon: 'ph:flask' }
  ]

  const activePath = computed(() => route.path)

  function navigate(path: string) {
    if (path !== activePath.value) router.push(path)
  }
</script>

<template>
  <nav class="creator-nav" aria-label="内容工作流视图">
    <div class="creator-nav__links">
      <button
        v-for="item in items"
        :key="item.path"
        type="button"
        :class="{ 'is-active': activePath === item.path }"
        @click="navigate(item.path)"
      >
        <Icon :icon="item.icon" width="17" />
        {{ item.label }}
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
  .creator-nav {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 46px;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--dojo-line);
  }

  .creator-nav__links {
    display: flex;
    flex: 1;
    align-self: stretch;
    gap: 20px;
    min-width: 0;
  }

  .creator-nav__links button {
    display: inline-flex;
    min-height: 45px;
    align-items: center;
    gap: 7px;
    padding: 0;
    border: 0;
    border-radius: 0;
    color: var(--dojo-muted);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    transition: color 160ms ease;

    &:hover,
    &:focus-visible,
    &.is-active {
      color: var(--dojo-ink);
      outline: none;
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--dojo-accent-soft);
    }

    &.is-active {
      position: relative;

      &::after {
        position: absolute;
        right: 0;
        bottom: -1px;
        left: 0;
        height: 2px;
        background: var(--dojo-accent);
        border-radius: 2px 2px 0 0;
        content: '';
      }
    }
  }

  @media (max-width: 900px) {
    .creator-nav {
      gap: 8px;
      overflow-x: auto;
    }

    .creator-nav__links {
      flex: 0 0 auto;
      overflow-x: auto;
    }
  }
</style>
