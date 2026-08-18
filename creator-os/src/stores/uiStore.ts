import { reactive } from 'vue'

export type CalendarView = 'week' | 'month'

const state = reactive({
  sidebarCollapsed: false,
  newContentModalOpen: false,
  selectedContentId: null as string | null,
  contentDrawerOpen: false,
  calendarView: 'month' as CalendarView,
  toast: null as { message: string; action?: string } | null,
})

let toastTimer: number | undefined
let toastAction: (() => void) | undefined

export const uiStore = {
  state,
  openNewContentModal() {
    state.newContentModalOpen = true
  },
  closeNewContentModal() {
    state.newContentModalOpen = false
  },
  openContentDrawer(contentId: string) {
    state.selectedContentId = contentId
    state.contentDrawerOpen = true
  },
  closeContentDrawer() {
    state.contentDrawerOpen = false
  },
  setCalendarView(view: CalendarView) {
    state.calendarView = view
  },
  showToast(message: string, action?: string, onAction?: () => void) {
    state.toast = { message, action }
    toastAction = onAction
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      state.toast = null
    }, 3200)
  },
  dismissToast() {
    state.toast = null
    toastAction = undefined
  },
  runToastAction() {
    toastAction?.()
    state.toast = null
    toastAction = undefined
  },
}
