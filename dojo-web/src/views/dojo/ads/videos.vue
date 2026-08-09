<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>投放视频监控</h1>
        <p>各批次视频投放记录与播放对比</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" :sync-store="false" width="240px" />
        <div class="auto-refresh">
          <span>自动刷新设置</span>
          <ElSelect v-model="autoInterval" style="width: 120px">
            <ElOption label="关闭" value="off" />
            <ElOption label="5 分钟" value="5" />
            <ElOption label="15 分钟" value="15" />
            <ElOption label="30 分钟" value="30" />
          </ElSelect>
        </div>
        <ElButton @click="exportRows">导出</ElButton>
        <ElButton @click="showAdd = true">增加账号/视频</ElButton>
        <ElButton :loading="syncing" @click="syncPage">同步本页播放量</ElButton>
      </div>
    </header>

    <p v-if="!selectedProjectIds.length" class="demo-hint">
      未选项目时展示<strong>全部</strong>投放视频（{{ rows.length }}
      条可见）；勾选上方项目可收窄范围。
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ rows.length }}</span>
        <span class="stat__l">当前筛选条数</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.delivered }}</span>
        <span class="stat__l">已投放</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ fmt(stats.views) }}</span>
        <span class="stat__l">播放量合计（含自然流）</span>
      </div>
      <div class="stat">
        <span class="stat__n" :class="{ danger: stats.laggard }">{{ stats.laggard }}</span>
        <span class="stat__l">播放不顺利</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <span class="filter-hint">{{ projectFilterLabel }}</span>
        <ElSelect v-model="batch" placeholder="全部项目批次" clearable style="width: 200px">
          <ElOption
            v-for="b in batchOptions"
            :key="b.batch"
            :label="`${b.batch}（${b.videoCount}）`"
            :value="b.batch"
          />
        </ElSelect>
        <ElSelect v-model="status" placeholder="投放状态" clearable style="width: 140px">
          <ElOption v-for="s in statuses" :key="s" :label="s" :value="s" />
        </ElSelect>
        <ElSelect v-model="sortBy" style="width: 160px">
          <ElOption label="按播放量高→低" value="views-desc" />
          <ElOption label="按播放量低→高" value="views-asc" />
          <ElOption label="按日期新→旧" value="date-desc" />
          <ElOption label="按日期旧→新" value="date-asc" />
        </ElSelect>
        <ElInput
          v-model="keyword"
          placeholder="搜索链接 / 云机 / 区域 / 备注"
          clearable
          style="width: 240px"
        />
        <ElCheckbox v-model="onlyLaggard">只看播放不顺利</ElCheckbox>
        <span class="filters__count">{{ rows.length }}</span>
      </div>

      <ElTable :data="paged" stripe style="width: 100%" :row-class-name="rowClass">
        <ElTableColumn
          label="#"
          type="index"
          width="60"
          :index="(i: number) => (page - 1) * pageSize + i + 1"
        />
        <ElTableColumn prop="batch" label="项目批次" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.batch }}</span>
            <ElTag v-if="row.custom" size="small" type="warning" class="custom-tag">自建</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="日期" min-width="100">
          <template #default="{ row }">{{ row.date || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="云机编号" min-width="100">
          <template #default="{ row }">{{ row.device || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="视频链接" min-width="180">
          <template #default="{ row }">
            <a class="link" :href="row.videoUrl" target="_blank" rel="noopener">
              {{ shortUrl(row.videoUrl) }}
            </a>
          </template>
        </ElTableColumn>
        <ElTableColumn label="播放量" min-width="110" align="right">
          <template #default="{ row }">
            <strong>{{ fmt(effectiveViews(row)) }}</strong>
            <em v-if="synced[row.id]" class="synced">已同步</em>
          </template>
        </ElTableColumn>
        <ElTableColumn label="对比同批次" min-width="150">
          <template #default="{ row }">
            <div v-if="medianOf(row.batch)" class="bar">
              <div
                class="bar__fill"
                :style="{
                  width: `${Math.min(100, (effectiveViews(row) / (medianOf(row.batch) * 2)) * 100)}%`,
                  background: perfColor(row)
                }"
              />
              <span class="bar__text">{{ ratioText(row) }}</span>
            </div>
            <span v-else class="muted">无基准</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="投放区域" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.region || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" min-width="100">
          <template #default="{ row }">
            <ElTag size="small" :type="statusType(row.status)">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="投流反馈" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.feedback || row.note || '—' }}</template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="pager"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="rows.length"
      />
    </section>

    <ElDialog
      v-model="showAdd"
      title="增加账号/视频"
      width="520px"
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <ElFormItem label="项目批次" prop="batch">
          <ElInput v-model="form.batch" placeholder="批次名称" />
        </ElFormItem>
        <ElFormItem label="日期">
          <ElDatePicker
            v-model="form.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="投放日期"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="云机编号">
          <ElInput v-model="form.device" placeholder="云机编号" />
        </ElFormItem>
        <ElFormItem label="账号链接">
          <ElInput v-model="form.accountUrl" placeholder="https://www.tiktok.com/@..." />
        </ElFormItem>
        <ElFormItem label="视频链接" prop="videoUrl">
          <ElInput v-model="form.videoUrl" placeholder="https://www.tiktok.com/@.../video/..." />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.note" type="textarea" :rows="2" placeholder="可选说明" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="showAdd = false">取消</ElButton>
        <ElButton type="primary" @click="submitAdd">添加</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import type { AdVideo } from '@/mock/dojo/imported/ads'
  import { runtimeAdBatches, runtimeAdVideos } from '@/store/dojoRuntimeStore'
  import { syncVideoMetrics } from '@/api/tiktok'
  import { exportCsv } from '@/utils/dojoExport'
  import { markAccountsSynced, markVideosSynced, normalizeHandle } from '@/store/dojoSyncStore'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { getProjectById, matchesAnyProject } from '@/store/dojoProjectStore'

  defineOptions({ name: 'DojoAdVideos' })

  type DisplayVideo = AdVideo & { custom?: boolean }

  const route = useRoute()

  const selectedProjectIds = ref<string[]>([])
  const sortBy = ref<'views-desc' | 'views-asc' | 'date-desc' | 'date-asc'>('views-desc')

  const projectFilterLabel = computed(() => {
    if (!selectedProjectIds.value.length) return '全部项目'
    return selectedProjectIds.value
      .map((id) => getProjectById(id)?.name)
      .filter(Boolean)
      .join('、')
  })

  function matchesProject(row: DisplayVideo) {
    return matchesAnyProject(
      `${row.batch} ${row.region ?? ''} ${row.content ?? ''}`,
      selectedProjectIds.value
    )
  }

  const batch = ref('')
  const status = ref('')
  const keyword = ref('')
  const onlyLaggard = ref(false)
  const page = ref(1)
  const pageSize = ref(20)
  const syncing = ref(false)
  const synced = ref<Record<string, number>>({})
  const customVideos = ref<DisplayVideo[]>([])
  const autoInterval = ref<'off' | '5' | '15' | '30'>('off')
  const showAdd = ref(false)
  const formRef = ref<FormInstance>()

  let intervalTimer: ReturnType<typeof setInterval> | null = null

  const form = reactive({
    batch: '',
    date: '',
    device: '',
    accountUrl: '',
    videoUrl: '',
    note: ''
  })

  const formRules: FormRules = {
    batch: [{ required: true, message: '请填写项目批次', trigger: 'blur' }],
    videoUrl: [{ required: true, message: '请填写视频链接', trigger: 'blur' }]
  }

  const allVideos = computed<DisplayVideo[]>(() => [
    ...runtimeAdVideos.value,
    ...customVideos.value
  ])

  const batchOptions = computed(() => {
    const map = new Map(runtimeAdBatches.value.map((b) => [b.batch, { ...b }]))
    for (const v of customVideos.value) {
      const existing = map.get(v.batch)
      if (existing) {
        existing.videoCount += 1
      } else {
        map.set(v.batch, {
          batch: v.batch,
          videoCount: 1,
          deliveredCount: 0,
          firstDate: v.date,
          lastDate: v.date,
          totalNaturalViews: 0,
          totalViews: 0
        })
      }
    }
    return [...map.values()]
  })

  const statuses = computed(() => [...new Set(allVideos.value.map((v) => v.status))])

  onMounted(() => {
    const q = route.query.batch
    if (typeof q === 'string' && q) batch.value = q
  })

  onUnmounted(() => {
    if (intervalTimer) clearInterval(intervalTimer)
  })

  watch(autoInterval, (v) => {
    if (intervalTimer) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
    if (v === 'off') return
    intervalTimer = setInterval(() => syncPage(), Number(v) * 60 * 1000)
  })

  function effectiveViews(row: DisplayVideo) {
    return synced.value[row.id] ?? row.views ?? row.naturalViews ?? 0
  }

  const medians = computed(() => {
    const map = new Map<string, number>()
    for (const b of batchOptions.value) {
      const vals = allVideos.value
        .filter((v) => v.batch === b.batch)
        .map(effectiveViews)
        .filter((n) => n > 0)
        .sort((x, y) => x - y)
      if (vals.length) map.set(b.batch, vals[Math.floor(vals.length / 2)])
    }
    return map
  })

  function medianOf(b: string) {
    return medians.value.get(b) ?? 0
  }

  function isLaggard(row: DisplayVideo) {
    const m = medianOf(row.batch)
    const v = effectiveViews(row)
    if (row.status === '已投放' && v === 0) return true
    return m > 0 && v > 0 && v < m * 0.5
  }

  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    const list = allVideos.value.filter((v) => {
      if (!matchesProject(v)) return false
      if (batch.value && v.batch !== batch.value) return false
      if (status.value && v.status !== status.value) return false
      if (onlyLaggard.value && !isLaggard(v)) return false
      if (
        kw &&
        !`${v.videoUrl} ${v.device} ${v.region} ${v.note} ${v.accountUrl}`
          .toLowerCase()
          .includes(kw)
      )
        return false
      return true
    })
    list.sort((a, b) => {
      if (sortBy.value === 'views-desc') return effectiveViews(b) - effectiveViews(a)
      if (sortBy.value === 'views-asc') return effectiveViews(a) - effectiveViews(b)
      if (sortBy.value === 'date-asc') return (a.date || '').localeCompare(b.date || '')
      return (b.date || '').localeCompare(a.date || '')
    })
    return list
  })

  const paged = computed(() =>
    rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  )

  const stats = computed(() => ({
    delivered: rows.value.filter((v) => v.status === '已投放').length,
    views: rows.value.reduce((n, v) => n + effectiveViews(v), 0),
    laggard: rows.value.filter(isLaggard).length
  }))

  watch([selectedProjectIds, batch, status, keyword, onlyLaggard, sortBy], () => {
    page.value = 1
  })

  function fmt(n: number | null) {
    return n == null ? '—' : n.toLocaleString('en-US')
  }

  function shortUrl(u: string) {
    return u.replace(/^https?:\/\//, '').slice(0, 34)
  }

  function ratioText(row: DisplayVideo) {
    const m = medianOf(row.batch)
    if (!m) return '—'
    return `${Math.round((effectiveViews(row) / m) * 100)}% 中位`
  }

  function perfColor(row: DisplayVideo) {
    const m = medianOf(row.batch)
    const r = m ? effectiveViews(row) / m : 0
    if (r >= 1.2) return '#22c55e'
    if (r >= 0.8) return '#4a90d9'
    if (r >= 0.5) return '#f59e0b'
    return '#ef4444'
  }

  function statusType(s: string) {
    if (s === '已投放') return 'success'
    if (s === '暂不投放') return 'info'
    if (s === '跟进中') return 'warning'
    return 'info'
  }

  function rowClass({ row }: { row: DisplayVideo }) {
    return isLaggard(row) ? 'row-laggard' : ''
  }

  async function syncPage() {
    syncing.value = true
    try {
      const targets = paged.value
      const results = await Promise.all(targets.map((v) => syncVideoMetrics(v.videoUrl)))
      let hit = 0
      const syncedUrls: string[] = []
      const syncedHandles: string[] = []
      let fromRapid = false

      results.forEach((r, i) => {
        if (r?.views != null) {
          synced.value[targets[i].id] = r.views
          hit++
          if (r.source === 'rapidapi') {
            fromRapid = true
            syncedUrls.push(targets[i].videoUrl)
            const handle = normalizeHandle(targets[i].accountUrl)
            if (handle) syncedHandles.push(handle)
          }
        }
      })

      if (fromRapid) {
        markVideosSynced(syncedUrls)
        if (syncedHandles.length) markAccountsSynced(syncedHandles)
      }

      const src = fromRapid ? 'RapidAPI' : '本地 mock'
      ElMessage.success(`已更新 ${hit} 条播放量（来源：${src}）`)
    } finally {
      syncing.value = false
    }
  }

  function exportRows() {
    exportCsv(
      '投放视频监控',
      [
        '项目批次',
        '日期',
        '云机编号',
        '账号链接',
        '视频链接',
        '播放量',
        '投放区域',
        '状态',
        '备注'
      ],
      rows.value.map((v) => [
        v.batch,
        v.date,
        v.device,
        v.accountUrl,
        v.videoUrl,
        effectiveViews(v),
        v.region,
        v.status,
        v.feedback || v.note
      ])
    )
  }

  function resetForm() {
    form.batch = ''
    form.date = ''
    form.device = ''
    form.accountUrl = ''
    form.videoUrl = ''
    form.note = ''
  }

  async function submitAdd() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    customVideos.value.push({
      id: `custom-v-${Date.now()}`,
      custom: true,
      batch: form.batch.trim(),
      date: form.date || null,
      platform: 'TikTok',
      device: form.device.trim(),
      accountUrl: form.accountUrl.trim(),
      videoUrl: form.videoUrl.trim(),
      content: '',
      naturalViews: null,
      views: null,
      code: '',
      region: '',
      note: form.note.trim(),
      feedback: '',
      status: '跟进中'
    })

    showAdd.value = false
    ElMessage.success('已添加视频监控条目')
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .stat__n.danger {
    color: #ef4444;
  }

  .custom-tag {
    margin-left: 6px;
    vertical-align: middle;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;

    &__count {
      margin-left: auto;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .filter-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gate {
    padding: 48px 24px;
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
  }

  .auto-refresh {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .link {
    color: var(--el-color-primary);
    text-decoration: none;
    font-size: 12px;

    &:hover {
      text-decoration: underline;
    }
  }

  .synced {
    margin-left: 6px;
    font-style: normal;
    font-size: 10px;
    color: #22c55e;
  }

  .bar {
    position: relative;
    height: 18px;
    border-radius: 9px;
    background: var(--el-fill-color-light);
    overflow: hidden;

    &__fill {
      height: 100%;
      border-radius: 9px;
    }

    &__text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--el-text-color-primary);
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .pager {
    margin-top: 14px;
    justify-content: flex-end;
  }

  :deep(.row-laggard) {
    --el-table-tr-bg-color: rgb(239 68 68 / 6%);
  }
</style>
