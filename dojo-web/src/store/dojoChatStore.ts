import { reactive } from 'vue'
import type { ChatTurn } from '@/api/llm'

export interface ChatMessage extends ChatTurn {
  sources?: Array<{ platform: string; title: string; link: string }>
  memoryHint?: string
}

export interface AgentPanelState {
  /** 对话框 left；<0 表示尚未定位 */
  x: number
  /** 对话框 top；<0 表示尚未定位 */
  y: number
  /** 椭圆按钮 left；<0 表示停在右下角 */
  launcherX: number
  /** 椭圆按钮 top；<0 表示停在右下角 */
  launcherY: number
  open: boolean
  /** 3 = 含可拖动按钮坐标 */
  posVersion?: number
}

const STORAGE_KEY = 'dojo-agent-global'
const PANEL_KEY = 'dojo-agent-panel'
const PENDING_KEY = 'dojo-agent-pending'

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ChatMessage[]
  } catch {
    /* ignore */
  }
  return []
}

function loadPanel(): AgentPanelState {
  try {
    const raw = localStorage.getItem(PANEL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AgentPanelState
      return {
        x: typeof parsed.x === 'number' ? parsed.x : -1,
        y: typeof parsed.y === 'number' ? parsed.y : -1,
        launcherX: typeof parsed.launcherX === 'number' ? parsed.launcherX : -1,
        launcherY: typeof parsed.launcherY === 'number' ? parsed.launcherY : -1,
        open: Boolean(parsed.open),
        posVersion: 3
      }
    }
  } catch {
    /* ignore */
  }
  return { x: -1, y: -1, launcherX: -1, launcherY: -1, open: false, posVersion: 3 }
}

function loadPending(): unknown {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return null
}

export const dojoChatStore = reactive({
  loading: false,
  messages: loadMessages(),
  panel: loadPanel(),
  pendingWorkflow: loadPending()
})

function persistMessages() {
  const raw = JSON.stringify(dojoChatStore.messages)
  localStorage.setItem(STORAGE_KEY, raw)
  sessionStorage.setItem(STORAGE_KEY, raw)
}

export function getGlobalChatMessages(): ChatMessage[] {
  return dojoChatStore.messages
}

export function appendGlobalChatMessage(msg: ChatMessage) {
  dojoChatStore.messages = [...dojoChatStore.messages, msg]
  persistMessages()
}

export function clearGlobalChat() {
  dojoChatStore.messages = []
  dojoChatStore.pendingWorkflow = null
  persistMessages()
  localStorage.removeItem(PENDING_KEY)
}

export function savePanelState(state: AgentPanelState) {
  dojoChatStore.panel = {
    x: state.x,
    y: state.y,
    launcherX: state.launcherX ?? dojoChatStore.panel.launcherX,
    launcherY: state.launcherY ?? dojoChatStore.panel.launcherY,
    open: state.open,
    posVersion: 3
  }
  localStorage.setItem(PANEL_KEY, JSON.stringify(dojoChatStore.panel))
}

export function savePendingWorkflow(value: unknown) {
  dojoChatStore.pendingWorkflow = value
  if (value == null) localStorage.removeItem(PENDING_KEY)
  else localStorage.setItem(PENDING_KEY, JSON.stringify(value))
}
