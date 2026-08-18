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
    component: '/dojo/creator/timeline',
    meta: { title: 'menus.dojo.today', icon: 'ri:sun-line', roles }
  },
  {
    name: 'DojoInspirationCollection',
    path: '/inspiration-collection',
    component: '/dojo/inspiration',
    meta: { title: 'menus.dojo.inspirationCollection', icon: 'ri:radar-line', roles }
  },
  {
    name: 'DojoInspiration',
    path: '/inspiration',
    component: '/dojo/inspiration',
    meta: { title: 'menus.dojo.inspiration', icon: 'ri:lightbulb-flash-line', roles }
  },
  {
    name: 'DojoScriptWorkshop',
    path: '/script-workshop',
    component: '/dojo/inspiration',
    meta: {
      title: 'menus.dojo.inspiration',
      icon: 'ri:file-edit-line',
      roles,
      isHide: true,
      activePath: '/inspiration'
    },
    redirect: '/inspiration'
  },
  {
    name: 'DojoBenchmarkLibrary',
    path: '/benchmark-library',
    component: '/dojo/inspiration',
    meta: { title: 'menus.dojo.benchmarkLibrary', icon: 'ri:user-star-line', roles }
  },
  {
    name: 'DojoOperations',
    path: '/operations',
    component: '/dojo/operations',
    meta: { title: 'menus.dojo.operations', icon: 'ri:dashboard-2-line', roles }
  },
  {
    name: 'DojoCreator',
    path: '/creator',
    component: '/index/index',
    redirect: '/creator/today',
    meta: { title: 'menus.dojo.creator', icon: 'ri:sparkling-2-line', roles, isHide: true },
    children: [
      {
        name: 'DojoCreatorToday',
        path: 'today',
        component: '/dojo/creator',
        meta: { title: 'menus.dojo.creatorToday', icon: 'ri:focus-3-line', roles }
      },
      {
        name: 'DojoCreatorCalendar',
        path: 'calendar',
        component: '/dojo/creator/calendar',
        meta: { title: 'menus.dojo.creatorCalendar', icon: 'ri:calendar-event-line', roles }
      },
      {
        name: 'DojoCreatorTimeline',
        path: 'timeline',
        component: '/dojo/creator/timeline',
        meta: {
          title: 'menus.dojo.creatorTimeline',
          icon: 'ri:git-commit-line',
          roles,
          isHide: true,
          activePath: '/today'
        }
      },
      {
        name: 'DojoCreatorReview',
        path: 'review',
        component: '/dojo/creator/review',
        meta: { title: 'menus.dojo.creatorReview', icon: 'ri:flask-line', roles }
      }
    ]
  },
  {
    name: 'DojoProject',
    path: '/project',
    component: '/dojo/project',
    meta: {
      title: 'menus.dojo.project',
      icon: 'ri:dashboard-3-line',
      roles
    }
  },
  {
    name: 'DojoTimeline',
    path: '/timeline',
    component: '/dojo/timeline',
    meta: {
      title: 'menus.dojo.timeline',
      icon: 'ri:calendar-schedule-line',
      roles,
      isHide: true,
      activePath: '/today'
    }
  },
  {
    name: 'DojoCalendar',
    path: '/calendar',
    component: '/dojo/creator/calendar',
    meta: { title: 'menus.dojo.calendar', icon: 'ri:calendar-2-line', roles }
  },
  {
    name: 'DojoAccountReview',
    path: '/account-matrix',
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
  // 账号相关路径必须彼此第一段不同，否则会互相覆盖导致空白页。
  {
    name: 'DojoWorklog',
    path: '/worklog',
    component: '/dojo/accounts',
    meta: { title: 'menus.dojo.accounts', icon: 'ri:file-text-line', roles }
  },
  {
    name: 'DojoBackup',
    path: '/backup',
    component: '/dojo/backup',
    meta: { title: 'menus.dojo.backup', icon: 'ri:database-2-line', roles }
  },

  // —— 侧栏隐藏，卡片/旧链接仍可进入 ——
  {
    name: 'DojoAccountDetail',
    path: '/account-detail/:handle',
    component: '/dojo/accounts/detail',
    meta: {
      title: 'menus.dojo.accountDetail',
      roles,
      isHide: true,
      activePath: '/account-matrix'
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
    path: '/account-intake',
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

  // 旧路径重定向（单段 path，避免 /accounts/* 互相抢 Layout 父路由）
  {
    name: 'DojoMonitorRedirect',
    path: '/monitor',
    component: '/dojo/accounts/review',
    meta: {
      title: 'menus.dojo.accountReview',
      roles,
      isHide: true,
      activePath: '/account-matrix'
    },
    redirect: '/account-matrix'
  },
  {
    name: 'DojoFlowRedirect',
    path: '/flow',
    component: '/dojo/creator/calendar',
    meta: { title: 'menus.dojo.calendar', roles, isHide: true, activePath: '/calendar' }
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
    component: '/dojo/creator/timeline',
    meta: { title: 'menus.dojo.today', roles, isHide: true, activePath: '/today' }
  }
]
