<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Icon } from '@iconify/vue'
import GradientButton from '../common/GradientButton.vue'
import type { NewContentPayload } from '../../types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: NewContentPayload]
}>()

const defaultForm = () => ({
  title: '',
  role: 'acquisition',
  tier: 'B',
  type: '方法拆解',
  priority: 'normal',
  rawIdea: '',
})

const form = reactive(defaultForm())

function handleClose() {
  emit('submit', {
    title: form.title,
    role: form.role as NewContentPayload['role'],
    tier: form.tier as NewContentPayload['tier'],
    type: form.type,
    priority: form.priority as NewContentPayload['priority'],
    rawIdea: form.rawIdea,
  })
}

function handleSubmit() {
  if (!form.title.trim()) {
    document.querySelector<HTMLInputElement>('#content-title')?.focus()
    return
  }

  emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      Object.assign(form, defaultForm())
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="modal-backdrop"
        role="presentation"
        @mousedown.self="handleClose"
      >
        <section
          class="new-content-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-content-title"
        >
          <button
            class="modal-close"
            type="button"
            aria-label="关闭"
            @click="handleClose"
          >
            <Icon icon="ph:x" width="20" />
          </button>

          <header class="modal-header">
            <p class="eyebrow">NEW SIGNAL</p>
            <h2 id="new-content-title">记下一条值得推进的内容</h2>
            <p>先留下核心想法，进入内容档案后再补充细节。</p>
          </header>

          <form class="content-form" @submit.prevent="handleSubmit">
            <label class="form-field form-field--full">
              <span>内容标题 <b>*</b></span>
              <input
                id="content-title"
                v-model="form.title"
                type="text"
                required
                placeholder="例如：客户反复问你的问题，就是精准选题"
              />
            </label>

            <label class="form-field">
              <span>内容角色</span>
              <select v-model="form.role">
                <option value="acquisition">获客</option>
                <option value="trust">建立信任</option>
                <option value="conversion">完成转化</option>
              </select>
            </label>

            <label class="form-field">
              <span>内容档位</span>
              <select v-model="form.tier">
                <option value="A">A · 重点制作</option>
                <option value="B">B · 常规制作</option>
                <option value="C">C · 快速响应</option>
              </select>
            </label>

            <label class="form-field">
              <span>主要类型</span>
              <select v-model="form.type">
                <option>方法拆解</option>
                <option>观点表达</option>
                <option>案例复盘</option>
                <option>客户问答</option>
              </select>
            </label>

            <label class="form-field">
              <span>优先级</span>
              <select v-model="form.priority">
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="normal">普通</option>
                <option value="low">低</option>
              </select>
            </label>

            <label class="form-field form-field--full">
              <span>原始想法</span>
              <textarea
                v-model="form.rawIdea"
                rows="4"
                placeholder="写下触发这条内容的真实场景、问题或一句判断……"
              />
            </label>

            <footer class="modal-footer">
              <button class="secondary-button" type="button" @click="handleClose">
                取消
              </button>
              <GradientButton type="submit">
                保存并继续
                <Icon icon="ph:arrow-right" width="18" />
              </GradientButton>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
