<template>
  <div class="dojo-agent" :style="rootStyle">
    <!-- 收起：Art Design 风格圆钮，无机器人、无胶囊文案 -->
    <button
      v-show="!open"
      type="button"
      class="agent-fab"
      :class="{ dragging, busy: loading }"
      title="打开助手"
      @mousedown.prevent="startDrag"
      @click="onFabClick"
    >
      <span class="agent-fab__ring" />
      <svg class="agent-fab__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 11.5C5 7.91 7.91 5 11.5 5S18 7.91 18 11.5 15.09 18 11.5 18H9l-3.2 2.1c-.45.3-1.05-.05-.95-.58L5.5 16.2A6.47 6.47 0 0 1 5 11.5Z"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"
        />
        <circle cx="9.2" cy="11.5" r="1" fill="currentColor" />
        <circle cx="11.5" cy="11.5" r="1" fill="currentColor" />
        <circle cx="13.8" cy="11.5" r="1" fill="currentColor" />
      </svg>
    </button>

    <section v-show="open" class="agent-panel">
      <header class="agent-panel__head" @mousedown="onHeadDown">
        <div class="agent-panel__brand">
          <span class="agent-panel__mark">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path
                d="M5 11.5C5 7.91 7.91 5 11.5 5S18 7.91 18 11.5 15.09 18 11.5 18H9l-3.2 2.1c-.45.3-1.05-.05-.95-.58L5.5 16.2A6.47 6.47 0 0 1 5 11.5Z"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <div class="agent-panel__titles">
            <strong>助手</strong>
            <em>{{ loading ? '思考中…' : pageLabel }}</em>
          </div>
        </div>
        <div class="agent-panel__ops">
          <button type="button" title="清空" @click.stop="clearGlobalChat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button type="button" title="收起" @click.stop="close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div ref="threadRef" class="agent-panel__thread">
        <div v-if="!messages.length" class="agent-empty">
          <p class="agent-empty__lead">查数据、问现状</p>
          <div class="agent-empty__chips">
            <button v-for="s in suggestions" :key="s" type="button" @click="askNow(s)">{{ s }}</button>
          </div>
        </div>

        <div v-for="(msg, i) in messages" :key="i" class="chat-msg" :class="msg.role">
          <p>{{ formatAiText(msg.content) }}</p>
          <div v-if="msg.sources?.length" class="chat-msg__sources">
            <a
              v-for="(s, si) in msg.sources.slice(0, 4)"
              :key="si"
              class="src-chip"
              :href="s.link"
              target="_blank"
              rel="noopener"
            >
              {{ s.platform }}
            </a>
          </div>
        </div>

        <div v-if="loading" class="chat-msg assistant loading">
          <i /><i /><i />
        </div>
      </div>

      <footer class="agent-panel__foot">
        <div class="chat-input-row">
          <input
            v-model="input"
            class="chat-input"
            :disabled="loading"
            :placeholder="`在「${pageLabel}」提问…`"
            @keydown.enter="submit"
          />
          <button class="chat-send" :disabled="loading || !input.trim()" @click="submit">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useDojoAgent } from '@/composables/useDojoAgent'
  import { useDojoAgentChat } from '@/composables/useDojoAgentChat'
  import { clearGlobalChat, dojoChatStore, savePanelState } from '@/store/dojoChatStore'
  import { formatAiText } from '@/utils/formatAiText'

  defineOptions({ name: 'DojoFloatingAgent' })

  const { seed } = useDojoAgent()
  const { messages, pageLabel, send, loading } = useDojoAgentChat()
  const input = ref('')
  const threadRef = ref<HTMLElement | null>(null)
  const dragging = ref(false)

  const suggestions = ['本周分发还差哪些账号？', '@justdojoit 最近播放多少？', '哪些投放已逾期未达标？']

  const open = computed(() => dojoChatStore.panel.open)
  const pos = computed(() => dojoChatStore.panel)
  const rootStyle = computed(() => ({
    right: `${24 + pos.value.x}px`,
    bottom: `${24 + pos.value.y}px`
  }))

  let moved = false
  let start = { mx: 0, my: 0, x: 0, y: 0 }
  const PANEL_W = 360
  const PANEL_H = 500
  const FAB = 52
  const GAP = 24

  function clampPos(x: number, y: number, isOpen: boolean) {
    const w = isOpen ? Math.min(PANEL_W, window.innerWidth - 32) : FAB
    const h = isOpen ? Math.min(PANEL_H, window.innerHeight - 100) : FAB
    return {
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w - GAP - 8)),
      y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - h - GAP - 8))
    }
  }

  function openPanel() {
    savePanelState({ ...clampPos(pos.value.x, pos.value.y, true), open: true })
  }
  function reclamp() {
    const next = clampPos(pos.value.x, pos.value.y, open.value)
    if (next.x !== pos.value.x || next.y !== pos.value.y) savePanelState({ ...next, open: open.value })
  }
  function close() {
    savePanelState({ ...pos.value, open: false })
  }
  function submit() {
    const text = input.value.trim()
    if (!text || loading.value) return
    input.value = ''
    if (!open.value) openPanel()
    send(text)
  }
  function askNow(text: string) {
    if (!loading.value) send(text)
  }
  function onFabClick() {
    if (!moved) openPanel()
  }
  function onHeadDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    startDrag(e)
  }
  function startDrag(e: MouseEvent) {
    dragging.value = true
    moved = false
    start = { mx: e.clientX, my: e.clientY, x: pos.value.x, y: pos.value.y }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  function onMove(e: MouseEvent) {
    if (!dragging.value) return
    const dx = e.clientX - start.mx
    const dy = e.clientY - start.my
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    savePanelState({ open: open.value, ...clampPos(start.x - dx, start.y - dy, open.value) })
  }
  function onUp() {
    dragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    setTimeout(() => {
      moved = false
    }, 50)
  }

  watch(
    () => seed.value.n,
    () => {
      if (!seed.value.text) return
      openPanel()
      send(seed.value.text)
    }
  )
  watch([() => messages.value.length, loading], () =>
    nextTick(() => threadRef.value?.scrollTo({ top: 999999, behavior: 'smooth' }))
  )

  onMounted(() => {
    window.addEventListener('dojo-agent-open', openPanel)
    window.addEventListener('resize', reclamp)
    reclamp()
  })
  onUnmounted(() => {
    window.removeEventListener('dojo-agent-open', openPanel)
    window.removeEventListener('resize', reclamp)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  })
</script>

<style scoped lang="scss">
  .dojo-agent {
    position: fixed;
    z-index: 4000;
    pointer-events: none;

    > * {
      pointer-events: auto;
    }
  }

  .agent-fab {
    position: relative;
    width: 52px;
    height: 52px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: var(--el-bg-color);
    color: var(--el-color-primary);
    cursor: grab;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 4%),
      0 8px 24px rgb(0 0 0 / 6%);
    display: grid;
    place-items: center;
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      border-color 0.18s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--el-border-color));
      box-shadow:
        0 2px 6px rgb(0 0 0 / 6%),
        0 12px 28px rgb(0 0 0 / 8%);
    }

    &.dragging {
      cursor: grabbing;
    }

    &.busy .agent-fab__ring {
      opacity: 1;
      animation: spin 1.2s linear infinite;
    }

    &__ring {
      position: absolute;
      inset: 4px;
      border-radius: 13px;
      border: 1.5px solid transparent;
      border-top-color: var(--el-color-primary);
      opacity: 0;
    }

    &__icon {
      width: 22px;
      height: 22px;
      position: relative;
      z-index: 1;
    }
  }

  .agent-panel {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 360px;
    max-width: calc(100vw - 28px);
    height: 500px;
    max-height: calc(100vh - 96px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: var(--el-bg-color);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 4%),
      0 18px 40px rgb(0 0 0 / 10%);
    overflow: hidden;

    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 12px 12px 14px;
      border-bottom: 1px solid var(--el-border-color-extra-light);
      cursor: grab;
      user-select: none;
      background: var(--el-bg-color);
    }

    &__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    &__mark {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--el-color-primary);
      background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
    }

    &__titles {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;

      strong {
        font-size: 14px;
        font-weight: 650;
        color: var(--el-text-color-primary);
        letter-spacing: -0.01em;
      }

      em {
        font-style: normal;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    &__ops {
      display: flex;
      gap: 2px;

      button {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--el-text-color-secondary);
        display: grid;
        place-items: center;
        cursor: pointer;

        &:hover {
          background: var(--el-fill-color-light);
          color: var(--el-text-color-primary);
        }
      }
    }

    &__thread {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      background: var(--el-bg-color);
      scrollbar-width: thin;
    }

    &__foot {
      padding: 10px 12px 12px;
      border-top: 1px solid var(--el-border-color-extra-light);
      background: var(--el-bg-color);
    }
  }

  .agent-empty {
    padding: 8px 2px 4px;

    &__lead {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 650;
      color: var(--el-text-color-primary);
    }

    &__chips {
      display: flex;
      flex-direction: column;
      gap: 8px;

      button {
        text-align: left;
        padding: 10px 12px;
        border: 1px solid var(--el-border-color-lighter);
        border-radius: 10px;
        background: var(--el-bg-color);
        color: var(--el-text-color-regular);
        font-size: 12px;
        cursor: pointer;
        transition: border-color 0.15s ease;

        &:hover {
          border-color: color-mix(in srgb, var(--el-color-primary) 45%, var(--el-border-color));
          color: var(--el-color-primary);
        }
      }
    }
  }

  .chat-msg {
    max-width: 88%;
    margin-bottom: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--el-text-color-primary);

    p {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    &.user {
      margin-left: auto;
      background: color-mix(in srgb, var(--el-color-primary) 14%, transparent);
      border-radius: 12px 12px 4px 12px;
    }

    &.assistant {
      margin-right: auto;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-extra-light);
      border-radius: 12px 12px 12px 4px;
    }

    &.loading {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      padding: 12px 14px;

      i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--el-text-color-placeholder);
        animation: blink 1.2s infinite ease-in-out;

        &:nth-child(2) {
          animation-delay: 0.15s;
        }
        &:nth-child(3) {
          animation-delay: 0.3s;
        }
      }
    }

    &__sources {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
  }

  .src-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
    text-decoration: none;
  }

  .chat-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);

    &:focus-within {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 16%, transparent);
    }
  }

  .chat-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--el-text-color-primary);

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  .chat-send {
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 10px;
    background: var(--el-color-primary);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }
</style>
