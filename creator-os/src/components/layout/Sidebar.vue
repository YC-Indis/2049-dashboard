<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { NAVIGATION_GROUPS } from '../../constants/navigation'
import { creatorStore } from '../../stores/creatorStore'

const goalHealth = computed(() => {
  const goal = creatorStore.state.goal
  const publish = goal.publishCurrent / goal.publishTarget
  const followers = goal.followerCurrent / goal.followerTarget
  const quality = goal.qualityCurrent / goal.qualityTarget
  return Math.round(((publish + followers + quality) / 3) * 100)
})
</script>

<template>
  <aside class="sidebar">
    <RouterLink
      class="brand"
      to="/today"
      aria-label="XIA Creator OS 首页"
    >
      <span class="brand__mark">X</span>
      <span class="brand__copy">
        <strong>XIA CREATOR OS</strong>
        <small>CONTENT · GROWTH · SIGNAL</small>
      </span>
    </RouterLink>

    <nav class="sidebar__nav" aria-label="主导航">
      <section
        v-for="group in NAVIGATION_GROUPS"
        :key="group.label"
        class="nav-group"
      >
        <p class="nav-group__label">{{ group.label }}</p>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :to="item.path"
        >
          <Icon :icon="item.icon" width="21" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </section>
    </nav>

    <div class="sidebar__footer">
      <RouterLink class="goal-card" to="/goals">
        <div class="goal-card__topline">
          <span>阶段目标</span>
          <strong>{{ goalHealth }}%</strong>
        </div>
        <div class="goal-card__track" aria-hidden="true">
          <span :style="{ width: `${goalHealth}%` }" />
        </div>
        <p>{{ creatorStore.state.goal.publishCurrent }} / {{ creatorStore.state.goal.publishTarget }} 篇</p>
        <small>当前 {{ creatorStore.state.goal.followerCurrent.toLocaleString() }} 粉丝</small>
      </RouterLink>

      <RouterLink class="profile-card" to="/profile">
        <span class="profile-card__avatar">夏</span>
        <span>
          <strong>小夏</strong>
          <small>AI × 高客单 IP 运营</small>
        </span>
        <Icon icon="ph:dots-three" width="20" />
      </RouterLink>
    </div>
  </aside>
</template>
