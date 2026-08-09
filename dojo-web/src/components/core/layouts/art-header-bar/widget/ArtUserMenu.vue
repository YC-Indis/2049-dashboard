<!-- 用户菜单 -->
<template>
  <ElPopover
    ref="userMenuPopover"
    placement="bottom-end"
    :width="220"
    :hide-after="0"
    :offset="10"
    trigger="hover"
    :show-arrow="false"
    popper-class="user-menu-popover"
    popper-style="padding: 5px 16px;"
  >
    <template #reference>
      <div class="user-avatar-btn" title="账户">
        <ArtLogo class="user-avatar-btn__logo" size="28" />
      </div>
    </template>
    <template #default>
      <div class="pt-3">
        <div class="flex-c pb-1 px-0">
          <div class="user-avatar-btn user-avatar-btn--menu">
            <ArtLogo class="user-avatar-btn__logo" size="36" />
          </div>
          <div class="w-[calc(100%-60px)] h-full">
            <span class="block text-sm font-medium text-g-800 truncate">{{ displayName }}</span>
            <span class="block mt-0.5 text-xs text-g-500 truncate">{{ displayEmail }}</span>
          </div>
        </div>
        <ul class="py-4 mt-3 border-t border-g-300/80">
          <div class="log-out c-p" @click="loginOut">
            {{ $t('topBar.user.logout') }}
          </div>
        </ul>
      </div>
    </template>
  </ElPopover>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { ElMessageBox } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'

  defineOptions({ name: 'ArtUserMenu' })

  const { t } = useI18n()
  const userStore = useUserStore()
  const { getUserInfo: userInfo } = storeToRefs(userStore)
  const userMenuPopover = ref()

  const displayName = computed(() => {
    const name = userInfo.value.userName || 'Dojo'
    return /^art$/i.test(name) ? 'Dojo' : name
  })
  const displayEmail = computed(() => {
    const email = userInfo.value.email || ''
    if (/art\.design|artd\.pro|art-design/i.test(email)) return 'dojo@2049.team'
    return email || 'dojo@2049.team'
  })

  const loginOut = (): void => {
    closeUserMenu()
    setTimeout(() => {
      ElMessageBox.confirm(t('common.logOutTips'), t('common.tips'), {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        customClass: 'login-out-dialog'
      }).then(() => {
        userStore.logOut()
      })
    }, 200)
  }

  const closeUserMenu = (): void => {
    setTimeout(() => {
      userMenuPopover.value.hide()
    }, 100)
  }
</script>

<style scoped lang="scss">
  @reference '@styles/core/tailwind.css';

  .user-avatar-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    margin-right: 20px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--el-color-primary) 40%, var(--el-border-color));
    }

    &--menu {
      margin-right: 12px;
      flex-shrink: 0;
    }

    &__logo {
      pointer-events: none;
    }
  }

  .log-out {
    @apply py-1.5
    mt-2
    text-xs
    text-center
    border
    border-g-400
    rounded-md
    transition-all
    duration-200
    hover:shadow-xl;
  }
</style>
