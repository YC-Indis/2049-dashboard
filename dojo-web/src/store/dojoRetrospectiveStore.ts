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
  items: [
    {
      id: 'retro-1',
      title: 'Dojo 首周投放复盘',
      project: 'Dojo',
      date: '2026-03-01',
      content: '首周自然流账号互动率偏低，投流批次英国区进度 60%，需补 2 条高完播素材。',
      tags: ['投放', '英国']
    },
    {
      id: 'retro-2',
      title: 'elfbar 矩阵冷启动',
      project: 'elfbar',
      date: '2026-04-12',
      content: '新号起量慢，3s 留存约 11%，建议加强前 3 秒钩子与 BGM 统一。',
      tags: ['冷启动', '留存']
    }
  ] as Retrospective[]
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
