import { AppRouteRecord } from '@/types/router'

const roles = ['R_SUPER', 'R_ADMIN', 'R_USER']

/**
 * 侧栏：今日待办 / 项目总览 / 项目排期 / 节奏日历 /
 * 总账号预览 / 投放账号监控 / 投放视频监控 / 工作复盘。
 * 脚本、分发、账号接入等保留路由但侧栏隐藏。
 */
export const dojoRoutes: AppRouteRecord[] = [
  {
    name: 'DojoToday',
    path: '/today',
    component: '/dojo/today',
    meta: { title: 'menus.dojo.today', icon: 'ri:sun-line', roles }
  },
  {
    name: 'DojoProject',
    path: '/project',
    component: '/dojo/project',
    meta: { title: 'menus.dojo.project', icon: 'ri:dashboard-3-line', roles, fixedTab: true }
  },
  {
    name: 'DojoTimeline',
    path: '/timeline',
    component: '/dojo/timeline',
    meta: { title: 'menus.dojo.timeline', icon: 'ri:calendar-schedule-line', roles }
  },
  {
    name: 'DojoCalendar',
    path: '/calendar',
    component: '/dojo/calendar',
    meta: { title: 'menus.dojo.calendar', icon: 'ri:calendar-2-line', roles }
  },
  {
    name: 'DojoAccountReview',
    path: '/accounts/review',
    component: '/dojo/accounts/review',
    meta: { title: 'menus.dojo.accountReview', icon: 'ri:tiktok-line', roles }
  },
  {
    name: 'DojoAdAccounts',
    path: '/ad-accounts',
    component: '/dojo/ads/accounts',
    meta: { title: 'menus.dojo.adAccounts', icon: 'ri:notification-3-line', roles }
  },
  {
    name: 'DojoAdVideos',
    path: '/ad-videos',
    component: '/dojo/ads/videos',
    meta: { title: 'menus.dojo.adVideos', icon: 'ri:play-circle-line', roles }
  },
  // 注意：一级路由只会取 path 第一段做 Layout 父路径。
  // 不能再用 /accounts，否则会和 /accounts/review 抢同一父路由，复盘页空白且标题变成「总账号预览」。
  {
    name: 'DojoWorklog',
    path: '/worklog',
    component: '/dojo/accounts',
    meta: { title: 'menus.dojo.accounts', icon: 'ri:file-text-line', roles }
  },

  // —— 侧栏隐藏，卡片/旧链接仍可进入 ——
  {
    name: 'DojoAccountDetail',
    path: '/accounts/detail/:handle',
    component: '/dojo/accounts/detail',
    meta: {
      title: 'menus.dojo.accountDetail',
      roles,
      isHide: true,
      activePath: '/accounts/review'
    }
  },
  {
    name: 'DojoScripts',
    path: '/scripts',
    component: '/dojo/scripts',
    meta: { title: 'menus.dojo.scripts', icon: 'ri:file-list-3-line', roles, isHide: true }
  },
  {
    name: 'DojoDistribution',
    path: '/distribution',
    component: '/dojo/distribution',
    meta: { title: 'menus.dojo.distribution', icon: 'ri:send-plane-line', roles, isHide: true }
  },
  {
    name: 'DojoAccountIntake',
    path: '/accounts/intake',
    component: '/dojo/accounts/intake',
    meta: { title: 'menus.dojo.accountIntake', icon: 'ri:inbox-archive-line', roles, isHide: true }
  },
  {
    name: 'DojoAdVideoDetail',
    path: '/ad-video/:videoId',
    component: '/dojo/ads/video-detail',
    meta: {
      title: 'menus.dojo.adVideoDetail',
      roles,
      isHide: true,
      activePath: '/ad-videos'
    }
  },
  {
    name: 'DojoAds',
    path: '/ads',
    component: '/dojo/ads',
    meta: { title: 'menus.dojo.ads', icon: 'ri:rocket-2-line', roles, isHide: true }
  },

  // 旧路径重定向
  {
    name: 'DojoMonitorRedirect',
    path: '/monitor',
    component: '/dojo/accounts/review',
    meta: { title: 'menus.dojo.accountReview', roles, isHide: true, activePath: '/accounts/review' }
  },
  {
    name: 'DojoFlowRedirect',
    path: '/flow',
    component: '/dojo/timeline',
    meta: { title: 'menus.dojo.timeline', roles, isHide: true, activePath: '/timeline' }
  },
  {
    name: 'DojoProgressRedirect',
    path: '/progress',
    component: '/dojo/timeline',
    meta: { title: 'menus.dojo.timeline', roles, isHide: true, activePath: '/timeline' }
  },
  {
    name: 'DojoExecutionRedirect',
    path: '/execution',
    component: '/dojo/timeline',
    meta: { title: 'menus.dojo.timeline', roles, isHide: true, activePath: '/timeline' }
  },
  {
    name: 'DojoConfirmRedirect',
    path: '/confirm',
    component: '/dojo/today',
    meta: { title: 'menus.dojo.today', roles, isHide: true, activePath: '/today' }
  }
]
