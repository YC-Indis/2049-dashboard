<template>
  <div class="dojo-page account-pool">
    <header class="dojo-page__head">
      <div>
        <h1>投放账号监控</h1>
        <p>监控投放账号 · 列表 / 卡片切换，点进详情监看视频</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="240px" />
        <ElRadioGroup v-model="viewMode" size="default">
          <ElRadioButton value="list">列表</ElRadioButton>
          <ElRadioButton value="card">卡片</ElRadioButton>
        </ElRadioGroup>
        <ElButton @click="exportAccountInfo">导出账号信息</ElButton>
      </div>
    </header>

    <div class="pool-bar">
      <div class="pool-bar__title">
        投放账号池
        <ElTag size="small" type="info" effect="plain">{{ filteredAccounts.length }}</ElTag>
      </div>
      <div class="pool-bar__ops">
        <span class="auto-refresh">
          自动刷新
          <ElSelect
            v-model="autoRefreshMs"
            size="small"
            style="width: 110px"
            @change="onAutoRefreshChange"
          >
            <ElOption
              v-for="opt in autoRefreshOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </span>
        <ElButton size="small" :loading="syncingAll" type="primary" plain @click="syncAll">
          立即刷新全部
        </ElButton>
        <span class="muted">{{ syncHint }}</span>
      </div>
    </div>

    <div class="stat-row stat-row--2">
      <div class="stat">
        <span class="stat__n accent">{{ filteredAccounts.length }}</span>
        <span class="stat__l">投放账号</span>
      </div>
      <div class="stat">
        <span class="stat__n accent">{{ formatCompact(totalFans) }}</span>
        <span class="stat__l">粉丝总量</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索账号 / 昵称 / 所属项目"
          style="width: 240px"
        />
        <ElSelect v-model="sortKey" clearable placeholder="排序字段" style="width: 140px">
          <ElOption label="粉丝数" value="followers" />
          <ElOption label="已发布视频" value="videos" />
        </ElSelect>
        <ElRadioGroup v-model="sortOrder" size="default" :disabled="!sortKey">
          <ElRadioButton value="desc">降序</ElRadioButton>
          <ElRadioButton value="asc">升序</ElRadioButton>
        </ElRadioGroup>
        <span class="muted">共 {{ filteredAccounts.length }} 个账号</span>
      </div>

      <div v-if="selectedAccounts.length" class="batch-bar">
        <span>
          已选 <strong>{{ selectedAccounts.length }}</strong> 个账号
        </span>
        <ElButton size="small" :loading="syncingSelected" @click="syncSelected">
          刷新选中
        </ElButton>
        <ElButton size="small" @click="clearSelection">取消选择</ElButton>
      </div>

      <ElTable
        v-if="viewMode === 'list'"
        ref="tableRef"
        :key="`tbl-${sortKey}-${sortOrder}`"
        :data="displayAccounts"
        row-key="handle"
        stripe
        :default-sort="tableDefaultSort"
        @selection-change="onTableSelectionChange"
        @sort-change="onTableSort"
      >
        <ElTableColumn type="selection" width="48" reserve-selection />
        <ElTableColumn label="账号名称" min-width="200">
          <template #default="{ row }">
            <div class="name-cell">
              <strong>{{ row.nickname || row.handle }}</strong>
              <span class="muted">{{ row.handle }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="所属项目" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="project-cell" :class="{ 'is-empty': !row.projectId }">
              {{ row.projectId ? projectName(row.projectId) : '未归属' }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="平台" width="100">
          <template #default>
            <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="videos"
          label="已发布视频"
          width="120"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }">{{ videoCount(row) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="followers" label="粉丝" width="110" align="right" sortable="custom">
          <template #default="{ row }">
            {{ row.followers != null ? row.followers.toLocaleString() : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="主页链接" width="120">
          <template #default="{ row }">
            <a
              v-if="homeLink(row)"
              :href="homeLink(row)"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              打开主页
            </a>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click.stop="goDetail(row)">查看详情 →</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-else class="account-grid">
        <article
          v-for="row in displayAccounts"
          :key="row.handle"
          class="acc-card"
          :class="{ 'is-selected': isSelected(row) }"
          @click="goDetail(row)"
        >
          <div class="acc-card__top">
            <ElCheckbox
              :model-value="isSelected(row)"
              @click.stop
              @update:model-value="(v) => toggleCardSelect(row, Boolean(v))"
            />
            <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          </div>
          <h3>{{ row.nickname || row.handle }}</h3>
          <p class="acc-card__handle">{{ row.handle }}</p>
          <p class="acc-card__project" :class="{ 'is-empty': !row.projectId }">
            {{ row.projectId ? projectName(row.projectId) : '未归属项目' }}
          </p>
          <dl class="acc-card__kv">
            <div>
              <dt>粉丝数</dt>
              <dd>{{ row.followers != null ? row.followers.toLocaleString() : '—' }}</dd>
            </div>
            <div>
              <dt>已发布视频</dt>
              <dd>{{ videoCount(row) }}</dd>
            </div>
          </dl>
          <footer class="acc-card__foot">
            <a
              v-if="homeLink(row)"
              :href="homeLink(row)"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              打开主页
            </a>
            <span v-else class="muted">无主页</span>
            <ElButton link type="primary" @click.stop="goDetail(row)">查看详情 →</ElButton>
          </footer>
        </article>
        <p v-if="!displayAccounts.length" class="empty-hint">暂无投放账号，请添加并同步</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, type TableInstance } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import {
    accountVideos,
    dojoAccountStore,
    syncAccounts,
    type MatrixAccount
  } from '@/store/dojoAccountStore'
  import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
  import { exportCsv } from '@/utils/dojoExport'
  import { loadTable, saveTable } from '@/utils/dojoPersist'
  import { stripHandle } from '@/api/tiktok'

  defineOptions({ name: 'DojoAdAccounts' })

  const HOUR = 3600 * 1000
  const DAY = 24 * HOUR
  const TABLE_AUTO_REFRESH = 'adAccountAutoRefresh'
  const autoRefreshOptions = [
    { label: '关闭', value: 0 },
    { label: '1 小时', value: HOUR },
    { label: '6 小时', value: 6 * HOUR },
    { label: '12 小时', value: 12 * HOUR },
    { label: '1 天', value: DAY },
    { label: '3 天', value: 3 * DAY },
    { label: '1 周', value: 7 * DAY }
  ] as const

  interface AutoRefreshPersist {
    intervalMs: number
    lastRunAt?: string
  }

  const router = useRouter()
  const viewMode = ref<'list' | 'card'>('list')
  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const keyword = ref('')
  const sortKey = ref<'' | 'followers' | 'videos'>('')
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const syncingAll = ref(false)
  const syncingSelected = ref(false)
  const persistedAuto = loadTable<AutoRefreshPersist>(TABLE_AUTO_REFRESH)
  const autoRefreshMs = ref(persistedAuto?.intervalMs ?? 0)
  const autoLastRunAt = ref(persistedAuto?.lastRunAt || '')
  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
  let autoTickTimer: ReturnType<typeof setInterval> | null = null
  const nowTick = ref(Date.now())
  const tableRef = ref<TableInstance>()
  const selectedAccounts = ref<MatrixAccount[]>([])

  watch(selectedProjectIds, (ids) => {
    dojoProjectStore.selectedIds = [...ids]
  })

  const projectAccounts = computed(() => {
    void dojoAccountStore.revision
    const ids = selectedProjectIds.value
    return dojoAccountStore.accounts.filter((a) => {
      if (!ids.length) return true
      return a.projectId ? ids.includes(a.projectId) : false
    })
  })

  const filteredAccounts = computed(() => {
    const q = keyword.value.trim().toLowerCase()
    return projectAccounts.value.filter((a) => {
      if (!q) return true
      const project = a.projectId ? projectName(a.projectId).toLowerCase() : ''
      return (
        a.handle.toLowerCase().includes(q) ||
        (a.nickname || '').toLowerCase().includes(q) ||
        project.includes(q)
      )
    })
  })

  const displayAccounts = computed(() => {
    const list = [...filteredAccounts.value]
    if (!sortKey.value) return list
    const dir = sortOrder.value === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va =
        sortKey.value === 'followers'
          ? a.followers == null
            ? -1
            : a.followers
          : videoCount(a)
      const vb =
        sortKey.value === 'followers'
          ? b.followers == null
            ? -1
            : b.followers
          : videoCount(b)
      if (va === vb) return a.handle.localeCompare(b.handle)
      return (va - vb) * dir
    })
    return list
  })

  const tableDefaultSort = computed(() => {
    if (!sortKey.value) return undefined
    return {
      prop: sortKey.value,
      order: (sortOrder.value === 'asc' ? 'ascending' : 'descending') as 'ascending' | 'descending'
    }
  })

  function onTableSort(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
    if (!payload.order || (payload.prop !== 'followers' && payload.prop !== 'videos')) {
      sortKey.value = ''
      return
    }
    sortKey.value = payload.prop
    sortOrder.value = payload.order === 'ascending' ? 'asc' : 'desc'
  }

  const totalFans = computed(() =>
    filteredAccounts.value.reduce((s, a) => s + (a.followers || 0), 0)
  )

  const syncHint = computed(() => {
    void nowTick.value
    const synced = filteredAccounts.value.filter((a) => a.lastSyncedAt)
    const latest = synced
      .map((a) => a.lastSyncedAt!)
      .sort()
      .at(-1)
    const parts: string[] = []
    if (latest) parts.push(`上次更新：${new Date(latest).toLocaleString()}`)
    else parts.push('尚未同步过账号')
    if (autoRefreshMs.value > 0) {
      const base = autoLastRunAt.value ? new Date(autoLastRunAt.value).getTime() : 0
      const nextAt = base ? base + autoRefreshMs.value : Date.now()
      if (nextAt > Date.now()) {
        parts.push(`下次自动：${new Date(nextAt).toLocaleString()}`)
      } else {
        parts.push('下次自动：即将执行')
      }
    }
    return parts.join(' · ')
  })

  function persistAutoRefresh() {
    saveTable(TABLE_AUTO_REFRESH, {
      intervalMs: autoRefreshMs.value,
      lastRunAt: autoLastRunAt.value || undefined
    } satisfies AutoRefreshPersist)
  }

  function clearAutoRefreshTimer() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
  }

  async function runAutoRefresh(silent = true) {
    const handles = filteredAccounts.value.map((a) => a.handle)
    if (!handles.length || syncingAll.value) return
    syncingAll.value = true
    try {
      await syncAccounts(handles)
      autoLastRunAt.value = new Date().toISOString()
      persistAutoRefresh()
      if (!silent) ElMessage.success(`自动刷新完成：${handles.length} 个账号`)
    } finally {
      syncingAll.value = false
    }
  }

  function setupAutoRefresh() {
    clearAutoRefreshTimer()
    persistAutoRefresh()
    if (autoRefreshMs.value <= 0) return
    const last = autoLastRunAt.value ? new Date(autoLastRunAt.value).getTime() : 0
    if (!last || Date.now() - last >= autoRefreshMs.value) {
      void runAutoRefresh(true)
    }
    autoRefreshTimer = setInterval(() => {
      void runAutoRefresh(true)
    }, autoRefreshMs.value)
  }

  function onAutoRefreshChange() {
    if (autoRefreshMs.value > 0) {
      const label =
        autoRefreshOptions.find((o) => o.value === autoRefreshMs.value)?.label || '已开启'
      ElMessage.success(`已开启自动刷新：每 ${label}`)
    } else {
      ElMessage.info('已关闭自动刷新')
    }
    setupAutoRefresh()
  }

  onMounted(() => {
    autoTickTimer = setInterval(() => {
      nowTick.value = Date.now()
    }, 30_000)
    setupAutoRefresh()
  })

  onUnmounted(() => {
    clearAutoRefreshTimer()
    if (autoTickTimer) {
      clearInterval(autoTickTimer)
      autoTickTimer = null
    }
  })

  function projectName(id: string) {
    return getProjectById(id)?.name || id
  }

  function videoCount(row: MatrixAccount) {
    const cached = accountVideos(row.handle).length
    return cached || row.totalVideos || 0
  }

  function homeLink(row: MatrixAccount) {
    if (row.link) return row.link
    if (row.handle) return `https://www.tiktok.com/@${stripHandle(row.handle)}`
    return ''
  }

  function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  function goDetail(row: MatrixAccount) {
    router.push(`/account-detail/${encodeURIComponent(stripHandle(row.handle))}`)
  }

  function onTableSelectionChange(rows: MatrixAccount[]) {
    selectedAccounts.value = rows
  }

  function isSelected(row: MatrixAccount) {
    const key = row.handle.toLowerCase()
    return selectedAccounts.value.some((a) => a.handle.toLowerCase() === key)
  }

  function toggleCardSelect(row: MatrixAccount, on: boolean) {
    const key = row.handle.toLowerCase()
    if (on) {
      if (!isSelected(row)) selectedAccounts.value = [...selectedAccounts.value, row]
      return
    }
    selectedAccounts.value = selectedAccounts.value.filter((a) => a.handle.toLowerCase() !== key)
  }

  function clearSelection() {
    selectedAccounts.value = []
    tableRef.value?.clearSelection()
  }

  watch(displayAccounts, () => {
    const alive = new Set(displayAccounts.value.map((a) => a.handle.toLowerCase()))
    const next = selectedAccounts.value.filter((a) => alive.has(a.handle.toLowerCase()))
    if (next.length !== selectedAccounts.value.length) selectedAccounts.value = next
  })

  watch(viewMode, () => {
    clearSelection()
  })

  function exportAccountInfo() {
    const rows = filteredAccounts.value.map((a) => [
      a.nickname || '',
      a.handle,
      'TikTok',
      a.projectId ? projectName(a.projectId) : '',
      a.followers ?? '',
      videoCount(a),
      homeLink(a),
      a.lastSyncedAt || ''
    ])
    exportCsv(
      `投放账号监控_${new Date().toISOString().slice(0, 10)}`,
      ['昵称', '账号', '平台', '所属项目', '粉丝', '已发布视频', '主页链接', '上次同步'],
      rows
    )
    ElMessage.success(`已导出 ${rows.length} 条账号信息`)
  }

  async function syncAll() {
    const handles = filteredAccounts.value.map((a) => a.handle)
    if (!handles.length) {
      ElMessage.info('暂无投放账号')
      return
    }
    syncingAll.value = true
    try {
      await syncAccounts(handles)
      autoLastRunAt.value = new Date().toISOString()
      persistAutoRefresh()
      ElMessage.success(`已刷新 ${handles.length} 个账号`)
    } finally {
      syncingAll.value = false
    }
  }

  async function syncSelected() {
    if (!selectedAccounts.value.length) {
      ElMessage.info('请先勾选账号')
      return
    }
    syncingSelected.value = true
    try {
      await syncAccounts(selectedAccounts.value.map((a) => a.handle))
      ElMessage.success(`已刷新 ${selectedAccounts.value.length} 个账号`)
    } finally {
      syncingSelected.value = false
    }
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .stat-row--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 480px;
  }

  .accent {
    color: var(--el-color-primary);
  }

  .pool-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    padding: 10px 14px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 10px;
    background: var(--el-color-primary-light-9);

    &__title {
      display: flex;
      gap: 8px;
      align-items: center;
      font-weight: 600;
    }

    &__ops {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
  }

  .auto-refresh {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }

  .batch-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin: -4px 0 14px;
    padding: 10px 12px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 10px;
    background: var(--el-color-primary-light-9);
    font-size: 13px;

    strong {
      font-variant-numeric: tabular-nums;
      color: var(--el-color-primary);
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .empty-hint {
    margin: 0;
    padding: 32px 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 14px;
    grid-column: 1 / -1;
  }

  .name-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;

    strong {
      font-weight: 600;
    }
  }

  .project-cell {
    font-weight: 600;

    &.is-empty {
      font-weight: 400;
      color: var(--el-text-color-placeholder);
    }
  }

  .account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .acc-card {
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 4px 16px rgb(0 0 0 / 4%);
    }

    &.is-selected {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
    }

    &__top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
    }

    &__handle {
      margin: 4px 0 6px;
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }

    &__project {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-color-primary);

      &.is-empty {
        font-weight: 400;
        color: var(--el-text-color-placeholder);
      }
    }

    &__kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 0 0 12px;

      dt {
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }

      dd {
        margin: 2px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    &__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid var(--el-border-color-extra-light);
      font-size: 13px;
    }
  }
</style>
