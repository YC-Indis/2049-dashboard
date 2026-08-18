<template>
  <div class="dojo-page account-detail">
    <header class="dojo-page__head">
      <div>
        <ElButton link type="primary" class="back" @click="router.push('/account-matrix')">
          ← 返回账号池
        </ElButton>
        <h1>账号分析</h1>
        <p>查看单个账号的内容与指标，监看近期发布视频</p>
      </div>
      <div v-if="account" class="head-ops">
        <ElButton :loading="syncing" @click="refresh">刷新指标</ElButton>
        <ElButton @click="exportFans">导出账号信息</ElButton>
        <ElButton @click="exportVideos">导出发布视频</ElButton>
        <ElButton type="danger" plain @click="remove">删除</ElButton>
      </div>
    </header>

    <p v-if="!account" class="empty-state">未找到该账号，可能已被删除。</p>

    <template v-else>
      <section class="identity panel">
        <div>
          <h2>
            {{ account.nickname || account.handle }}
            <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          </h2>
          <p class="identity__meta">
            {{ account.handle }}
            <template v-if="account.region"> · {{ account.region }}</template>
            <template v-if="account.segment"> · {{ account.segment }}</template>
            <template v-if="account.projectId">
              · {{ projectName(account.projectId) }}
            </template>
          </p>
          <a
            v-if="homeLink"
            class="identity__link"
            :href="homeLink"
            target="_blank"
            rel="noreferrer"
          >
            打开主页
          </a>
        </div>
        <div class="identity__sync muted">
          {{
            account.lastSyncedAt
              ? `上次同步 ${new Date(account.lastSyncedAt).toLocaleString()}`
              : '尚未同步'
          }}
          <span v-if="account.syncError" class="danger"> · {{ account.syncError }}</span>
        </div>
      </section>

      <h3 class="section-title">基础表现</h3>
      <div class="stat-row">
        <div class="stat">
          <span class="stat__n">{{ num(account.followers) }}</span>
          <span class="stat__l">粉丝数</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ videos.length || account.totalVideos || 0 }}</span>
          <span class="stat__l">已发布视频</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ postFrequency }}</span>
          <span class="stat__l">发布频率</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ daysSinceLastPost }}</span>
          <span class="stat__l">距上次发布</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ num(avgViews) }}</span>
          <span class="stat__l">均播放</span>
        </div>
        <div class="stat">
          <span class="stat__n">{{ spreadScore }}</span>
          <span class="stat__l">传播潜力</span>
        </div>
      </div>

      <section class="panel">
        <h3 class="section-title">近期发布内容</h3>
        <p class="muted section-desc">账号内视频状况监看 · 共 {{ videos.length }} 条</p>
        <ElTable :data="videos" stripe empty-text="暂无视频，请先刷新指标">
          <ElTableColumn label="发布日期" width="120" prop="publishDate" />
          <ElTableColumn label="内容" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <a v-if="row.videoUrl" :href="row.videoUrl" target="_blank" rel="noreferrer">
                {{ row.description || row.videoId }}
              </a>
              <span v-else>{{ row.description || row.videoId }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="播放量" width="110" align="right">
            <template #default="{ row }">{{ row.views.toLocaleString() }}</template>
          </ElTableColumn>
          <ElTableColumn label="点赞量" width="100" align="right">
            <template #default="{ row }">{{ row.likes.toLocaleString() }}</template>
          </ElTableColumn>
          <ElTableColumn label="评论量" width="100" align="right">
            <template #default="{ row }">{{ row.comments.toLocaleString() }}</template>
          </ElTableColumn>
          <ElTableColumn label="转发量" width="100" align="right">
            <template #default="{ row }">{{ row.shares.toLocaleString() }}</template>
          </ElTableColumn>
        </ElTable>
      </section>

      <section class="panel wow-panel">
        <div class="wow-panel__head">
          <div>
            <h3 class="section-title">周环比透视</h3>
            <p class="muted section-desc">
              对比当前快照与约 7 天前（或上次刷新）的数据
              <template v-if="wowInterval">
                · 对比区间 {{ wowInterval }}
              </template>
            </p>
          </div>
          <ElButton type="primary" plain :loading="comparing" @click="refreshCompare">
            刷新对比
          </ElButton>
        </div>
        <ElTable :data="wowRows" stripe empty-text="暂无指标">
          <ElTableColumn prop="label" label="指标" min-width="120" />
          <ElTableColumn label="上周/上次" min-width="110" align="right">
            <template #default="{ row }">{{ row.prevText }}</template>
          </ElTableColumn>
          <ElTableColumn label="当前" min-width="110" align="right">
            <template #default="{ row }">{{ row.currText }}</template>
          </ElTableColumn>
          <ElTableColumn label="变化" min-width="100" align="right">
            <template #default="{ row }">
              <span :class="row.deltaClass">{{ row.deltaText }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
        <p class="wow-panel__foot muted">
          指标更新时间：{{ metricUpdatedAt }}
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    accountVideos,
    dojoAccountStore,
    findAccount,
    removeAccount,
    syncAccount
  } from '@/store/dojoAccountStore'
  import {
    dojoAccountWow,
    getWowBaseline,
    saveWowBaseline,
    type AccountWowMetrics
  } from '@/store/dojoAccountWow'
  import { getProjectById } from '@/store/dojoProjectStore'
  import { exportCsv } from '@/utils/dojoExport'
  import { stripHandle } from '@/api/tiktok'

  const DAY_MS = 24 * 3600 * 1000
  const WOW_BASELINE_TTL_MS = 7 * DAY_MS

  defineOptions({ name: 'DojoAccountDetail' })

  const route = useRoute()
  const router = useRouter()
  const syncing = ref(false)
  const comparing = ref(false)

  const handleParam = computed(() => stripHandle(String(route.params.handle || '')))

  const account = computed(() => {
    void dojoAccountStore.revision
    if (!handleParam.value) return null
    return findAccount(handleParam.value) || null
  })

  const videos = computed(() => {
    void dojoAccountStore.revision
    if (!account.value) return []
    return [...accountVideos(account.value.handle)].sort((a, b) =>
      (b.publishDate || '').localeCompare(a.publishDate || '')
    )
  })

  const homeLink = computed(() => {
    if (!account.value) return ''
    return account.value.link || `https://www.tiktok.com/@${stripHandle(account.value.handle)}`
  })

  const avgViews = computed(() => {
    if (!videos.value.length) return 0
    return Math.round(videos.value.reduce((s, v) => s + v.views, 0) / videos.value.length)
  })

  const avgLikes = computed(() => {
    if (!videos.value.length) return 0
    return Math.round(videos.value.reduce((s, v) => s + v.likes, 0) / videos.value.length)
  })

  const avgEngagement = computed(() => {
    if (!videos.value.length) return 0
    return videos.value.reduce((s, v) => s + v.engagementRate, 0) / videos.value.length
  })

  const daysSinceLastPost = computed(() => {
    const latest = videos.value[0]?.publishDate
    if (!latest) return '—'
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(latest).getTime()) / (24 * 3600 * 1000))
    )
    return days === 0 ? '今天' : `${days} 天`
  })

  const postFrequency = computed(() => {
    if (videos.value.length < 2) return videos.value.length ? `${videos.value.length} 条` : '—'
    const dates = videos.value
      .map((v) => new Date(v.publishDate).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b)
    if (dates.length < 2) return '—'
    const spanDays = Math.max(1, (dates.at(-1)! - dates[0]!) / (24 * 3600 * 1000))
    const perWeek = (videos.value.length / spanDays) * 7
    return `${perWeek.toFixed(1)} 条/周`
  })

  const spreadScore = computed(() => {
    const fans = account.value?.followers || 0
    const er = avgEngagement.value
    const score = Math.min(100, Math.round(Math.log10(fans + 10) * 12 + er * 800))
    return score
  })

  function captureMetrics(at = new Date().toISOString()): AccountWowMetrics {
    return {
      at,
      followers: account.value?.followers || 0,
      posts: videos.value.length || account.value?.totalVideos || 0,
      avgViews: avgViews.value,
      avgLikes: avgLikes.value,
      engagementRate: avgEngagement.value,
      spreadScore: spreadScore.value
    }
  }

  const currentMetrics = computed(() => {
    void dojoAccountStore.revision
    void videos.value.length
    if (!account.value) return null
    return captureMetrics(account.value.lastSyncedAt || new Date().toISOString())
  })

  const baselineMetrics = computed(() => {
    void dojoAccountWow.revision
    if (!account.value) return null
    return getWowBaseline(account.value.handle)
  })

  function fmtTs(iso?: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  function fmtInt(n: number) {
    return Math.round(n).toLocaleString()
  }

  function fmtViews(n: number) {
    if (!Number.isFinite(n)) return '—'
    return n >= 100 ? fmtInt(n) : n.toFixed(1)
  }

  function fmtPct(rate: number) {
    return `${(rate * 100).toFixed(2)}%`
  }

  function deltaText(prev: number, curr: number, kind: 'int' | 'views' | 'pct') {
    const d = curr - prev
    if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return '—'
    if (kind === 'pct') {
      const pp = d * 100
      if (Math.abs(pp) < 0.05) return pp < 0 ? '-0.0' : '+0.0'
      const sign = pp > 0 ? '+' : ''
      return `${sign}${pp.toFixed(1)}`
    }
    if (kind === 'views') {
      const sign = d > 0 ? '+' : ''
      return `${sign}${Math.abs(d) >= 10 ? fmtInt(d) : d.toFixed(1)}`
    }
    const sign = d > 0 ? '+' : ''
    return `${sign}${fmtInt(d)}`
  }

  function deltaClass(prev: number, curr: number) {
    const d = curr - prev
    if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return ''
    return d > 0 ? 'is-up' : 'is-down'
  }

  const wowInterval = computed(() => {
    const prev = baselineMetrics.value
    const curr = currentMetrics.value
    if (!prev || !curr) return ''
    return `${fmtTs(prev.at)} → ${fmtTs(curr.at)}`
  })

  const metricUpdatedAt = computed(() => {
    const curr = currentMetrics.value
    if (!curr) return '—'
    return fmtTs(curr.at)
  })

  const wowRows = computed(() => {
    const curr = currentMetrics.value
    const prev = baselineMetrics.value
    if (!curr) return []
    const defs: Array<{
      key: keyof AccountWowMetrics
      label: string
      kind: 'int' | 'views' | 'pct'
      fmt: (n: number) => string
    }> = [
      { key: 'followers', label: '粉丝数', kind: 'int', fmt: fmtInt },
      { key: 'posts', label: '出品贴文', kind: 'int', fmt: fmtInt },
      { key: 'avgViews', label: '均播放/阅读', kind: 'views', fmt: fmtViews },
      { key: 'avgLikes', label: '均点赞', kind: 'int', fmt: fmtInt },
      { key: 'engagementRate', label: '互动率', kind: 'pct', fmt: fmtPct },
      { key: 'spreadScore', label: '传播潜力', kind: 'int', fmt: fmtInt }
    ]
    return defs.map((d) => {
      const c = Number(curr[d.key]) || 0
      const p = prev ? Number(prev[d.key]) || 0 : null
      return {
        label: d.label,
        prevText: p == null ? '—' : d.fmt(p),
        currText: d.fmt(c),
        deltaText: p == null ? '—' : deltaText(p, c, d.kind),
        deltaClass: p == null ? '' : deltaClass(p, c)
      }
    })
  })

  function projectName(id: string) {
    return getProjectById(id)?.name || id
  }

  function num(n?: number | null) {
    if (n == null) return '—'
    return n.toLocaleString()
  }

  function shouldRefreshBaseline(baseline: AccountWowMetrics | null) {
    if (!baseline) return true
    const age = Date.now() - new Date(baseline.at).getTime()
    return !Number.isFinite(age) || age >= WOW_BASELINE_TTL_MS
  }

  async function refreshCompare() {
    if (!account.value) return
    comparing.value = true
    try {
      const before = captureMetrics(new Date().toISOString())
      const baseline = getWowBaseline(account.value.handle)
      // 无基线或已满约 7 天：把刷新前快照记为「上周/上次」
      if (shouldRefreshBaseline(baseline)) {
        saveWowBaseline(account.value.handle, before)
      }
      const result = await syncAccount(account.value.handle)
      if (!result) {
        ElMessage.warning(account.value.syncError || '同步失败')
        return
      }
      // 若基线仍是刚写入的 before，对比区间就是「刷新前 → 刷新后」
      // 若沿用旧基线（7 天内多次刷新），则继续与那次基线比
      ElMessage.success('对比已更新')
    } finally {
      comparing.value = false
    }
  }

  async function refresh() {
    if (!account.value) return
    syncing.value = true
    try {
      const result = await syncAccount(account.value.handle)
      if (result) ElMessage.success('指标已刷新')
      else ElMessage.warning(account.value.syncError || '同步失败')
    } finally {
      syncing.value = false
    }
  }

  function exportFans() {
    if (!account.value) return
    const a = account.value
    exportCsv(
      `账号信息_${stripHandle(a.handle)}`,
      ['昵称', '账号', '地区', '平台', '项目', '细分', '粉丝', '视频数', '主页', '上次同步'],
      [
        [
          a.nickname || '',
          a.handle,
          a.region || '',
          'TikTok',
          a.projectId ? projectName(a.projectId) : '',
          a.segment || '',
          a.followers ?? '',
          videos.value.length || a.totalVideos || 0,
          homeLink.value,
          a.lastSyncedAt || ''
        ]
      ]
    )
    ElMessage.success('已导出账号信息')
  }

  function exportVideos() {
    if (!account.value) return
    if (!videos.value.length) {
      ElMessage.warning('暂无视频数据，请先刷新指标')
      return
    }
    exportCsv(
      `账号视频_${stripHandle(account.value.handle)}`,
      ['账号', '发布日期', '内容', '播放量', '点赞', '评论', '转发', '链接'],
      videos.value.map((v) => [
        account.value!.handle,
        v.publishDate,
        v.description,
        v.views,
        v.likes,
        v.comments,
        v.shares,
        v.videoUrl
      ])
    )
    ElMessage.success(`已导出 ${videos.value.length} 条视频`)
  }

  async function remove() {
    if (!account.value) return
    await ElMessageBox.confirm(`确认删除 ${account.value.handle}？`, '删除账号', {
      type: 'warning'
    })
    removeAccount(account.value.handle)
    ElMessage.success('已删除')
    router.push('/account-matrix')
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .back {
    margin-bottom: 6px;
  }

  .empty-state {
    padding: 28px;
    text-align: center;
    color: var(--el-text-color-secondary);
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;
  }

  .identity {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;

    h2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 650;
    }

    &__meta {
      margin: 0 0 6px;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }

    &__link {
      font-size: 13px;
    }

    &__sync {
      font-size: 13px;
    }
  }

  .section-title {
    margin: 8px 0 10px;
    font-size: 16px;
    font-weight: 650;
  }

  .section-desc {
    margin: -4px 0 12px;
    font-size: 13px;
  }

  .stat-row {
    grid-template-columns: repeat(6, minmax(0, 1fr));

    @media (max-width: 1100px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
  }

  .danger {
    color: var(--el-color-danger);
  }

  .wow-panel {
    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 4px;

      .section-title {
        margin-bottom: 4px;
      }

      .section-desc {
        margin: 0;
      }
    }

    &__foot {
      margin: 12px 0 0;
      font-size: 13px;
    }

    .is-up {
      color: var(--el-color-success);
      font-variant-numeric: tabular-nums;
    }

    .is-down {
      color: var(--el-color-danger);
      font-variant-numeric: tabular-nums;
    }
  }
</style>
