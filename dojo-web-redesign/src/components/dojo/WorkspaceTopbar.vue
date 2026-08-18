<script setup lang="ts">
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRoute, useRouter } from 'vue-router'

  defineEmits<{
    toggleMenu: []
  }>()

  const route = useRoute()
  const router = useRouter()

  const routeTitles: Array<[string, string]> = [
    ['/today', '时间规划'],
    ['/project', '项目管理'],
    ['/timeline', '项目排期'],
    ['/calendar', '执行日历'],
    ['/inspiration-collection', '灵感采集'],
    ['/inspiration', '灵感库'],
    ['/benchmark-library', '对标库'],
    ['/creator', '内容工作流'],
    ['/operations', '运营驾驶舱'],
    ['/account-matrix', '账号矩阵'],
    ['/ad-videos', '视频监控'],
    ['/ad-video', '视频分析'],
    ['/worklog', '工作复盘']
  ]

  const title = computed(
    () => routeTitles.find(([path]) => route.path.startsWith(path))?.[1] || '2049'
  )

  const today = computed(() =>
    new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    }).format(new Date())
  )

  function openQuickCapture() {
    router.push({ path: '/today', query: { new: '1' } })
  }

  function openAiControl() {
    window.dispatchEvent(new CustomEvent('dojo-agent-open'))
  }
</script>

<template>
  <header class="workspace-topbar">
    <div class="workspace-topbar__left">
      <button
        type="button"
        class="workspace-topbar__menu"
        aria-label="打开导航"
        @click="$emit('toggleMenu')"
      >
        <Icon icon="ph:list" width="21" />
      </button>
      <span class="workspace-topbar__title">{{ title }}</span>
      <span class="workspace-topbar__date">{{ today }}</span>
    </div>
    <div class="workspace-topbar__right">
      <button type="button" class="workspace-topbar__ai" @click="openAiControl">
        <Icon icon="ph:command-duotone" width="17" />
        <span><strong>AI 中控</strong><small>LOCAL READY</small></span>
      </button>
      <span class="workspace-topbar__local"> <i /> 本地数据在线 </span>
      <button type="button" class="workspace-topbar__capture" @click="openQuickCapture">
        <Icon icon="ph:plus-bold" width="15" />
        新建内容
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
  .workspace-topbar {
    z-index: 40;
    display: flex;
    flex: 0 0 auto;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    min-height: var(--warm-topbar-height, 88px);
    padding: 0 max(48px, env(safe-area-inset-right)) 0 max(48px, env(safe-area-inset-left));
    background: color-mix(in srgb, var(--dojo-paper) 88%, transparent);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--dojo-line-soft);

    &__left,
    &__right {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    &__title {
      font-family: var(--dojo-serif);
      font-size: 20px;
      font-weight: 600;
      color: var(--dojo-ink);
    }

    &__date {
      font-family: Georgia, 'Noto Serif SC', serif;
      font-size: 13px;
      color: var(--dojo-muted);
    }

    &__menu {
      display: none;
    }

    &__local {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      font-size: 12px;
      color: var(--dojo-muted);

      i {
        width: 6px;
        height: 6px;
        background: var(--dojo-green);
        border-radius: 50%;
      }
    }

    &__ai {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      min-height: 42px;
      padding: 0 14px;
      color: #fffdfc;
      cursor: pointer;
      background: #403666;
      border: 1px solid #403666;
      border-radius: 12px;

      > span {
        display: grid;
        gap: 1px;
        text-align: left;
      }

      strong {
        font-size: 12px;
        line-height: 1;
        color: #fffdfc;
      }

      small {
        font-size: 10px;
        font-weight: 700;
        color: rgb(255 253 252 / 68%);
        letter-spacing: 0.04em;
      }

      &:hover,
      &:focus-visible {
        background: #342e55;
        border-color: #342e55;
        outline: 0;
      }
    }

    &__capture {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      min-height: 42px;
      padding: 0 18px;
      font-size: 13px;
      font-weight: 650;
      color: #fffdfc;
      cursor: pointer;
      background: linear-gradient(135deg, #e8685e 0%, #c75f8c 52%, #7860cc 100%);
      border: 0;
      border-radius: 12px;
      box-shadow: 0 8px 18px rgb(55 42 62 / 10%);
      transition:
        filter 140ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 140ms cubic-bezier(0.22, 1, 0.36, 1);

      &:hover,
      &:focus-visible {
        filter: brightness(0.96);
        outline: 0;
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  @media (width <= 1279px) {
    .workspace-topbar {
      padding: 0 max(16px, env(safe-area-inset-right)) 0 max(24px, env(safe-area-inset-left));
    }
  }

  @media (width <= 1100px) {
    .workspace-topbar__local {
      display: none;
    }

    .workspace-topbar__ai small {
      display: none;
    }
  }

  @media (width <= 980px) {
    .workspace-topbar__date {
      display: none;
    }
  }

  @media (width <= 800px) {
    .workspace-topbar {
      min-height: 64px;
      padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));

      &__menu {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        color: var(--dojo-ink);
        background: var(--dojo-paper);
        border: 1px solid var(--dojo-line);
        border-radius: 12px;
      }

      &__title {
        font-size: 16px;
      }
    }
  }

  @media (width <= 640px) {
    .workspace-topbar__ai span {
      display: none;
    }

    .workspace-topbar__capture {
      justify-content: center;
      width: 40px;
      padding: 0;
      font-size: 0;
    }
  }
</style>
