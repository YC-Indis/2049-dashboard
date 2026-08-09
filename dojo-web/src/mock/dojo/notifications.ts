/** Dojo 业务通知 — 替代 Art Design Pro 模板通知 */

export type DojoNoticeType = 'confirm' | 'overdue' | 'account' | 'publish' | 'agent'

export interface DojoNotice {
  title: string
  time: string
  type: DojoNoticeType
  route?: string
}

export interface DojoTodo {
  title: string
  time: string
  priority: 'high' | 'medium'
  route: string
}

export const dojoNotices: DojoNotice[] = []

export const dojoTodos: DojoTodo[] = []
