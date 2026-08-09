import { AppRouteRecord } from '@/types/router'

const roles = ['R_SUPER', 'R_ADMIN', 'R_USER']

/**
 * 扁平侧栏：每个板块一个独立页面，不做可展开分组。
 * 监看面板已移除，总账号预览顶替其位置。
 */
export const dojoRoutes: AppRouteRecord[] = [
  {
    name: 'DojoToday',
    path: '/today',
    component: '/dojo/today',
    meta: { title: 'menus.dojo.today', icon: 'ri:sun-line', roles, fixedTab: true }
  },
  {
    name: 'DojoProject',
    path: '/project',
    component: '/dojo/project',
    meta: { title: 'menus.dojo.project', icon: 'ri:dashboard-3-line', roles }
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
    name: 'DojoScripts',
    path: '/scripts',
    component: '/dojo/scripts',
    meta: { title: 'menus.dojo.scripts', icon: 'ri:file-list-3-line', roles }
  },
  {
    name: 'DojoDistribution',
    path: '/distribution',
    component: '/dojo/distribution',
    meta: { title: 'menus.dojo.distribution', icon: 'ri:send-plane-line', roles }
  },
  {
    name: 'DojoAccountIntake',
    path: '/accounts/intake',
    component: '/dojo/accounts/intake',
    meta: { title: 'menus.dojo.accountIntake', icon: 'ri:inbox-archive-line', roles }
  },
  {
    name: 'DojoAccountReview',
    path: '/accounts/review',
    component: '/dojo/accounts/review',
    meta: { title: 'menus.dojo.accountReview', icon: 'ri:tiktok-line', roles }
  },
  {
    name: 'DojoAds',
    path: '/ads',
    component: '/dojo/ads',
    meta: { title: 'menus.dojo.ads', icon: 'ri:rocket-2-line', roles }
  },
  {
    name: 'DojoAdVideos',
    path: '/ads/videos',
    component: '/dojo/ads/videos',
    meta: { title: 'menus.dojo.adVideos', icon: 'ri:play-circle-line', roles }
  },
  {
    name: 'DojoAdAccounts',
    path: '/ads/accounts',
    component: '/dojo/ads/accounts',
    meta: { title: 'menus.dojo.adAccounts', icon: 'ri:bar-chart-box-line', roles }
  },
  {
    name: 'DojoAccounts',
    path: '/accounts',
    component: '/dojo/accounts',
    meta: { title: 'menus.dojo.accounts', icon: 'ri:file-text-line', roles }
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
