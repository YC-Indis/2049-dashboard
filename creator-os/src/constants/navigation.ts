export interface NavigationItem {
  label: string
  path: string
  icon: string
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: 'CONTENT',
    items: [
      { label: '今日推进', path: '/today', icon: 'ph:sun-horizon' },
      { label: '节奏日历', path: '/calendar', icon: 'ph:calendar-blank' },
      { label: '内容流转', path: '/flow', icon: 'ph:kanban' },
    ],
  },
  {
    label: 'BUSINESS',
    items: [{ label: '经营策略', path: '/strategy', icon: 'ph:circles-three-plus' }],
  },
  {
    label: 'GROWTH',
    items: [
      { label: '目标进度', path: '/goals', icon: 'ph:target' },
      { label: '复盘沉淀', path: '/review', icon: 'ph:notebook' },
    ],
  },
  {
    label: 'PERSONAL',
    items: [{ label: '个性与数据', path: '/profile', icon: 'ph:user-circle' }],
  },
]

export const ROUTE_META: Record<string, { eyebrow: string; title: string }> = {
  '/today': { eyebrow: 'TODAY', title: '今日推进' },
  '/calendar': { eyebrow: 'CONTENT RHYTHM', title: '节奏日历' },
  '/flow': { eyebrow: 'CONTENT FLOW', title: '内容流转' },
  '/strategy': { eyebrow: 'IP BUSINESS LOOP', title: '经营策略' },
  '/goals': { eyebrow: 'CREATOR NORTH STAR', title: '目标进度' },
  '/review': { eyebrow: 'REVIEW LAB', title: '复盘沉淀' },
  '/profile': { eyebrow: 'PERSONAL SYSTEM', title: '个性与数据' },
}
