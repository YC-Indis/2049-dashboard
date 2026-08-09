<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>脚本进度</h1>
        <p v-if="totalScripts" class="head-meta">{{ totalScripts }} 条内容方向</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
        <ElButton type="primary" @click="openPlanDialog">添加脚本计划</ElButton>
      </div>
    </header>

    <div class="filter-row">
      <span class="filter-label">脚本区间</span>
      <ElDatePicker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始"
        end-placeholder="结束"
        unlink-panels
        teleported
        class="filter-row__picker"
      />
      <span class="filter-row__hint">
        以周为粒度浏览；可选年月区间筛选 · {{ rows.length }} 条脚本
      </span>
    </div>

    <section class="panel">
      <div class="panel__title">
        {{ panelTitle }}
      </div>
      <ElTable v-if="rows.length" :data="rows" stripe>
        <ElTableColumn prop="seq" label="序号" width="70" />
        <ElTableColumn prop="category" label="类别 / 细分" width="140" show-overflow-tooltip />
        <ElTableColumn prop="title" label="内容方向" min-width="170" show-overflow-tooltip />
        <ElTableColumn label="参考" width="70">
          <template #default="{ row }">
            <a v-if="row.refLink" :href="row.refLink.split(' ')[0]" target="_blank" rel="noopener">
              打开
            </a>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="shootReq" label="拍摄要求" min-width="240" show-overflow-tooltip />
        <ElTableColumn prop="note" label="注意事项" min-width="180" show-overflow-tooltip />
      </ElTable>
      <p v-else class="empty">当前项目暂无脚本数据，可切换项目或添加脚本计划。</p>
    </section>

    <section class="panel">
      <div class="panel__title">脚本计划（已同步中控）</div>
      <ElTable :data="currentPlans" stripe empty-text="暂无脚本计划">
        <ElTableColumn prop="date" label="日期" width="120" />
        <ElTableColumn prop="account" label="账号" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="script" label="脚本" min-width="200" show-overflow-tooltip />
        <ElTableColumn prop="note" label="备注" min-width="160" show-overflow-tooltip />
        <ElTableColumn label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <ElButton type="danger" link @click="removePlan(row.id)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog v-model="planDialogVisible" title="添加脚本计划" width="560px" align-center destroy-on-close>
      <ElForm ref="planFormRef" :model="planForm" :rules="planRules" label-width="88px">
        <ElFormItem label="日期" prop="date">
          <ElDatePicker
            v-model="planForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem v-if="derivedWeekLabel" label="周次">
          <span class="muted">{{ derivedWeekLabel }}</span>
        </ElFormItem>
        <ElFormItem label="账号" prop="account">
          <ElSelect
            v-model="planForm.account"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入账号"
            style="width: 100%"
          >
            <ElOption v-for="a in accountOptions" :key="a" :label="a" :value="a" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="脚本方向" prop="script">
          <ElInput
            v-model="planForm.script"
            type="textarea"
            :rows="3"
            placeholder="脚本标题 / 内容方向"
          />
        </ElFormItem>
        <ElFormItem label="备注" prop="note">
          <ElInput v-model="planForm.note" type="textarea" :rows="2" placeholder="可选备注" />
        </ElFormItem>
        <ElFormItem>
          <ElButton plain @click="showAiPanel = !showAiPanel">AI 辅助录入</ElButton>
        </ElFormItem>
        <div v-if="showAiPanel" class="ai-panel">
          <p class="ai-panel__hint">粘贴账号链接、日期与说明，AI 解析后填充表单或批量追加计划。</p>
          <ElInput
            v-model="aiRawText"
            type="textarea"
            :rows="5"
            placeholder="例：@justdojoit 2/15 开箱脚本；@other 2026-02-20 日常 vlog"
          />
          <ElButton type="primary" :loading="aiParsing" @click="runAiParse">解析</ElButton>
        </div>
      </ElForm>
      <template #footer>
        <ElButton @click="planDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitPlan">提交</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { aiParseStructured } from '@/api/llm'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { scriptProgressRows, type ScriptProgressRow } from '@/mock/dojo/flowData'
  import { accountPlans } from '@/mock/dojo/imported'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import { buildWeekOptions, deriveWeekLabel } from '@/utils/dojoWeeks'
  import { dojoScheduleStore, setFocusRange, clearFocusRange } from '@/store/dojoScheduleStore'

  defineOptions({ name: 'DojoScripts' })

  interface ScriptPlan {
    id: string
    week?: string
    date: string
    account: string
    script: string
    note: string
  }

  interface AiPlanRow {
    date: string
    account: string
    script: string
    note?: string
  }

  const selectedProjectIds = ref<string[]>(
    dojoProjectStore.selectedIds.length ? [...dojoProjectStore.selectedIds] : ['dojo']
  )
  const planProjectId = computed(() => selectedProjectIds.value[0] || 'dojo')
  const dateRange = ref<[string, string] | null>(
    dojoScheduleStore.focusRange
      ? [dojoScheduleStore.focusRange.start, dojoScheduleStore.focusRange.end]
      : null
  )
  const planDialogVisible = ref(false)
  const planFormRef = ref<FormInstance>()
  const showAiPanel = ref(false)
  const aiRawText = ref('')
  const aiParsing = ref(false)

  const projects = computed(() => dojoProjectStore.projects.filter((p) => p.active !== false))

  const projectScripts = reactive<Record<string, ScriptProgressRow[]>>({
    dojo: [...scriptProgressRows]
  })

  const projectPlans = reactive<Record<string, ScriptPlan[]>>({
    dojo: []
  })

  const planForm = reactive({
    date: '',
    account: '',
    script: '',
    note: ''
  })

  const planRules: FormRules = {
    date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    account: [{ required: true, message: '请选择或输入账号', trigger: 'blur' }],
    script: [{ required: true, message: '请填写脚本方向', trigger: 'blur' }]
  }

  const currentScriptRows = computed(() => {
    const ids = selectedProjectIds.value.length ? selectedProjectIds.value : ['dojo']
    return ids.flatMap((id) => {
      if (!projectScripts[id]) projectScripts[id] = id === 'dojo' ? [...scriptProgressRows] : []
      return projectScripts[id] ?? []
    })
  })

  const weekKeys = computed(() => {
    const keys = new Set<string>()
    for (const r of currentScriptRows.value) {
      if (r.week) keys.add(r.week)
    }
    return [...keys]
  })

  const weekMeta = computed(() =>
    buildWeekOptions(weekKeys.value, (key) =>
      currentScriptRows.value.filter((r) => r.week === key).length
    )
  )

  const totalScripts = computed(() => currentScriptRows.value.length)

  const rows = computed(() => {
    if (!dateRange.value) return currentScriptRows.value
    const [start, end] = dateRange.value
    const ranges = new Map(weekMeta.value.map((w) => [w.key, w]))
    return currentScriptRows.value.filter((r) => {
      if (!r.week) return true
      const meta = ranges.get(r.week)
      if (!meta) return true
      return meta.start <= end && meta.end >= start
    })
  })

  const panelTitle = computed(() => {
    if (dateRange.value) {
      return `${dateRange.value[0]} → ${dateRange.value[1]}`
    }
    return '全部脚本'
  })

  const currentPlans = computed(() => {
    const ids = selectedProjectIds.value.length ? selectedProjectIds.value : ['dojo']
    return ids.flatMap((id) => projectPlans[id] ?? [])
  })

  const derivedWeekLabel = computed(() => deriveWeekLabel(planForm.date, weekKeys.value))

  watch(dateRange, (v) => {
    if (v?.[0] && v[1]) setFocusRange(v[0], v[1])
    else clearFocusRange()
  })

  function appendPlan(row: Omit<ScriptPlan, 'id'>) {
    const pid = planProjectId.value
    if (!projectPlans[pid]) projectPlans[pid] = []
    projectPlans[pid].push({
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...row
    })
  }

  const accountOptions = computed(() => {
    const handles = new Set<string>()
    for (const plan of accountPlans) {
      for (const acc of plan.accounts) {
        const raw = acc.link || acc.name
        const m = raw.match(/@([\w.]+)/)
        handles.add(m ? `@${m[1]}` : raw.trim())
      }
    }
    return [...handles].filter(Boolean).sort()
  })

  function openPlanDialog() {
    planForm.date = ''
    planForm.account = ''
    planForm.script = ''
    planForm.note = ''
    showAiPanel.value = false
    aiRawText.value = ''
    planDialogVisible.value = true
  }

  async function runAiParse() {
    const raw = aiRawText.value.trim()
    if (!raw) {
      ElMessage.warning('请先粘贴账号链接、日期或说明')
      return
    }

    aiParsing.value = true
    try {
      const result = await aiParseStructured<AiPlanRow[]>(
        '将输入解析为脚本计划数组。date 用 YYYY-MM-DD；account 为 @handle 或链接；script 为脚本方向；note 可选。',
        raw,
        '[{"date":"2026-02-15","account":"@handle","script":"内容方向","note":""}]'
      )

      if (!result.ok) {
        ElMessage.error('AI 解析失败，请检查粘贴内容后重试')
        return
      }

      const parsed = (Array.isArray(result.data) ? result.data : [result.data]).filter(
        (r) => r?.date && r?.account && r?.script
      )

      if (!parsed.length) {
        ElMessage.warning('未解析出有效计划，请补充日期、账号与脚本方向')
        return
      }

      if (parsed.length === 1) {
        const row = parsed[0]
        planForm.date = row.date
        planForm.account = row.account
        planForm.script = row.script
        planForm.note = row.note ?? ''
        ElMessage.success('已填充表单，请确认后提交')
        return
      }

      for (const row of parsed) {
        appendPlan({
          week: deriveWeekLabel(row.date, weekKeys.value) || undefined,
          date: row.date,
          account: row.account,
          script: row.script,
          note: row.note ?? ''
        })
      }
      planDialogVisible.value = false
      ElMessage.success(`已批量添加 ${parsed.length} 条脚本计划`)
    } finally {
      aiParsing.value = false
    }
  }

  async function submitPlan() {
    const valid = await planFormRef.value?.validate().catch(() => false)
    if (!valid) return

    const weekLabel = deriveWeekLabel(planForm.date, weekKeys.value)
    appendPlan({
      week: weekLabel || undefined,
      date: planForm.date,
      account: planForm.account,
      script: planForm.script,
      note: planForm.note
    })

    planDialogVisible.value = false
    ElMessage.success('脚本计划已添加并同步中控')
  }

  function removePlan(id: string) {
    for (const list of Object.values(projectPlans)) {
      const idx = list.findIndex((p) => p.id === id)
      if (idx >= 0) {
        list.splice(idx, 1)
        ElMessage.success('已删除脚本计划')
        return
      }
    }
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .head-meta {
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    &__hint {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .filter-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  .filter-row__picker {
    flex: 0 0 280px;
    width: 280px !important;
    max-width: 280px;
  }

  .muted {
    color: var(--el-text-color-secondary);
  }

  .ai-panel {
    width: 100%;
    padding: 12px;
    border: 1px dashed var(--el-border-color);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);

    &__hint {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .el-button {
      margin-top: 8px;
    }
  }
</style>
