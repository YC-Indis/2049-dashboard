<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>投放检阅</h1>
        <p>项目进度与买量账号同屏监看</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" :sync-store="false" width="260px" />
        <ElRadioGroup v-model="viewMode" size="small">
          <ElRadioButton value="card">卡片</ElRadioButton>
          <ElRadioButton value="list">列表</ElRadioButton>
        </ElRadioGroup>
        <ElButton type="primary" @click="showAdd = true">添加监控</ElButton>
      </div>
    </header>

    <p v-if="!selectedProjectIds.length" class="demo-hint">
      未选项目时展示<strong>全部</strong>投放案件（{{ projectFilteredTargets.length }}
      条）；勾选上方项目可收窄范围。
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
          <span class="alert-list__tag" :class="a.level">{{
            a.level === 'high' ? '严重' : '预警'
          }}</span>
          <strong>{{ a.row.project }}</strong>
          <span class="alert-list__region">{{ a.row.region }}</span>
          <span class="alert-list__why">{{ a.reason }}</span>
        </li>
      </ul>
    </section>

    <section class="panel">
      <div class="panel__title">
        项目目标
        <span class="panel__sub"
          >投放案件（{{ rows.length }} / {{ projectFilteredTargets.length }} 条）</span
        >
      </div>
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
        <ElCheckbox v-model="hideFinished">隐藏已达标项目</ElCheckbox>
        <ElButton v-if="hiddenIds.size" link type="primary" @click="hiddenIds.clear()">
          已隐藏 {{ hiddenIds.size }} 个 · 恢复
        </ElButton>
      </div>

      <div v-if="viewMode === 'card'" class="target-grid">
        <article v-for="row in rows" :key="row.id" class="target-card" :class="stateOf(row)">
          <header class="target-card__head">
            <div class="target-card__name">
              {{ row.project }}
              <ElTag v-if="row.custom" size="small" type="warning">自建</ElTag>
            </div>
            <ElTag size="small" :type="stateTagType(stateOf(row))">{{
              stateLabel(stateOf(row))
            }}</ElTag>
          </header>
          <p class="target-card__meta">
            {{ row.region }} · {{ row.product || '未标注' }} · 截止 {{ row.deadline || '—' }}
          </p>
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
          <dl class="target-card__kv">
            <div>
              <dt>需求播放量</dt>
              <dd>{{ fmt(row.targetViews) }}</dd>
            </div>
            <div>
              <dt>目前总播放量</dt>
              <dd>{{ fmt(row.currentViews) }}</dd>
            </div>
            <div>
              <dt>条数</dt>
              <dd>{{ row.currentCount ?? '—' }} / {{ row.totalCount ?? '—' }}</dd>
            </div>
            <div>
              <dt>剩余播放量</dt>
              <dd :class="{ ok: (row.remainingViews ?? 0) <= 0 }">
                {{ row.remainingViews == null ? '—' : fmt(Math.max(0, row.remainingViews)) }}
              </dd>
            </div>
          </dl>
          <footer class="target-card__ops">
            <ElButton v-if="row.batch" link type="primary" @click="openVideos(row)">
              视频明细 {{ videoCount(row.batch) }} 条
            </ElButton>
            <span v-else class="muted">未关联</span>
            <ElButton link @click="hide(row)">隐藏</ElButton>
          </footer>
        </article>
        <p v-if="!rows.length" class="empty">没有符合条件的投放案件</p>
      </div>

      <ElTable v-else :data="rows" stripe style="width: 100%">
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
        <ElTableColumn label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <ElButton link @click.stop="hide(row)">隐藏</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <section class="panel">
      <div class="panel__title">
        买量账号
        <span class="panel__sub">{{ accountRows.length }} 个账号 · 与上方视图切换同步</span>
      </div>

      <div v-if="viewMode === 'card'" class="account-grid">
        <article v-for="a in accountRows" :key="a.id" class="account-card">
          <header class="account-card__head">
            <strong>{{ a.device || '未编号' }}</strong>
            <ElTag size="small" effect="plain">{{ a.batches[0] || '未分批' }}</ElTag>
          </header>
          <dl class="account-card__kv">
            <div>
              <dt>视频</dt>
              <dd>{{ a.videoCount }}</dd>
            </div>
            <div>
              <dt>已投放</dt>
              <dd>{{ a.deliveredCount }}</dd>
            </div>
            <div>
              <dt>累计播放</dt>
              <dd>{{ fmt(a.totalViews) }}</dd>
            </div>
          </dl>
          <p class="account-card__range">
            投放区间 {{ a.firstDate || '—' }} → {{ a.lastDate || '—' }}
          </p>
          <a v-if="a.accountUrl" :href="a.accountUrl" target="_blank" rel="noreferrer">打开账号</a>
        </article>
        <p v-if="!accountRows.length" class="empty">当前筛选下没有买量账号</p>
      </div>

      <ElTable v-else :data="accountRows" stripe style="width: 100%">
        <ElTableColumn label="账号" min-width="160">
          <template #default="{ row }">{{ row.device || '未编号' }}</template>
        </ElTableColumn>
        <ElTableColumn label="所属批次" min-width="160">
          <template #default="{ row }">{{ row.batches[0] || '未分批' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="videoCount" label="视频" min-width="80" align="right" />
        <ElTableColumn prop="deliveredCount" label="已投放" min-width="90" align="right" />
        <ElTableColumn label="累计播放" min-width="110" align="right">
          <template #default="{ row }">{{ fmt(row.totalViews) }}</template>
        </ElTableColumn>
        <ElTableColumn label="投放区间" min-width="180">
          <template #default="{ row }"
            >{{ row.firstDate || '—' }} → {{ row.lastDate || '—' }}</template
          >
        </ElTableColumn>
        <ElTableColumn label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <a v-if="row.accountUrl" :href="row.accountUrl" target="_blank" rel="noreferrer"
              >打开账号</a
            >
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog
      v-model="showAdd"
      title="添加监控案件"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
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
  import {
    runtimeAdAccounts,
    runtimeAdBatches,
    runtimeAdTargets,
    type RuntimeAdTarget
  } from '@/store/dojoRuntimeStore'
  import { getProjectById, matchesAnyProject } from '@/store/dojoProjectStore'
  import { dojoProjectRuntime, timeProgress } from '@/store/dojoProjectRuntime'
  import { DOJO_TODAY } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoAds' })

  type DisplayTarget = RuntimeAdTarget & { custom?: boolean; note?: string }

  const router = useRouter()

  const selectedProjectIds = ref<string[]>([])
  const viewMode = ref<'card' | 'list'>('card')
  const keyword = ref('')
  const regionFilter = ref('')
  const stateFilter = ref('')
  const hideFinished = ref(false)
  const hiddenIds = reactive(new Set<string>())
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

  const projectFilterLabel = computed(() => {
    if (!selectedProjectIds.value.length) return '全部项目'
    return selectedProjectIds.value
      .map((id) => getProjectById(id)?.name)
      .filter(Boolean)
      .join('、')
  })

  const allTargets = computed<DisplayTarget[]>(() => [
    ...runtimeAdTargets.value,
    ...customCases.value
  ])

  function matchesProject(row: DisplayTarget) {
    if (!selectedProjectIds.value.length) return true
    if (row.projectId && selectedProjectIds.value.includes(row.projectId)) return true
    return matchesAnyProject(
      `${row.project} ${row.region} ${row.batch ?? ''} ${row.product ?? ''}`,
      selectedProjectIds.value
    )
  }

  const projectFilteredTargets = computed(() => allTargets.value.filter(matchesProject))

  const regions = computed(() => [
    ...new Set(allTargets.value.map((t) => t.region).filter(Boolean))
  ])

  function endOf(row: DisplayTarget) {
    if (row.deadline) return row.deadline
    return runtimeAdBatches.value.find((b) => b.batch === row.batch)?.lastDate ?? null
  }

  function stateOf(row: DisplayTarget) {
    if ((row.viewsRate ?? 0) >= 1 || row.finished) return 'hit'
    if (behindTimeProgress(row)) return 'behind'
    const end = endOf(row)
    if (end && end < DOJO_TODAY) return 'behind'
    return 'running'
  }

  function stateLabel(s: string) {
    return s === 'hit' ? '已达标' : s === 'behind' ? '落后' : '进行中'
  }

  function stateTagType(s: string) {
    return s === 'hit' ? 'success' : s === 'behind' ? 'danger' : 'primary'
  }

  /** 播放进度比项目的时间进度落后 30 个百分点以上 */
  function behindTimeProgress(row: DisplayTarget) {
    const runtime = row.projectId ? dojoProjectRuntime[row.projectId] : null
    if (!runtime) return false
    const elapsed = timeProgress(runtime.kpi)
    return Math.round((row.viewsRate ?? 0) * 100) < elapsed - 30
  }

  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return projectFilteredTargets.value.filter((t) => {
      if (hiddenIds.has(t.id)) return false
      if (hideFinished.value && stateOf(t) === 'hit') return false
      if (regionFilter.value && t.region !== regionFilter.value) return false
      if (stateFilter.value && stateOf(t) !== stateFilter.value) return false
      if (kw && !`${t.project} ${t.region} ${t.product} ${t.note ?? ''}`.toLowerCase().includes(kw))
        return false
      return true
    })
  })

  /** 买量账号跟着上方筛选一起收窄 */
  const accountRows = computed(() => {
    const batches = new Set(rows.value.map((r) => r.batch).filter(Boolean))
    if (!batches.size) return []
    return runtimeAdAccounts.value.filter((a) => a.batches.some((b) => batches.has(b)))
  })

  const totals = computed(() => {
    const target = projectFilteredTargets.value.reduce((n, t) => n + (t.targetViews || 0), 0)
    const current = projectFilteredTargets.value.reduce((n, t) => n + (t.currentViews || 0), 0)
    return { target, current, rate: target ? current / target : 0 }
  })

  const alerts = computed(() => {
    const out: Array<{ id: string; row: DisplayTarget; level: 'high' | 'mid'; reason: string }> = []
    for (const row of projectFilteredTargets.value) {
      if (hiddenIds.has(row.id)) continue
      if (row.finished || (row.viewsRate ?? 0) >= 1) continue
      const rate = row.viewsRate ?? 0
      const gap = row.remainingViews != null ? Math.max(0, row.remainingViews) : null
      const end = endOf(row)
      if (end && end < DOJO_TODAY) {
        const when = row.deadline ? `已过截止日 ${end}` : `最后一次投放停在 ${end}`
        out.push({
          id: row.id,
          row,
          level: 'high',
          reason: `${when}，只完成 ${pctText(rate)}${gap ? `，还差 ${fmt(gap)} 播放` : ''}`
        })
      } else if (behindTimeProgress(row)) {
        const runtime = dojoProjectRuntime[row.projectId]
        out.push({
          id: row.id,
          row,
          level: 'mid',
          reason: `时间已过 ${timeProgress(runtime.kpi)}%，播放仅 ${pctText(rate)}`
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
    return runtimeAdBatches.value.find((b) => b.batch === batch)?.videoCount ?? 0
  }

  function openVideos(row: DisplayTarget) {
    router.push({ path: '/ads/videos', query: { batch: row.batch || '' } })
  }

  function hide(row: DisplayTarget) {
    hiddenIds.add(row.id)
    ElMessage.info('已隐藏，后续监看不再计入')
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
      projectId: '',
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
      updatedAt: DOJO_TODAY,
      updatedAtText: DOJO_TODAY,
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

  .panel__sub {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .filter-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .target-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }

  .target-card {
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-left: 3px solid var(--el-border-color);
    border-radius: 10px;
    background: var(--el-bg-color);

    &.hit {
      border-left-color: #22c55e;
    }

    &.behind {
      border-left-color: #ef4444;
    }

    &.running {
      border-left-color: #4a90d9;
    }

    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    &__name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
    }

    &__meta {
      margin: 6px 0 10px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      margin: 12px 0 0;

      dt {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 2px 0 0;
        font-size: 14px;
        font-weight: 600;
      }
    }

    &__ops {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }

  .account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .account-card {
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);

    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }

    &__kv {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin: 0;

      dt {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 2px 0 0;
        font-size: 14px;
        font-weight: 600;
      }
    }

    &__range {
      margin: 10px 0 6px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .empty {
    grid-column: 1 / -1;
    padding: 28px;
    text-align: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
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
