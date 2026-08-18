<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { createCreatorPlanningItem } from '@/store/dojoCreatorStore'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import type { CreateCreatorPlanningItemInput } from '@/types/dojoCreator'

  const props = withDefaults(
    defineProps<{
      open: boolean
      initialProjectId?: string
      initialContentId?: string
      initialPhaseBlockId?: string
      initialParentId?: string
    }>(),
    {
      initialContentId: '',
      initialPhaseBlockId: '',
      initialProjectId: '',
      initialParentId: ''
    }
  )

  const emit = defineEmits<{
    close: []
    created: [itemId: string]
  }>()

  type PlanningItemForm = CreateCreatorPlanningItemInput

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  function defaultForm(): PlanningItemForm {
    return {
      projectId:
        props.initialProjectId ||
        dojoProjectStore.selectedIds[0] ||
        dojoProjectStore.projects[0]?.id ||
        '',
      title: '',
      detail: '',
      contentId: props.initialContentId || undefined,
      phaseBlockId: props.initialPhaseBlockId || undefined,
      parentId: props.initialParentId || undefined
    }
  }

  const form = reactive<PlanningItemForm>(defaultForm())
  const projectOptions = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )
  const rules: FormRules<PlanningItemForm> = {
    projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
    title: [
      { required: true, message: '请输入事项名称', trigger: 'blur' },
      { min: 2, message: '事项名称至少需要 2 个字', trigger: 'blur' }
    ]
  }

  watch(
    () => props.open,
    (open) => {
      if (open) Object.assign(form, defaultForm())
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
      ElMessage.warning('请先填写事项名称和所属项目')
      return
    }

    submitting.value = true
    try {
      const item = createCreatorPlanningItem({ ...form })
      ElMessage.success('事项已加入左侧待安排池')
      emit('created', item.id)
      handleClose()
    } catch {
      ElMessage.error('事项保存失败，请重试')
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <ElDialog
    :model-value="open"
    title="新增待安排事项"
    width="min(620px, calc(100vw - 32px))"
    destroy-on-close
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
      <ElFormItem label="所属项目" prop="projectId">
        <ElSelect v-model="form.projectId" filterable>
          <ElOption
            v-for="project in projectOptions"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="事项名称" prop="title">
        <ElInput
          v-model="form.title"
          maxlength="80"
          show-word-limit
          placeholder="例如：补拍产品开箱近景"
        />
      </ElFormItem>

      <ElFormItem label="备注（可选）">
        <ElInput
          v-model="form.detail"
          type="textarea"
          :rows="3"
          maxlength="240"
          show-word-limit
          placeholder="补充交付标准、素材或注意事项"
        />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit"> 加入待安排池 </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
  :deep(.el-select) {
    width: 100%;
  }
</style>
