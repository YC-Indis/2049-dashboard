import { reactive } from 'vue'

export interface Retrospective {
  id: string
  title: string
  project: string
  date: string
  content: string
  tags: string[]
}

export const dojoRetrospectiveStore = reactive({
  items: [] as Retrospective[]
})

export function addRetrospective(item: Omit<Retrospective, 'id'>) {
  dojoRetrospectiveStore.items.unshift({
    ...item,
    id: `retro-${Date.now()}`
  })
}

export function updateRetrospective(id: string, patch: Partial<Omit<Retrospective, 'id'>>) {
  const idx = dojoRetrospectiveStore.items.findIndex((r) => r.id === id)
  if (idx >= 0) {
    dojoRetrospectiveStore.items[idx] = { ...dojoRetrospectiveStore.items[idx], ...patch }
  }
}

export function removeRetrospective(id: string) {
  const idx = dojoRetrospectiveStore.items.findIndex((r) => r.id === id)
  if (idx >= 0) dojoRetrospectiveStore.items.splice(idx, 1)
}
