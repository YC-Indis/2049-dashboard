<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRoute } from 'vue-router'
  import { dojoSidebarStore, toggleSidebarCollapsed } from '@/store/dojoSidebarStore'

  defineProps<{ open: boolean }>()

  const emit = defineEmits<{
    close: []
  }>()

  const route = useRoute()
  const mobileNav = ref(false)
  const compactNav = ref(false)
  const compactExpanded = ref(false)
  const collapsed = computed(() => {
    if (mobileNav.value) return false
    if (compactNav.value) return !compactExpanded.value
    return dojoSidebarStore.collapsed
  })

  function syncViewportNav() {
    const width = window.innerWidth
    mobileNav.value = width <= 800
    compactNav.value = width > 800 && width <= 1279
    if (!compactNav.value) compactExpanded.value = false
  }

  function handleCollapseToggle() {
    if (compactNav.value) {
      compactExpanded.value = !compactExpanded.value
      return
    }
    toggleSidebarCollapsed()
  }

  onMounted(() => {
    syncViewportNav()
    window.addEventListener('resize', syncViewportNav)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncViewportNav)
  })

  const groups = [
    {
      label: '执行',
      items: [
        { path: '/project', label: '项目管理', icon: 'ph:gauge-duotone' },
        { path: '/today', label: '时间规划', icon: 'ph:sun-duotone' },
        { path: '/calendar', label: '执行日历', icon: 'ph:calendar-dots-duotone' }
      ]
    },
    {
      label: '内容',
      items: [
        { path: '/inspiration-collection', label: '灵感采集', icon: 'ph:magnifying-glass' },
        { path: '/inspiration', label: '灵感库', icon: 'ph:lightbulb-filament-duotone' },
        { path: '/benchmark-library', label: '对标库', icon: 'ph:users-three-duotone' }
      ]
    },
    {
      label: '运营',
      items: [
        { path: '/operations', label: '运营驾驶舱', icon: 'ph:chart-polar-duotone' },
        { path: '/account-matrix', label: '账号矩阵', icon: 'ph:users-three-duotone' },
        { path: '/ad-videos', label: '视频监控', icon: 'ph:play-circle-duotone' }
      ]
    }
  ] as const

  function isActive(path: string) {
    if (path === '/calendar')
      return route.path === '/calendar' || route.path === '/creator/calendar'
    if (path === '/inspiration') return route.path === '/inspiration'
    if (path === '/project') return route.path === '/project'
    return route.path === path || route.path.startsWith(`${path}/`)
  }
</script>

<template>
  <aside
    class="workspace-sidebar"
    :class="{ 'is-open': open, 'is-collapsed': collapsed }"
    :aria-expanded="!collapsed"
  >
    <div class="workspace-sidebar__top">
      <RouterLink
        class="workspace-brand"
        to="/today"
        :title="collapsed ? '2049 工作台' : undefined"
        @click="emit('close')"
      >
        <strong>2049</strong>
      </RouterLink>
      <button
        type="button"
        class="workspace-collapse"
        :title="collapsed ? '展开侧栏' : '收纳侧栏'"
        :aria-label="collapsed ? '展开侧栏' : '收纳侧栏'"
        @click="handleCollapseToggle()"
      >
        <Icon :icon="collapsed ? 'ph:sidebar-simple' : 'ph:sidebar-simple-duotone'" width="18" />
      </button>
    </div>

    <nav class="workspace-nav" aria-label="主要导航">
      <section v-for="group in groups" :key="group.label" class="workspace-nav__group">
        <p v-if="!collapsed">{{ group.label }}</p>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          :title="collapsed ? item.label : undefined"
          :class="{ 'is-active': isActive(item.path) }"
          @click="emit('close')"
        >
          <Icon :icon="item.icon" width="20" aria-hidden="true" />
          <span v-if="!collapsed">{{ item.label }}</span>
        </RouterLink>
      </section>
    </nav>

    <div class="workspace-sidebar__footer">
      <RouterLink to="/worklog" :title="collapsed ? '工作复盘' : undefined" @click="emit('close')">
        <Icon icon="ph:notebook-duotone" width="18" />
        <span v-if="!collapsed">工作复盘</span>
      </RouterLink>
    </div>
  </aside>
  <button
    v-if="open"
    class="workspace-sidebar__scrim"
    type="button"
    aria-label="关闭导航"
    @click="emit('close')"
  />
</template>

<style scoped lang="scss">
  .workspace-sidebar {
    position: relative;
    z-index: 90;
    display: flex;
    flex-direction: column;
    width: var(--warm-sidebar-expanded, 240px);
    height: 100dvh;
    padding: 18px 14px max(16px, env(safe-area-inset-bottom));
    color: rgb(255 255 255 / 68%);
    background: var(--warm-sidebar, #211d39);
    border-right: 0;
    transition: width 200ms cubic-bezier(0.22, 1, 0.36, 1);

    &.is-collapsed {
      width: var(--warm-sidebar-collapsed, 64px);
      padding: 14px 10px;

      .workspace-sidebar__top {
        justify-content: center;
        flex-direction: column;
        gap: 10px;
      }

      .workspace-brand {
        justify-content: center;
        min-height: 40px;
        padding: 0;

        strong {
          font-size: 16px;
        }
      }

      .workspace-collapse {
        margin: 0 auto;
      }

      .workspace-nav__group {
        margin-bottom: 10px;

        > a {
          justify-content: center;
          padding: 0;
        }
      }

      .workspace-sidebar__footer {
        > a,
        > button {
          justify-content: center;
          padding: 0;
        }
      }
    }
  }

  .workspace-sidebar__top {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .workspace-brand {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
    min-height: 42px;
    padding: 0 6px;
    color: #fffdfc;
    text-decoration: none;

    strong {
      overflow: hidden;
      font-family: var(--dojo-serif);
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .workspace-collapse {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: rgb(255 255 255 / 68%);
    cursor: pointer;
    background: var(--warm-sidebar-soft, #2b2648);
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 12px;

    &:hover,
    &:focus-visible {
      color: #fffdfc;
      background: var(--warm-sidebar-active, #342e55);
      outline: 0;
    }
  }

  .workspace-nav {
    flex: 1;
    min-height: 0;
    padding: 0 2px;
    overflow-x: hidden;
    overflow-y: auto;

    &__group {
      margin-bottom: 18px;

      > p {
        margin: 0 12px 8px;
        font-size: 11px;
        font-weight: 650;
        color: rgb(255 255 255 / 42%);
        letter-spacing: 0;
      }

      > a {
        position: relative;
        display: flex;
        gap: 11px;
        align-items: center;
        min-height: 46px;
        padding: 0 16px;
        margin-bottom: 2px;
        font-size: 14px;
        font-weight: 550;
        color: rgb(255 255 255 / 68%);
        text-decoration: none;
        border-radius: 12px;
        transition:
          color 140ms cubic-bezier(0.22, 1, 0.36, 1),
          background 140ms cubic-bezier(0.22, 1, 0.36, 1);

        &:hover,
        &:focus-visible {
          color: #fffdfc;
          background: rgb(255 255 255 / 5%);
          outline: 0;
        }

        &.is-active {
          color: #fffdfc;
          background: var(--warm-sidebar-active, #342e55);

          &::before {
            position: absolute;
            top: 10px;
            bottom: 10px;
            left: 0;
            width: 3px;
            content: '';
            background: var(--dojo-accent);
            border-radius: 999px;
          }
        }
      }
    }
  }

  .workspace-sidebar__footer {
    display: grid;
    gap: 4px;
    padding: 12px 2px 0;
    border-top: 1px solid rgb(255 255 255 / 8%);

    > a,
    > button {
      display: flex;
      gap: 9px;
      align-items: center;
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      font-size: 13px;
      color: rgb(255 255 255 / 68%);
      text-align: left;
      text-decoration: none;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 12px;

      &:hover,
      &:focus-visible {
        color: #fffdfc;
        background: rgb(255 255 255 / 5%);
        outline: 0;
      }
    }

  }

  .workspace-sidebar__scrim {
    display: none;
  }

  @media (width <= 800px) {
    .workspace-sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: min(82vw, 240px);
      box-shadow: 20px 0 40px rgb(33 29 57 / 28%);
      transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      transform: translateX(-104%);

      &.is-collapsed {
        width: min(82vw, 240px);
      }

      &.is-open {
        transform: translateX(0);
      }

      .workspace-collapse {
        display: none;
      }
    }

    .workspace-sidebar__scrim {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: block;
      padding: 0;
      background: rgb(33 29 57 / 42%);
      border: 0;
    }
  }
</style>
