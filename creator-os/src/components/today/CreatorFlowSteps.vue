<script setup lang="ts">
import { Icon } from '@iconify/vue'

const steps = [
  {
    number: '01',
    title: '捕捉一个真实问题',
    detail: '一句话也可以，先进入灵感池',
    icon: 'ph:sparkle',
    path: '/flow',
  },
  {
    number: '02',
    title: '安排下一个生产阶段',
    detail: '把大纲、脚本或录制放进日历',
    icon: 'ph:calendar-check',
    path: '/calendar',
  },
  {
    number: '03',
    title: '在 T+3 留下一条规则',
    detail: '让下一条内容直接复用经验',
    icon: 'ph:bookmark-simple',
    path: '/review',
  },
]
</script>

<template>
  <section class="creator-flow panel">
    <RouterLink
      v-for="(step, index) in steps"
      :key="step.number"
      class="creator-flow__step"
      :to="step.path"
    >
      <span class="creator-flow__number">{{ step.number }}</span>
      <span class="creator-flow__icon">
        <Icon :icon="step.icon" width="21" />
      </span>
      <span class="creator-flow__copy">
        <strong>{{ step.title }}</strong>
        <small>{{ step.detail }}</small>
      </span>
      <Icon
        v-if="index < steps.length - 1"
        class="creator-flow__arrow"
        icon="ph:arrow-right"
        width="20"
      />
    </RouterLink>
  </section>
</template>
