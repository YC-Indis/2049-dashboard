<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    addProjectPhaseBar,
    availablePhasesToAdd,
    suggestProjectPhaseRange,
    type PlanPhaseKey
  } from '@/store/dojoKpiSchedule'
  import { dojoProjectStore } from '@/store/dojoProjectStore'

  const props = withDefaults(
    defineProps<{
      open: boolean
      initialProjectId?: string
    }>(),
    {
      initialProjectId: ''
    }
  )

  const emit = defineEmits<{
    close: []
    created: [blockId: string]
  }>()

  interface ProjectPhaseForm {
    projectId: string
    phaseKey: PlanPhaseKey | ''
    range: [string, string] | null
  }

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  function defaultForm(): ProjectPhaseForm {
    return {
      projectId:
        props.initialProjectId ||
        dojoProjectStore.selectedIds[0] ||
        dojoProjectStore.projects.find((project) => project.active !== false)?.id ||
        '',
      phaseKey: '',
      range: null
    }
  }

  const form = reactive<ProjectPhaseForm>(defaultForm())
  const projectOptions = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )
  const phaseOptions = computed(() => availablePhasesToAdd(form.projectId))
  const suggestedRange = computed(() => suggestProjectPhaseRange(form.projectId))
  const rules: FormRules<ProjectPhaseForm> = {
    projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
    phaseKey: [{ required: true, message: '请选择项目环节', trigger: 'change' }]
  }

  watch(
    () => props.open,
    (open) => {
      if (open) Object.assign(form, defaultForm())
    }
  )

  watch(
    () => form.projectId,
    () => {
      form.phaseKey = ''
      form.range = null
      formRef.value?.clearValidate('phaseKey')
    }
  )

  function handleClose() {
    formRef.value?.clearValidate()
    Object.assign(form, defaultForm())
    emit('close')
  }

  async function handleSubmit() {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      ElMessage.warning('请先选择所属项目和项目环节')
      return
    }

    submitting.value = true
    try {
      const block = addProjectPhaseBar(
        form.projectId,
        form.phaseKey as PlanPhaseKey,
        form.range ? { start: form.range[0], end: form.range[1] } : undefined
      )
      if (!block) throw new Error('phase-create-failed')
      ElMessage.success('项目环节已加入总规划')
      emit('created', block.id)
      handleClose()
    } catch {
      ElMessage.error('项目环节添加失败，请检查项目周期')
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <ElDialog
    :model-value="open"
    title="添加项目环节"
    width="min(620px, calc(100vw - 32px))"
    destroy-on-close
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
      <ElFormItem label="所属项目" prop="projectId">
        <ElSelect v-model="form.projectId" filterable placeholder="选择项目">
          <ElOption
            v-for="project in projectOptions"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="项目环节" prop="phaseKey">
        <ElSelect
          v-model="form.phaseKey"
          :disabled="!phaseOptions.length"
          :placeholder="phaseOptions.length ? '选择要加入总规划的环节' : '该项目的环节已全部加入'"
        >
          <ElOption
            v-for="phase in phaseOptions"
            :key="phase.key"
            :label="phase.label"
            :value="phase.key"
          >
            <span class="phase-option">
              <i :style="{ background: phase.color }" />
              <span>{{ phase.label }}</span>
              <small v-if="phase.target">{{ phase.done }}/{{ phase.target }}</small>
            </span>
          </ElOption>
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="计划周期（可选）">
        <ElDatePicker
          v-model="form.range"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="截止日期"
        />
        <p v-if="suggestedRange" class="range-suggestion">
          自动接续：{{ suggestedRange.start }} 至 {{ suggestedRange.end }}
        </p>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton
        type="primary"
        :loading="submitting"
        :disabled="!phaseOptions.length"
        @click="handleSubmit"
      >
        加入项目总规划
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
  :deep(.el-select),
  :deep(.el-date-editor) {
    width: 100%;
  }

  .phase-option {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;

    i {
      width: 8px;
      height: 8px;
      border-radius: 3px;
    }

    small {
      color: var(--el-text-color-secondary);
      font-variant-numeric: tabular-nums;
    }
  }

  .range-suggestion {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-variant-numeric: tabular-nums;
  }
</style>
