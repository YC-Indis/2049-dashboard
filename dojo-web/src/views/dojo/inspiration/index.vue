<script setup lang="ts">
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRoute, useRouter } from 'vue-router'
  import InspirationBenchmarkAccounts from './components/InspirationBenchmarkAccounts.vue'
  import InspirationCollection from './components/InspirationCollection.vue'
  import InspirationLibrary from './components/InspirationLibrary.vue'

  defineOptions({ name: 'DojoInspiration' })

  type WorkspacePart = 'collection' | 'library' | 'benchmark'

  const route = useRoute()
  const router = useRouter()
  const activePart = computed<WorkspacePart>(() => {
    if (route.path === '/inspiration-collection') return 'collection'
    if (route.path === '/benchmark-library') return 'benchmark'
    return 'library'
  })
  const heading = computed(() => {
    if (activePart.value === 'collection') {
      return {
        title: '灵感采集',
        description: '中文词会转成英文再搜 TikTok。结果多了先滤广告，再留最符合的前十。'
      }
    }
    if (activePart.value === 'benchmark') {
      return {
        title: '对标库',
        description: '卡片管理对标账号，点进去再看作品。看中的视频加入灵感库。'
      }
    }
    return {
      title: '灵感库',
      description: '对照片子写口播和画面，用 AI 按文字改稿。标签不含项目品牌。'
    }
  })
</script>

<template>
  <main class="inspiration-workspace" :class="{ 'is-library': activePart === 'library' }">
    <header class="workspace-heading" :class="{ 'is-compact': activePart === 'library' }">
      <div class="workspace-heading__copy">
        <h1>
          <Icon
            class="workspace-heading__icon"
            :icon="
              activePart === 'collection'
                ? 'ph:magnifying-glass'
                : activePart === 'benchmark'
                  ? 'ph:users-three-duotone'
                  : 'ph:lightbulb-filament-duotone'
            "
            :width="activePart === 'library' ? 22 : 28"
          />
          {{ heading.title }}
        </h1>
        <p v-if="activePart !== 'library'">{{ heading.description }}</p>
      </div>
    </header>

    <div class="workspace-body" :class="`is-${activePart}`">
      <InspirationCollection
        v-if="activePart === 'collection'"
        @open-library="router.push('/inspiration')"
      />
      <InspirationLibrary
        v-else-if="activePart === 'library'"
        @open-benchmark="
          router.push({ path: '/benchmark-library', query: { account: $event } })
        "
      />
      <InspirationBenchmarkAccounts v-else layout="cards" />
    </div>
  </main>
</template>

<style scoped lang="scss">
  .inspiration-workspace {
    container-type: inline-size;
    container-name: workspace;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    min-height: 0;
    padding: 18px 20px 20px;
    overflow: hidden;
    color: var(--dojo-ink);
    background: var(--dojo-canvas);
  }

  .inspiration-workspace.is-library {
    padding: 12px 16px 14px;
  }

  .workspace-heading {
    flex: 0 0 auto;
    display: flex;
    gap: 28px;
    align-items: flex-start;
    justify-content: space-between;
    margin: 0 2px 22px;
  }

  .workspace-heading__copy {
    max-width: 780px;
  }

  .workspace-heading h1,
  .workspace-heading p {
    margin: 0;
  }

  .workspace-heading h1 {
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: 760px;
    font-family: var(--dojo-serif);
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 500;
    line-height: 1.22;
    text-wrap: balance;
    letter-spacing: -0.02em;
  }

  .workspace-heading__icon {
    flex: 0 0 auto;
    color: var(--dojo-accent);
  }

  .workspace-heading p {
    max-width: 68ch;
    margin-top: 8px;
    font-size: var(--dojo-fs-label);
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .workspace-heading.is-compact {
    margin: 0 2px 10px;
  }

  .workspace-heading.is-compact h1 {
    font-size: 22px;
    line-height: 1.2;
  }

  .workspace-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .workspace-body > * {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  @media (width <= 800px) {
    .inspiration-workspace {
      height: auto;
      min-height: 100%;
      overflow: auto;
      padding: 56px max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom))
        max(16px, env(safe-area-inset-left));
    }

    .workspace-heading {
      display: grid;
      gap: 14px;
      margin: 0 0 16px;
    }

    .workspace-body,
    .workspace-body > * {
      height: auto;
      min-height: 0;
      overflow: visible;
    }
  }
</style>
