<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>复盘总结</h1>
      </div>
      <div class="head-ops">
        <ElButton type="primary" @click="openCreate">新建复盘</ElButton>
        <ElButton @click="$router.push('/accounts/review')">总账号预览</ElButton>
      </div>
    </header>

    <section class="panel">
      <div class="filters">
        <DojoProjectSelect v-model="selectedProjectIds" width="220px" placeholder="筛选项目（可多选）" />
        <ElInput v-model="keyword" placeholder="搜索标题 / 内容 / 标签" clearable style="width: 220px" />
        <span class="muted">共 {{ filtered.length }} 条</span>
      </div>

      <ElTable :data="filtered" stripe>
        <ElTableColumn prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="project" label="项目" width="110" />
        <ElTableColumn prop="date" label="日期" width="110" />
        <ElTableColumn label="标签" width="160">
          <template #default="{ row }">
            <ElTag v-for="t in row.tags" :key="t" size="small" class="tag">{{ t }}</ElTag>
            <span v-if="!row.tags.length" class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="content" label="内容摘要" min-width="240" show-overflow-tooltip />
        <ElTableColumn label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link type="danger" @click="remove(row.id)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建复盘' : '编辑复盘'"
      width="640px"
      align-center
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <ElFormItem label="标题" prop="title">
          <ElInput v-model="form.title" placeholder="复盘标题" />
        </ElFormItem>
        <ElFormItem label="项目" prop="project">
          <ElSelect v-model="form.project" filterable allow-create default-first-option style="width: 100%">
            <ElOption v-for="p in allProjects" :key="p.id" :label="p.name" :value="p.name" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="日期" prop="date">
          <ElDatePicker
            v-model="form.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="复盘日期"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="标签">
          <ElSelect
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入后回车添加"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="内容" prop="content">
          <ElInput v-model="form.content" type="textarea" :rows="6" placeholder="复盘正文" />
        </ElFormItem>
        <ElFormItem label="AI 辅助">
          <ElInput
            v-model="aiNotes"
            type="textarea"
            :rows="4"
            placeholder="粘贴会议记录、数据截图说明等，点击生成草稿"
          />
          <ElButton
            type="primary"
            plain
            size="small"
            class="ai-btn"
            :loading="aiLoading"
            @click="runAiDraft"
          >
            AI 生成草稿
          </ElButton>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { aiParseStructured } from '@/api/llm'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
  import {
    dojoRetrospectiveStore,
    addRetrospective,
    updateRetrospective,
    removeRetrospective,
    type Retrospective
  } from '@/store/dojoRetrospectiveStore'

  defineOptions({ name: 'DojoRetrospectives' })

  type DialogMode = 'create' | 'edit'

  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const keyword = ref('')
  const dialogVisible = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const editingId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const aiNotes = ref('')
  const aiLoading = ref(false)

  const allProjects = computed(() => dojoProjectStore.projects.filter((p) => p.active !== false))

  const filtered = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    const names = selectedProjectIds.value
      .map((id) => getProjectById(id)?.name)
      .filter(Boolean) as string[]
    return dojoRetrospectiveStore.items.filter((r) => {
      if (names.length && !names.includes(r.project)) return false
      if (!kw) return true
      const hay = `${r.title} ${r.content} ${r.tags.join(' ')}`.toLowerCase()
      return hay.includes(kw)
    })
  })

  const emptyForm = () => ({
    title: '',
    project: '',
    date: '',
    content: '',
    tags: [] as string[]
  })

  const form = reactive(emptyForm())

  const formRules: FormRules = {
    title: [{ required: true, message: '请填写标题', trigger: 'blur' }],
    project: [{ required: true, message: '请选择项目', trigger: 'change' }],
    date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    content: [{ required: true, message: '请填写内容', trigger: 'blur' }]
  }

  function openCreate() {
    dialogMode.value = 'create'
    editingId.value = null
    aiNotes.value = ''
    Object.assign(form, emptyForm())
    dialogVisible.value = true
  }

  function openEdit(row: Retrospective) {
    dialogMode.value = 'edit'
    editingId.value = row.id
    aiNotes.value = ''
    form.title = row.title
    form.project = row.project
    form.date = row.date
    form.content = row.content
    form.tags = [...row.tags]
    dialogVisible.value = true
  }

  function resetForm() {
    Object.assign(form, emptyForm())
    aiNotes.value = ''
    editingId.value = null
  }

  async function submitForm() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const payload = {
      title: form.title.trim(),
      project: form.project.trim(),
      date: form.date,
      content: form.content.trim(),
      tags: form.tags.map((t) => t.trim()).filter(Boolean)
    }

    if (dialogMode.value === 'create') {
      addRetrospective(payload)
      ElMessage.success('已新建复盘')
    } else if (editingId.value) {
      updateRetrospective(editingId.value, payload)
      ElMessage.success('已更新复盘')
    }

    dialogVisible.value = false
  }

  async function remove(id: string) {
    try {
      await ElMessageBox.confirm('确定删除这条复盘？', '删除复盘', { type: 'warning' })
      removeRetrospective(id)
      ElMessage.success('已删除')
    } catch {
      /* cancelled */
    }
  }

  interface AiRetroDraft {
    title?: string
    project?: string
    date?: string
    content?: string
    tags?: string[]
  }

  async function runAiDraft() {
    const raw = aiNotes.value.trim()
    if (!raw) {
      ElMessage.warning('请先粘贴笔记或记录')
      return
    }

    aiLoading.value = true
    try {
      const result = await aiParseStructured<AiRetroDraft>(
        '根据原始笔记整理为复盘总结。字段：title、project、date(YYYY-MM-DD)、content（200-500字）、tags（字符串数组）。',
        raw,
        '{"title":"首周投放复盘","project":"Dojo","date":"2026-03-01","content":"...","tags":["投放","英国"]}'
      )

      if (!result.ok) {
        ElMessage.error('AI 生成失败，请稍后重试')
        return
      }

      const d = result.data
      if (d.title) form.title = d.title
      if (d.project) form.project = d.project
      if (d.date) form.date = d.date
      if (d.content) form.content = d.content
      if (d.tags?.length) form.tags = d.tags
      ElMessage.success('已生成草稿，请确认后保存')
    } finally {
      aiLoading.value = false
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
    margin-bottom: 14px;
  }

  .muted {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .tag {
    margin-right: 4px;
  }

  .ai-btn {
    margin-top: 8px;
  }
</style>
