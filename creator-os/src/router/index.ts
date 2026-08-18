import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/today', component: () => import('../pages/TodayPage.vue') },
    { path: '/calendar', component: () => import('../pages/CalendarPage.vue') },
    { path: '/flow', component: () => import('../pages/FlowPage.vue') },
    { path: '/strategy', component: () => import('../pages/StrategyPage.vue') },
    { path: '/goals', component: () => import('../pages/GoalsPage.vue') },
    { path: '/review', component: () => import('../pages/ReviewPage.vue') },
    { path: '/profile', component: () => import('../pages/ProfilePage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/today' },
  ],
})

export default router
