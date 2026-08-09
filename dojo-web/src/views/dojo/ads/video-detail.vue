<template>
  <div class="dojo-page video-detail">
    <header class="dojo-page__head">
      <div>
        <ElButton link type="primary" class="back" @click="router.push('/ad-videos')">
          ← 返回视频列表
        </ElButton>
        <h1>视频分析</h1>
        <p>投放监控账号作品 · 播放量与互动指标</p>
      </div>
      <div v-if="video" class="head-ops">
        <ElButton v-if="video.videoUrl" tag="a" :href="video.videoUrl" target="_blank" rel="noreferrer">
          打开 TikTok
        </ElButton>
        <ElButton :loading="syncing" @click="refreshAccount">刷新账号数据</ElButton>
      </div>
    </header>

    <p v-if="!video" class="empty-state">未找到该视频，可能账号尚未同步。</p>

    <template v-else>
      <section class="identity panel">
        <div>
          <h2>{{ video.description || video.videoId }}</h2>
          <p class="identity__meta">
            {{ video.accountNickname || video.accountHandle }}
            <template v-if="video.publishDate"> · {{ video.publishDate }}</template>
          </p>
          <a
            v-if="video.videoUrl"
            class="identity__link"
            :href="video.videoUrl"
            target="_blank"
            rel="noreferrer"
          >
            打开视频链接
          </a>
        </div>
      </section>

      <h3 class="section-title">播放与互动</h3>
      <div class="stat-row">
        <div class="stat">
          <span class="stat__n">{{ num(video.views) }}</span>
          <span class="stat__l">播放量</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ num(video.likes) }}</span>
          <span class="stat__l">点赞量</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ num(video.comments) }}</span>
          <span class="stat__l">评论量</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ num(video.shares) }}</span>
          <span class="stat__l">转发量</span>
        </div>
      </div>

      <div class="stat-row stat-row--2">
        <div class="stat">
          <span class="stat__n">{{ engagementRate }}</span>
          <span class="stat__l">互动率</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ num(totalEngagement) }}</span>
          <span class="stat__l">互动量合计</span>
        </div>
      </div>

      <section class="panel">
        <h3 class="section-title">所属账号</h3>
        <p class="muted section-desc">
          {{ video.accountHandle }}
          <ElButton link type="primary" @click="goAccount">查看账号分析 →</ElButton>
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { findAdMonitorVideo } from '@/store/dojoAdMonitorStore'
  import { syncAccounts } from '@/store/dojoAccountStore'
  import { stripHandle } from '@/api/tiktok'

  defineOptions({ name: 'DojoAdVideoDetail' })

  const route = useRoute()
  const router = useRouter()
  const syncing = ref(false)

  const video = computed(() => findAdMonitorVideo(String(route.params.videoId)))

  const totalEngagement = computed(
    () => (video.value?.likes || 0) + (video.value?.comments || 0) + (video.value?.shares || 0)
  )

  const engagementRate = computed(() => {
    if (!video.value?.views) return '—'
    const rate = video.value.engagementRate || totalEngagement.value / video.value.views
    return `${(rate * 100).toFixed(2)}%`
  })

  function num(n: number) {
    return n.toLocaleString('en-US')
  }

  function goAccount() {
    if (!video.value) return
    router.push(`/accounts/detail/${encodeURIComponent(stripHandle(video.value.accountHandle))}`)
  }

  async function refreshAccount() {
    if (!video.value) return
    syncing.value = true
    try {
      await syncAccounts([video.value.accountHandle])
      ElMessage.success('已刷新账号与视频数据')
    } finally {
      syncing.value = false
    }
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .back {
    margin-bottom: 8px;
    padding-left: 0;
  }

  .empty-state {
    padding: 48px 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  .identity {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;
    align-items: flex-start;

    h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 650;
      line-height: 1.35;
    }

    &__meta {
      margin: 0 0 8px;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }

    &__link {
      color: var(--el-color-primary);
      font-size: 13px;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
  }

  .section-desc {
    margin: 0;
    font-size: 14px;
  }

  .muted {
    color: var(--el-text-color-secondary);
  }

  .stat-row--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 480px;
  }
</style>
