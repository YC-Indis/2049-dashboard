<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { createCreatorContent } from '@/store/dojoCreatorStore'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import type { CreateCreatorContentInput } from '@/types/dojoCreator'

  const props = defineProps<{ open: boolean }>()
  const emit = defineEmits<{
    close: []
    created: [contentId: string]
  }>()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const defaultForm = (): CreateCreatorContentInput => ({
    projectId: dojoProjectStore.selectedIds[0] || dojoProjectStore.projects[0]?.id || '',
    title: '',
    summary: ''
  })

  const form = reactive<CreateCreatorContentInput>(defaultForm())

  const projectOptions = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )

  const rules: FormRules<CreateCreatorContentInput> = {
    projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
    title: [
      { required: true, message: '请输入内容标题', trigger: 'blur' },
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
      ElMessage.warning('请先补全内容标题与所属项目')
      return
    }

    submitting.value = true
    try {
      const content = createCreatorContent({ ...form })
      ElMessage.success('事项已加入时间规划')
      emit('created', content.id)
      handleClose()
    } catch {
      ElMessage.error('创建失败，请稍后重试')
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <ElDialog
    :model-value="open"
    title="新增规划事项"
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

      <ElFormItem label="事项名称" prop="title">
        <ElInput v-model="form.title" maxlength="80" show-word-limit placeholder="要做什么？" />
      </ElFormItem>

      <ElFormItem label="备注（可选）" prop="summary">
        <ElInput
          v-model="form.summary"
          type="textarea"
          :rows="3"
          maxlength="240"
          show-word-limit
          placeholder="补充交付要求、素材或注意事项"
        />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit"> 加入时间规划 </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
  :deep(.el-select),
  :deep(.el-date-editor) {
    width: 100%;
  }
</style>
