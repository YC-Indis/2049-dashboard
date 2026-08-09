/**
 * 快速入口：Dojo 核心工作面
 */
import type { FastEnterConfig } from '@/types/config'

const fastEnterConfig: FastEnterConfig = {
  minWidth: 1200,
  applications: [
    {
      name: '今日',
      description: '任务与风险总览',
      icon: 'ri:calendar-check-line',
      iconColor: '#377dff',
      enabled: true,
      order: 1,
      routeName: 'DojoToday'
    },
    {
      name: '内容流转',
      description: '时间线 + 脚本/分发/执行表',
      icon: 'ri:flow-chart',
      iconColor: '#4A90D9',
      enabled: true,
      order: 2,
      routeName: 'DojoFlow'
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
      name: '账号矩阵',
      description: 'TikTok 监看与检阅',
      icon: 'ri:tiktok-line',
      iconColor: '#111',
      enabled: true,
      order: 4,
      routeName: 'DojoAccounts'
    }
  ],
  quickLinks: [
    { name: '时间规划', enabled: true, order: 1, routeName: 'DojoTimeline' },
    { name: '节奏日历', enabled: true, order: 2, routeName: 'DojoCalendar' },
    { name: '项目', enabled: true, order: 3, routeName: 'DojoProject' }
  ]
}

export default Object.freeze(fastEnterConfig)
