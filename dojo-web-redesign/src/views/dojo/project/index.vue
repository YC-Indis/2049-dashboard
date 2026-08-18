<template>
  <div class="dojo-page project-overview">
    <header class="dojo-page__head">
      <div>
        <h1>项目管理</h1>
        <p
          >创建项目并持续校准 KPI
          与当前进度；这里的数据会同步进入时间规划、执行日历和运营驾驶舱。</p
        >
      </div>
      <div class="head-ops">
        <ElButton v-if="endedVisibleCount" plain @click="hideAllEnded">
          隐藏已结束（{{ endedVisibleCount }}）
        </ElButton>
        <ElButton @click="refreshAllMetrics" :loading="refreshing">刷新现状</ElButton>
        <ElButton @click="importVisible = true">AI 导入</ElButton>
        <ElButton type="primary" @click="openCreate">新建项目</ElButton>
      </div>
    </header>

    <p v-if="!cards.length && !hiddenCards.length" class="empty-state">
      暂无项目。点右上角「新建项目」手填，或「AI 导入」粘贴 brief。
    </p>
    <p v-else-if="!cards.length && hiddenCards.length" class="empty-state">
      可见项目已全部隐藏。可在下方「已隐藏项目」中恢复。
    </p>

    <article
      v-for="card in cards"
      :key="card.project.id"
      class="project-card"
      :class="{ 'is-editing': editingId === card.project.id }"
    >
      <header class="project-card__head">
        <div class="project-card__title">
          <template v-if="editingId === card.project.id">
            <ElInput v-model="draft.name" size="large" class="inline-name" />
            <div class="inline-meta">
              <ElInput v-model="draft.brand" size="small" placeholder="品牌" style="width: 120px" />
              <ElInput
                v-model="draft.region"
                size="small"
                placeholder="地区"
                style="width: 100px"
              />
              <ElSelect v-model="draft.priority" size="small" style="width: 88px">
                <ElOption label="高" value="high" />
                <ElOption label="中" value="medium" />
                <ElOption label="低" value="low" />
              </ElSelect>
            </div>
          </template>
          <template v-else>
            <h2>{{ card.project.name }}</h2>
            <p>
              品牌 {{ card.runtime.brand || '—' }} · {{ cycleLabel(card.runtime.kpi) }}
              <span v-if="card.project.region && card.project.region !== '—'">
                · {{ card.project.region }}
              </span>
            </p>
            <dl class="project-people">
              <div>
                <dt>负责人</dt>
                <dd>{{ card.runtime.owner || '未设置' }}</dd>
              </div>
              <div>
                <dt>客户对接</dt>
                <dd>{{ card.runtime.clientContact || '未设置' }}</dd>
              </div>
            </dl>
          </template>
        </div>
        <div class="project-card__tags">
          <ElTag size="small" type="primary">{{ card.runtime.runStatus }}</ElTag>
          <ElTag v-if="editingId !== card.project.id" size="small" effect="plain">
            优先级: {{ priorityLabel(card.runtime.priority) }}
          </ElTag>
          <template v-if="editingId === card.project.id">
            <ElButton size="small" type="primary" @click="saveInline(card.project.id)">
              完成
            </ElButton>
            <ElButton size="small" @click="cancelInline">取消</ElButton>
          </template>
          <template v-else>
            <ProjectQuickControls
              :project="card.project"
              :runtime="card.runtime"
              :refreshing="refreshingId === card.project.id"
              @edit="startInline"
              @duplicate="duplicateCard"
              @sync="syncToCalendar"
              @refresh="refreshOne"
              @hide="hideCard"
              @remove="removeCard"
            />
          </template>
        </div>
      </header>

      <section
        v-if="card.execution"
        class="project-execution"
        :class="`is-${card.execution.timing}`"
        aria-label="当前执行重点"
      >
        <button
          type="button"
          class="project-execution__phase"
          @click="openProjectExecution(card.project.id)"
        >
          <span>{{ card.execution.phaseLabel.slice(0, 1) }}</span>
          <span>
            <small>当前执行</small>
            <strong>{{ card.execution.phaseLabel }} · {{ card.execution.timingLabel }}</strong>
            <em>{{ card.execution.scheduleLabel }}</em>
          </span>
        </button>

        <dl>
          <div>
            <dt>阶段动作</dt>
            <dd>{{ card.execution.actions.join(' · ') }}</dd>
          </div>
          <div>
            <dt>重点监看</dt>
            <dd>{{ card.execution.monitorSummary }}</dd>
            <span>{{ card.execution.monitors.join(' / ') }}</span>
          </div>
          <div class="project-execution__kpi">
            <dt>对齐 KPI</dt>
            <dd>{{ card.execution.kpiLabel }} {{ card.execution.kpiText }}</dd>
            <span><i :style="{ width: `${card.execution.progressPct}%` }" /></span>
          </div>
        </dl>

        <button
          type="button"
          class="project-execution__open"
          aria-label="打开项目时间规划"
          @click="openProjectExecution(card.project.id)"
        >
          <Icon icon="ph:arrow-up-right" width="16" />
        </button>
      </section>

      <!-- 进度：只读，跟 KPI/现状自动算 -->
      <div class="metric-grid">
        <div class="metric-grid__row">
          <span class="metric-grid__label">进度</span>
          <div
            v-for="cell in card.progress"
            :key="`p-${cell.label}`"
            class="metric-grid__cell"
            :title="cell.tip"
          >
            <strong>{{ cell.value }}%</strong>
            <span>{{ cell.label }}</span>
          </div>
        </div>

        <!-- KPI：编辑态可直接改 -->
        <div class="metric-grid__row" :class="{ 'is-live': editingId === card.project.id }">
          <span class="metric-grid__label">KPI</span>
          <template v-if="editingId === card.project.id">
            <div class="metric-grid__cell is-input">
              <ElDatePicker
                v-model="draft.cycle"
                type="daterange"
                size="small"
                value-format="YYYY-MM-DD"
                start-placeholder="起"
                end-placeholder="止"
                style="width: 100%"
              />
              <span>周期</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.accounts"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>账号数</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.scriptTarget"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>脚本目标</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.videos"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>成片目标</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.videos"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>过审目标</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.videos"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>视频目标</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.exposure"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>播放目标</span>
            </div>
          </template>
          <template v-else>
            <div
              v-for="cell in card.kpi"
              :key="`k-${cell.label}`"
              class="metric-grid__cell"
              :class="{ 'is-cycle': cell.label === '周期' }"
              :title="cell.tip"
            >
              <strong>{{ cell.text ?? formatNum(cell.value) }}</strong>
              <span>{{ cell.label }}</span>
              <div v-if="cell.label === '周期'" class="cycle-progress" aria-label="KPI 周期进度">
                <i :style="{ width: `${timeProgress(card.runtime.kpi)}%` }" />
              </div>
            </div>
          </template>
        </div>

        <!-- 现状：脚本/成片/过审可手改；账号/已发视频/播放量与账号矩阵、视频监控同源 -->
        <div class="metric-grid__row" :class="{ 'is-live': editingId === card.project.id }">
          <span class="metric-grid__label">现状</span>
          <template v-if="editingId === card.project.id">
            <div class="metric-grid__cell">
              <strong>{{ formatMonthDay(DOJO_TODAY) }}</strong>
              <span>当前日期</span>
            </div>
            <div class="metric-grid__cell is-input" title="来自账号导入，可手改临时覆盖">
              <ElInputNumber
                v-model="draft.curAccounts"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>账号数</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.curScripts"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>脚本产出</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.curEdited"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>成片数</span>
            </div>
            <div class="metric-grid__cell is-input">
              <ElInputNumber
                v-model="draft.curApproved"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>过审数</span>
            </div>
            <div class="metric-grid__cell is-input" title="与视频监控条数同源，可手改临时覆盖">
              <ElInputNumber
                v-model="draft.curDistributed"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>已发视频</span>
            </div>
            <div class="metric-grid__cell is-input" title="与视频监控播放合计同源，可手改临时覆盖">
              <ElInputNumber
                v-model="draft.curExposure"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
              />
              <span>播放量</span>
            </div>
          </template>
          <template v-else>
            <div
              v-for="cell in card.current"
              :key="`c-${cell.label}`"
              class="metric-grid__cell"
              :class="{ 'is-editable': currentField(cell.label) }"
              :title="cell.tip"
              @dblclick="startCurrentEdit(card.project.id, cell.label, cell.value)"
            >
              <ElInputNumber
                v-if="
                  editingCurrent?.projectId === card.project.id &&
                  editingCurrent.field === currentField(cell.label)
                "
                v-model="editingCurrent.value"
                :min="0"
                :controls="false"
                size="small"
                class="cell-num"
                autofocus
                @blur="saveCurrentEdit"
                @keyup.enter="saveCurrentEdit"
              />
              <strong v-else>{{ cell.text ?? formatNum(cell.value) }}</strong>
              <span>{{ cell.label }}</span>
            </div>
          </template>
        </div>
      </div>

      <p v-if="editingId === card.project.id" class="edit-hint">
        改完点「完成」保存。账号数 ← 账号矩阵；已发视频 / 播放量 ← 视频监控同步数据（可用「拉现状」重算）。
      </p>
    </article>

    <section v-if="hiddenCards.length" class="hidden-panel">
      <div class="hidden-panel__head">
        <strong>已隐藏项目（{{ hiddenCards.length }}）</strong>
        <span class="muted">隐藏后不出现在今日待办；可随时恢复</span>
      </div>
      <ul class="hidden-list">
        <li v-for="card in hiddenCards" :key="card.project.id">
          <div>
            <strong>{{ card.project.name }}</strong>
            <span class="muted">
              {{ card.runtime.runStatus }} · {{ cycleLabel(card.runtime.kpi) }}
            </span>
          </div>
          <ElButton size="small" type="primary" plain @click="restoreCard(card.project.id)">
            恢复显示
          </ElButton>
        </li>
      </ul>
    </section>

    <!-- 仅新建用弹窗 -->
    <ElDialog
      v-model="dialogVisible"
      title="新建项目"
      width="560px"
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="110px">
        <ElFormItem label="项目名称" prop="name">
          <ElInput v-model="form.name" placeholder="例：xros6 英国2.0" />
        </ElFormItem>
        <ElFormItem label="品牌">
          <ElInput v-model="form.brand" placeholder="如 smoore" />
        </ElFormItem>
        <ElFormItem label="地区">
          <ElInput v-model="form.region" />
        </ElFormItem>
        <ElFormItem label="负责人">
          <ElInput v-model="form.owner" />
        </ElFormItem>
        <ElFormItem label="客户对接">
          <ElInput v-model="form.clientContact" />
        </ElFormItem>
        <ElFormItem label="优先级">
          <ElSelect v-model="form.priority" style="width: 100%">
            <ElOption label="高" value="high" />
            <ElOption label="中" value="medium" />
            <ElOption label="低" value="low" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="项目周期">
          <ElDatePicker
            v-model="form.cycle"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 100%"
          />
        </ElFormItem>
        <ElDivider content-position="left">KPI 目标（可先留空后改）</ElDivider>
        <ElFormItem label="账号数">
          <ElInputNumber v-model="form.accounts" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="脚本目标">
          <ElInputNumber
            v-model="form.scripts"
            :min="0"
            :controls="false"
            style="width: 100%"
            placeholder="总条数，不要求按号均分"
          />
        </ElFormItem>
        <ElFormItem label="成片数">
          <ElInputNumber v-model="form.videos" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="播放目标">
          <ElInputNumber v-model="form.exposure" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="同步日历">
          <ElCheckbox v-model="form.syncCalendar">保存后量化写入节奏日历 / 项目排期</ElCheckbox>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitCreate">创建</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="importVisible" title="导入项目" width="640px" destroy-on-close>
      <p class="import-tip">
        粘贴自然语言 brief，由 DeepSeek 理解后写入 KPI（失败时用本地规则兜底）。整段通常是
        <strong>一个项目</strong>。
      </p>
      <ElInput
        v-model="importText"
        type="textarea"
        :rows="12"
        placeholder="粘贴项目 brief…"
        :disabled="importing"
      />
      <ElCheckbox v-model="importSync" style="margin-top: 10px" :disabled="importing">
        导入后同步 KPI 到节奏日历
      </ElCheckbox>
      <template #footer>
        <ElButton :disabled="importing" @click="importVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="importing" @click="submitImport">导入</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { onBeforeRouteLeave } from 'vue-router'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    createProject,
    dojoProjectStore,
    getProjectById,
    hideEndedProjects,
    removeProject,
    setProjectActive,
    setSelectedProjects,
    updateProject
  } from '@/store/dojoProjectStore'
  import {
    currentRows,
    cycleLabel,
    getProjectRuntime,
    kpiRows,
    plannedScripts,
    priorityLabel,
    progressRows,
    projectRuntimeRevision,
    timeProgress,
    type ProjectRuntime
  } from '@/store/dojoProjectRuntime'
  import { syncProjectKpiToSchedule } from '@/store/dojoKpiSchedule'
  import { projectExecutionBrief } from '@/store/dojoExecutionGuide'
  import {
    syncAllProjectsCurrentFromLedger,
    syncProjectCurrentFromLedger
  } from '@/store/dojoProjectMetrics'
  import { dojoAccountStore } from '@/store/dojoAccountStore'
  import { DOJO_TODAY, formatMonthDay } from '@/utils/dojoDates'
  import { parseProjectImportText } from '@/utils/dojoProjectImport'
  import ProjectQuickControls from '@/components/dojo/ProjectQuickControls.vue'

  defineOptions({ name: 'DojoProject' })

  const router = useRouter()
  const dialogVisible = ref(false)
  const formRef = ref<FormInstance>()
  const importVisible = ref(false)
  const importText = ref('')
  const importSync = ref(true)
  const importing = ref(false)
  const editingId = ref('')
  const refreshing = ref(false)
  const refreshingId = ref('')
  const editingCurrent = ref<{
    projectId: string
    field: keyof ProjectRuntime['current']
    value: number
  } | null>(null)

  const draft = reactive({
    name: '',
    brand: '',
    region: '',
    priority: 'medium' as ProjectRuntime['priority'],
    cycle: null as [string, string] | null,
    accounts: 0,
    scriptTarget: 0,
    videos: 0,
    exposure: 0,
    curAccounts: 0,
    curScripts: 0,
    curEdited: 0,
    curApproved: 0,
    curDistributed: 0,
    curExposure: 0
  })

  const form = reactive({
    name: '',
    brand: '',
    region: '',
    owner: '',
    clientContact: '',
    priority: 'medium' as ProjectRuntime['priority'],
    cycle: null as [string, string] | null,
    accounts: 0,
    scripts: 0,
    videos: 0,
    exposure: 0,
    syncCalendar: true
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请填写项目名称', trigger: 'blur' }]
  }

  function isEndedStatus(status?: string) {
    return status === '完结' || status === '已完成'
  }

  function buildCard(project: (typeof dojoProjectStore.projects)[number]) {
    const runtime = getProjectRuntime(project.id)
    if (!runtime) return null
    return {
      project,
      runtime,
      execution: projectExecutionBrief(project.id, DOJO_TODAY),
      progress: progressRows(runtime),
      kpi: kpiRows(runtime),
      current: currentRows(runtime)
    }
  }

  const cards = computed(() => {
    void projectRuntimeRevision.value
    void dojoAccountStore.revision
    return dojoProjectStore.projects
      .filter((p) => p.active !== false)
      .flatMap((project) => {
        const card = buildCard(project)
        return card ? [card] : []
      })
  })

  const hiddenCards = computed(() => {
    void projectRuntimeRevision.value
    return dojoProjectStore.projects
      .filter((p) => p.active === false)
      .flatMap((project) => {
        const card = buildCard(project)
        return card ? [card] : []
      })
  })

  const endedVisibleCount = computed(
    () => cards.value.filter((c) => isEndedStatus(c.runtime.runStatus)).length
  )

  function hideCard(id: string) {
    setProjectActive(id, false)
    if (editingId.value === id) editingId.value = ''
    ElMessage.success('已隐藏，今日待办不再显示该项目')
  }

  function openProjectExecution(projectId: string) {
    setSelectedProjects([projectId])
    void router.push({ path: '/today', query: { project: projectId } })
  }

  function restoreCard(id: string) {
    setProjectActive(id, true)
    ElMessage.success('已恢复显示')
  }

  function hideAllEnded() {
    const n = hideEndedProjects()
    if (editingId.value) {
      const still = getProjectById(editingId.value)
      if (still?.active === false) editingId.value = ''
    }
    ElMessage.success(n ? `已隐藏 ${n} 个结束项目` : '没有可隐藏的结束项目')
  }

  onMounted(() => {
    const ids = dojoProjectStore.projects.map((p) => p.id)
    if (ids.length) syncAllProjectsCurrentFromLedger(ids)
  })

  function formatNum(n: number) {
    return Number.isFinite(n) ? n.toLocaleString() : '—'
  }

  function currentField(label: string): keyof ProjectRuntime['current'] | null {
    return (
      (
        {
          账号数: 'accounts',
          脚本产出: 'scripts',
          成片数: 'edited',
          过审数: 'approved',
          分发量: 'distributed',
          已发视频: 'distributed',
          曝光量: 'exposure',
          播放量: 'exposure'
        } as Record<string, keyof ProjectRuntime['current']>
      )[label] || null
    )
  }

  function startCurrentEdit(projectId: string, label: string, value: number) {
    const field = currentField(label)
    if (!field) return
    saveCurrentEdit()
    editingCurrent.value = { projectId, field, value }
  }

  function saveCurrentEdit() {
    const current = editingCurrent.value
    if (!current) return
    updateProject(current.projectId, {
      current: { [current.field]: Math.max(0, Number(current.value) || 0) }
    })
    editingCurrent.value = null
  }

  onBeforeRouteLeave(() => {
    saveCurrentEdit()
    if (editingId.value) saveInline(editingId.value)
  })

  function startInline(id: string) {
    const runtime = getProjectRuntime(id)
    const project = dojoProjectStore.projects.find((p) => p.id === id)
    if (!runtime || !project) return
    // 先按台账刷一遍派生字段，再进编辑
    syncProjectCurrentFromLedger(id)
    const rt = getProjectRuntime(id)!
    editingId.value = id
    draft.name = project.name
    draft.brand = rt.brand === '—' ? '' : rt.brand
    draft.region = project.region === '—' ? '' : project.region || ''
    draft.priority = rt.priority
    draft.cycle = [rt.kpi.cycleStart, rt.kpi.cycleEnd]
    draft.accounts = rt.kpi.accounts
    draft.scriptTarget = plannedScripts(rt.kpi)
    draft.videos = rt.kpi.videos
    draft.exposure = rt.kpi.exposure
    draft.curAccounts = rt.current.accounts
    draft.curScripts = rt.current.scripts
    draft.curEdited = rt.current.edited
    draft.curApproved = rt.current.approved
    draft.curDistributed = rt.current.distributed
    draft.curExposure = rt.current.exposure
  }

  function cancelInline() {
    editingId.value = ''
  }

  function saveInline(id: string) {
    const name = draft.name.trim()
    if (!name) {
      ElMessage.warning('项目名称不能为空')
      return
    }
    const cycleStart = draft.cycle?.[0] || DOJO_TODAY
    const cycleEnd = draft.cycle?.[1] || draft.cycle?.[0] || DOJO_TODAY
    const accounts = draft.accounts || 0
    const scripts = draft.scriptTarget || 0

    updateProject(id, {
      name,
      brand: draft.brand.trim() || '—',
      region: draft.region.trim() || '—',
      priority: draft.priority,
      cycleStart,
      cycleEnd,
      kpi: {
        accounts,
        videos: draft.videos || 0,
        exposure: draft.exposure || 0,
        scripts,
        // 仅作参考均值，不再反推总目标
        scriptsPerAccount: accounts > 0 ? Math.round(scripts / accounts) : 0
      },
      current: {
        accounts: draft.curAccounts || 0,
        scripts: draft.curScripts || 0,
        edited: draft.curEdited || 0,
        approved: draft.curApproved || 0,
        distributed: draft.curDistributed || 0,
        exposure: draft.curExposure || 0
      }
    })
    editingId.value = ''
    ElMessage.success('已保存')
  }

  function refreshOne(projectId: string) {
    refreshingId.value = projectId
    try {
      const m = syncProjectCurrentFromLedger(projectId)
      if (!m) {
        ElMessage.warning('未找到项目')
        return
      }
      ElMessage.success(
        `已回写：账号 ${m.accounts} · 已发视频 ${m.distributed} · 播放 ${m.exposure.toLocaleString()}`
      )
    } finally {
      refreshingId.value = ''
    }
  }

  function refreshAllMetrics() {
    refreshing.value = true
    try {
      const ids = dojoProjectStore.projects.map((p) => p.id)
      const n = syncAllProjectsCurrentFromLedger(ids)
      ElMessage.success(`已按台账/Rapid 刷新 ${n} 个项目现状`)
    } finally {
      refreshing.value = false
    }
  }

  function syncToCalendar(projectId: string) {
    const n = syncProjectKpiToSchedule(projectId)
    ElMessage.success(
      n ? `已同步项目周期到排期/日历（细项条请在「项目排期」里按需添加）` : '缺少周期，请先编辑 KPI'
    )
  }

  async function removeCard(projectId: string) {
    const name = dojoProjectStore.projects.find((p) => p.id === projectId)?.name || projectId
    try {
      await ElMessageBox.confirm(`确认删除项目「${name}」？`, '删除项目', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    if (editingId.value === projectId) editingId.value = ''
    removeProject(projectId)
    ElMessage.success('已删除项目，相关项目排期已同步清除')
  }

  function duplicateCard(projectId: string) {
    const project = dojoProjectStore.projects.find((p) => p.id === projectId)
    const runtime = getProjectRuntime(projectId)
    if (!project || !runtime) return
    const copy = createProject({
      name: `${project.name} 副本`,
      brand: runtime.brand,
      region: project.region,
      owner: runtime.owner,
      clientContact: runtime.clientContact,
      priority: runtime.priority,
      cycleStart: runtime.kpi.cycleStart,
      cycleEnd: runtime.kpi.cycleEnd,
      kpi: { ...runtime.kpi },
      aliases: [`${project.name} 副本`]
    })
    updateProject(copy.id, { current: { ...runtime.current } })
    setSelectedProjects([copy.id])
    ElMessage.success(`已复制为「${copy.name}」`)
    startInline(copy.id)
  }

  function openCreate() {
    resetForm()
    dialogVisible.value = true
  }

  function resetForm() {
    form.name = ''
    form.brand = ''
    form.region = ''
    form.owner = ''
    form.clientContact = ''
    form.priority = 'medium'
    form.cycle = null
    form.accounts = 0
    form.scripts = 0
    form.videos = 0
    form.exposure = 0
    form.syncCalendar = true
    formRef.value?.clearValidate()
  }

  async function submitCreate() {
    const ok = await formRef.value?.validate().catch(() => false)
    if (!ok) return
    const cycleStart = form.cycle?.[0] || DOJO_TODAY
    const cycleEnd = form.cycle?.[1] || form.cycle?.[0] || DOJO_TODAY
    const accounts = form.accounts || 0
    const scripts = form.scripts || 0
    const project = createProject({
      name: form.name,
      brand: form.brand.trim() || '—',
      region: form.region.trim() || '—',
      owner: form.owner.trim(),
      clientContact: form.clientContact.trim(),
      priority: form.priority,
      cycleStart,
      cycleEnd,
      kpi: {
        accounts,
        videos: form.videos || 0,
        exposure: form.exposure || 0,
        scripts,
        scriptsPerAccount: accounts > 0 ? Math.round(scripts / accounts) : 0
      }
    })
    setSelectedProjects([project.id])
    if (form.syncCalendar) {
      const n = syncProjectKpiToSchedule(project.id)
      if (n) ElMessage.success('已同步项目周期到排期/日历')
    }
    dialogVisible.value = false
    ElMessage.success(`已创建 ${project.name}`)
    startInline(project.id)
  }

  async function submitImport() {
    const raw = importText.value.trim()
    if (!raw) {
      ElMessage.warning('请粘贴项目 brief')
      return
    }
    importing.value = true
    try {
      const { projects, source, hint } = await parseProjectImportText(raw)
      if (!projects.length) {
        ElMessage.error('未能识别项目，请检查文本或改用「新建项目」手填')
        return
      }
      const createdIds: string[] = []
      for (const p of projects) {
        const cycleStart = p.cycleStart || DOJO_TODAY
        const cycleEnd = p.cycleEnd || p.cycleStart || DOJO_TODAY
        const project = createProject({
          name: p.name,
          brand: p.brand || '—',
          region: p.region || '—',
          owner: p.owner || '',
          clientContact: p.clientContact || '',
          priority: p.priority || 'medium',
          cycleStart,
          cycleEnd,
          kpi: {
            accounts: p.accounts || 0,
            videos: p.videos || 0,
            exposure: p.exposure || 0,
            scripts:
              p.scripts ??
              (p.accounts && p.scriptsPerAccount
                ? p.accounts * p.scriptsPerAccount
                : p.scriptsPerAccount || 0),
            scriptsPerAccount: p.scriptsPerAccount || 0
          }
        })
        if (importSync.value) syncProjectKpiToSchedule(project.id)
        createdIds.push(project.id)
      }
      if (createdIds.length) setSelectedProjects(createdIds)
      importVisible.value = false
      importText.value = ''
      const via = source === 'ai' ? 'DeepSeek' : '本地规则'
      ElMessage.success(`已导入 ${createdIds.length} 个项目（${via}）${hint ? ` · ${hint}` : ''}`)
      if (createdIds[0]) startInline(createdIds[0])
    } finally {
      importing.value = false
    }
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .empty-state {
    padding: 28px 20px;
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
    text-align: center;
    background: var(--el-fill-color-blank);
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;
  }

  .import-tip {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .project-card {
    padding: 18px 20px 16px;
    margin-top: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &.is-editing {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
    }

    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 14px;

      h2 {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 650;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    &__title {
      flex: 1;
      min-width: 220px;
    }

    &__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
  }

  .project-people {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin: 11px 0 0;
  }

  .project-people div {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;
  }

  .project-people dt {
    color: var(--dojo-muted);
  }

  .project-people dd {
    margin: 0;
    font-weight: 650;
    color: var(--dojo-ink);
  }

  .inline-name {
    margin-bottom: 8px;

    :deep(.el-input__inner) {
      font-size: 18px;
      font-weight: 650;
    }
  }

  .inline-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .edit-hint {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .project-execution {
    display: grid;
    grid-template-columns: minmax(180px, 0.8fr) minmax(0, 2fr) 32px;
    gap: 16px;
    align-items: center;
    min-height: 74px;
    padding: 10px 12px;
    margin-bottom: 14px;
    background: #f4f7fb;
    border: 1px solid #dce4ee;
    border-radius: 10px;

    &.is-overdue {
      background: #fff7f7;
      border-color: #f0d5d8;
    }

    &.is-complete {
      background: #f2f8f6;
      border-color: #d7ebe4;
    }

    &__phase {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
      padding: 0;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;

      > span:first-child {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        color: var(--dojo-accent);
        background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
        border-radius: 9px;
        font-size: 10px;
        font-weight: 750;
      }

      > span:last-child {
        display: grid;
        min-width: 0;
        gap: 2px;
      }

      small,
      em {
        color: var(--dojo-muted);
        font-size: 11px;
        font-style: normal;
      }

      strong,
      em {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: var(--dojo-ink);
        font-size: 11px;
      }
    }

    dl {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.8fr;
      gap: 20px;
      min-width: 0;
      margin: 0;
    }

    dl > div {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    dt,
    dl span {
      color: var(--dojo-muted);
      font-size: 11px;
    }

    dd {
      overflow: hidden;
      margin: 0;
      color: var(--dojo-ink);
      font-size: 10px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__kpi > span {
      height: 4px;
      overflow: hidden;
      background: #dfe6f0;
      border-radius: 3px;

      i {
        display: block;
        height: 100%;
        background: var(--dojo-accent);
        border-radius: inherit;
      }
    }

    &__open {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      padding: 0;
      color: var(--dojo-accent);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 8px;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
        outline: none;
      }
    }
  }

  .metric-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;

    &__row {
      display: grid;
      grid-template-columns: 52px repeat(7, minmax(0, 1fr));
      gap: 6px;
      align-items: stretch;

      &.is-live .metric-grid__cell {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-7);
      }
    }

    &__label {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
      border-radius: 8px;
    }

    &__cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 52px;
      padding: 8px 6px;
      text-align: center;
      border: 1px solid var(--el-border-color-extra-light);
      border-radius: 8px;

      strong {
        font-size: 14px;
        font-weight: 650;
        line-height: 1.2;
        word-break: break-all;
      }

      span {
        font-size: 11px;
        line-height: 1.2;
        color: var(--el-text-color-secondary);
      }

      &.is-input {
        justify-content: center;
        padding: 6px 4px;
      }

      &.is-editable {
        cursor: text;
      }

      &.is-editable:hover {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-7);
      }

      &.is-cycle {
        justify-content: center;

        strong {
          font-size: 12px;
          word-break: normal;
          white-space: nowrap;
        }
      }
    }
  }

  .cycle-progress {
    height: 4px;
    margin-top: 4px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 3px;

    i {
      display: block;
      height: 100%;
      background: var(--el-color-primary);
      border-radius: inherit;
    }
  }

  .cell-num {
    width: 100%;

    :deep(.el-input__inner) {
      padding-right: 4px;
      padding-left: 4px;
      font-weight: 650;
      text-align: center;
    }
  }

  @media (width <= 1100px) {
    .project-execution {
      grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.4fr) 32px;

      dl {
        grid-template-columns: 1fr 0.8fr;
      }

      dl > div:first-child {
        display: none;
      }
    }

    .metric-grid__row {
      grid-template-columns: 52px repeat(4, minmax(0, 1fr));
    }
  }

  @media (width <= 720px) {
    .project-execution {
      grid-template-columns: minmax(0, 1fr) 30px;

      dl {
        grid-column: 1 / -1;
        grid-template-columns: 1fr;
        gap: 10px;
        padding-left: 44px;
      }

      dl > div:first-child {
        display: grid;
      }

      &__open {
        grid-row: 1;
        grid-column: 2;
      }
    }

    .metric-grid__row {
      grid-template-columns: 52px repeat(2, minmax(0, 1fr));
    }
  }

  .hidden-panel {
    padding: 16px 18px;
    margin-top: 28px;
    background: var(--el-fill-color-blank);
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;

    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: baseline;
      margin-bottom: 12px;

      strong {
        font-size: 15px;
      }
    }
  }

  .hidden-list {
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid var(--el-border-color-extra-light);

      &:first-child {
        padding-top: 0;
        border-top: 0;
      }

      strong {
        display: block;
        margin-bottom: 2px;
      }

      .muted {
        font-size: 12px;
      }
    }
  }

  .muted {
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
</style>
