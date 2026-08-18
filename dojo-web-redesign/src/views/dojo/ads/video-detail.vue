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
        <ElButton
          v-if="video.videoUrl"
          tag="a"
          :href="video.videoUrl"
          target="_blank"
          rel="noreferrer"
        >
          打开 TikTok
        </ElButton>
        <ElButton :loading="syncing" @click="refreshAccount">刷新账号数据</ElButton>
      </div>
    </header>

    <p v-if="!video" class="empty-state">未找到该视频，可能账号尚未同步。</p>

    <template v-else>
      <section class="analysis-layout">
        <VideoPreviewPanel
          class="analysis-player"
          :title="video.description || video.videoId"
          :url="video.videoUrl"
          :poster="video.cover"
          player-only
        />

        <aside class="analysis-data">
          <section class="identity panel">
            <div>
              <h2>{{ video.description || video.videoId }}</h2>
              <p class="identity__meta">
                {{ video.accountNickname || video.accountHandle }}
                <template v-if="video.publishDate"> · {{ video.publishDate }}</template>
              </p>
            </div>
            <ElButton type="primary" @click="openVideoReview">记录到工作复盘</ElButton>
          </section>

          <section class="panel metric-panel">
            <h3 class="section-title">播放与互动</h3>
            <dl class="metric-grid">
              <div v-for="metric in allMetrics" :key="metric.label">
                <dt>{{ metric.label }}</dt>
                <dd>{{ metric.value }}</dd>
              </div>
            </dl>
          </section>

          <section class="panel account-panel">
            <div>
              <h3 class="section-title">所属账号</h3>
              <p class="muted section-desc">{{ video.accountHandle }}</p>
            </div>
            <ElButton link type="primary" @click="goAccount">查看账号分析 →</ElButton>
            <ElButton link type="primary" @click="router.push('/worklog')">查看工作复盘 →</ElButton>
          </section>
        </aside>
      </section>
    </template>

    <ElDialog v-model="reviewDialogOpen" title="记录视频复盘" width="min(620px, calc(100vw - 32px))">
      <div v-if="video" class="review-context">
        <strong>{{ video.description || video.videoId }}</strong>
        <span>{{ video.accountNickname || video.accountHandle }} · 播放 {{ num(video.views) }}</span>
      </div>
      <ElForm label-position="top">
        <ElFormItem label="判断">
          <ElRadioGroup v-model="reviewForm.verdict">
            <ElRadio label="好">好</ElRadio>
            <ElRadio label="不好">不好</ElRadio>
            <ElRadio label="待验证">待验证</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="为什么" required>
          <ElInput
            v-model="reviewForm.note"
            type="textarea"
            :rows="6"
            placeholder="记录为什么好 / 不好：开头、画面、节奏、产品露出、评论反馈或投放表现"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="reviewDialogOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveVideoReview">保存到工作复盘</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import VideoPreviewPanel from '@/components/dojo/VideoPreviewPanel.vue'
  import { findAdMonitorVideo } from '@/store/dojoAdMonitorStore'
  import { addManualEvent } from '@/store/dojoWorklogStore'
  import { syncAccounts } from '@/store/dojoAccountStore'
  import { stripHandle } from '@/api/tiktok'

  defineOptions({ name: 'DojoAdVideoDetail' })

  const route = useRoute()
  const router = useRouter()
  const syncing = ref(false)
  const reviewDialogOpen = ref(false)
  const reviewForm = ref({ verdict: '待验证', note: '' })

  const video = computed(() => findAdMonitorVideo(String(route.params.videoId)))

  const totalEngagement = computed(
    () => (video.value?.likes || 0) + (video.value?.comments || 0) + (video.value?.shares || 0)
  )

  const engagementRate = computed(() => {
    if (!video.value?.views) return '—'
    const rate = video.value.engagementRate || totalEngagement.value / video.value.views
    return `${(rate * 100).toFixed(2)}%`
  })
  const previewMetrics = computed(() => {
    if (!video.value) return []
    return [
      { label: '播放', value: num(video.value.views) },
      { label: '点赞', value: num(video.value.likes) },
      { label: '评论', value: num(video.value.comments) },
      { label: '转发', value: num(video.value.shares) }
    ]
  })
  const allMetrics = computed(() => [
    ...previewMetrics.value,
    { label: '互动率', value: engagementRate.value },
    { label: '互动量合计', value: num(totalEngagement.value) }
  ])

  function num(n: number) {
    return n.toLocaleString('en-US')
  }

  function goAccount() {
    if (!video.value) return
    router.push(`/account-detail/${encodeURIComponent(stripHandle(video.value.accountHandle))}`)
  }

  function openVideoReview() {
    reviewForm.value = { verdict: '待验证', note: '' }
    reviewDialogOpen.value = true
  }

  function saveVideoReview() {
    if (!video.value) return
    const note = reviewForm.value.note.trim()
    if (!note) {
      ElMessage.warning('请记录为什么好或不好')
      return
    }
    addManualEvent({
      title: `视频复盘：${video.value.description || video.value.videoId}`,
      detail: [
        `判断：${reviewForm.value.verdict}`,
        note,
        `播放 ${num(video.value.views)} · 点赞 ${num(video.value.likes)} · 评论 ${num(video.value.comments)} · 转发 ${num(video.value.shares)}`,
        video.value.videoUrl ? `来源：${video.value.videoUrl}` : ''
      ]
        .filter(Boolean)
        .join('\n'),
      projectId: video.value.projectId || undefined,
      handle: video.value.accountHandle
    })
    reviewDialogOpen.value = false
    ElMessage.success('已记录到工作复盘')
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
  @use '../dojo-page';

  .back {
    padding-left: 0;
    margin-bottom: 8px;
  }

  .empty-state {
    padding: 48px 16px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .review-context {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    margin-bottom: 16px;
    background: var(--dojo-paper-muted);
    border: 1px solid #cbdaf8;
    border-radius: 9px;

    strong {
      font-size: 14px;
    }

    span {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .analysis-layout {
    display: grid;
    grid-template-columns: minmax(360px, 460px) minmax(0, 1fr);
    gap: 22px;
    align-items: stretch;
    max-width: 1380px;
    min-height: 720px;
    margin: 0 auto;
  }

  .analysis-player {
    position: sticky;
    top: 20px;
    height: max-content;
  }

  .analysis-data {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .identity {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    h2 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 650;
      line-height: 1.35;
    }

    &__meta {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }

    &__link {
      font-size: 13px;
      color: var(--el-color-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;

    > div {
      padding: 13px;
      background: var(--dojo-paper-muted);
      border-radius: 9px;
    }

    dt {
      font-size: 10px;
      color: var(--dojo-muted);
    }

    dd {
      margin: 5px 0 0;
      font-size: 18px;
      font-weight: 680;
      font-variant-numeric: tabular-nums;
    }
  }

  .account-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  @media (width <= 980px) {
    .analysis-layout {
      grid-template-columns: 1fr;
    }

    .analysis-player {
      position: static;
    }
  }

  @media (width <= 560px) {
    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
