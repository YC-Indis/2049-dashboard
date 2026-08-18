import { reactive } from 'vue'

const STORAGE_KEY = 'dojo-workspace-sidebar'

function loadCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const dojoSidebarStore = reactive({
  /** 桌面端收纳为图标轨（Chainlink / TailAdmin 式） */
  collapsed: loadCollapsed()
})

export function setSidebarCollapsed(collapsed: boolean) {
  dojoSidebarStore.collapsed = collapsed
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed(!dojoSidebarStore.collapsed)
}
