import { reactive } from 'vue'
import type { ChatTurn } from '@/api/llm'

export interface ChatMessage extends ChatTurn {
  sources?: Array<{ platform: string; title: string; link: string }>
  memoryHint?: string
}

const STORAGE_KEY = 'dojo-agent-global'
const PANEL_KEY = 'dojo-agent-panel'

/** 欢迎语由面板空态承担，不写进消息流 */
function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ChatMessage[]
  } catch {
    /* ignore */
  }
  return []
}

function loadPanel() {
  try {
    const raw = localStorage.getItem(PANEL_KEY)
    if (raw) return JSON.parse(raw) as { x: number; y: number; open: boolean }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, open: false }
}

export const dojoChatStore = reactive({
  loading: false,
  messages: loadMessages(),
  panel: loadPanel()
})

export function getGlobalChatMessages(): ChatMessage[] {
  return dojoChatStore.messages
}

export function appendGlobalChatMessage(msg: ChatMessage) {
  dojoChatStore.messages = [...dojoChatStore.messages, msg]
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dojoChatStore.messages))
}

export function clearGlobalChat() {
  dojoChatStore.messages = []
  sessionStorage.setItem(STORAGE_KEY, '[]')
}

export function savePanelState(state: { x: number; y: number; open: boolean }) {
  dojoChatStore.panel = state
  localStorage.setItem(PANEL_KEY, JSON.stringify(state))
}
