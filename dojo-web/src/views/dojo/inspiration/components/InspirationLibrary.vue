<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import VideoPreviewPanel from '@/components/dojo/VideoPreviewPanel.vue'
  import {
    addInspirationAnnotation,
    addScriptConversationMessage,
    applyAiAdaptedInspiration,
    createManualExecutableInspiration,
    dojoInspirationStore,
    queueScriptAiRequest,
    removeExecutableInspiration,
    removeInspirationAnnotation,
    updateExecutableInspiration
  } from '@/store/dojoInspirationStore'
  import {
    parseInspirationBatchImport,
    type InspirationImportDraft
  } from '@/utils/dojoInspirationImport'
  import { extractAccountHandle } from '@/api/tiktok'
  import {
    addBenchmarkAccountFromInspiration,
    dojoInspirationExplore,
    syncBenchmarkAccount
  } from '@/store/dojoInspirationExplore'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import { dojoProjectRuntime } from '@/store/dojoProjectRuntime'
  import LibraryLayerIndex from '@/components/dojo/LibraryLayerIndex.vue'
  import CreatorReviewDialog from '../../creator/components/CreatorReviewDialog.vue'
  import {
    DEFAULT_INSPIRATION_TAGS,
    ingestDayLabel,
    parseTagInput,
    type InspirationCategory,
    type LibraryGroupBy
  } from '@/utils/dojoInspirationLayers'
  import {
    collectProjectOwnedTokens,
    rankDirectionalTags,
    withoutOwnedTags
  } from '@/utils/dojoInspirationTags'
  import { requestInspirationRewrite, toRewriteInput } from '@/services/scriptAiService'
  import { stripMarkdown } from '@/utils/dojoScriptFormat'

  const emit = defineEmits<{
    'open-benchmark': [handle: string]
  }>()

  const query = ref('')
  const groupBy = ref<LibraryGroupBy>('time')
  const layer = ref('')
  const page = ref(1)
  const pageSize = 12
  const selectedId = ref(dojoInspirationStore.executableInspirations[0]?.id || '')
  const annotationInput = ref('')
  const reviewOpen = ref(false)
  const inspirationEditorOpen = ref(false)
  const editingInspirationId = ref('')
  const inspirationForm = reactive({
    title: '',
    referenceUrl: '',
    sourceAuthor: '',
    notes: '',
    category: '未分类' as InspirationCategory,
    tags: ''
  })
  const formTags = ref<string[]>([])
  const customTagInput = ref('')
  const selectedCustomTag = ref('')
  const draftTab = ref<'transcript' | 'visual' | 'meta'>('transcript')
  const libraryGroupOptions: LibraryGroupBy[] = ['time', 'tag']
  const projectOwnedTokens = computed(() =>
    collectProjectOwnedTokens(
      dojoProjectStore.projects.map((project) => ({
        name: project.name,
        aliases: project.aliases,
        brand: dojoProjectRuntime[project.id]?.brand
      }))
    )
  )
  const evidenceForm = reactive({
    transcript: '',
    visualNotes: ''
  })
  const aiPrompt = ref('')
  const aiLoading = ref(false)
  const aiError = ref('')
  const aiImportOpen = ref(false)
  const aiRawText = ref('')
  const aiParsing = ref(false)
  const aiPreview = ref<InspirationImportDraft[]>([])

  const filteredInspirations = computed(() => {
    const keyword = query.value.trim().toLowerCase()
    return dojoInspirationStore.executableInspirations.filter((item) => {
      if (!keyword) return true
      return [item.title, item.angle, item.hook, item.category, ...(item.tags || []), ...item.shotPlan]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  })
  const layerItems = computed(() =>
    filteredInspirations.value.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: (item.tags || []).length
        ? (item.tags || []).map((tag) => `#${tag}`).join(' ')
        : `${ingestDayLabel(item.createdAt || item.updatedAt)} 入库`,
      createdAt: item.createdAt || item.updatedAt,
      category: (item.category as InspirationCategory) || '未分类',
      tags: withoutOwnedTags(item.tags || [], projectOwnedTokens.value)
    }))
  )
  const pageCount = computed(() => Math.max(1, Math.ceil(layerItems.value.length / pageSize)))
  const pagedLayerItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return layerItems.value.slice(start, start + pageSize)
  })
  const selected = computed(
    () =>
      dojoInspirationStore.executableInspirations.find((item) => item.id === selectedId.value) ||
      filteredInspirations.value[0]
  )
  const knownTags = computed(() => {
    const ranked = rankDirectionalTags(
      [
        ...dojoInspirationStore.executableInspirations.map((item) => item.tags || []),
        ...Object.values(dojoInspirationExplore.accountVideos).flatMap((videos) =>
          videos.map((item) => item.tags || [])
        )
      ],
      {
        ownedTokens: projectOwnedTokens.value,
        minCount: 2,
        limit: 16
      }
    )
    return [
      ...new Set([
        ...DEFAULT_INSPIRATION_TAGS,
        ...ranked.map((item) => item.tag),
        ...(selected.value?.tags || []),
        ...formTags.value
      ])
    ]
  })
  const annotations = computed(() =>
    selected.value
      ? dojoInspirationStore.annotationsById[selected.value.id] || selected.value.annotations
      : []
  )
  const sourceHandle = computed(() =>
    extractAccountHandle(selected.value?.sourceAuthor, selected.value?.referenceUrl)
  )
  const messages = computed(() =>
    selected.value
      ? dojoInspirationStore.conversations.filter((item) => item.scriptId === selected.value?.id)
      : []
  )
  const latestAssistantMessage = computed(() => {
    const list = messages.value.filter((item) => item.role === 'assistant')
    return list[list.length - 1] || null
  })

  watch(
    selected,
    (inspiration) => {
      Object.assign(evidenceForm, {
        transcript:
          inspiration?.transcript ||
          (inspiration?.copyPlan || []).filter(Boolean).join('\n') ||
          '',
        visualNotes: inspiration?.visualNotes || (inspiration?.shotPlan || []).join('\n') || ''
      })
    },
    { immediate: true }
  )

  watch([query, layer, groupBy], () => {
    page.value = 1
  })

  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })

  function handleAddAnnotation() {
    if (!selected.value) return
    if (!addInspirationAnnotation(selected.value.id, annotationInput.value)) {
      ElMessage.warning('先写下一条具体判断或改编要求')
      return
    }
    annotationInput.value = ''
    ElMessage.success('批注已保存')
  }

  function saveEvidence(showMessage = true) {
    if (!selected.value) return null
    const inspiration = updateExecutableInspiration(selected.value.id, evidenceForm)
    if (showMessage) ElMessage.success('已保存')
    return inspiration
  }

  function applyLatestAiAdaptation() {
    if (!selected.value || !latestAssistantMessage.value) {
      ElMessage.warning('先让 AI 改一版，再写入正文')
      return
    }
    const inspiration = applyAiAdaptedInspiration(
      selected.value.id,
      latestAssistantMessage.value.content
    )
    if (!inspiration) return
    evidenceForm.transcript = inspiration.transcript || ''
    ElMessage.success('已写入口播')
  }

  async function handleAiRequest() {
    if (!selected.value) return
    const prompt = aiPrompt.value.trim()
    const inspiration = saveEvidence(false)
    if (!inspiration) return
    if (!evidenceForm.transcript.trim() && !evidenceForm.visualNotes.trim()) {
      ElMessage.warning('先写一点口播或画面，再让 AI 改')
      return
    }
    if (!queueScriptAiRequest(selected.value.id, prompt || '按人物口播改成可拍稿，不要 Markdown。')) {
      ElMessage.warning('先写下要改的地方')
      return
    }
    aiPrompt.value = ''
    aiError.value = ''
    aiLoading.value = true
    try {
      const answer = await requestInspirationRewrite(
        toRewriteInput(inspiration, evidenceForm),
        dojoInspirationStore.conversations.filter((item) => item.scriptId === inspiration.id)
      )
      addScriptConversationMessage(inspiration.id, 'assistant', answer)
    } catch (error) {
      aiError.value = error instanceof Error ? error.message : 'AI 请求失败，请稍后重试'
      ElMessage.error(aiError.value)
    } finally {
      aiLoading.value = false
    }
  }

  async function openSourceHome() {
    const handle = sourceHandle.value
    if (!handle) {
      ElMessage.warning('这条灵感还没有可识别的账号主页')
      return
    }
    const account = addBenchmarkAccountFromInspiration({
      handle,
      note: selected.value?.title ? `来自灵感「${selected.value.title}」` : '从灵感库加入'
    })
    if (!account) {
      ElMessage.warning('账号主页无法加入对标库')
      return
    }
    void syncBenchmarkAccount(account.id)
    ElMessage.success(`已把 ${account.handle} 加入对标库`)
    emit('open-benchmark', account.handle)
  }

  function handleCreateReview() {
    if (!selected.value) return
    reviewOpen.value = true
  }

  function addCustomTagTo(target: 'form' | 'selected') {
    const tags = parseTagInput(target === 'form' ? customTagInput.value : selectedCustomTag.value)
    if (!tags.length) {
      ElMessage.warning('先写下标签再添加')
      return
    }
    if (target === 'form') {
      formTags.value = [...new Set([...formTags.value, ...tags])]
      customTagInput.value = ''
      return
    }
    if (!selected.value) return
    updateExecutableInspiration(selected.value.id, {
      tags: [...new Set([...(selected.value.tags || []), ...tags])]
    })
    selectedCustomTag.value = ''
  }

  function toggleFormTag(tag: string) {
    formTags.value = formTags.value.includes(tag)
      ? formTags.value.filter((item) => item !== tag)
      : [...formTags.value, tag]
  }

  function toggleSelectedTag(tag: string) {
    if (!selected.value) return
    const current = selected.value.tags || []
    updateExecutableInspiration(selected.value.id, {
      tags: current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    })
  }

  function openInspirationEditor(edit = false) {
    editingInspirationId.value = edit ? selected.value?.id || '' : ''
    Object.assign(inspirationForm, {
      title: edit ? selected.value?.title || '' : '',
      referenceUrl: edit ? selected.value?.referenceUrl || '' : '',
      sourceAuthor: edit ? selected.value?.sourceAuthor || '' : '',
      notes: edit ? selected.value?.angle || '' : '',
      category: (edit ? selected.value?.category : '未分类') || '未分类',
      tags: edit ? (selected.value?.tags || []).join('，') : ''
    })
    formTags.value = edit ? [...(selected.value?.tags || [])] : []
    customTagInput.value = ''
    inspirationEditorOpen.value = true
  }

  function saveInspirationEditor() {
    if (!inspirationForm.title.trim()) {
      ElMessage.warning('请填写灵感名称')
      return
    }
    if (editingInspirationId.value) {
      updateExecutableInspiration(editingInspirationId.value, {
        title: inspirationForm.title,
        referenceUrl: inspirationForm.referenceUrl,
        sourceAuthor: inspirationForm.sourceAuthor,
        angle: inspirationForm.notes,
        category: inspirationForm.category,
        tags: formTags.value
      })
      ElMessage.success('灵感资料已更新')
    } else {
      const inspiration = createManualExecutableInspiration({
        title: inspirationForm.title,
        referenceUrl: inspirationForm.referenceUrl,
        sourceAuthor: inspirationForm.sourceAuthor,
        notes: inspirationForm.notes,
        category: inspirationForm.category,
        tags: formTags.value
      })
      selectedId.value = inspiration.id
      ElMessage.success('灵感已加入知识库')
    }
    inspirationEditorOpen.value = false
  }

  async function handleRemoveInspiration() {
    if (!selected.value) return
    const inspiration = selected.value
    try {
      await ElMessageBox.confirm(
        `从灵感库删除“${inspiration.title}”？已经生成的脚本会保留。`,
        '删除灵感',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeExecutableInspiration(inspiration.id)
      selectedId.value = dojoInspirationStore.executableInspirations[0]?.id || ''
      ElMessage.success('已从灵感库删除，原候选恢复为可再次筛选')
    } catch {
      return
    }
  }

  function openAiImport() {
    aiRawText.value = ''
    aiPreview.value = []
    aiImportOpen.value = true
  }

  async function runAiImport() {
    if (!aiRawText.value.trim()) {
      ElMessage.warning('请先粘贴链接、拍摄要求或灵感笔记')
      return
    }
    aiParsing.value = true
    try {
      const result = await parseInspirationBatchImport(aiRawText.value)
      aiPreview.value = result.drafts
      if (!result.drafts.length) {
        ElMessage.warning(result.content || '没有识别出可导入的灵感')
        return
      }
      ElMessage.success(`已识别 ${result.drafts.length} 条，请确认后入库`)
    } finally {
      aiParsing.value = false
    }
  }

  function confirmAiImport() {
    if (!aiPreview.value.length) return
    let firstId = ''
    aiPreview.value.forEach((draft) => {
      const inspiration = createManualExecutableInspiration({
        title: draft.title,
        referenceUrl: draft.referenceUrl,
        notes: draft.angle,
        hook: draft.hook,
        shotPlan: draft.shotPlan,
        copyPlan: draft.copyPlan,
        musicPlan: draft.musicPlan,
        visualNotes: draft.visualNotes,
        transcript: draft.transcript
      })
      if (!firstId) firstId = inspiration.id
    })
    if (firstId) selectedId.value = firstId
    ElMessage.success(`已导入 ${aiPreview.value.length} 条灵感`)
    aiImportOpen.value = false
  }
</script>

<template>
  <section class="library-surface">
    <aside class="library-index">
      <header>
        <span>视频边栏</span>
        <div>
          <strong>{{ dojoInspirationStore.executableInspirations.length }}</strong>
          <button type="button" class="is-ai" @click="openAiImport">
            <Icon icon="ph:sparkle" width="14" />AI 导入
          </button>
          <button type="button" @click="openInspirationEditor(false)">
            <Icon icon="ph:plus" width="14" />添加
          </button>
        </div>
      </header>
      <label>
        <Icon icon="ph:magnifying-glass" width="16" />
        <input v-model="query" type="search" placeholder="搜索角度、标签或入库记录" />
      </label>
      <LibraryLayerIndex
        v-model:group-by="groupBy"
        v-model:layer="layer"
        :items="pagedLayerItems"
        :selected-id="selected?.id || ''"
        :group-by-options="libraryGroupOptions"
        empty-text="没有匹配的可执行灵感"
        @select="selectedId = $event"
      />
      <nav v-if="pageCount > 1" class="library-pager" aria-label="灵感分页">
        <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button type="button" :disabled="page >= pageCount" @click="page += 1">下一页</button>
      </nav>
    </aside>

    <section v-if="selected" class="library-preview-pane">
      <header>
        <h2>{{ selected.title }}</h2>
        <p>{{ selected.angle }}</p>
        <div class="library-meta">
          <em>{{ ingestDayLabel(selected.createdAt) }} 入库</em>
          <em v-for="tag in selected.tags || []" :key="tag">#{{ tag }}</em>
          <em v-if="!(selected.tags || []).length">未打标签</em>
          <button
            v-if="sourceHandle"
            type="button"
            class="source-home"
            @click="openSourceHome"
          >
            <Icon icon="ph:user-circle" width="14" />
            {{ sourceHandle.startsWith('@') ? sourceHandle : `@${sourceHandle}` }} 加入对标库
          </button>
        </div>
      </header>
      <VideoPreviewPanel
        class="library-preview"
        player-only
        :title="selected.title"
        :url="selected.referenceUrl"
        empty-text="当前链接不支持站内嵌入，但原始 URL 已永久保留"
      />
    </section>

    <aside v-if="selected" class="library-work-pane">
      <header class="library-work-pane__toolbar">
        <div class="library-work-pane__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :class="{ 'is-active': draftTab === 'transcript' }"
            @click="draftTab = 'transcript'"
          >
            口播
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-active': draftTab === 'visual' }"
            @click="draftTab = 'visual'"
          >
            画面
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-active': draftTab === 'meta' }"
            @click="draftTab = 'meta'"
          >
            资料
          </button>
        </div>
        <div class="library-work-pane__actions dojo-action-row">
          <button type="button" class="is-secondary" @click="handleCreateReview">
            启发
          </button>
          <button type="button" class="is-secondary" @click="openInspirationEditor(true)">
            编辑
          </button>
          <button type="button" class="is-primary" @click="saveEvidence()">
            保存
          </button>
          <button
            type="button"
            class="is-danger"
            aria-label="删除当前灵感"
            title="删除当前灵感"
            @click="handleRemoveInspiration"
          >
            <Icon icon="ph:trash" width="16" />
          </button>
        </div>
      </header>

      <section v-show="draftTab !== 'meta'" class="script-draft">
        <textarea
          v-if="draftTab === 'transcript'"
          v-model="evidenceForm.transcript"
          placeholder="对照片子写人物口播，或直接改导入来的稿"
        />
        <textarea
          v-else
          v-model="evidenceForm.visualNotes"
          placeholder="镜头、构图、产品露出"
        />
      </section>

      <section v-show="draftTab === 'meta'" class="library-meta-pane">
        <section class="tag-editor">
          <header>
            <h3>标签</h3>
          </header>
          <div class="tag-picker__chips">
            <button
              v-for="tag in knownTags"
              :key="tag"
              type="button"
              :class="{ 'is-active': (selected.tags || []).includes(tag) }"
              @click="toggleSelectedTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
          <form class="tag-picker__custom" @submit.prevent="addCustomTagTo('selected')">
            <input v-model="selectedCustomTag" type="text" placeholder="自建标签，回车添加" />
            <button type="submit">添加</button>
          </form>
        </section>

        <section v-if="selected.hook" class="hook-line">
          <span>HOOK</span>
          <strong>{{ selected.hook }}</strong>
        </section>

        <section class="annotation-board">
          <header>
            <div>
              <h3>改编需求</h3>
              <p>必须保留的动作、不能照搬的部分。</p>
            </div>
            <span>{{ annotations.length }} 条</span>
          </header>
          <form @submit.prevent="handleAddAnnotation">
            <input
              v-model="annotationInput"
              type="text"
              placeholder="例如：前 2 秒直接展示测试结果"
            />
            <button type="submit"><Icon icon="ph:plus" width="14" />添加</button>
          </form>
          <div v-if="annotations.length" class="annotation-list">
            <article v-for="annotation in annotations" :key="annotation.id">
              <Icon icon="ph:push-pin-duotone" width="15" />
              <p>{{ annotation.text }}</p>
              <button
                type="button"
                aria-label="删除批注"
                @click="removeInspirationAnnotation(selected.id, annotation.id)"
              >
                <Icon icon="ph:x" width="13" />
              </button>
            </article>
          </div>
        </section>
      </section>

      <section v-show="draftTab !== 'meta'" class="library-ai">
        <header>
          <strong>AI 改稿</strong>
          <div class="quick-prompts">
            <button
              type="button"
              @click="aiPrompt = '按人物口播改成可拍稿，不要 Markdown。'"
            >
              改一版
            </button>
            <button type="button" @click="aiPrompt = '把口播压成大约 15 秒，保留开场。'">
              15 秒
            </button>
            <button type="button" @click="aiPrompt = '把开场钩子写得更直接。'">
              Hook
            </button>
            <button type="button" @click="aiPrompt = '找出最难拍的环节并给替代。'">
              降难度
            </button>
          </div>
        </header>
        <p v-if="aiError" class="ai-error">{{ aiError }}</p>
        <div class="conversation">
          <article v-for="message in messages" :key="message.id" :class="`is-${message.role}`">
            <span>{{
              message.role === 'user' ? '你' : message.role === 'assistant' ? 'AI' : '系统'
            }}</span>
            <p>
              {{
                message.role === 'assistant' ? stripMarkdown(message.content) : message.content
              }}
            </p>
            <button
              v-if="message.role === 'assistant' && message.id === latestAssistantMessage?.id"
              type="button"
              class="apply-ai"
              @click="applyLatestAiAdaptation"
            >
              写入口播
            </button>
          </article>
          <p v-if="!messages.length" class="conversation-empty">写下口播或画面，再让 AI 改。</p>
        </div>
        <form @submit.prevent="handleAiRequest">
          <textarea v-model="aiPrompt" rows="2" placeholder="要改哪里，直接说" />
          <button type="submit" :disabled="aiLoading">
            {{ aiLoading ? '改写中…' : '发送' }}
          </button>
        </form>
      </section>
    </aside>

    <CreatorReviewDialog
      :open="reviewOpen"
      :initial-inspiration-id="selected?.id || ''"
      @close="reviewOpen = false"
      @saved="reviewOpen = false"
    />

    <ElDialog
      v-model="inspirationEditorOpen"
      :title="editingInspirationId ? '编辑灵感资料' : '添加灵感资料'"
      width="min(600px, calc(100vw - 32px))"
      destroy-on-close
    >
      <ElForm label-position="top">
        <ElFormItem label="灵感名称" required>
          <ElInput v-model="inspirationForm.title" placeholder="例如：海外游戏化转场案例" />
        </ElFormItem>
        <ElFormItem label="视频链接（可选）">
          <ElInput
            v-model="inspirationForm.referenceUrl"
            placeholder="粘贴 TikTok / YouTube / 小红书链接"
          />
        </ElFormItem>
        <ElFormItem label="来源账号（建议填写）">
          <ElInput
            v-model="inspirationForm.sourceAuthor"
            placeholder="例如：@sunnyjadediary"
          />
        </ElFormItem>
        <ElFormItem label="标签（可选，默认不选）">
          <div class="tag-picker">
            <div class="tag-picker__chips">
              <button
                v-for="tag in knownTags"
                :key="tag"
                type="button"
                :class="{ 'is-active': formTags.includes(tag) }"
                @click="toggleFormTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
            <form class="tag-picker__custom" @submit.prevent="addCustomTagTo('form')">
              <input v-model="customTagInput" type="text" placeholder="自建标签，回车添加" />
              <button type="submit">添加</button>
            </form>
          </div>
        </ElFormItem>
        <ElFormItem label="初始记录（可选）">
          <ElInput
            v-model="inspirationForm.notes"
            type="textarea"
            :rows="8"
            placeholder="先自由记录为什么值得保存、可迁移的形式或后续要验证的问题"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="inspirationEditorOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveInspirationEditor">保存到知识库</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="aiImportOpen"
      title="AI 批量导入灵感"
      width="min(760px, calc(100vw - 32px))"
      destroy-on-close
    >
      <p class="ai-import-hint">
        粘贴多条链接、拍摄要求、口播要点或表格。AI
        会自动识别链接，并拆出镜头 / 话术 / Hook，确认后再写入灵感库。
      </p>
      <ElInput
        v-model="aiRawText"
        type="textarea"
        :rows="9"
        placeholder="例如：&#10;https://www.tiktok.com/@xxx/video/123&#10;拍摄要求：前 2 秒特写电池，换弹要有 ASMR，收尾露出包装&#10;Hook：The drop was accidental…"
      />
      <div class="ai-import-actions">
        <ElButton type="primary" :loading="aiParsing" @click="runAiImport">解析预览</ElButton>
        <span v-if="aiPreview.length">已识别 {{ aiPreview.length }} 条</span>
      </div>
      <ElTable
        v-if="aiPreview.length"
        :data="aiPreview"
        stripe
        size="small"
        class="ai-import-preview"
        max-height="320"
      >
        <ElTableColumn prop="title" label="标题" min-width="140" show-overflow-tooltip />
        <ElTableColumn prop="referenceUrl" label="链接" min-width="160" show-overflow-tooltip />
        <ElTableColumn label="拍摄要求" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ (row.shotPlan || []).join(' · ') || row.visualNotes || '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="hook" label="Hook" min-width="120" show-overflow-tooltip />
      </ElTable>
      <template #footer>
        <ElButton @click="aiImportOpen = false">取消</ElButton>
        <ElButton type="primary" :disabled="!aiPreview.length" @click="confirmAiImport">
          确认导入 {{ aiPreview.length || '' }} 条
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped lang="scss">
  .library-surface {
    display: grid;
    grid-template-columns: minmax(220px, 0.95fr) minmax(240px, 1.15fr) minmax(360px, 2.15fr);
    min-width: 0;
    height: 100%;
    max-width: none;
    margin: 0;
    overflow: hidden;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 18px;
    box-shadow: var(--dojo-shadow-sm);
  }

  .library-index {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 16px 12px;
    overflow: hidden;
    background: var(--dojo-paper-muted);
    border-right: 1px solid var(--dojo-line);
  }

  .library-index :deep(.layer-index) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    margin-top: 10px;
  }

  .library-index :deep(.layer-groups) {
    flex: 1;
    max-height: none;
    overflow: auto;
  }

  .library-index > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px 12px;
  }

  .library-index > header > div {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .library-index > header button {
    display: flex;
    gap: 3px;
    align-items: center;
    min-height: 25px;
    padding: 0 7px;
    font-size: 11px;
    color: #fffdfc;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 10px;
  }

  .library-index > header button.is-ai {
    color: #fffdfc;
    background: #403666;
    border: 1px solid #403666;
  }

  .ai-import-hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--dojo-muted-strong);
  }

  .ai-import-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 12px 0;
    font-size: 12px;
    color: var(--dojo-muted);
  }

  .ai-import-preview {
    margin-top: 4px;
  }

  .library-index > header span {
    font-size: 10px;
    font-weight: 800;
    color: var(--dojo-muted);
    letter-spacing: 0.12em;
  }

  .library-index > header strong {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    font-size: 11px;
    color: #fff;
    background: var(--dojo-accent);
    border-radius: 7px;
  }

  .library-index > label {
    display: flex;
    gap: 7px;
    align-items: center;
    min-height: 36px;
    padding: 0 10px;
    color: var(--dojo-muted);
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 9px;
  }

  .library-index input {
    min-width: 0;
    font-size: 11px;
    background: transparent;
    border: 0;
    outline: none;
  }

  .library-list {
    display: grid;
    gap: 4px;
    margin-top: 12px;
  }

  .library-list button {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 14px;
    gap: 8px;
    align-items: center;
    min-height: 68px;
    padding: 9px;
    color: var(--dojo-muted-strong);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 9px;
  }

  .library-list button:hover,
  .library-list button:focus-visible {
    color: var(--dojo-ink);
    background: var(--dojo-paper);
    outline: none;
  }

  .library-list button.is-active {
    color: var(--dojo-ink);
    background: color-mix(in srgb, var(--dojo-accent) 16%, var(--dojo-paper));
    box-shadow: inset 3px 0 0 var(--dojo-accent);
  }

  .library-list button > span:first-child {
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .library-list button > span:nth-child(2) {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .library-list strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-list small {
    display: -webkit-box;
    overflow: hidden;
    font-size: 10px;
    line-height: 1.4;
    color: var(--dojo-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .library-list > p {
    padding: 18px 8px;
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .library-pager {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    margin-top: auto;
    font-size: 11px;
    color: var(--dojo-muted);

    button {
      min-height: 32px;
      padding: 0 10px;
      color: var(--dojo-ink);
      cursor: pointer;
      background: var(--dojo-paper);
      border: 1px solid var(--dojo-line);
      border-radius: 8px;

      &:disabled {
        color: var(--dojo-muted);
        cursor: not-allowed;
      }
    }
  }

  .library-preview-pane,
  .library-work-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .library-preview-pane {
    container-type: size;
    display: flex;
    flex-direction: column;
    align-items: center;
    align-self: stretch;
    padding: 12px 16px 16px;
    overflow: auto;
    background: var(--dojo-canvas);
    border-right: 1px solid var(--dojo-line);
  }

  .library-preview-pane > header {
    flex: 0 0 auto;
    width: 100%;
    margin-bottom: 10px;
  }

  .library-preview-pane h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.35;
  }

  .library-preview-pane p {
    display: -webkit-box;
    margin: 4px 0 0;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.45;
    color: var(--dojo-muted-strong);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .library-preview {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: min(100%, 300px);
    max-height: min(520px, calc(100cqh - 96px));
    height: auto;
    aspect-ratio: 9 / 16;
    min-height: 0;
    margin: auto;
    background: transparent;
  }

  .library-preview :deep(.video-preview-panel) {
    flex: 1;
    min-height: 0;
    height: 100%;
    background: transparent;
  }

  .library-preview :deep(.video-preview-panel__player) {
    background: transparent;
  }

  .library-work-pane {
    padding: 12px 12px 12px;
    overflow: hidden;
    background: var(--dojo-paper-muted);
  }

  .library-work-pane__toolbar {
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    margin-bottom: 10px;
  }

  .library-work-pane__tabs {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 9px;
  }

  .library-work-pane__tabs button {
    min-height: 28px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--dojo-muted-strong);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 7px;
  }

  .library-work-pane__tabs button.is-active {
    font-weight: 650;
    color: var(--dojo-ink);
    background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
  }

  .library-work-pane__actions {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
    justify-content: flex-end;
    margin: 0 0 0 auto;
  }

  .library-work-pane__actions.dojo-action-row > button {
    min-height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }

  .script-draft {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .library-meta-pane {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    gap: 14px;
    min-height: 0;
    overflow: auto;
  }

  .tag-editor {
    display: grid;
    gap: 10px;
    margin-bottom: 0;
  }

  .tag-picker,
  .tag-picker__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-picker {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  .tag-picker__chips button {
    min-height: 30px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 999px;
  }

  .tag-picker__chips button.is-active {
    color: #fff;
    background: var(--dojo-accent);
    border-color: var(--dojo-accent);
  }

  .tag-picker__custom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }

  .tag-picker__custom input {
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    color: var(--dojo-ink);
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .tag-picker__custom button {
    height: 32px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .tag-editor header h3,
  .script-draft header h3,
  .annotation-board header h3 {
    margin: 0;
    font-size: 13px;
  }

  .tag-editor header p,
  .script-draft header p,
  .annotation-board header p {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .script-draft textarea {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    padding: 12px 14px;
    font: inherit;
    font-size: 14px;
    line-height: 1.65;
    color: var(--dojo-ink);
    resize: none;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
    outline: none;
  }

  .library-ai {
    display: flex;
    flex: 0 1 38%;
    flex-direction: column;
    gap: 8px;
    min-height: 180px;
    max-height: 42%;
    padding-top: 10px;
    margin-top: 10px;
    border-top: 1px solid var(--dojo-line);
  }

  .library-ai > header {
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .library-ai > header strong {
    font-size: 13px;
    white-space: nowrap;
  }

  .quick-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: flex-end;
  }

  .quick-prompts button {
    min-height: 26px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 999px;
  }

  .ai-error {
    padding: 8px 10px;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #9f363f;
    background: #fff0f1;
    border: 1px solid #f1c9cd;
    border-radius: 8px;
  }

  .conversation {
    display: grid;
    flex: 1 1 auto;
    gap: 8px;
    align-content: start;
    min-height: 0;
    overflow-y: auto;
  }

  .conversation article {
    display: grid;
    gap: 4px;
    padding: 9px 10px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line-soft);
    border-radius: 8px;
  }

  .conversation article.is-user {
    margin-left: 22px;
  }

  .conversation article span {
    font-size: 10px;
    font-weight: 700;
    color: var(--dojo-accent);
  }

  .conversation article p {
    margin: 0;
    font-size: 12px;
    line-height: 1.65;
    color: var(--dojo-ink);
    white-space: pre-wrap;
  }

  .conversation article .apply-ai {
    justify-self: start;
    min-height: 26px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 700;
    color: #fffdfc;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 7px;
  }

  .conversation-empty {
    margin: 0;
    padding: 8px 0;
    font-size: 12px;
    color: var(--dojo-muted);
  }

  .library-ai form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
  }

  .library-ai textarea {
    width: 100%;
    min-height: 52px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
    color: var(--dojo-ink);
    resize: none;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
    outline: none;
  }

  .library-ai form button {
    min-width: 52px;
    min-height: 36px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 8px;
  }

  .library-ai form button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .inspiration-detail {
    min-width: 0;
    padding: 25px;
  }

  .inspiration-detail__head {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .inspiration-detail__head span {
    font-size: 10px;
    font-weight: 800;
    color: var(--dojo-accent);
    letter-spacing: 0.13em;
  }

  .inspiration-detail__head h2,
  .inspiration-detail__head p {
    margin: 0;
  }

  .inspiration-detail__head h2 {
    margin-top: 5px;
    font-family: var(--dojo-serif);
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
  }

  .library-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
  }

  .library-meta em {
    padding: 3px 7px;
    font-size: 10px;
    font-style: normal;
    color: var(--dojo-ink);
    background: color-mix(in srgb, var(--dojo-blue) 14%, var(--dojo-paper));
    border-radius: 8px;
  }

  .source-home {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    margin: 0;
    padding: 0;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-accent);
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .inspiration-detail__head p {
    max-width: 760px;
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--dojo-muted-strong);
  }

  .inspiration-detail__actions {
    justify-content: flex-end;
  }

  .library-preview-row {
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 14px;
    align-items: stretch;
    margin-top: 20px;
  }

  .hook-line {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 13px 15px;
    margin-top: 15px;
    color: #fffdfc;
    background: #403666;
    border-radius: 12px;
  }

  .hook-line span {
    font-size: 10px;
    font-weight: 800;
    color: #c9b8ff;
    letter-spacing: 0.12em;
  }

  .hook-line strong {
    font-size: 11px;
    line-height: 1.5;
  }

  .evidence-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 100%;
    padding: 16px;
    margin-top: 0;
    background: var(--dojo-paper-muted);
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
  }

  .evidence-editor > header,
  .evidence-editor > footer {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .evidence-editor h3,
  .evidence-editor p {
    margin: 0;
  }

  .evidence-editor h3 {
    font-size: 12px;
  }

  .evidence-editor p,
  .evidence-editor > footer > span {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .evidence-editor > header > span {
    flex: 0 0 auto;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-amber);
    background: color-mix(in srgb, var(--dojo-amber) 10%, var(--dojo-paper));
    border-radius: 7px;

    &.is-ready {
      color: var(--dojo-green);
      background: color-mix(in srgb, var(--dojo-green) 10%, var(--dojo-paper));
    }
  }

  .evidence-editor__fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    flex: 1;
    margin-top: 0;
  }

  .evidence-editor__fields label {
    display: grid;
    gap: 6px;
  }

  .evidence-editor__fields label > span {
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-muted-strong);
  }

  .evidence-editor textarea {
    width: 100%;
    min-width: 0;
    padding: 10px 11px;
    font: inherit;
    font-size: 10px;
    line-height: 1.55;
    color: var(--dojo-ink);
    resize: vertical;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .evidence-editor textarea:focus-visible {
    border-color: var(--dojo-accent);
    outline: 2px solid var(--dojo-accent-soft);
    outline-offset: 1px;
  }

  .evidence-editor > footer {
    align-items: center;
    margin-top: 10px;
  }

  .evidence-editor > footer > span {
    margin-top: 0;
  }

  .evidence-editor > footer button,
  .annotation-board form button {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    color: #fff;
    white-space: nowrap;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 8px;
  }

  .execution-grid {
    display: grid;
    grid-template-columns: 1.25fr 1fr 0.8fr;
    gap: 10px;
    margin-top: 12px;
  }

  .execution-grid > section {
    padding: 14px;
    background: #f1f5f9;
    border-radius: 10px;
  }

  .execution-grid header {
    display: flex;
    gap: 7px;
    align-items: center;
  }

  .execution-grid h3 {
    margin: 0;
    font-size: 10px;
  }

  .execution-grid ol,
  .execution-grid ul {
    display: grid;
    gap: 7px;
    padding: 0;
    margin: 11px 0 0;
    list-style: none;
  }

  .execution-grid li {
    font-size: 11px;
    line-height: 1.5;
    color: var(--dojo-muted-strong);
  }

  .execution-grid ol li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 7px;
  }

  .execution-grid time {
    font-size: 10px;
    font-weight: 800;
    color: var(--dojo-accent);
  }

  .execution-grid ul li {
    position: relative;
    padding-left: 11px;
  }

  .execution-grid ul li::before {
    position: absolute;
    top: 6px;
    left: 0;
    width: 4px;
    height: 4px;
    content: '';
    background: var(--dojo-cyan);
    border-radius: 50%;
  }

  .annotation-board {
    padding: 15px;
    margin-top: 12px;
    background: var(--dojo-paper-muted);
    border-radius: 10px;
  }

  .annotation-board > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .annotation-board h3,
  .annotation-board p {
    margin: 0;
  }

  .annotation-board h3 {
    font-size: 10px;
  }

  .annotation-board p {
    margin-top: 4px;
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .annotation-board > header > span {
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-accent);
  }

  .annotation-board form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    margin-top: 12px;
  }

  .annotation-board input {
    min-width: 0;
    padding: 0 10px;
    font-size: 11px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .annotation-list {
    display: grid;
    gap: 6px;
    margin-top: 10px;
  }

  .annotation-list article {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) 26px;
    gap: 7px;
    align-items: center;
    padding: 8px 9px;
    background: rgb(255 255 255 / 76%);
    border-radius: 7px;
  }

  .annotation-list p {
    font-size: 10px;
    line-height: 1.5;
  }

  .annotation-list button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    color: var(--dojo-muted);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 6px;
  }

  @container workspace (max-width: 900px) {
    .library-surface {
      grid-template-columns: 1fr;
      height: auto;
    }

    .library-index,
    .library-preview-pane {
      border-right: 0;
      border-bottom: 1px solid var(--dojo-line);
    }

    .library-index {
      max-height: 320px;
    }

    .library-preview {
      width: min(100%, 260px);
      max-height: 460px;
    }

    .library-work-pane {
      min-height: 72vh;
      overflow: auto;
    }

    .library-ai {
      max-height: none;
    }
  }

  @media (width <= 800px) {
    .library-surface {
      border-radius: 12px;
    }

    .library-preview-pane,
    .library-work-pane {
      padding: 14px;
    }

    .annotation-board form {
      grid-template-columns: 1fr;
    }
  }
</style>
