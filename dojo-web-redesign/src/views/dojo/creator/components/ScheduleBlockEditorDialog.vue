<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    executionBriefForBlock,
    resetPhaseGuideOverride,
    resolvePhaseGuide,
    upsertPhaseGuideOverride
  } from '@/store/dojoExecutionGuide'
  import { phaseKeyFromBlockId, PLAN_PHASE_META, type PlanPhaseKey } from '@/store/dojoKpiSchedule'
  import { shiftCreatorPlanningItemsForPhase } from '@/store/dojoCreatorStore'
  import {
    dojoScheduleStore,
    isKpiBlock,
    patchScheduleBlock,
    removeScheduleBlock,
    type ScheduleBlock
  } from '@/store/dojoScheduleStore'

  const props = defineProps<{
    open: boolean
    blockId: string
  }>()

  const emit = defineEmits<{
    close: []
    saved: []
  }>()

  const router = useRouter()

  interface BlockForm {
    title: string
    type: ScheduleBlock['type']
    start: string
    end: string
    status: string
    owner: string
    note: string
  }

  interface GuideDraft {
    objective: string
    actions: string[]
    monitors: string[]
    monitorSummary: string
  }

  const formRef = ref<FormInstance>()
  const saving = ref(false)
  const originalStart = ref('')
  const form = reactive<BlockForm>({
    title: '',
    type: 'task',
    start: '',
    end: '',
    status: '已安排',
    owner: '',
    note: ''
  })
  const guideDraft = reactive<GuideDraft>({
    objective: '',
    actions: [],
    monitors: [],
    monitorSummary: ''
  })
  const guideDirty = ref(false)
  const hasGuideOverride = ref(false)

  const block = computed(() => dojoScheduleStore.blocks.find((item) => item.id === props.blockId))
  const isProjectPhase = computed(() => Boolean(block.value && isKpiBlock(block.value)))
  const phaseKey = computed((): PlanPhaseKey | null => {
    if (!block.value) return null
    const key = phaseKeyFromBlockId(block.value.id, block.value.projectId)
    if (key === 'approve') return 'edit'
    if (!key || key === 'cycle') return null
    return key
  })
  const executionBrief = computed(() =>
    block.value && isProjectPhase.value ? executionBriefForBlock(block.value) : null
  )
  const liveMonitorSummary = computed(() => executionBrief.value?.monitorSummary || '')
  const phaseLabel = computed(() => {
    if (!block.value) return ''
    const key = phaseKey.value
    return PLAN_PHASE_META.find((item) => item.key === key)?.label || block.value.title
  })
  const rules: FormRules<BlockForm> = {
    title: [{ required: true, message: '请输入事项名称', trigger: 'blur' }],
    start: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
    end: [{ required: true, message: '请选择截止日期', trigger: 'change' }]
  }

  function loadGuideDraft(projectId: string, key: PlanPhaseKey) {
    const resolved = resolvePhaseGuide(projectId, key)
    guideDraft.objective = resolved.objective
    guideDraft.actions = [...resolved.actions]
    guideDraft.monitors = [...resolved.monitors]
    // 空字符串 = 继续用 KPI 现状自动算；有内容才覆盖
    guideDraft.monitorSummary = resolved.monitorSummaryOverride
    hasGuideOverride.value = resolved.hasOverride
    guideDirty.value = false
  }

  watch(
    [() => props.open, block],
    ([open, value]) => {
      if (!open || !value) return
      originalStart.value = value.start
      const key = phaseKeyFromBlockId(value.id, value.projectId)
      const publicPhaseLabel = PLAN_PHASE_META.find((item) => item.key === key)?.label
      Object.assign(form, {
        title: publicPhaseLabel || value.title,
        type: value.type,
        start: value.start,
        end: value.end,
        status: value.status || '已安排',
        owner: value.owner || '',
        note: isKpiBlock(value) && value.note?.startsWith('[kpi-sync]') ? '' : value.note || ''
      })
      if (key && isKpiBlock(value)) {
        const guideKey: PlanPhaseKey | null =
          key === 'approve' ? 'edit' : key === 'cycle' ? null : key
        if (guideKey) loadGuideDraft(value.projectId, guideKey)
      } else {
        guideDraft.objective = ''
        guideDraft.actions = []
        guideDraft.monitors = []
        guideDraft.monitorSummary = ''
        hasGuideOverride.value = false
        guideDirty.value = false
      }
    },
    { immediate: true }
  )

  function markGuideDirty() {
    guideDirty.value = true
  }

  function addAction() {
    guideDraft.actions.push('')
    markGuideDirty()
  }

  function removeAction(index: number) {
    guideDraft.actions.splice(index, 1)
    markGuideDirty()
  }

  function addMonitor() {
    guideDraft.monitors.push('')
    markGuideDirty()
  }

  function removeMonitor(index: number) {
    guideDraft.monitors.splice(index, 1)
    markGuideDirty()
  }

  function dayDifference(start: string, end: string) {
    return Math.round(
      (new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000
    )
  }

  function handleClose() {
    formRef.value?.clearValidate()
    emit('close')
  }

  function goEditProjectKpi() {
    if (!block.value) return
    handleClose()
    router.push({ path: '/project', query: { focus: block.value.projectId } })
  }

  async function handleResetGuide() {
    if (!block.value || !phaseKey.value) return
    try {
      await ElMessageBox.confirm(
        '将本环节的「阶段要做 / 重点监看」恢复为系统默认模板？',
        '恢复默认文案',
        {
          confirmButtonText: '恢复默认',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      resetPhaseGuideOverride(block.value.projectId, phaseKey.value)
      loadGuideDraft(block.value.projectId, phaseKey.value)
      ElMessage.success('已恢复默认阶段文案')
    } catch {
      return
    }
  }

  async function handleSave() {
    if (!formRef.value || !block.value) return
    try {
      await formRef.value.validate()
    } catch {
      ElMessage.warning('请补全名称和日期')
      return
    }
    if (form.end < form.start) {
      ElMessage.warning('截止日期不能早于开始日期')
      return
    }

    saving.value = true
    try {
      const current = block.value as ScheduleBlock
      const dayDelta = dayDifference(originalStart.value, form.start)
      patchScheduleBlock(current.id, {
        title: isProjectPhase.value ? current.title : form.title.trim(),
        type: isProjectPhase.value ? current.type : form.type,
        start: form.start,
        end: form.end,
        status: form.status,
        owner: form.owner.trim() || undefined,
        note: form.note.trim() || undefined
      })

      if (isProjectPhase.value && phaseKey.value && guideDirty.value) {
        upsertPhaseGuideOverride(current.projectId, phaseKey.value, {
          objective: guideDraft.objective,
          actions: guideDraft.actions,
          monitors: guideDraft.monitors,
          monitorSummary: guideDraft.monitorSummary
        })
        hasGuideOverride.value = true
        guideDirty.value = false
      }

      const shifted = isProjectPhase.value
        ? shiftCreatorPlanningItemsForPhase(current.id, dayDelta)
        : 0
      ElMessage.success(shifted ? `已更新，并同步移动 ${shifted} 个细分事项` : '事项已更新')
      emit('saved')
      handleClose()
    } finally {
      saving.value = false
    }
  }

  async function handleDelete() {
    if (!block.value || isProjectPhase.value) return
    try {
      await ElMessageBox.confirm(
        `删除事项“${block.value.title}”？它会从执行日历和时间规划中同时移除。`,
        '删除执行事项',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeScheduleBlock(block.value.id)
      ElMessage.success('执行事项已删除')
      emit('saved')
      handleClose()
    } catch {
      return
    }
  }
</script>

<template>
  <ElDialog
    :model-value="open"
    :title="isProjectPhase ? '编辑项目环节' : '编辑执行事项'"
    width="min(680px, calc(100vw - 32px))"
    destroy-on-close
    @close="handleClose"
  >
    <div v-if="block" class="block-context">
      <strong>{{ block.projectName }}</strong>
      <span v-if="isProjectPhase">{{ phaseLabel }}</span>
    </div>

    <section v-if="isProjectPhase" class="execution-editor" aria-label="阶段执行内容">
      <header class="execution-editor__head">
        <div>
          <strong>阶段执行内容</strong>
          <p>可增删改「阶段要做 / 重点监看」；KPI 数字来自项目管理，日期在下方改。</p>
        </div>
        <ElButton v-if="hasGuideOverride" link type="primary" @click="handleResetGuide">
          恢复默认
        </ElButton>
      </header>

      <div class="execution-editor__grid">
        <div class="execution-editor__col">
          <div class="execution-editor__label">
            <span>这个阶段要做</span>
            <button type="button" class="link-btn" @click="addAction">+ 添加</button>
          </div>
          <div v-if="!guideDraft.actions.length" class="execution-editor__empty">暂无动作，点添加</div>
          <div
            v-for="(_, index) in guideDraft.actions"
            :key="`action-${index}`"
            class="execution-editor__row"
          >
            <ElInput
              v-model="guideDraft.actions[index]"
              maxlength="40"
              placeholder="例如：确认场景与道具"
              @input="markGuideDirty"
            />
            <button type="button" class="icon-btn" aria-label="删除动作" @click="removeAction(index)">
              ×
            </button>
          </div>
        </div>

        <div class="execution-editor__col">
          <div class="execution-editor__label">
            <span>重点监看</span>
            <button type="button" class="link-btn" @click="addMonitor">+ 添加</button>
          </div>
          <ElInput
            v-model="guideDraft.monitorSummary"
            maxlength="48"
            :placeholder="liveMonitorSummary || '主文案，如：待形成成片 0'"
            @input="markGuideDirty"
          />
          <span class="execution-editor__hint">
            留空则按项目现状自动生成；填写后固定显示你的文案。
          </span>
          <div
            v-for="(_, index) in guideDraft.monitors"
            :key="`monitor-${index}`"
            class="execution-editor__row"
          >
            <ElInput
              v-model="guideDraft.monitors[index]"
              maxlength="28"
              placeholder="例如：可拍库存"
              @input="markGuideDirty"
            />
            <button
              type="button"
              class="icon-btn"
              aria-label="删除监看项"
              @click="removeMonitor(index)"
            >
              ×
            </button>
          </div>
          <div v-if="!guideDraft.monitors.length" class="execution-editor__empty">暂无监看项</div>
        </div>

        <div class="execution-editor__col">
          <div class="execution-editor__label">
            <span>对齐 KPI</span>
            <button type="button" class="link-btn" @click="goEditProjectKpi">改项目 KPI</button>
          </div>
          <strong class="execution-editor__kpi">
            {{ executionBrief?.kpiLabel }} {{ executionBrief?.kpiText }}
          </strong>
          <span class="execution-editor__hint">
            进度数字跟项目管理里的 KPI / 现状走；本环节日期请在下方修改。
          </span>
          <ElFormItem label="阶段目标说明" class="execution-editor__objective">
            <ElInput
              v-model="guideDraft.objective"
              type="textarea"
              :rows="2"
              maxlength="120"
              placeholder="可选，描述本阶段要对齐的目标"
              @input="markGuideDirty"
            />
          </ElFormItem>
        </div>
      </div>
    </section>

    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
      <ElFormItem label="事项名称" prop="title">
        <ElInput v-model="form.title" :disabled="isProjectPhase" maxlength="80" />
      </ElFormItem>

      <ElFormItem v-if="!isProjectPhase" label="事项类型">
        <ElSelect v-model="form.type">
          <ElOption label="任务" value="task" />
          <ElOption label="脚本" value="script" />
          <ElOption label="发布" value="publish" />
          <ElOption label="投放" value="ad" />
          <ElOption label="里程碑" value="milestone" />
          <ElOption label="其他" value="other" />
        </ElSelect>
      </ElFormItem>

      <div class="date-grid">
        <ElFormItem label="开始日期" prop="start">
          <ElDatePicker v-model="form.start" type="date" value-format="YYYY-MM-DD" />
        </ElFormItem>
        <ElFormItem label="截止日期" prop="end">
          <ElDatePicker v-model="form.end" type="date" value-format="YYYY-MM-DD" />
        </ElFormItem>
      </div>

      <div class="date-grid">
        <ElFormItem label="状态">
          <ElSelect v-model="form.status">
            <ElOption label="已安排" value="已安排" />
            <ElOption label="进行中" value="进行中" />
            <ElOption label="已完成" value="已完成" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="负责人">
          <ElInput v-model="form.owner" maxlength="40" placeholder="可选" />
        </ElFormItem>
      </div>

      <ElFormItem label="备注">
        <ElInput v-model="form.note" type="textarea" :rows="3" maxlength="240" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton v-if="!isProjectPhase" type="danger" plain @click="handleDelete">删除事项</ElButton>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存修改</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
  .block-context {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
    border-radius: 8px;

    span {
      color: var(--el-text-color-secondary);
    }
  }

  .date-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .execution-editor {
    margin-bottom: 18px;
    padding: 12px;
    background: #f4f7fb;
    border: 1px solid #dce4ee;
    border-radius: 10px;

    &__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;

      strong {
        display: block;
        font-size: 13px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        line-height: 1.4;
      }
    }

    &__grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr 0.95fr;
      gap: 14px;
    }

    &__col {
      display: grid;
      gap: 8px;
      align-content: start;
      min-width: 0;
    }

    &__label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 28px;
      gap: 6px;
      align-items: center;
    }

    &__empty {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
    }

    &__kpi {
      font-size: 12px;
      color: var(--el-text-color-primary);
      line-height: 1.35;
    }

    &__hint {
      font-size: 10px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
    }

    &__objective {
      margin-bottom: 0;
    }
  }

  .link-btn,
  .icon-btn {
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 0;
    color: var(--dojo-accent);
    font-size: 11px;
    line-height: 1;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--el-text-color-secondary);
    font-size: 16px;

    &:hover {
      background: #e8eef8;
      color: #c45656;
    }
  }

  :deep(.el-select),
  :deep(.el-date-editor) {
    width: 100%;
  }

  @media (max-width: 640px) {
    .date-grid {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .execution-editor__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
