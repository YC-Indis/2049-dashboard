<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>投放检阅</h1>
        <p>投放目标进度一览</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" :sync-store="false" width="260px" />
        <ElButton type="primary" @click="showAdd = true">添加案件</ElButton>
      </div>
    </header>

    <p v-if="!selectedProjectIds.length" class="demo-hint">
      未选项目时展示<strong>全部</strong>投放案件（{{ projectFilteredTargets.length }} 条）；勾选上方项目可收窄范围。
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ fmt(totals.target) }}</span>
        <span class="stat__l">需求播放量合计</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ fmt(totals.current) }}</span>
        <span class="stat__l">目前总播放量</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ Math.round(totals.rate * 100) }}%</span>
        <span class="stat__l">整体播放进度</span>
      </div>
      <div class="stat">
        <span class="stat__n" :class="{ danger: alerts.length }">{{ alerts.length }}</span>
        <span class="stat__l">需要关注的项目</span>
      </div>
    </div>

    <section v-if="alerts.length" class="alert-panel">
      <div class="alert-panel__title">
        播放不顺利 · {{ alerts.length }} 个案件
        <span>已过截止日期仍未达标，或进度落后于时间进度 30% 以上</span>
      </div>
      <ul class="alert-list">
        <li v-for="a in alerts" :key="a.id">
          <span class="alert-list__tag" :class="a.level">{{ a.level === 'high' ? '严重' : '预警' }}</span>
          <strong>{{ a.row.project }}</strong>
          <span class="alert-list__region">{{ a.row.region }}</span>
          <span class="alert-list__why">{{ a.reason }}</span>
        </li>
      </ul>
    </section>

    <section class="panel">
      <div class="filters">
        <span class="filter-hint">{{ projectFilterLabel }}</span>
        <ElInput v-model="keyword" placeholder="搜索地区 / 产品" clearable style="width: 220px" />
        <ElSelect v-model="regionFilter" placeholder="投放地区" clearable style="width: 180px">
          <ElOption v-for="r in regions" :key="r" :label="r" :value="r" />
        </ElSelect>
        <ElSelect v-model="stateFilter" placeholder="进度状态" clearable style="width: 150px">
          <ElOption label="已达标" value="hit" />
          <ElOption label="进行中" value="running" />
          <ElOption label="落后" value="behind" />
        </ElSelect>
        <span class="filters__count">{{ rows.length }} / {{ projectFilteredTargets.length }}</span>
      </div>

      <ElTable :data="rows" stripe style="width: 100%">
        <ElTableColumn prop="project" label="项目" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.project }}</span>
            <ElTag v-if="row.custom" size="small" type="warning" class="custom-tag">自建</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="region" label="投放地区" min-width="140" show-overflow-tooltip />
        <ElTableColumn prop="product" label="产品" min-width="90">
          <template #default="{ row }">{{ row.product || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="需求播放量" min-width="110" align="right">
          <template #default="{ row }">{{ fmt(row.targetViews) }}</template>
        </ElTableColumn>
        <ElTableColumn label="目前总播放量" min-width="120" align="right">
          <template #default="{ row }">{{ fmt(row.currentViews) }}</template>
        </ElTableColumn>
        <ElTableColumn label="播放进度" min-width="170">
          <template #default="{ row }">
            <div class="bar">
              <div
                class="bar__fill"
                :style="{
                  width: `${Math.min(100, (row.viewsRate ?? 0) * 100)}%`,
                  background: rateColor(row.viewsRate)
                }"
              />
              <span class="bar__text">{{ pctText(row.viewsRate) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="条数" min-width="90" align="right">
          <template #default="{ row }">
            {{ row.currentCount ?? '—' }} / {{ row.totalCount ?? '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="条数进度" min-width="90" align="right">
          <template #default="{ row }">{{ pctText(row.countRate) }}</template>
        </ElTableColumn>
        <ElTableColumn label="剩余播放量" min-width="110" align="right">
          <template #default="{ row }">
            <span :class="{ ok: (row.remainingViews ?? 0) <= 0 }">
              {{ row.remainingViews == null ? '—' : fmt(Math.max(0, row.remainingViews)) }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="截止日期" min-width="110">
          <template #default="{ row }">{{ row.deadline || row.deadlineText || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="上次更新" min-width="100">
          <template #default="{ row }">{{ row.updatedAt || row.updatedAtText || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="视频明细" min-width="100" fixed="right">
          <template #default="{ row }">
            <ElButton v-if="row.batch" link type="primary" @click.stop="openVideos(row)">
              {{ videoCount(row.batch) }} 条
            </ElButton>
            <span v-else class="muted">未关联</span>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog v-model="showAdd" title="添加监控案件" width="480px" destroy-on-close @closed="resetForm">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <ElFormItem label="项目" prop="project">
          <ElInput v-model="form.project" placeholder="项目名称" />
        </ElFormItem>
        <ElFormItem label="投放地区" prop="region">
          <ElInput v-model="form.region" placeholder="如：英国伯明翰" />
        </ElFormItem>
        <ElFormItem label="产品">
          <ElInput v-model="form.product" placeholder="可选" />
        </ElFormItem>
        <ElFormItem label="需求播放量" prop="targetViews">
          <ElInputNumber v-model="form.targetViews" :min="1" :step="10000" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="截止日期" prop="deadline">
          <ElDatePicker
            v-model="form.deadline"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择截止日期"
            style="width: 100%"
          />
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
  import { computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { adTargets, adBatches, type AdTarget } from '@/mock/dojo/imported/ads'
  import { dojoProjectStore, getProjectById, matchesAnyProject } from '@/store/dojoProjectStore'

  defineOptions({ name: 'DojoAds' })

  type DisplayTarget = AdTarget & { custom?: boolean; note?: string }

  const router = useRouter()
  const todayKey = '2026-08-07'

  const selectedProjectIds = ref<string[]>([])

  const projectFilterLabel = computed(() => {
    if (!selectedProjectIds.value.length) return '全部项目'
    return selectedProjectIds.value
      .map((id) => getProjectById(id)?.name)
      .filter(Boolean)
      .join('、')
  })

  function rowProjectText(row: DisplayTarget) {
    return `${row.project} ${row.region} ${row.batch ?? ''} ${row.product ?? ''}`
  }

  function matchesProject(row: DisplayTarget) {
    return matchesAnyProject(rowProjectText(row), selectedProjectIds.value)
  }

  const keyword = ref('')
  const regionFilter = ref('')
  const stateFilter = ref('')
  const customCases = ref<DisplayTarget[]>([])
  const showAdd = ref(false)
  const formRef = ref<FormInstance>()

  const form = reactive({
    project: '',
    region: '',
    product: '',
    targetViews: 100000 as number | null,
    deadline: '',
    note: ''
  })

  const formRules: FormRules = {
    project: [{ required: true, message: '请填写项目名称', trigger: 'blur' }],
    region: [{ required: true, message: '请填写投放地区', trigger: 'blur' }],
    targetViews: [{ required: true, message: '请填写需求播放量', trigger: 'change' }],
    deadline: [{ required: true, message: '请选择截止日期', trigger: 'change' }]
  }

  const allTargets = computed(() => [...adTargets, ...customCases.value])

  const projectFilteredTargets = computed(() =>
    allTargets.value.filter((t) => matchesProject(t))
  )

  const regions = computed(() => [...new Set(allTargets.value.map((t) => t.region).filter(Boolean))])

  function endOf(row: DisplayTarget) {
    if (row.deadline) return row.deadline
    return adBatches.find((b) => b.batch === row.batch)?.lastDate ?? null
  }

  function stateOf(row: DisplayTarget) {
    if ((row.viewsRate ?? 0) >= 1 || row.finished) return 'hit'
    const end = endOf(row)
    if (end && end < todayKey) return 'behind'
    return 'running'
  }

  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return projectFilteredTargets.value.filter((t) => {
      if (regionFilter.value && t.region !== regionFilter.value) return false
      if (stateFilter.value && stateOf(t) !== stateFilter.value) return false
      if (
        kw &&
        !`${t.project} ${t.region} ${t.product} ${(t as DisplayTarget).note ?? ''}`
          .toLowerCase()
          .includes(kw)
      )
        return false
      return true
    })
  })

  const totals = computed(() => {
    const target = projectFilteredTargets.value.reduce((n, t) => n + (t.targetViews || 0), 0)
    const current = projectFilteredTargets.value.reduce((n, t) => n + (t.currentViews || 0), 0)
    return { target, current, rate: target ? current / target : 0 }
  })

  const alerts = computed(() => {
    const out: Array<{ id: string; row: DisplayTarget; level: 'high' | 'mid'; reason: string }> = []
    for (const row of projectFilteredTargets.value) {
      if (row.finished || (row.viewsRate ?? 0) >= 1) continue
      const rate = row.viewsRate ?? 0
      const gap = row.remainingViews != null ? Math.max(0, row.remainingViews) : null
      const end = endOf(row)
      if (end && end < todayKey) {
        const when = row.deadline ? `已过截止日 ${end}` : `最后一次投放停在 ${end}`
        out.push({
          id: row.id,
          row,
          level: 'high',
          reason: `${when}，只完成 ${pctText(rate)}${gap ? `，还差 ${fmt(gap)} 播放` : ''}`
        })
      } else if (rate < 0.5 && (row.currentCount ?? 0) > 0) {
        out.push({
          id: row.id,
          row,
          level: 'mid',
          reason: `已产出 ${row.currentCount}/${row.totalCount ?? '—'} 条，播放仅 ${pctText(rate)}`
        })
      }
    }
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'high' ? -1 : 1))
  })

  function fmt(n: number | null) {
    if (n == null) return '—'
    return n.toLocaleString('en-US')
  }

  function pctText(r: number | null) {
    return r == null ? '—' : `${Math.round(r * 100)}%`
  }

  function rateColor(r: number | null) {
    if (r == null) return '#d1d5db'
    if (r >= 1) return '#22c55e'
    if (r >= 0.6) return '#4a90d9'
    if (r >= 0.3) return '#f59e0b'
    return '#ef4444'
  }

  function videoCount(batch: string | null) {
    return adBatches.find((b) => b.batch === batch)?.videoCount ?? 0
  }

  function openVideos(row: DisplayTarget) {
    router.push({ path: '/ads/videos', query: { batch: row.batch || '' } })
  }

  function resetForm() {
    form.project = ''
    form.region = ''
    form.product = ''
    form.targetViews = 100000
    form.deadline = ''
    form.note = ''
  }

  async function submitAdd() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const target = form.targetViews ?? 0
    customCases.value.push({
      id: `custom-${Date.now()}`,
      custom: true,
      project: form.project.trim(),
      region: form.region.trim(),
      product: form.product.trim(),
      targetViews: target,
      currentViews: 0,
      currentCount: 0,
      totalCount: null,
      countFinished: false,
      viewsRate: 0,
      countRate: null,
      remainingViews: target,
      updatedAt: todayKey,
      updatedAtText: todayKey,
      deadline: form.deadline,
      deadlineText: form.deadline,
      adPlatformViews: null,
      finished: false,
      batch: null,
      note: form.note.trim()
    })

    showAdd.value = false
    ElMessage.success('已添加监控案件')
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

  .alert-panel {
    margin-bottom: 16px;
    padding: 14px 18px;
    border: 1px solid #fca5a5;
    border-radius: 12px;
    background: #fef2f2;

    &__title {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 15px;
      font-weight: 600;
      color: #b91c1c;

      span {
        font-size: 12px;
        font-weight: 400;
        color: #ef4444;
      }
    }
  }

  .alert-list {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-top: 1px solid rgb(252 165 165 / 50%);
      font-size: 13px;
      color: #7f1d1d;

      &:first-child {
        border-top: 0;
      }
    }

    &__tag {
      padding: 1px 7px;
      border-radius: 4px;
      color: #fff;
      font-size: 11px;

      &.high {
        background: #ef4444;
      }

      &.mid {
        background: #f59e0b;
      }
    }

    &__region {
      color: #b91c1c;
    }

    &__why {
      color: #991b1b;
      opacity: 0.85;
    }
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
      transition: width 0.3s ease;
    }

    &__text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .ok {
    color: #22c55e;
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  :global(html.dark) .alert-panel {
    border-color: #7f1d1d;
    background: rgb(127 29 29 / 15%);
  }
</style>
