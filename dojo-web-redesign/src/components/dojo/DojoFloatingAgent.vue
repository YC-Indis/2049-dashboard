<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useDojoAgent } from '@/composables/useDojoAgent'
  import { useDojoAgentChat } from '@/composables/useDojoAgentChat'
  import { clearGlobalChat, dojoChatStore, savePanelState } from '@/store/dojoChatStore'
  import {
    activeLlmProvider,
    addCustomLlmProvider,
    dojoLlmSettings,
    removeLlmProvider,
    setActiveLlmProvider,
    setAgentFontScale,
    updateLlmProvider
  } from '@/store/dojoLlmSettings'
  import { formatAiText } from '@/utils/formatAiText'

  defineOptions({ name: 'DojoFloatingAgent' })

  const { seed } = useDojoAgent()
  const { messages, send, loading } = useDojoAgentChat()
  const input = ref('')
  const showSettings = ref(false)
  const savedHint = ref('')
  const threadRef = ref<HTMLElement | null>(null)
  const dockRef = ref<HTMLElement | null>(null)
  const dragging = ref(false)
  const launcherDragging = ref(false)
  const launcherMoved = ref(false)
  const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
  const dragOrigin = ref({ clientX: 0, clientY: 0, left: 18, top: 18 })
  const launcherRef = ref<HTMLElement | null>(null)
  const open = computed(() => dojoChatStore.panel.open)
  const activeProvider = activeLlmProvider
  const panelStyle = computed(() => {
    const scale = { '--agent-font-scale': String(dojoLlmSettings.fontScale) }
    const left = dojoChatStore.panel.x
    const top = dojoChatStore.panel.y
    if (left < 0 || top < 0) {
      return {
        ...scale,
        right: '18px',
        bottom: '18px',
        left: 'auto',
        top: 'auto'
      }
    }
    return {
      ...scale,
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto'
    }
  })

  function flashSaved(text = '已保存到本机') {
    savedHint.value = text
    window.setTimeout(() => {
      if (savedHint.value === text) savedHint.value = ''
    }, 1600)
  }

  function onProviderField(
    field: 'name' | 'baseUrl' | 'model' | 'apiKey' | 'style',
    value: string
  ) {
    const id = dojoLlmSettings.activeId
    if (field === 'style') {
      updateLlmProvider(id, { style: value === 'anthropic' ? 'anthropic' : 'openai' })
    } else {
      updateLlmProvider(id, { [field]: value })
    }
    flashSaved()
  }

  const launcherStyle = computed(() => {
    const left = dojoChatStore.panel.launcherX
    const top = dojoChatStore.panel.launcherY
    if (left < 0 || top < 0) {
      return { right: '20px', bottom: '20px', left: 'auto', top: 'auto' }
    }
    return { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' }
  })

  function persistPanel(open = dojoChatStore.panel.open) {
    savePanelState({
      ...dojoChatStore.panel,
      open,
      posVersion: 3
    })
  }

  function setOpen(value: boolean) {
    persistPanel(value)
  }

  function submit() {
    const text = input.value.trim()
    if (!text || loading.value) return
    input.value = ''
    setOpen(true)
    void send(text)
  }

  function openPanel() {
    setOpen(true)
    nextTick(() => ensurePanelPosition(true))
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max))
  }

  function defaultPanel() {
    const width = dockRef.value?.offsetWidth || 380
    const height = dockRef.value?.offsetHeight || 560
    return {
      x: Math.max(10, viewport.value.width - width - 18),
      y: Math.max(10, viewport.value.height - height - 18)
    }
  }

  function ensurePanelPosition(persist = false) {
    if (!dockRef.value) return
    const rect = dockRef.value.getBoundingClientRect()
    const maxX = Math.max(10, viewport.value.width - rect.width - 10)
    const maxY = Math.max(10, viewport.value.height - rect.height - 10)
    let nextX = dojoChatStore.panel.x
    let nextY = dojoChatStore.panel.y
    if (nextX < 0 || nextY < 0) {
      const fallback = defaultPanel()
      nextX = fallback.x
      nextY = fallback.y
    } else {
      nextX = clamp(nextX, 10, maxX)
      nextY = clamp(nextY, 10, maxY)
    }
    const next = {
      x: nextX,
      y: nextY,
      launcherX: dojoChatStore.panel.launcherX,
      launcherY: dojoChatStore.panel.launcherY,
      open: dojoChatStore.panel.open,
      posVersion: 3 as const
    }
    dojoChatStore.panel = next
    if (persist) savePanelState(next)
  }

  function startDrag(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const el = dockRef.value
    if (!el) return
    // 若仍是默认 right/bottom，先换成 left/top 再拖
    if (dojoChatStore.panel.x < 0 || dojoChatStore.panel.y < 0) {
      const rect = el.getBoundingClientRect()
      dojoChatStore.panel = {
        ...dojoChatStore.panel,
        x: rect.left,
        y: rect.top,
        posVersion: 3
      }
    }
    dragging.value = true
    dragOrigin.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      left: dojoChatStore.panel.x,
      top: dojoChatStore.panel.y
    }
    const handle = event.currentTarget as HTMLElement | null
    handle?.setPointerCapture?.(event.pointerId)
  }

  function moveDrag(event: PointerEvent) {
    if (launcherDragging.value) {
      moveLauncherDrag(event)
      return
    }
    if (!dragging.value || !dockRef.value) return
    event.preventDefault()
    const rect = dockRef.value.getBoundingClientRect()
    const deltaX = event.clientX - dragOrigin.value.clientX
    const deltaY = event.clientY - dragOrigin.value.clientY
    dojoChatStore.panel = {
      ...dojoChatStore.panel,
      x: clamp(
        dragOrigin.value.left + deltaX,
        10,
        Math.max(10, viewport.value.width - rect.width - 10)
      ),
      y: clamp(
        dragOrigin.value.top + deltaY,
        10,
        Math.max(10, viewport.value.height - rect.height - 10)
      ),
      open: true,
      posVersion: 3
    }
  }

  function stopDrag(event?: Event) {
    if (launcherDragging.value) {
      stopLauncherDrag(event as PointerEvent)
      return
    }
    if (!dragging.value) return
    dragging.value = false
    const pointerEvent = event as PointerEvent | undefined
    const handle = pointerEvent?.currentTarget as HTMLElement | null | undefined
    if (pointerEvent && handle?.hasPointerCapture?.(pointerEvent.pointerId)) {
      handle.releasePointerCapture(pointerEvent.pointerId)
    }
    persistPanel()
  }

  function startLauncherDrag(event: PointerEvent) {
    event.preventDefault()
    launcherMoved.value = false
    const el = launcherRef.value
    if (!el) return
    if (dojoChatStore.panel.launcherX < 0 || dojoChatStore.panel.launcherY < 0) {
      const rect = el.getBoundingClientRect()
      dojoChatStore.panel.launcherX = rect.left
      dojoChatStore.panel.launcherY = rect.top
    }
    launcherDragging.value = true
    dragOrigin.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      left: dojoChatStore.panel.launcherX,
      top: dojoChatStore.panel.launcherY
    }
    el.setPointerCapture?.(event.pointerId)
  }

  function moveLauncherDrag(event: PointerEvent) {
    if (!launcherDragging.value || !launcherRef.value) return
    event.preventDefault()
    const rect = launcherRef.value.getBoundingClientRect()
    const deltaX = event.clientX - dragOrigin.value.clientX
    const deltaY = event.clientY - dragOrigin.value.clientY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 6) launcherMoved.value = true
    dojoChatStore.panel.launcherX = clamp(
      dragOrigin.value.left + deltaX,
      10,
      Math.max(10, viewport.value.width - rect.width - 10)
    )
    dojoChatStore.panel.launcherY = clamp(
      dragOrigin.value.top + deltaY,
      10,
      Math.max(10, viewport.value.height - rect.height - 10)
    )
  }

  function stopLauncherDrag(event?: PointerEvent) {
    if (!launcherDragging.value) return
    launcherDragging.value = false
    const handle = event?.currentTarget as HTMLElement | null | undefined
    if (event && handle?.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId)
    }
    persistPanel(false)
  }

  function onLauncherClick() {
    if (launcherMoved.value) {
      launcherMoved.value = false
      return
    }
    openPanel()
  }

  function updateViewport() {
    viewport.value = { width: window.innerWidth, height: window.innerHeight }
    nextTick(() => ensurePanelPosition(true))
  }

  watch(
    () => seed.value.n,
    () => {
      if (!seed.value.text) return
      openPanel()
      void send(seed.value.text)
    }
  )

  watch([() => messages.value.length, loading], () =>
    nextTick(() => threadRef.value?.scrollTo({ top: 999999, behavior: 'smooth' }))
  )

  onMounted(() => {
    window.addEventListener('dojo-agent-open', openPanel)
    window.addEventListener('resize', updateViewport)
    window.addEventListener('pointermove', moveDrag)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
    if (open.value) nextTick(() => ensurePanelPosition(true))
  })

  onUnmounted(() => {
    window.removeEventListener('dojo-agent-open', openPanel)
    window.removeEventListener('resize', updateViewport)
    window.removeEventListener('pointermove', moveDrag)
    window.removeEventListener('pointerup', stopDrag)
    window.removeEventListener('pointercancel', stopDrag)
  })
</script>

<template>
  <div class="ai-float-layer">
    <button
      v-if="!open"
      ref="launcherRef"
      type="button"
      class="ai-trigger"
      :class="{ 'is-dragging': launcherDragging }"
      :style="launcherStyle"
      aria-label="打开 SixNine49 助手"
      @pointerdown="startLauncherDrag"
      @click="onLauncherClick"
    >
      <span class="ai-trigger__orb" aria-hidden="true">
        <Icon icon="ph:sparkle-fill" width="16" />
      </span>
      <span class="ai-trigger__copy">
        <strong>SixNine49</strong>
        <small>问执行 / 内容 / 运营</small>
      </span>
      <i v-if="loading" class="ai-trigger__pulse" />
    </button>

    <section
      v-else
      ref="dockRef"
      class="ai-copilot"
      :class="{ 'is-dragging': dragging }"
      :style="panelStyle"
      aria-label="AI 工作助手"
    >
      <header class="copilot-head" @pointerdown="startDrag">
          <div class="copilot-identity">
            <span class="copilot-mark" aria-hidden="true">
              <Icon icon="ph:sparkle-fill" width="15" />
            </span>
            <div>
              <strong>SixNine49</strong>
              <small>翻页不断对话 · 跨项目增删改查</small>
            </div>
          </div>
        <div class="copilot-controls">
          <button
            type="button"
            title="模型与显示设置"
            aria-label="模型与显示设置"
            :class="{ 'is-active': showSettings }"
            @click="showSettings = !showSettings"
          >
            <Icon icon="ph:gear-six-bold" width="15" height="15" />
          </button>
          <button type="button" title="清空对话" aria-label="清空对话" @click="clearGlobalChat">
            <Icon icon="ph:eraser-bold" width="15" height="15" />
          </button>
          <button type="button" title="收起助手" aria-label="收起助手" @click="setOpen(false)">
            <Icon icon="ph:minus-bold" width="15" height="15" />
          </button>
        </div>
      </header>

      <div v-if="showSettings" class="copilot-settings">
        <div class="settings-block">
          <label>对话字号</label>
          <div class="settings-row">
            <input
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              :value="dojoLlmSettings.fontScale"
              @input="
                setAgentFontScale(Number(($event.target as HTMLInputElement).value));
                flashSaved('字号已更新')
              "
            />
            <span>{{ Math.round(dojoLlmSettings.fontScale * 100) }}%</span>
          </div>
        </div>

        <div class="settings-block">
          <label>当前模型</label>
          <select
            :value="dojoLlmSettings.activeId"
            @change="
              setActiveLlmProvider(($event.target as HTMLSelectElement).value);
              flashSaved('已切换模型')
            "
          >
            <option
              v-for="provider in dojoLlmSettings.providers"
              :key="provider.id"
              :value="provider.id"
            >
              {{ provider.name }}{{ provider.apiKey ? '' : '（未填 Key）' }}
            </option>
          </select>
        </div>

        <template v-if="activeProvider">
          <div class="settings-block">
            <label>显示名称</label>
            <input
              :value="activeProvider.name"
              type="text"
              @change="onProviderField('name', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="settings-block">
            <label>接口类型</label>
            <select
              :value="activeProvider.style"
              @change="onProviderField('style', ($event.target as HTMLSelectElement).value)"
            >
              <option value="openai">OpenAI 兼容（DeepSeek / GPT / Qwen）</option>
              <option value="anthropic">Anthropic（Claude）</option>
            </select>
          </div>
          <div class="settings-block">
            <label>Base URL</label>
            <input
              :value="activeProvider.baseUrl"
              type="text"
              placeholder="https://api.deepseek.com"
              @change="onProviderField('baseUrl', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="settings-block">
            <label>Model</label>
            <input
              :value="activeProvider.model"
              type="text"
              placeholder="deepseek-v4-flash"
              @change="onProviderField('model', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="settings-block">
            <label>API Key</label>
            <input
              :value="activeProvider.apiKey"
              type="password"
              autocomplete="off"
              placeholder="粘贴后立即生效，保存在本机浏览器"
              @change="onProviderField('apiKey', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </template>

        <div class="settings-actions">
          <button
            type="button"
            @click="
              addCustomLlmProvider();
              flashSaved('已添加自定义模型')
            "
          >
            + 自定义模型
          </button>
          <button
            v-if="activeProvider && !activeProvider.builtin"
            type="button"
            class="is-danger"
            @click="
              removeLlmProvider(activeProvider.id);
              flashSaved('已删除')
            "
          >
            删除当前
          </button>
        </div>
        <p class="settings-hint">
          DeepSeek 用 deepseek-v4-flash 做日常确认式 Agent，更重推理可改 deepseek-v4-pro。deepseek-chat 已下线。Key 只存本机。
          <em v-if="savedHint">{{ savedHint }}</em>
        </p>
      </div>

      <div v-else ref="threadRef" class="copilot-thread">
        <div v-if="!messages.length" class="agent-empty">
          <strong>嗨，我是 SixNine49</strong>
          <p>
            可以说：新建项目、给「某项目」建任务、改期、建采集、加灵感/脚本/对标账号、删某条内容。中台不限项目数量，写操作请带上项目名。缺参数我会先问，确认后才执行。翻页后对话还在。
          </p>
          <button type="button" class="agent-empty__link" @click="showSettings = true">
            去设置里填模型 Key →
          </button>
        </div>

        <article
          v-for="(message, index) in messages"
          :key="index"
          class="chat-message"
          :class="message.role"
        >
          <span>{{ message.role === 'assistant' ? 'SixNine49' : 'YOU' }}</span>
          <p>{{ formatAiText(message.content) }}</p>
          <small v-if="message.memoryHint">{{ message.memoryHint }}</small>
        </article>

        <article v-if="loading" class="chat-message assistant is-loading">
          <span>SixNine49</span><p><i /><i /><i /></p>
        </article>
      </div>

      <footer v-if="!showSettings" class="copilot-input">
        <div>
          <textarea
            v-model="input"
            rows="1"
            :disabled="loading"
            placeholder="例：新建项目 / 改投放日期 / 采集 unboxing 20条 近7天…"
            aria-label="给 SixNine49 输入指令"
            @keydown.enter.exact.prevent="submit"
          />
          <button
            type="button"
            :disabled="loading || !input.trim()"
            aria-label="发送"
            @click="submit"
          >
            <Icon icon="ph:arrow-up-bold" width="15" />
          </button>
        </div>
        <small v-if="activeProvider">
          {{ activeProvider.name }} · {{ activeProvider.apiKey ? 'Key 已配置' : '未配置 Key' }}
        </small>
      </footer>
    </section>
  </div>
</template>

<style scoped lang="scss">
  .ai-float-layer {
    position: fixed;
    inset: 0;
    z-index: 4000;
    pointer-events: none;

    > * {
      pointer-events: auto;
    }
  }

  .ai-trigger {
    position: fixed;
    right: 20px;
    bottom: 20px;
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 168px;
    min-height: 52px;
    padding: 8px 14px 8px 8px;
    color: var(--dojo-ink);
    cursor: grab;
    touch-action: none;
    background: linear-gradient(180deg, #fffdfc 0%, #f2ecea 100%);
    border: 1px solid var(--dojo-line);
    border-radius: 999px;
    box-shadow:
      0 14px 30px rgb(55 42 62 / 10%),
      inset 0 1px rgb(255 255 255 / 75%);
    transition:
      transform 160ms ease,
      box-shadow 160ms ease;

    &.is-dragging {
      cursor: grabbing;
      transform: none;
    }

    &:hover,
    &:focus-visible {
      outline: 0;
      box-shadow:
        0 18px 36px rgb(55 42 62 / 12%),
        0 0 0 4px rgb(120 96 204 / 16%);
      transform: translateY(-2px);
    }

    .ai-trigger__orb {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: #fff;
      background: #403666;
      border-radius: 50%;
      box-shadow: 0 8px 16px rgb(64 54 102 / 28%);
    }

    .ai-trigger__copy {
      display: grid;
      gap: 1px;
      text-align: left;
    }

    strong {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    small {
      font-size: 11px;
      color: #69788e;
      letter-spacing: 0.01em;
    }

    .ai-trigger__pulse {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 7px;
      height: 7px;
      background: #7860cc;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgb(120 96 204 / 45%);
      animation: velix-pulse 1.4s ease infinite;
    }
  }

  @keyframes velix-pulse {
    0% {
      box-shadow: 0 0 0 0 rgb(120 96 204 / 45%);
    }
    70% {
      box-shadow: 0 0 0 8px rgb(120 96 204 / 0%);
    }
    100% {
      box-shadow: 0 0 0 0 rgb(120 96 204 / 0%);
    }
  }

  .ai-copilot {
    --agent-font-scale: 1;
    position: fixed;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(380px, calc(100vw - 20px));
    height: min(560px, calc(100dvh - 78px));
    overflow: hidden;
    color: var(--dojo-ink);
    background: rgb(251 248 247 / 98%);
    backdrop-filter: blur(18px);
    border: 1px solid var(--dojo-line);
    border-radius: 18px;
    box-shadow:
      0 28px 70px rgb(55 42 62 / 16%),
      0 8px 22px rgb(55 42 62 / 8%),
      inset 0 1px rgb(255 255 255 / 70%);

    &::before {
      position: absolute;
      inset: 0 0 auto;
      height: 1px;
      content: '';
      background: linear-gradient(90deg, transparent, #e8685e 45%, #7860cc, transparent);
      opacity: 0.7;
    }

    &.is-dragging {
      user-select: none;
      box-shadow:
        0 34px 84px rgb(31 35 40 / 22%),
        0 0 0 1px rgb(143 118 232 / 20%);
    }
  }

  .copilot-head {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 62px;
    padding: 12px 13px 10px 15px;
    cursor: grab;
    touch-action: none;
    user-select: none;

    &:active {
      cursor: grabbing;
    }
  }

  .copilot-identity,
  .copilot-controls {
    display: flex;
    align-items: center;
  }

  .copilot-identity {
    gap: 10px;
    min-width: 0;

    > div {
      min-width: 0;
    }

    strong,
    small {
      display: block;
    }

    strong {
      font-size: 13px;
      font-weight: 680;
      color: #24292f;
      letter-spacing: 0.01em;
    }

    small {
      margin-top: 3px;
      overflow: hidden;
      font-size: 11px;
      color: #66707d;
      text-overflow: ellipsis;
      white-space: nowrap;

      i {
        display: inline-block;
        width: 5px;
        height: 5px;
        margin-right: 5px;
        background: #31caaa;
        border-radius: 50%;
        box-shadow: 0 0 7px rgb(49 202 170 / 70%);
      }
    }
  }

  .copilot-mark {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 34px;
    height: 34px;
    color: #fff;
    background: #403666;
    border: 0;
    border-radius: 50%;
    box-shadow: 0 8px 16px rgb(64 54 102 / 24%);
  }

  .copilot-controls {
    flex: 0 0 auto;
    gap: 6px;

    button {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      padding: 0;
      color: #4b5563;
      cursor: pointer;
      background: #fff;
      border: 1px solid #c8ced6;
      border-radius: 8px;
      transition:
        color 120ms ease,
        background 120ms ease,
        border-color 120ms ease;

      &:hover,
      &:focus-visible {
        color: #1f2328;
        background: #f3f5f7;
        border-color: #a8b0bb;
        outline: 0;
      }

      &.is-active {
        color: #4b3f8f;
        background: #efeaf8;
        border-color: #b9a8e4;
      }
    }
  }

  .copilot-settings {
    min-height: 0;
    padding: 12px 14px 16px;
    overflow-y: auto;
    border-top: 1px solid #d8dce2;
    background: #f7f8fa;
  }

  .settings-block {
    display: grid;
    gap: 5px;
    margin-bottom: 11px;

    > label {
      font-size: calc(10px * var(--agent-font-scale));
      font-weight: 650;
      color: #4b5563;
    }

    input[type='text'],
    input[type='password'],
    select {
      width: 100%;
      padding: 7px 9px;
      font-size: calc(11px * var(--agent-font-scale));
      color: #24292f;
      background: #fff;
      border: 1px solid #c8ced6;
      border-radius: 8px;
      outline: 0;

      &:focus {
        border-color: #6e5bb0;
        box-shadow: 0 0 0 3px rgb(117 86 216 / 12%);
      }
    }
  }

  .settings-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;

    input[type='range'] {
      width: 100%;
    }

    span {
      min-width: 42px;
      font-size: calc(11px * var(--agent-font-scale));
      color: #66707d;
      text-align: right;
    }
  }

  .settings-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;

    button {
      padding: 6px 10px;
      font-size: calc(11px * var(--agent-font-scale));
      color: #3f3366;
      cursor: pointer;
      background: #ece6f8;
      border: 0;
      border-radius: 8px;

      &.is-danger {
        color: #9b1c1c;
        background: #fde8e8;
      }
    }
  }

  .settings-hint {
    margin: 12px 0 0;
    font-size: calc(10px * var(--agent-font-scale));
    line-height: 1.55;
    color: #66707d;

    em {
      display: block;
      margin-top: 6px;
      font-style: normal;
      color: #7860cc;
    }
  }

  .copilot-thread {
    min-height: 0;
    padding: 14px;
    overflow-y: auto;
    border-top: 1px solid #d8dce2;
    scrollbar-color: #aab2bd transparent;
  }

  .agent-empty {
    display: grid;
    place-items: center;
    padding: 22px 10px;
    text-align: center;

    > strong {
      font-size: calc(13px * var(--agent-font-scale));
      color: #24292f;
    }

    > p {
      max-width: 300px;
      margin: 7px 0 0;
      font-size: calc(11px * var(--agent-font-scale));
      line-height: 1.6;
      color: #66707d;
    }
  }

  .agent-empty__link {
    margin-top: 12px;
    padding: 0;
    font-size: calc(11px * var(--agent-font-scale));
    color: #4f6fd6;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .chat-message {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 7px;
    margin-bottom: 11px;

    > span {
      padding-top: 8px;
      font-size: calc(8px * var(--agent-font-scale));
      font-weight: 750;
      color: #70819c;
      letter-spacing: 0.06em;
    }

    p {
      padding: 8px 10px;
      margin: 0;
      font-size: calc(12px * var(--agent-font-scale));
      line-height: 1.55;
      color: #30363d;
      white-space: pre-wrap;
      background: #e9edf2;
      border-radius: 4px 10px 10px;
    }

    &.user p {
      color: #3f3366;
      background: #e7e1f7;
    }

    > small {
      grid-column: 2;
      font-size: calc(9px * var(--agent-font-scale));
      color: #637590;
    }

    &.is-loading {
      p {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      i {
        width: 4px;
        height: 4px;
        background: #8394ad;
        border-radius: 50%;
        animation: pulse 1s ease-in-out infinite;

        &:nth-child(2) {
          animation-delay: 0.14s;
        }

        &:nth-child(3) {
          animation-delay: 0.28s;
        }
      }
    }
  }

  .copilot-input {
    padding: 10px 12px 12px;
    background: #f0f2f4;
    border-top: 1px solid #d2d7de;

    > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 31px;
      gap: 7px;
      align-items: center;
      padding: 6px 6px 6px 11px;
      background: #fff;
      border: 1px solid #c8ced6;
      border-radius: 11px;

      &:focus-within {
        border-color: #6e5bb0;
        box-shadow: 0 0 0 3px rgb(117 86 216 / 12%);
      }
    }

    textarea {
      padding: 4px 0;
      font: inherit;
      font-size: calc(12px * var(--agent-font-scale));
      line-height: 1.45;
      color: #24292f;
      resize: none;
      background: transparent;
      border: 0;
      outline: 0;
    }

    button {
      display: grid;
      place-items: center;
      width: 31px;
      height: 31px;
      padding: 0;
      color: #fff;
      cursor: pointer;
      background: #7357cf;
      border: 0;
      border-radius: 9px;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }

    > small {
      display: block;
      margin: 6px 3px 0;
      font-size: calc(10px * var(--agent-font-scale));
      color: #66707d;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.35;
    }

    50% {
      opacity: 1;
    }
  }

  @media (width <= 640px) {
    .ai-trigger {
      right: 14px;
      bottom: 14px;
    }

    .ai-copilot {
      width: min(360px, calc(100vw - 20px));
      height: min(520px, calc(100dvh - 68px));
      border-radius: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-trigger,
    .ai-trigger__pulse,
    .chat-message.is-loading i {
      transition: none;
      animation: none;
    }
  }
</style>
