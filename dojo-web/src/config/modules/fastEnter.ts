/**
 * 快速入口：2049 核心工作面
 */
import type { FastEnterConfig } from '@/types/config'

const fastEnterConfig: FastEnterConfig = {
  minWidth: 1200,
  applications: [
    {
      name: '今日待办',
      description: '任务与风险总览',
      icon: 'ri:calendar-check-line',
      iconColor: '#377dff',
      enabled: true,
      order: 1,
      routeName: 'DojoToday'
    },
    {
      name: '项目总览',
      description: 'KPI 与现状总览',
      icon: 'ri:dashboard-3-line',
      iconColor: '#4A90D9',
      enabled: true,
      order: 2,
      routeName: 'DojoProject'
    },
    {
      name: '节奏日历',
      description: '排期与发布节奏',
      icon: 'ri:calendar-2-line',
      iconColor: '#13DEB9',
      enabled: true,
      order: 3,
      routeName: 'DojoCalendar'
    },
    {
      name: '总账号预览',
      description: 'TikTok 账号总览',
      icon: 'ri:tiktok-line',
      iconColor: '#111',
      enabled: true,
      order: 4,
      routeName: 'DojoAccountReview'
    }
  ],
  quickLinks: [
    { name: '项目排期', enabled: true, order: 1, routeName: 'DojoTimeline' },
    { name: '节奏日历', enabled: true, order: 2, routeName: 'DojoCalendar' },
    { name: '项目总览', enabled: true, order: 3, routeName: 'DojoProject' }
  ]
}

export default Object.freeze(fastEnterConfig)
