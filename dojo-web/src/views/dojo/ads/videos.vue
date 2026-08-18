<template>
  <div class="dojo-page ad-videos">
    <header class="dojo-page__head">
      <div>
        <h1>投放视频监控</h1>
        <p>汇总全部投放视频 · 列表 / 卡片切换，点进查看播放与互动</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" :sync-store="false" width="240px" />
        <ElRadioGroup v-model="viewMode" size="default">
          <ElRadioButton value="list">列表</ElRadioButton>
          <ElRadioButton value="card">卡片</ElRadioButton>
        </ElRadioGroup>
        <ElButton :loading="syncing" @click="syncAll">同步播放量</ElButton>
        <ElButton @click="exportRows">导出</ElButton>
      </div>
    </header>

    <p v-if="!filteredVideos.length && !dojoAccountStore.accounts.length" class="demo-hint">
      暂无投放视频，请先在投放账号监控中添加账号并同步。
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n accent">{{ filteredVideos.length }}</span>
        <span class="stat__l">投放视频</span>
      </div>
      <div class="stat">
        <span class="stat__n accent">{{ formatCompact(totalViews) }}</span>
        <span class="stat__l">播放量合计</span>
      </div>
      <div class="stat">
        <span class="stat__n accent">{{ formatCompact(totalLikes) }}</span>
        <span class="stat__l">点赞合计</span>
      </div>
      <div class="stat">
        <span class="stat__n accent">{{ formatCompact(totalEngagement) }}</span>
        <span class="stat__l">互动量合计</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索账号 / 视频描述 / 链接"
          style="width: 260px"
        />
        <ElSelect v-model="sortBy" style="width: 160px">
          <ElOption label="按播放量高→低" value="views-desc" />
          <ElOption label="按播放量低→高" value="views-asc" />
          <ElOption label="按日期新→旧" value="date-desc" />
          <ElOption label="按日期旧→新" value="date-asc" />
        </ElSelect>
        <span class="muted">共 {{ filteredVideos.length }} 条视频</span>
      </div>

      <p v-if="!filteredVideos.length" class="empty-hint">
        {{ dojoAccountStore.accounts.length ? '暂无投放视频，请先同步投放账号' : '暂无投放账号' }}
      </p>

      <ElTable v-if="viewMode === 'list'" :data="displayVideos" stripe row-key="videoId">
        <ElTableColumn label="发布日期" width="120" prop="publishDate" />
        <ElTableColumn label="所属账号" min-width="140">
          <template #default="{ row }">
            <strong>{{ row.accountNickname || row.accountHandle }}</strong>
            <div class="muted">{{ row.accountHandle }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="内容" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || row.videoId }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="播放量" width="110" align="right">
          <template #default="{ row }">{{ num(row.views) }}</template>
        </ElTableColumn>
        <ElTableColumn label="点赞" width="90" align="right">
          <template #default="{ row }">{{ num(row.likes) }}</template>
        </ElTableColumn>
        <ElTableColumn label="评论" width="90" align="right">
          <template #default="{ row }">{{ num(row.comments) }}</template>
        </ElTableColumn>
        <ElTableColumn label="转发" width="90" align="right">
          <template #default="{ row }">{{ num(row.shares) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click.stop="goDetail(row)">查看数据与视频</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-else class="video-grid">
        <article v-for="row in displayVideos" :key="row.videoId" class="vid-card">
          <div class="vid-card__cover">
            <img v-if="row.cover" :src="row.cover" alt="" loading="lazy" />
            <div v-else class="vid-card__placeholder">
              <span>▶</span>
            </div>
          </div>
          <div class="vid-card__body">
            <p class="vid-card__account">{{ row.accountNickname || row.accountHandle }}</p>
            <h3>{{ row.description || row.videoId }}</h3>
            <p class="vid-card__date muted">{{ row.publishDate || '—' }}</p>
            <dl class="vid-card__kv">
              <div>
                <dt>播放</dt>
                <dd>{{ num(row.views) }}</dd>
              </div>
              <div>
                <dt>点赞</dt>
                <dd>{{ num(row.likes) }}</dd>
              </div>
              <div>
                <dt>评论</dt>
                <dd>{{ num(row.comments) }}</dd>
              </div>
              <div>
                <dt>转发</dt>
                <dd>{{ num(row.shares) }}</dd>
              </div>
            </dl>
            <button class="vid-card__preview" type="button" @click="goDetail(row)">
              <Icon icon="ph:play-circle" width="16" />
              查看数据与视频
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { adMonitorVideos, type AdMonitorVideo } from '@/store/dojoAdMonitorStore'
  import { dojoAccountStore, syncAccounts } from '@/store/dojoAccountStore'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import { exportCsv } from '@/utils/dojoExport'

  defineOptions({ name: 'DojoAdVideos' })

  const router = useRouter()
  const viewMode = ref<'list' | 'card'>('card')
  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const keyword = ref('')
  const sortBy = ref<'views-desc' | 'views-asc' | 'date-desc' | 'date-asc'>('views-desc')
  const syncing = ref(false)

  const filteredVideos = computed(() => {
    const ids = selectedProjectIds.value
    const activeProjectIds = new Set(
      dojoProjectStore.projects
        .filter((project) => project.active !== false)
        .map((project) => project.id)
    )
    const q = keyword.value.trim().toLowerCase()
    return adMonitorVideos.value.filter((v) => {
      if (v.projectId && !activeProjectIds.has(v.projectId)) return false
      if (ids.length && v.projectId && !ids.includes(v.projectId)) return false
      if (ids.length && !v.projectId) return false
      if (!q) return true
      return (
        v.accountHandle.toLowerCase().includes(q) ||
        (v.accountNickname || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q) ||
        v.videoUrl.toLowerCase().includes(q)
      )
    })
  })

  const displayVideos = computed(() => {
    const list = [...filteredVideos.value]
    list.sort((a, b) => {
      if (sortBy.value === 'views-desc') return b.views - a.views
      if (sortBy.value === 'views-asc') return a.views - b.views
      if (sortBy.value === 'date-asc')
        return (a.publishDate || '').localeCompare(b.publishDate || '')
      return (b.publishDate || '').localeCompare(a.publishDate || '')
    })
    return list
  })

  const totalViews = computed(() => filteredVideos.value.reduce((n, v) => n + v.views, 0))
  const totalLikes = computed(() => filteredVideos.value.reduce((n, v) => n + v.likes, 0))
  const totalEngagement = computed(() =>
    filteredVideos.value.reduce((n, v) => n + v.likes + v.comments + v.shares, 0)
  )

  function num(n: number) {
    return n.toLocaleString('en-US')
  }

  function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  function goDetail(row: AdMonitorVideo) {
    router.push(`/ad-video/${encodeURIComponent(row.videoId)}`)
  }

  async function syncAll() {
    const handles = dojoAccountStore.accounts.map((a) => a.handle)
    if (!handles.length) {
      ElMessage.info('请先在投放账号监控中添加账号')
      return
    }
    syncing.value = true
    try {
      await syncAccounts(handles)
      ElMessage.success(`已同步 ${handles.length} 个账号的作品与指标`)
    } finally {
      syncing.value = false
    }
  }

  function exportRows() {
    exportCsv(
      '投放视频监控',
      ['发布日期', '所属账号', '视频链接', '播放量', '点赞', '评论', '转发', '互动率'],
      filteredVideos.value.map((v) => [
        v.publishDate,
        v.accountHandle,
        v.videoUrl,
        v.views,
        v.likes,
        v.comments,
        v.shares,
        v.engagementRate
      ])
    )
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page';

  .accent {
    color: var(--el-color-primary);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }

  .muted {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .empty-hint {
    padding: 32px 16px;
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  .vid-card {
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 4px 16px rgb(0 0 0 / 4%);
    }

    &.is-active {
      border-color: var(--dojo-accent-soft);
      box-shadow: 0 0 0 2px rgb(47 111 237 / 10%);
    }

    &__cover {
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: var(--el-fill-color-light);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    &__placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 18px;
      color: var(--el-text-color-secondary);
    }

    &__body {
      padding: 12px 14px 14px;
    }

    &__account {
      margin: 0 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-color-primary);
    }

    h3 {
      display: -webkit-box;
      margin: 0 0 6px;
      overflow: hidden;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    &__date {
      margin: 0 0 10px;
      font-size: 12px;
    }

    &__kv {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin: 0;

      dt {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 600;
      }
    }
  }

  .vid-card__preview {
    display: flex;
    gap: 7px;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 34px;
    margin-top: 12px;
    font-size: 10px;
    font-weight: 700;
    color: var(--dojo-accent);
    cursor: pointer;
    background: #e8f0fb;
    border: 0;
    border-radius: 8px;
  }

  .vid-card__preview:hover,
  .vid-card__preview:focus-visible {
    background: #dfeafb;
    outline: none;
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }
</style>
