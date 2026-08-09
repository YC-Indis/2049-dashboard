<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>买量账号监看</h1>
        <p>投放账号播放量与粉丝量走势</p>
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
        <ElButton @click="showAdd = true">增加账号</ElButton>
        <ElButton type="primary" :loading="syncing" @click="syncPage"> 同步本页粉丝量 </ElButton>
      </div>
    </header>

    <p v-if="!selectedProjectIds.length" class="demo-hint">
      未选项目时展示<strong>全部</strong>买量账号（{{ rows.length }} 个）；勾选上方项目可收窄范围。
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ rows.length }}</span>
        <span class="stat__l">在投账号</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ fmt(stats.videos) }}</span>
        <span class="stat__l">承载视频数</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ fmt(stats.views) }}</span>
        <span class="stat__l">累计播放量</span>
      </div>
      <div class="stat">
        <span class="stat__n" :class="{ danger: stats.weak }">{{ stats.weak }}</span>
        <span class="stat__l">均播偏低需检查</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <span class="filter-hint">{{ projectFilterLabel }}</span>
        <ElSelect v-model="batch" placeholder="全部项目批次" clearable style="width: 200px">
          <ElOption v-for="b in batchNames" :key="b" :label="b" :value="b" />
        </ElSelect>
        <ElInput
          v-model="keyword"
          placeholder="搜索云机编号 / 账号链接"
          clearable
          style="width: 240px"
        />
        <ElSelect v-model="sortBy" style="width: 160px">
          <ElOption label="按视频数" value="videoCount" />
          <ElOption label="按累计播放" value="totalViews" />
          <ElOption label="按均播" value="avgNaturalViews" />
          <ElOption label="按粉丝量" value="followers" />
        </ElSelect>
        <ElCheckbox v-model="onlyWeak">只看均播偏低</ElCheckbox>
        <span class="filters__count">{{ rows.length }}</span>
      </div>

      <ElTable :data="paged" stripe style="width: 100%" :row-class-name="rowClass">
        <ElTableColumn label="云机编号" min-width="110">
          <template #default="{ row }">
            <strong>{{ row.device || '未编号' }}</strong>
            <ElTag v-if="row.custom" size="small" type="warning" class="custom-tag">自建</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="账号链接" min-width="200">
          <template #default="{ row }">
            <a
              v-if="row.accountUrl"
              class="link"
              :href="row.accountUrl"
              target="_blank"
              rel="noopener"
            >
              {{ handleOf(row.accountUrl) }}
            </a>
            <span v-else class="muted">未登记</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="粉丝量" min-width="130" align="right">
          <template #default="{ row }">
            <template v-if="followers[rowKey(row)]">
              <strong>{{ fmt(followers[rowKey(row)].followers) }}</strong>
              <em class="src">{{
                followers[rowKey(row)].source === 'rapidapi' ? 'RapidAPI' : 'mock'
              }}</em>
            </template>
            <ElButton v-else link type="primary" size="small" @click="syncOne(row)">拉取</ElButton>
          </template>
        </ElTableColumn>
        <ElTableColumn label="视频数" min-width="90" align="right">
          <template #default="{ row }">{{ row.videoCount }}</template>
        </ElTableColumn>
        <ElTableColumn label="已投放" min-width="90" align="right">
          <template #default="{ row }">{{ row.deliveredCount }}</template>
        </ElTableColumn>
        <ElTableColumn label="累计播放" min-width="110" align="right">
          <template #default="{ row }">{{ fmt(totalOf(row)) }}</template>
        </ElTableColumn>
        <ElTableColumn label="均播" min-width="150">
          <template #default="{ row }">
            <div class="bar">
              <div
                class="bar__fill"
                :style="{
                  width: `${Math.min(100, (avgOf(row) / (globalAvg * 2)) * 100)}%`,
                  background: avgColor(row)
                }"
              />
              <span class="bar__text">{{ fmt(avgOf(row)) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="所属批次" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.batches.join('、') }}</template>
        </ElTableColumn>
        <ElTableColumn label="投放区间" min-width="160">
          <template #default="{ row }">
            {{ row.firstDate || '—' }} → {{ row.lastDate || '—' }}
          </template>
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

    <ElDialog v-model="showAdd" title="增加账号" width="480px" destroy-on-close @closed="resetForm">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <ElFormItem label="云机编号">
          <ElInput v-model="form.device" placeholder="云机编号" />
        </ElFormItem>
        <ElFormItem label="账号链接" prop="accountUrl">
          <ElInput v-model="form.accountUrl" placeholder="https://www.tiktok.com/@..." />
        </ElFormItem>
        <ElFormItem label="所属批次" prop="batches">
          <ElInput
            v-model="form.batches"
            type="textarea"
            :rows="2"
            placeholder="多个批次用逗号或换行分隔"
          />
        </ElFormItem>
        <ElFormItem label="平台">
          <ElSelect v-model="form.platform" style="width: 100%">
            <ElOption label="TikTok" value="TikTok" />
            <ElOption label="Instagram" value="Instagram" />
            <ElOption label="YouTube" value="YouTube" />
          </ElSelect>
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
  import { computed, onUnmounted, reactive, ref, watch } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import type { AdAccount } from '@/mock/dojo/imported/ads'
  import { runtimeAdAccounts, runtimeAdBatches } from '@/store/dojoRuntimeStore'
  import { syncTikTokAccount, type TikTokAccountSnapshot } from '@/api/tiktok'
  import { exportCsv } from '@/utils/dojoExport'
  import { markAccountsSynced, normalizeHandle } from '@/store/dojoSyncStore'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { getProjectById, matchesAnyProject } from '@/store/dojoProjectStore'

  defineOptions({ name: 'DojoAdAccounts' })

  type DisplayAccount = AdAccount & { custom?: boolean }

  const selectedProjectIds = ref<string[]>([])

  const projectFilterLabel = computed(() => {
    if (!selectedProjectIds.value.length) return '全部项目'
    return selectedProjectIds.value
      .map((id) => getProjectById(id)?.name)
      .filter(Boolean)
      .join('、')
  })

  function matchesProject(row: DisplayAccount) {
    return row.batches.some((b) => matchesAnyProject(b, selectedProjectIds.value))
  }

  const batch = ref('')
  const keyword = ref('')
  const sortBy = ref<'videoCount' | 'totalViews' | 'avgNaturalViews' | 'followers'>('videoCount')
  const onlyWeak = ref(false)
  const page = ref(1)
  const pageSize = ref(20)
  const syncing = ref(false)
  const followers = ref<Record<string, TikTokAccountSnapshot>>({})
  const customAccounts = ref<DisplayAccount[]>([])
  const autoInterval = ref<'off' | '5' | '15' | '30'>('off')
  const showAdd = ref(false)
  const formRef = ref<FormInstance>()

  let intervalTimer: ReturnType<typeof setInterval> | null = null

  const form = reactive({
    device: '',
    accountUrl: '',
    batches: '',
    platform: 'TikTok'
  })

  const formRules: FormRules = {
    accountUrl: [{ required: true, message: '请填写账号链接', trigger: 'blur' }],
    batches: [{ required: true, message: '请填写所属批次', trigger: 'blur' }]
  }

  const allAccounts = computed<DisplayAccount[]>(() => [
    ...runtimeAdAccounts.value,
    ...customAccounts.value
  ])

  const batchNames = computed(() => {
    const names = new Set(runtimeAdBatches.value.map((b) => b.batch))
    for (const a of customAccounts.value) {
      for (const b of a.batches) names.add(b)
    }
    return [...names]
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

  function rowKey(row: DisplayAccount) {
    return row.custom ? `custom:${row.accountUrl}` : row.device || row.accountUrl
  }

  function totalOf(row: DisplayAccount) {
    return row.totalViews || row.totalNaturalViews
  }

  function avgOf(row: DisplayAccount) {
    return row.videoCount ? Math.round(totalOf(row) / row.videoCount) : 0
  }

  const globalAvg = computed(() => {
    const withData = allAccounts.value.filter((a) => totalOf(a) > 0)
    if (!withData.length) return 1
    return Math.round(withData.reduce((n, a) => n + avgOf(a), 0) / withData.length)
  })

  function isWeak(row: DisplayAccount) {
    return totalOf(row) > 0 && avgOf(row) < globalAvg.value * 0.5
  }

  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    const list = allAccounts.value.filter((a) => {
      if (!matchesProject(a)) return false
      if (batch.value && !a.batches.includes(batch.value)) return false
      if (onlyWeak.value && !isWeak(a)) return false
      if (kw && !`${a.device} ${a.accountUrl}`.toLowerCase().includes(kw)) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sortBy.value === 'followers') {
        return (
          (followers.value[rowKey(b)]?.followers ?? -1) -
          (followers.value[rowKey(a)]?.followers ?? -1)
        )
      }
      if (sortBy.value === 'totalViews') return totalOf(b) - totalOf(a)
      if (sortBy.value === 'avgNaturalViews') return avgOf(b) - avgOf(a)
      return b.videoCount - a.videoCount
    })
  })

  const paged = computed(() =>
    rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  )

  const stats = computed(() => ({
    videos: rows.value.reduce((n, a) => n + a.videoCount, 0),
    views: rows.value.reduce((n, a) => n + totalOf(a), 0),
    weak: rows.value.filter(isWeak).length
  }))

  watch([selectedProjectIds, batch, keyword, onlyWeak, sortBy], () => {
    page.value = 1
  })

  function fmt(n: number | null) {
    return n == null ? '—' : n.toLocaleString('en-US')
  }

  function handleOf(url: string) {
    const m = url.match(/@([\w.-]+)/)
    return m ? `@${m[1]}` : url.replace(/^https?:\/\//, '').slice(0, 32)
  }

  function avgColor(row: DisplayAccount) {
    const r = globalAvg.value ? avgOf(row) / globalAvg.value : 0
    if (r >= 1.2) return '#22c55e'
    if (r >= 0.8) return '#4a90d9'
    if (r >= 0.5) return '#f59e0b'
    return '#ef4444'
  }

  function rowClass({ row }: { row: DisplayAccount }) {
    return isWeak(row) ? 'row-weak' : ''
  }

  async function syncOne(row: DisplayAccount) {
    const snap = await syncTikTokAccount(handleOf(row.accountUrl || row.device))
    followers.value[rowKey(row)] = snap
    if (snap.source === 'rapidapi') {
      markAccountsSynced([normalizeHandle(row.accountUrl || row.device)])
    }
    return snap
  }

  async function syncPage() {
    syncing.value = true
    try {
      const results = await Promise.all(paged.value.map(syncOne))
      const fromRapid = results.some((s) => s.source === 'rapidapi')
      if (fromRapid) {
        const handles = paged.value
          .map((r) => normalizeHandle(r.accountUrl || r.device))
          .filter(Boolean)
        markAccountsSynced(handles)
      }
      const src = fromRapid ? 'RapidAPI' : '本地 mock'
      ElMessage.success(`已同步 ${paged.value.length} 个账号粉丝量（来源：${src}）`)
    } finally {
      syncing.value = false
    }
  }

  function exportRows() {
    exportCsv(
      '买量账号监看',
      [
        '云机编号',
        '账号链接',
        '平台',
        '粉丝量',
        '视频数',
        '已投放',
        '累计播放',
        '均播',
        '所属批次',
        '投放区间'
      ],
      rows.value.map((a) => [
        a.device,
        a.accountUrl,
        a.platform,
        followers.value[rowKey(a)]?.followers ?? '',
        a.videoCount,
        a.deliveredCount,
        totalOf(a),
        avgOf(a),
        a.batches.join('、'),
        `${a.firstDate || ''} → ${a.lastDate || ''}`
      ])
    )
  }

  function resetForm() {
    form.device = ''
    form.accountUrl = ''
    form.batches = ''
    form.platform = 'TikTok'
  }

  function parseBatches(text: string) {
    return text
      .split(/[,，、\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function submitAdd() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    customAccounts.value.push({
      custom: true,
      device: form.device.trim(),
      accountUrl: form.accountUrl.trim(),
      platform: form.platform,
      batches: parseBatches(form.batches),
      videoCount: 0,
      deliveredCount: 0,
      totalNaturalViews: 0,
      totalViews: 0,
      avgNaturalViews: null,
      firstDate: null,
      lastDate: null
    })

    showAdd.value = false
    ElMessage.success('已添加账号监控条目')
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

  .src {
    margin-left: 6px;
    font-style: normal;
    font-size: 10px;
    color: var(--el-text-color-secondary);
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

  :deep(.row-weak) {
    --el-table-tr-bg-color: rgb(239 68 68 / 6%);
  }
</style>
