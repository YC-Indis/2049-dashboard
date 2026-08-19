<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>分发数据</h1>
        <p>共 {{ all.length }} 条分发记录</p>
      </div>
      <div class="head-ops">
        <ElButton type="primary" plain @click="openCreate">新增</ElButton>
        <ElButton type="primary" plain @click="openAiImport">AI 导入</ElButton>
        <ElButton type="primary" :loading="syncing" @click="syncRecent">
          同步本页指标
        </ElButton>
      </div>
    </header>

    <section class="panel filters">
      <ElSelect v-model="account" placeholder="全部账号" clearable filterable style="width: 260px">
        <ElOption v-for="a in accountOptions" :key="a" :label="a" :value="a" />
      </ElSelect>
      <ElSelect v-model="flowType" placeholder="全部流量类型" clearable style="width: 160px">
        <ElOption v-for="f in flowOptions" :key="f" :label="f" :value="f" />
      </ElSelect>
      <div class="filter-group">
        <span class="filter-label">播放量</span>
        <ElInputNumber v-model="paidViewsMin" :min="0" :controls="false" placeholder="最小" style="width: 100px" />
        <span class="filter-sep">—</span>
        <ElInputNumber v-model="paidViewsMax" :min="0" :controls="false" placeholder="最大" style="width: 100px" />
      </div>
      <div class="filter-group">
        <span class="filter-label">互动率</span>
        <ElInputNumber
          v-model="engagementMin"
          :min="0"
          :max="1"
          :step="0.01"
          :precision="4"
          :controls="false"
          placeholder="最小"
          style="width: 100px"
        />
        <span class="filter-sep">—</span>
        <ElInputNumber
          v-model="engagementMax"
          :min="0"
          :max="1"
          :step="0.01"
          :precision="4"
          :controls="false"
          placeholder="最大"
          style="width: 100px"
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">分发日期</span>
        <ElDatePicker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          unlink-panels
          style="width: 260px"
          @change="onDateRangeChange"
        />
      </div>
      <span class="count">筛选出 {{ filtered.length }} 条</span>
    </section>

    <section class="panel">
      <ElTable :data="paged" stripe>
        <ElTableColumn prop="account" label="账号链接" min-width="170" show-overflow-tooltip />
        <ElTableColumn label="分发日期" width="110">
          <template #default="{ row }">{{ formatDateDisplay(row.publishDate) }}</template>
        </ElTableColumn>
        <ElTableColumn label="视频链接" width="80">
          <template #default="{ row }">
            <a v-if="row.videoUrl" :href="row.videoUrl" target="_blank" rel="noopener">打开</a>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="投流前自然流" width="120" align="right">
          <template #default="{ row }">{{ fmtNum(row.naturalViews) }}</template>
        </ElTableColumn>
        <ElTableColumn label="投放播放量" width="110" align="right">
          <template #default="{ row }">{{ fmtNum(row.paidViews) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="adCompleteTime" label="投放完成时间" width="120" />
        <ElTableColumn label="互动率" width="90" align="right">
          <template #default="{ row }">{{ fmtPct(row.engagementRate) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="note" label="备注" min-width="130" show-overflow-tooltip />
        <ElTableColumn label="流量类型" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ displayFlowType(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="openEdit(row)">编辑</ElButton>
            <ElButton type="danger" link @click="removeRow(row.id)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElPagination
        v-model:current-page="page"
        :page-size="20"
        :total="filtered.length"
        layout="total, prev, pager, next"
        class="pager"
      />
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增分发记录' : '编辑分发记录'"
      width="560px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <ElFormItem label="账号" prop="account">
          <ElInput v-model="form.account" placeholder="账号链接或 @handle" />
        </ElFormItem>
        <ElFormItem label="分发日期" prop="publishDate">
          <ElInput v-model="form.publishDate" placeholder="如 2026-02-15" />
        </ElFormItem>
        <ElFormItem label="视频链接" prop="videoUrl">
          <ElInput v-model="form.videoUrl" placeholder="https://..." />
        </ElFormItem>
        <ElFormItem label="投流前自然流" prop="naturalViews">
          <ElInputNumber v-model="form.naturalViews" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="投放播放量" prop="paidViews">
          <ElInputNumber v-model="form.paidViews" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="投放完成时间" prop="adCompleteTime">
          <ElInput v-model="form.adCompleteTime" placeholder="如 2026-02-20 或 投放中" />
        </ElFormItem>
        <ElFormItem label="互动率" prop="engagementRate">
          <ElInputNumber
            v-model="form.engagementRate"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="4"
            :controls="false"
            style="width: 100%"
            placeholder="0–1 小数，如 0.052"
          />
        </ElFormItem>
        <ElFormItem label="流量类型" prop="flowType">
          <ElSelect v-model="form.flowType" filterable placeholder="选择流量类型" style="width: 100%">
            <ElOption v-for="f in flowFormOptions" :key="f" :label="f" :value="f" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="备注" prop="note">
          <ElInput v-model="form.note" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="aiDialogVisible" title="AI 导入分发数据" width="720px" align-center destroy-on-close>
      <p class="ai-hint">
        程序负责增删改查与表格渲染；AI 负责粘贴 / 文件解析与字段补全。确认后将追加到列表。
      </p>
      <ElInput
        v-model="aiRawText"
        type="textarea"
        :rows="8"
        placeholder="粘贴 Excel 表格、CSV，或输入「帮我录入这些账号…」"
      />
      <div class="ai-file">
        <input ref="fileInputRef" type="file" accept=".csv,.txt,.tsv" @change="onAiFile" />
        <span class="muted">支持 .csv / .txt / .tsv</span>
      </div>
      <ElButton type="primary" :loading="aiParsing" @click="runAiImport">解析预览</ElButton>

      <ElTable v-if="aiPreview.length" :data="aiPreview" stripe size="small" class="ai-preview">
        <ElTableColumn prop="account" label="账号" min-width="120" show-overflow-tooltip />
        <ElTableColumn prop="publishDate" label="分发日期" width="100" />
        <ElTableColumn prop="flowType" label="流量类型" width="100">
          <template #default="{ row }">{{ displayFlowType(row) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="paidViews" label="投放播放量" width="100" align="right" />
        <ElTableColumn prop="note" label="备注" min-width="100" show-overflow-tooltip />
      </ElTable>

      <template #footer>
        <ElButton @click="aiDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :disabled="!aiPreview.length" @click="confirmAiImport">
          确认追加 {{ aiPreview.length ? aiPreview.length : '' }} 条
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { aiParseStructured } from '@/api/llm'
  import { distributionProgressRows, type DistributionProgressRow } from '@/mock/dojo/flowData'
  import { syncVideoMetrics } from '@/api/tiktok'
  import { clearFocusRange, dojoScheduleStore, setFocusRange } from '@/store/dojoScheduleStore'
  import { formatDateDisplay, normalizeDateString } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoDistribution' })

  type DialogMode = 'create' | 'edit'

  const UNDETERMINED = '未确定'
  const flowFormOptions = ['自然流', '投流', '纯自然流', '自然流+投流', UNDETERMINED]

  function seedFlowType(r: DistributionProgressRow) {
    return normalizeFlowType(r.flowType, r.note)
  }

  const all = ref<DistributionProgressRow[]>(
    distributionProgressRows.map((r) => ({
      ...r,
      publishDate: normalizeDateString(r.publishDate) || r.publishDate,
      flowType: seedFlowType(r)
    }))
  )
  const account = ref('')
  const flowType = ref('')
  const paidViewsMin = ref<number | null>(null)
  const paidViewsMax = ref<number | null>(null)
  const engagementMin = ref<number | null>(null)
  const engagementMax = ref<number | null>(null)
  const dateRange = ref<[string, string] | null>(
    dojoScheduleStore.focusRange
      ? [dojoScheduleStore.focusRange.start, dojoScheduleStore.focusRange.end]
      : null
  )
  const page = ref(1)
  const syncing = ref(false)
  const dialogVisible = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const editingId = ref<string | null>(null)
  const formRef = ref<FormInstance>()

  const aiDialogVisible = ref(false)
  const aiRawText = ref('')
  const aiParsing = ref(false)
  const aiPreview = ref<DistributionProgressRow[]>([])
  const fileInputRef = ref<HTMLInputElement>()

  const emptyForm = () => ({
    account: '',
    publishDate: '',
    videoUrl: '',
    naturalViews: null as number | null,
    paidViews: 0,
    adCompleteTime: '',
    engagementRate: null as number | null,
    note: '',
    flowType: UNDETERMINED
  })

  const form = reactive(emptyForm())

  const formRules: FormRules = {
    account: [{ required: true, message: '请填写账号', trigger: 'blur' }],
    publishDate: [{ required: true, message: '请填写分发日期', trigger: 'blur' }],
    flowType: [{ required: true, message: '请选择流量类型', trigger: 'change' }]
  }

  function isDashOnly(v: string) {
    return /^[-—–_\s]+$/.test(v)
  }

  /** 流量类型：保留「自然流+投流」等真实类目；「投放中」是状态不是类型 */
  function normalizeFlowType(raw: string, note = ''): string {
    const blob = `${raw || ''} ${note || ''}`.trim()
    if (!blob || isDashOnly(blob)) return UNDETERMINED
    if (/自然流\s*\+\s*投流/.test(blob)) return '自然流+投流'
    if (/纯自然流/.test(blob)) return '纯自然流'
    if (/自然流/.test(blob) && !/投流/.test(blob) && !/纯自然流/.test(blob)) return '自然流'
    if (/^投流$/.test((raw || '').trim())) return '投流'
    if (/自然流/.test(blob) && /投流/.test(blob)) return '自然流+投流'
    // 投放中 / 暂未开始 是状态，不能盖掉备注里的类型
    if (/投放中|暂未开始/.test(raw || '') && !/自然流|投流/.test(raw || '')) {
      if (/自然流\s*\+\s*投流/.test(note)) return '自然流+投流'
      if (/纯自然流/.test(note)) return '纯自然流'
      return UNDETERMINED
    }
    if (flowFormOptions.includes(raw)) return raw
    return UNDETERMINED
  }

  function displayFlowType(row: DistributionProgressRow | string) {
    if (typeof row === 'string') return normalizeFlowType(row)
    return normalizeFlowType(row.flowType, row.note)
  }

  const accountOptions = computed(() => [...new Set(all.value.map((r) => r.account))])

  const flowOptions = computed(() => {
    const set = new Set(all.value.map((r) => displayFlowType(r)))
    for (const f of flowFormOptions) set.add(f)
    return [...set].sort()
  })

  function onDateRangeChange(v: [string, string] | null) {
    if (v?.[0] && v[1]) setFocusRange(v[0], v[1])
    else clearFocusRange()
  }

  function inRange(val: number | null | undefined, min: number | null, max: number | null) {
    if (val == null) return min == null && max == null
    if (min != null && val < min) return false
    if (max != null && val > max) return false
    return true
  }

  const filtered = computed(() =>
    all.value.filter((r) => {
      if (account.value && r.account !== account.value) return false
      if (flowType.value && displayFlowType(r) !== flowType.value) return false
      if (!inRange(r.paidViews, paidViewsMin.value, paidViewsMax.value)) return false
      if (!inRange(r.engagementRate, engagementMin.value, engagementMax.value)) return false
      if (dateRange.value) {
        const [start, end] = dateRange.value
        const pub = normalizeDateString(r.publishDate) || r.publishDate
        if (pub < start || pub > end) return false
      }
      return true
    })
  )

  const paged = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20))

  watch(
    [account, flowType, paidViewsMin, paidViewsMax, engagementMin, engagementMax, dateRange],
    () => {
      page.value = 1
    }
  )

  function fmtNum(n?: number | null) {
    return n != null ? n.toLocaleString() : '—'
  }

  function fmtPct(n?: number | null, digits = 2) {
    return n != null ? `${(n * 100).toFixed(digits)}%` : '—'
  }

  function resetForm() {
    Object.assign(form, emptyForm())
    editingId.value = null
  }

  function openCreate() {
    dialogMode.value = 'create'
    resetForm()
    dialogVisible.value = true
  }

  function openEdit(row: DistributionProgressRow) {
    dialogMode.value = 'edit'
    editingId.value = row.id
    Object.assign(form, {
      account: row.account,
      publishDate: row.publishDate,
      videoUrl: row.videoUrl,
      naturalViews: row.naturalViews ?? null,
      paidViews: row.paidViews,
      adCompleteTime: row.adCompleteTime,
      engagementRate: row.engagementRate ?? null,
      note: row.note,
      flowType: normalizeFlowType(row.flowType, row.note)
    })
    dialogVisible.value = true
  }

  function buildRowFromForm(id?: string): DistributionProgressRow {
    const flow = normalizeFlowType(form.flowType, form.note)
    return {
      id: id ?? `dist-${Date.now()}`,
      account: form.account,
      publishDate: form.publishDate,
      videoUrl: form.videoUrl,
      naturalViews: form.naturalViews,
      paidViews: form.paidViews ?? 0,
      adCompleteTime: form.adCompleteTime,
      engagementRate: form.engagementRate,
      note: form.note,
      flowType: flow,
      status: /投放中|暂未开始投放/.test(form.adCompleteTime || form.note) ? '投放中' : '已完成',
      syncSource: id ? (all.value.find((r) => r.id === id)?.syncSource ?? 'manual') : 'manual'
    }
  }

  async function submitForm() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const payload = buildRowFromForm(editingId.value ?? undefined)

    if (dialogMode.value === 'create') {
      all.value.unshift(payload)
      ElMessage.success('已新增分发记录')
    } else {
      const idx = all.value.findIndex((r) => r.id === editingId.value)
      if (idx >= 0) {
        all.value[idx] = payload
        ElMessage.success('已更新分发记录')
      }
    }

    dialogVisible.value = false
  }

  function removeRow(id: string) {
    const idx = all.value.findIndex((r) => r.id === id)
    if (idx >= 0) {
      all.value.splice(idx, 1)
      ElMessage.success('已删除分发记录')
    }
  }

  function openAiImport() {
    aiRawText.value = ''
    aiPreview.value = []
    aiDialogVisible.value = true
  }

  function onAiFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      aiRawText.value = String(reader.result ?? '')
      ElMessage.success(`已读取 ${file.name}`)
    }
    reader.readAsText(file)
    input.value = ''
  }

  interface AiDistRow {
    account: string
    publishDate: string
    videoUrl?: string
    naturalViews?: number | null
    paidViews?: number
    adCompleteTime?: string
    engagementRate?: number | null
    note?: string
    flowType?: string
  }

  function toDistRow(raw: AiDistRow, idx: number): DistributionProgressRow | null {
    if (!raw.account?.trim() || !raw.publishDate?.trim()) return null
    const flow = normalizeFlowType(raw.flowType ?? '')
    const adCompleteTime = raw.adCompleteTime ?? ''
    const note = raw.note ?? ''
    return {
      id: `dist-ai-${Date.now()}-${idx}`,
      account: raw.account.trim(),
      publishDate: raw.publishDate.trim(),
      videoUrl: raw.videoUrl ?? '',
      naturalViews: raw.naturalViews ?? null,
      paidViews: raw.paidViews ?? 0,
      adCompleteTime,
      engagementRate: raw.engagementRate ?? null,
      note,
      flowType: flow,
      status: /投放中|暂未开始投放/.test(adCompleteTime || note) ? '投放中' : '已完成',
      syncSource: 'manual'
    }
  }

  async function runAiImport() {
    const raw = aiRawText.value.trim()
    if (!raw) {
      ElMessage.warning('请先粘贴表格内容或选择文件')
      return
    }

    aiParsing.value = true
    try {
      const result = await aiParseStructured<AiDistRow[]>(
        '解析为分发数据行。字段：account、publishDate(YYYY-MM-DD)、videoUrl、naturalViews、paidViews、adCompleteTime、engagementRate(0-1)、note、flowType(自然流/投流/纯自然流/自然流+投流/未确定)。',
        raw,
        '[{"account":"@handle","publishDate":"2026-02-15","videoUrl":"","naturalViews":1000,"paidViews":0,"adCompleteTime":"","engagementRate":0.05,"note":"","flowType":"纯自然流"}]'
      )

      if (!result.ok) {
        ElMessage.error('AI 解析失败，请检查粘贴内容后重试')
        aiPreview.value = []
        return
      }

      const rows = (Array.isArray(result.data) ? result.data : [result.data])
        .map((r, i) => toDistRow(r, i))
        .filter((r): r is DistributionProgressRow => r != null)

      if (!rows.length) {
        ElMessage.warning('未解析出有效行，请补充账号与分发日期')
        aiPreview.value = []
        return
      }

      aiPreview.value = rows
      ElMessage.success(`已解析 ${rows.length} 条，请确认后追加`)
    } finally {
      aiParsing.value = false
    }
  }

  function confirmAiImport() {
    if (!aiPreview.value.length) return
    all.value.unshift(...aiPreview.value.map((r) => ({ ...r })))
    ElMessage.success(`已追加 ${aiPreview.value.length} 条分发记录`)
    aiDialogVisible.value = false
  }

  async function syncRecent() {
    syncing.value = true
    try {
      let ok = 0
      for (const row of paged.value) {
        if (!row.videoUrl) continue
        const m = await syncVideoMetrics(row.videoUrl)
        if (!m) continue
        row.paidViews = m.views ?? row.paidViews
        row.engagementRate = m.engagementRate ?? row.engagementRate
        row.syncSource = m.source
        ok++
      }
      ElMessage.success(`已同步 ${ok} 条视频指标`)
    } finally {
      syncing.value = false
    }
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .filter-sep {
    color: var(--el-text-color-secondary);
  }

  .count,
  .muted {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .pager {
    margin-top: 14px;
    justify-content: flex-end;
  }

  .ai-hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }

  .ai-file {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0 12px;
  }

  .ai-preview {
    margin-top: 14px;
  }
</style>
