<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { requestReviewSynthesis } from '@/services/reviewAiService'
  import {
    completeCreatorReview,
    createCreatorReview,
    dojoCreatorStore
  } from '@/store/dojoCreatorStore'
  import { dojoInspirationStore } from '@/store/dojoInspirationStore'
  import type { CompleteCreatorReviewInput } from '@/types/dojoCreator'

  const props = withDefaults(
    defineProps<{
      open: boolean
      reviewId?: string
      initialContentId?: string
      initialInspirationId?: string
    }>(),
    {
      reviewId: '',
      initialContentId: '',
      initialInspirationId: ''
    }
  )

  const emit = defineEmits<{
    close: []
    saved: [reviewId: string]
  }>()

  interface ReviewDocumentForm extends CompleteCreatorReviewInput {
    contentId: string
    inspirationId: string
    tags: string[]
  }

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const aiLoading = ref(false)

  function defaultForm(): ReviewDocumentForm {
    const initialInspirationId = props.initialInspirationId
    return {
      contentId:
        props.initialContentId ||
        (initialInspirationId ? '' : dojoCreatorStore.contents[0]?.id || ''),
      inspirationId: initialInspirationId,
      title: '',
      rating: 5,
      result: '',
      reason: '',
      videoUrl: '',
      scriptSnapshot: '',
      manualNotes: '',
      shotNotes: '',
      copyNotes: '',
      musicNotes: '',
      aiSummary: '',
      nextAction: '',
      tags: [],
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reusableRule: '',
      knowledgeDimension: 'copy'
    }
  }

  const form = reactive<ReviewDocumentForm>(defaultForm())
  const activeReview = computed(() =>
    dojoCreatorStore.reviews.find((review) => review.id === props.reviewId)
  )
  const selectedInspiration = computed(() =>
    dojoInspirationStore.executableInspirations.find((item) => item.id === form.inspirationId)
  )
  const selectedContent = computed(() =>
    dojoCreatorStore.contents.find((item) => item.id === form.contentId)
  )
  const sourceTitle = computed(
    () => selectedContent.value?.title || selectedInspiration.value?.title || '未命名来源'
  )
  const rules: FormRules<ReviewDocumentForm> = {
    manualNotes: [{ required: true, message: '请先写下这条内容给你的启发', trigger: 'blur' }]
  }

  watch(
    () => props.open,
    (open) => {
      if (!open) return
      const review = activeReview.value
      if (!review) {
        Object.assign(form, defaultForm())
        if (selectedInspiration.value?.referenceUrl) {
          form.videoUrl = selectedInspiration.value.referenceUrl
        }
        return
      }
      Object.assign(form, {
        contentId: review.contentId,
        inspirationId: review.inspirationId || '',
        title: review.title || '',
        rating: review.rating || 5,
        result: review.result || '',
        reason: review.reason || '',
        videoUrl: review.videoUrl || '',
        scriptSnapshot: review.scriptSnapshot || '',
        manualNotes: review.manualNotes || '',
        shotNotes: review.shotNotes || '',
        copyNotes: review.copyNotes || '',
        musicNotes: review.musicNotes || '',
        aiSummary: review.aiSummary || '',
        nextAction: review.nextAction || '',
        tags: [...(review.tags || [])],
        views: review.views || 0,
        likes: review.likes || 0,
        comments: review.comments || 0,
        shares: review.shares || 0,
        saves: review.saves || 0,
        reusableRule: '',
        knowledgeDimension: 'copy'
      })
    }
  )

  watch(
    () => form.inspirationId,
    () => {
      if (!form.videoUrl && selectedInspiration.value?.referenceUrl) {
        form.videoUrl = selectedInspiration.value.referenceUrl
      }
    }
  )

  function handleClose() {
    formRef.value?.clearValidate()
    Object.assign(form, defaultForm())
    emit('close')
  }

  async function handleAiSynthesis() {
    const manualNotes = form.manualNotes?.trim() || ''
    if (!manualNotes) {
      ElMessage.warning('先写下你的真实启发，再交给 AI 整理')
      return
    }
    aiLoading.value = true
    try {
      form.aiSummary = await requestReviewSynthesis({
        sourceTitle: sourceTitle.value,
        manualNotes,
        shotNotes: form.shotNotes || '',
        copyNotes: form.copyNotes || '',
        musicNotes: form.musicNotes || '',
        result: form.result,
        reason: form.reason
      })
      ElMessage.success('AI 已基于你的记录整理知识卡')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : 'AI 整理失败，请稍后重试')
    } finally {
      aiLoading.value = false
    }
  }

  async function handleSubmit() {
    if (!form.contentId && !form.inspirationId) {
      ElMessage.warning('请至少关联一条自己的内容或灵感库视频')
      return
    }
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch {
      ElMessage.warning('请先写下这条内容给你的启发')
      return
    }

    submitting.value = true
    try {
      const review =
        activeReview.value ||
        createCreatorReview(
          form.contentId,
          undefined,
          form.inspirationId || undefined,
          sourceTitle.value
        )
      if (!review) throw new Error('missing review')
      completeCreatorReview(review.id, { ...form })
      ElMessage.success('已保存到个人内容知识库')
      emit('saved', review.id)
      handleClose()
    } catch {
      ElMessage.error('记录保存失败，请重试')
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <ElDialog
    :model-value="open"
    :title="activeReview?.reviewedAt ? '编辑知识记录' : '记录这条内容的启发'"
    width="min(860px, calc(100vw - 32px))"
    destroy-on-close
    @close="handleClose"
  >
    <div class="review-mode-note">
      <Icon icon="ph:bookmark-simple-duotone" width="20" />
      <div>
        <strong>先保存你的判断，再让 AI 整理</strong>
        <span>只需写下启发即可保存；数据、完整归因和知识规则都可以以后再补。</span>
      </div>
    </div>

    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
      <div class="review-form-grid">
        <ElFormItem label="关联我的内容（可选）">
          <ElSelect v-model="form.contentId" filterable clearable :disabled="Boolean(activeReview)">
            <ElOption
              v-for="content in dojoCreatorStore.contents"
              :key="content.id"
              :label="content.title"
              :value="content.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="关联灵感库视频（可选）">
          <ElSelect
            v-model="form.inspirationId"
            filterable
            clearable
            :disabled="Boolean(activeReview)"
          >
            <ElOption
              v-for="inspiration in dojoInspirationStore.executableInspirations"
              :key="inspiration.id"
              :label="inspiration.title"
              :value="inspiration.id"
            />
          </ElSelect>
        </ElFormItem>
      </div>

      <div class="review-form-grid">
        <ElFormItem label="知识卡标题">
          <ElInput v-model="form.title" :placeholder="`${sourceTitle} · 我的启发`" />
        </ElFormItem>
        <ElFormItem label="视频链接">
          <ElInput v-model="form.videoUrl" placeholder="TikTok、YouTube 或本地视频地址" />
        </ElFormItem>
      </div>

      <ElFormItem label="我的启发" prop="manualNotes">
        <ElInput
          v-model="form.manualNotes"
          type="textarea"
          :rows="5"
          placeholder="这条视频哪里打动了你？下次可能在什么场景复用？先用自己的话记下来。"
        />
      </ElFormItem>

      <div class="dimension-notes">
        <ElFormItem label="画面 / 镜头">
          <ElInput
            v-model="form.shotNotes"
            type="textarea"
            :rows="3"
            placeholder="构图、动作、节奏、转场、产品露出"
          />
        </ElFormItem>
        <ElFormItem label="内容 / 话术">
          <ElInput
            v-model="form.copyNotes"
            type="textarea"
            :rows="3"
            placeholder="Hook、结构、表达顺序、承诺与 CTA"
          />
        </ElFormItem>
        <ElFormItem label="音乐 / 声音">
          <ElInput
            v-model="form.musicNotes"
            type="textarea"
            :rows="3"
            placeholder="情绪、节拍、卡点、音效或静默"
          />
        </ElFormItem>
      </div>

      <section class="ai-knowledge-card">
        <header>
          <div>
            <strong>AI 知识整理</strong>
            <span>DeepSeek 只读取上面的文字记录，不会直接观看视频。</span>
          </div>
          <ElButton :loading="aiLoading" @click="handleAiSynthesis">
            <Icon icon="ph:sparkle" width="15" />
            整理为知识卡
          </ElButton>
        </header>
        <ElInput
          v-model="form.aiSummary"
          type="textarea"
          :rows="5"
          placeholder="AI 整理结果会出现在这里，你仍可以继续修改。"
        />
      </section>

      <details class="review-advanced">
        <summary>补充完整复盘与数据（可选）</summary>

        <ElFormItem label="脚本快照">
          <ElInput
            v-model="form.scriptSnapshot"
            type="textarea"
            :rows="3"
            placeholder="保留当时实际使用的开头、结构和 CTA"
          />
        </ElFormItem>

        <div class="metric-grid">
          <ElFormItem label="播放">
            <ElInputNumber v-model="form.views" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="点赞">
            <ElInputNumber v-model="form.likes" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="评论">
            <ElInputNumber v-model="form.comments" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="转发">
            <ElInputNumber v-model="form.shares" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="收藏">
            <ElInputNumber v-model="form.saves" :min="0" controls-position="right" />
          </ElFormItem>
        </div>

        <ElFormItem label="整体评价">
          <ElRate v-model="form.rating" />
        </ElFormItem>
        <div class="review-form-grid">
          <ElFormItem label="真实结果">
            <ElInput v-model="form.result" type="textarea" :rows="3" />
          </ElFormItem>
          <ElFormItem label="原因判断">
            <ElInput v-model="form.reason" type="textarea" :rows="3" />
          </ElFormItem>
        </div>
        <div class="review-form-grid">
          <ElFormItem label="下一步行动">
            <ElInput v-model="form.nextAction" placeholder="下一条具体要验证什么" />
          </ElFormItem>
          <ElFormItem label="标签">
            <ElSelect
              v-model="form.tags"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="输入后回车"
            />
          </ElFormItem>
        </div>
        <div class="review-dialog__knowledge-rule">
          <ElFormItem label="知识维度">
            <ElSelect v-model="form.knowledgeDimension">
              <ElOption label="镜头" value="shot" />
              <ElOption label="话术" value="copy" />
              <ElOption label="音乐" value="music" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="沉淀为可复用规则">
            <ElInput v-model="form.reusableRule" placeholder="例如：前三秒先给真实结果" />
          </ElFormItem>
        </div>
      </details>
    </ElForm>

    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit"> 保存到知识库 </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
  .review-mode-note {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 18px;
    color: #42536a;
    background: var(--dojo-paper-muted);
    border-radius: 10px;
  }

  .review-mode-note div {
    display: grid;
    gap: 3px;
  }

  .review-mode-note strong {
    color: #0969da;
  }

  .review-mode-note span {
    font-size: 11px;
    line-height: 1.5;
  }

  .review-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .dimension-notes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .ai-knowledge-card {
    padding: 14px;
    margin: 4px 0 18px;
    background: #f2f7f6;
    border: 1px solid #cfe5df;
    border-radius: 10px;
  }

  .ai-knowledge-card header {
    display: flex;
    gap: 18px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 11px;
  }

  .ai-knowledge-card header > div {
    display: grid;
    gap: 3px;
  }

  .ai-knowledge-card span {
    font-size: 10px;
    color: #5b6d78;
  }

  .review-advanced {
    padding-top: 14px;
    border-top: 1px solid #dce4ee;
  }

  .review-advanced summary {
    margin-bottom: 16px;
    font-weight: 700;
    color: #42536a;
    cursor: pointer;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }

  .review-dialog__knowledge-rule {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    gap: 14px;
  }

  :deep(.el-select),
  :deep(.el-input-number) {
    width: 100%;
  }

  @media (width <= 760px) {
    .review-form-grid,
    .dimension-notes,
    .review-dialog__knowledge-rule {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ai-knowledge-card header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
