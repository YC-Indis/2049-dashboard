<!--
  DIRECTION: An operations situation room translated into the same warm personal desk: data is visual, linked, and always resolves into a next action.
  FIRST VIEWPORT: One long performance trace and a decision scatterplot lead; the account matrix and anomaly queue support them instead of repeating metric cards.
  FORM: Personal work desk, user-selected Superlist-adjacent direction, seed cdaed56f.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRouter } from 'vue-router'
  import { operationsFixtures } from '@/mock/dojo/operationsFixtures'
  import { adMonitorVideos } from '@/store/dojoAdMonitorStore'
  import { dojoCreatorStore } from '@/store/dojoCreatorStore'
  import { getOperationsInvestment } from '@/store/dojoOperationsStore'
  import { cycleLabel, getProjectRuntime, plannedScripts } from '@/store/dojoProjectRuntime'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import type { OperationsVideo } from '@/types/dojoOperations'

  defineOptions({ name: 'DojoOperations' })

  const router = useRouter()
  const period = ref<7 | 30 | 90>(30)
  const projectId = ref('all')
  const platform = ref<'all' | OperationsVideo['platform']>('all')
  const selectedAccount = ref('all')

  const isFixture = computed(() => adMonitorVideos.value.length === 0)

  const sourceVideos = computed<OperationsVideo[]>(() => {
    const activeProjectIds = new Set(
      dojoProjectStore.projects
        .filter((project) => project.active !== false)
        .map((project) => project.id)
    )
    if (adMonitorVideos.value.length) {
      return adMonitorVideos.value
        .filter((video) => !video.projectId || activeProjectIds.has(video.projectId))
        .map((video) => {
          const totalEngagement = video.likes + video.comments + video.shares
          const engagementRate = video.views ? (totalEngagement / video.views) * 100 : 0
          return applyInvestment({
            id: video.videoId,
            projectId: video.projectId || '',
            account: video.accountNickname || video.accountHandle,
            platform: 'TikTok',
            title: video.description || `视频 ${video.videoId}`,
            publishedAt: video.publishDate || '',
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares,
            engagementRate: Number(engagementRate.toFixed(1)),
            spend: 0,
            revenue: 0,
            conversions: 0,
            growthRate: undefined,
            lifecycle: undefined,
            anomaly: undefined,
            trend: undefined
          })
        })
    }
    const firstProject = dojoProjectStore.projects.find((project) => project.active !== false)
    return operationsFixtures
      .map((video) =>
        applyInvestment({
          ...video,
          projectId: video.projectId || firstProject?.id || ''
        })
      )
      .filter((video) => !video.projectId || activeProjectIds.has(video.projectId))
  })

  const filteredVideos = computed(() =>
    sourceVideos.value.filter((video) => {
      if (!isWithinPeriod(video.publishedAt)) return false
      if (projectId.value !== 'all' && video.projectId !== projectId.value) return false
      if (platform.value !== 'all' && video.platform !== platform.value) return false
      if (selectedAccount.value !== 'all' && video.account !== selectedAccount.value) return false
      return true
    })
  )

  const totalViews = computed(() =>
    filteredVideos.value.reduce((sum, video) => sum + video.views, 0)
  )
  const averageEngagement = computed(() => {
    if (!filteredVideos.value.length) return 0
    return (
      filteredVideos.value.reduce((sum, video) => sum + video.engagementRate, 0) /
      filteredVideos.value.length
    )
  })
  const risingCount = computed(
    () =>
      filteredVideos.value.filter(
        (video) => typeof video.growthRate === 'number' && video.growthRate >= 20
      ).length
  )
  const totalSpend = computed(() =>
    filteredVideos.value.reduce((sum, video) => sum + video.spend, 0)
  )
  const totalRevenue = computed(() =>
    filteredVideos.value.reduce((sum, video) => sum + video.revenue, 0)
  )
  const totalRoi = computed(() => roiPercent(totalSpend.value, totalRevenue.value))

  const periodAnchor = computed(() => {
    const timestamps = sourceVideos.value
      .map((video) => Date.parse(video.publishedAt))
      .filter(Number.isFinite)
    return timestamps.length ? Math.max(...timestamps) : Date.now()
  })
  const hasHistoricalSignals = computed(() =>
    filteredVideos.value.some(
      (video) => typeof video.growthRate === 'number' && Boolean(video.trend?.length)
    )
  )

  const accountRows = computed(() => {
    const map = new Map<string, OperationsVideo[]>()
    sourceVideos.value.forEach((video) => {
      const list = map.get(video.account) || []
      list.push(video)
      map.set(video.account, list)
    })
    return [...map.entries()].map(([account, videos]) => {
      const views = videos.reduce((sum, video) => sum + video.views, 0)
      const engagement =
        videos.reduce((sum, video) => sum + video.engagementRate, 0) / videos.length
      const growthValues = videos
        .map((video) => video.growthRate)
        .filter((value): value is number => typeof value === 'number')
      const growth = growthValues.length
        ? growthValues.reduce((sum, value) => sum + value, 0) / growthValues.length
        : 0
      return {
        account,
        videos: videos.length,
        views,
        engagement,
        growth,
        score: Math.max(1, Math.min(100, Math.round(50 + growth + engagement * 2)))
      }
    })
  })

  const projectRows = computed(() => {
    return dojoProjectStore.projects
      .filter((project) => project.active !== false)
      .map((project) => {
        const runtime = getProjectRuntime(project.id)
        const videos = sourceVideos.value.filter((video) => video.projectId === project.id)
        const contents = dojoCreatorStore.planningItems.filter(
          (item) => item.projectId === project.id
        )
        const accountCount = new Set(videos.map((video) => video.account)).size
        const spend = videos.reduce((sum, video) => sum + video.spend, 0)
        const revenue = videos.reduce((sum, video) => sum + video.revenue, 0)
        return {
          id: project.id,
          name: project.name,
          brand: runtime?.brand || project.region || '未补充品牌',
          cycle: runtime ? cycleLabel(runtime.kpi) : '未设置周期',
          accountCount: Math.max(accountCount, runtime?.current.accounts || 0),
          accountTarget: runtime?.kpi.accounts || 0,
          scriptCount: runtime?.current.scripts || 0,
          scriptTarget: runtime ? plannedScripts(runtime.kpi) : 0,
          contentCount: contents.length,
          videoCount: videos.length,
          spend,
          roi: roiPercent(spend, revenue)
        }
      })
  })

  function isWithinPeriod(publishedAt: string) {
    const timestamp = Date.parse(publishedAt)
    if (!Number.isFinite(timestamp)) return true
    const cutoff = periodAnchor.value - (period.value - 1) * 86400000
    return timestamp >= cutoff && timestamp <= periodAnchor.value
  }

  function applyInvestment(video: OperationsVideo) {
    const saved = getOperationsInvestment(video.id)
    if (!saved) return video
    return {
      ...video,
      spend: saved.spend,
      revenue: saved.revenue,
      conversions: saved.conversions,
      attributionNote: saved.attributionNote
    }
  }

  function roiPercent(spend: number, revenue: number) {
    if (!spend) return null
    return ((revenue - spend) / spend) * 100
  }

  function compact(value: number) {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
    return value.toLocaleString('zh-CN')
  }

  function heatColor(score: number) {
    if (score >= 82) return 'is-hot'
    if (score >= 68) return 'is-warm'
    if (score >= 52) return 'is-stable'
    return 'is-cool'
  }


  function selectProject(nextProjectId: string) {
    projectId.value = projectId.value === nextProjectId ? 'all' : nextProjectId
    selectedAccount.value = 'all'
  }
</script>

<template>
  <div class="operations-workspace">
    <header class="operations-head">
      <div>
        <h1>运营驾驶舱</h1>
        <p>从账号矩阵看见变化，从视频曲线找到原因，再把判断变成今天真正要做的事。</p>
      </div>
      <div class="operations-head__controls">
        <span v-if="isFixture" class="fixture-badge"><i /> 本地演示数据</span>
        <span v-else-if="!hasHistoricalSignals" class="fixture-badge is-history-missing">
          <i /> 历史增长待接入
        </span>
        <ElSelect v-model="projectId" size="small" aria-label="筛选项目">
          <ElOption label="全部项目" value="all" />
          <ElOption
            v-for="project in dojoProjectStore.projects.filter((item) => item.active !== false)"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </ElSelect>
        <ElSelect v-model="platform" size="small" aria-label="筛选平台">
          <ElOption label="全部平台" value="all" />
          <ElOption label="TikTok" value="TikTok" />
          <ElOption label="YouTube" value="YouTube" />
          <ElOption label="Instagram" value="Instagram" />
        </ElSelect>
        <div class="period-switch" aria-label="视频发布窗口">
          <button
            v-for="value in [7, 30, 90] as const"
            :key="value"
            type="button"
            :class="{ 'is-active': period === value }"
            @click="period = value"
          >
            {{ value }}天
          </button>
        </div>
      </div>
    </header>

    <section class="project-rail" aria-label="项目与账号概览">
      <header>
        <div>
          <h2>项目与账号</h2>
          <p>选择项目后，账号矩阵、视频表现、投流回报和行动队列会一起收窄。</p>
        </div>
        <button type="button" @click="router.push('/project')">
          <Icon icon="ph:sliders-horizontal" width="15" />
          管理项目
        </button>
      </header>
      <div v-if="projectRows.length" class="project-rail__list">
        <button
          v-for="project in projectRows"
          :key="project.id"
          type="button"
          :class="{ 'is-active': projectId === project.id }"
          @click="selectProject(project.id)"
        >
          <span class="project-rail__identity">
            <strong>{{ project.name }}</strong>
            <small>{{ project.brand }} · {{ project.cycle }}</small>
          </span>
          <span>
            <strong>{{ project.accountCount }}/{{ project.accountTarget || '—' }}</strong>
            <small>账号现状 / 目标</small>
          </span>
          <span>
            <strong>{{ project.scriptCount }}/{{ project.scriptTarget || '—' }}</strong>
            <small>脚本现状 / 目标</small>
          </span>
          <span>
            <strong>{{ project.contentCount }}</strong>
            <small>项目事项</small>
          </span>
          <span>
            <strong>{{ project.videoCount }}</strong>
            <small>监控视频</small>
          </span>
          <span>
            <strong>{{ project.roi === null ? '—' : `${project.roi.toFixed(0)}%` }}</strong>
            <small>ROI · ¥{{ project.spend.toLocaleString('zh-CN') }} 投入</small>
          </span>
          <Icon icon="ph:check-circle-fill" width="17" />
        </button>
      </div>
      <div v-else class="project-rail__empty">
        <span>还没有项目，先建立项目后再接入账号、内容和投流数据。</span>
        <button type="button" @click="router.push('/project')">新建项目</button>
      </div>
    </section>

    <section class="signal-strip" aria-label="关键运营信号">
      <div>
        <span>覆盖播放</span>
        <strong>{{ compact(totalViews) }}</strong>
        <small>当前筛选内累计</small>
      </div>
      <div>
        <span>平均互动率</span>
        <strong>{{ averageEngagement.toFixed(1) }}%</strong>
        <small>赞评转 / 播放</small>
      </div>
      <div>
        <span>正在起量</span>
        <strong>{{ risingCount }}</strong>
        <small>{{ hasHistoricalSignals ? '增长斜率 ≥ 20%' : '需要历史播放快照' }}</small>
      </div>
      <div>
        <span>投流回报</span>
        <strong>{{
          totalRoi === null ? '—' : `${totalRoi >= 0 ? '+' : ''}${totalRoi.toFixed(0)}%`
        }}</strong>
        <small
          >投入 ¥{{ totalSpend.toLocaleString('zh-CN') }} · 回收 ¥{{
            totalRevenue.toLocaleString('zh-CN')
          }}</small
        >
      </div>
      <div class="signal-strip__question">
        <Icon icon="ph:crosshair-duotone" width="23" />
        <p>今天应该把预算和注意力放在哪里？</p>
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="dashboard-panel dashboard-panel--matrix">
        <div class="panel-heading">
          <div>
            <h2>账号矩阵温度</h2>
            <p>点击账号可收窄筛选。视频明细请到侧栏「视频监控」查看，这里不再重复罗列。</p>
          </div>
          <button v-if="selectedAccount !== 'all'" type="button" @click="selectedAccount = 'all'">
            清除筛选
          </button>
        </div>
        <div v-if="accountRows.length" class="account-matrix">
          <button
            v-for="account in accountRows"
            :key="account.account"
            type="button"
            :class="[
              heatColor(account.score),
              { 'is-active': selectedAccount === account.account }
            ]"
            @click="selectedAccount = selectedAccount === account.account ? 'all' : account.account"
          >
            <span>{{ account.account }}</span>
            <strong>{{ account.score }}</strong>
            <small>{{ compact(account.views) }} 播放 · {{ account.videos }} 条</small>
          </button>
        </div>
        <p v-else class="empty-line">当前筛选下还没有可展示的账号。</p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .operations-workspace {
    min-height: 100%;
    padding: 18px 20px 20px;
  }

  .operations-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 28px;
    margin: 0 2px 22px;

    h1 {
      max-width: 760px;
      margin: 0;
      font-family: var(--dojo-serif);
      font-size: clamp(28px, 3vw, 40px);
      font-weight: 500;
      line-height: 1.22;
      text-wrap: balance;
      letter-spacing: -0.02em;
    }

    p {
      max-width: 68ch;
      margin: 8px 0 0;
      color: var(--dojo-muted);
      font-size: var(--dojo-fs-label);
      line-height: 1.55;
    }

    &__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;

      :deep(.el-select) {
        width: 118px;
      }
    }
  }

  .fixture-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    color: var(--dojo-amber);
    background: color-mix(in srgb, var(--dojo-amber) 8%, var(--dojo-paper));
    border-radius: 8px;
    font-size: 11px;

    i {
      width: 6px;
      height: 6px;
      background: var(--dojo-amber);
      border-radius: 50%;
    }

    &.is-history-missing {
      color: var(--dojo-cyan);
      background: color-mix(in srgb, var(--dojo-cyan) 8%, var(--dojo-paper));

      i {
        background: var(--dojo-cyan);
      }
    }
  }

  .project-rail {
    margin-bottom: 24px;
    border-top: 1px solid var(--dojo-line);
    border-bottom: 1px solid var(--dojo-line);
  }

  .project-rail > header {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    min-height: 58px;
    padding: 9px 3px;
  }

  .project-rail h2,
  .project-rail p {
    margin: 0;
  }

  .project-rail h2 {
    font-size: 14px;
  }

  .project-rail p {
    margin-top: 4px;
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .project-rail > header > button,
  .project-rail__empty button {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
    min-height: 32px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-ink);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .project-rail__list {
    display: grid;
  }

  .project-rail__list > button {
    display: grid;
    grid-template-columns: minmax(220px, 1.7fr) repeat(5, minmax(92px, 0.7fr)) 20px;
    gap: 14px;
    align-items: center;
    min-height: 66px;
    padding: 9px 5px;
    color: var(--dojo-muted-strong);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-top: 1px solid var(--dojo-line-soft);
    transition:
      background 150ms ease,
      color 150ms ease;

    &:hover,
    &:focus-visible,
    &.is-active {
      color: var(--dojo-ink);
      background: color-mix(in srgb, var(--dojo-accent) 6%, var(--dojo-paper));
      outline: none;
    }

    > span {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    strong {
      overflow: hidden;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      overflow: hidden;
      font-size: 10px;
      color: var(--dojo-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    > svg {
      color: transparent;
    }

    &.is-active > svg {
      color: var(--dojo-accent);
    }
  }

  .project-rail__identity strong {
    font-size: 13px !important;
  }

  .project-rail__empty {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
    padding: 10px 4px;
    font-size: 10px;
    color: var(--dojo-muted);
    border-top: 1px solid var(--dojo-line-soft);
  }

  .period-switch {
    display: flex;
    padding: 3px;
    background: var(--dojo-sidebar);
    border-radius: 10px;

    button {
      min-height: 27px;
      padding: 0 9px;
      color: var(--dojo-muted);
      background: transparent;
      border: 0;
      border-radius: 7px;
      font-size: 11px;
      cursor: pointer;

      &.is-active {
        color: var(--dojo-ink);
        background: var(--dojo-paper);
        box-shadow: 0 3px 8px rgb(55 43 36 / 6%);
      }
    }
  }

  .signal-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(105px, 1fr)) minmax(190px, 1.4fr);
    margin-bottom: 28px;
    border-top: 1px solid var(--dojo-line);
    border-bottom: 1px solid var(--dojo-line);

    > div {
      display: grid;
      align-content: center;
      min-height: 91px;
      padding: 13px 19px;
      border-right: 1px solid var(--dojo-line-soft);

      > span {
        color: var(--dojo-muted);
        font-size: 11px;
      }

      > strong {
        margin: 3px 0 1px;
        font-size: 18px;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.03em;
      }

      > small {
        color: var(--dojo-muted-light);
        font-size: 10px;
      }
    }

    &__question {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      color: var(--dojo-accent);
      border-right: 0 !important;

      p {
        margin: 0;
        color: var(--dojo-ink);
        font-size: 11px;
        font-weight: 650;
        line-height: 1.5;
      }
    }
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .dashboard-panel {
    min-width: 0;
    padding: 22px 23px;
    background: color-mix(in srgb, var(--dojo-paper) 78%, transparent);
    border-radius: 15px;
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 11px;

    h2 {
      margin: 0;
      font-size: 14px;
      letter-spacing: -0.015em;
    }

    p {
      margin: 4px 0 0;
      color: var(--dojo-muted);
      font-size: 11px;
      line-height: 1.5;
    }

    > span,
    > button {
      color: var(--dojo-muted-light);
      font-size: 11px;
      white-space: nowrap;
    }

    > button {
      padding: 0;
      background: transparent;
      border: 0;
      cursor: pointer;
    }
  }

  .account-matrix {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;

    button {
      display: grid;
      min-height: 86px;
      align-content: space-between;
      padding: 12px;
      color: var(--dojo-ink);
      border: 0;
      border-radius: 11px;
      text-align: left;
      cursor: pointer;
      transition:
        transform 150ms ease,
        box-shadow 150ms ease;

      &:hover,
      &.is-active {
        transform: translateY(-2px);
        box-shadow: 0 9px 18px rgb(65 50 41 / 10%);
      }

      span {
        overflow: hidden;
        font-size: 11px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        margin: 5px 0;
        font-size: 21px;
        font-variant-numeric: tabular-nums;
      }

      small {
        color: rgb(41 37 34 / 62%);
        font-size: 7px;
      }

      &.is-hot {
        background: #efb4a9;
      }

      &.is-warm {
        background: #e8d19e;
      }

      &.is-stable {
        background: #bad7c8;
      }

      &.is-cool {
        background: #d5d3df;
      }
    }
  }







  .empty-line {
    margin: 18px 0 6px;
    color: var(--dojo-muted);
    font-size: 10px;
  }

  @media (max-width: 1080px) {
    .project-rail__list > button {
      grid-template-columns: minmax(200px, 1.5fr) repeat(3, minmax(92px, 0.7fr)) 20px;

      > span:nth-of-type(5),
      > span:nth-of-type(6) {
        display: none;
      }
    }

    .signal-strip {
      grid-template-columns: repeat(4, 1fr);

      &__question {
        grid-column: 1 / -1;
        min-height: 60px !important;
        border-top: 1px solid var(--dojo-line-soft);
      }
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
    }

  }

  @media (max-width: 800px) {
    .operations-workspace {
      padding: 56px max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom))
        max(16px, env(safe-area-inset-left));
    }

    .operations-head {
      display: grid;
      gap: 14px;
      margin: 0 0 16px;

      &__controls {
        justify-content: flex-start;
        margin-top: 18px;
      }
    }

    .project-rail > header {
      align-items: flex-start;
      flex-direction: column;
      padding: 12px 0;
    }

    .project-rail__list > button {
      grid-template-columns: minmax(0, 1fr) auto 20px;
      gap: 10px;

      > span:nth-of-type(n + 3) {
        display: none;
      }
    }

    .signal-strip {
      grid-template-columns: repeat(2, 1fr);

      > div:nth-child(2) {
        border-right: 0;
      }

      > div:nth-child(-n + 2) {
        border-bottom: 1px solid var(--dojo-line-soft);
      }
    }

    .account-matrix {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .dashboard-panel {
      padding: 18px 14px;
    }

    .operations-head__controls :deep(.el-select) {
      width: calc(50% - 4px);
    }

    .fixture-badge {
      width: 100%;
    }
  }
</style>
