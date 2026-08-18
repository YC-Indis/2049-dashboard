<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import PageHeader from '../components/common/PageHeader.vue'
import ProgressBar from '../components/common/ProgressBar.vue'
import { creatorStore } from '../stores/creatorStore'

const goal = computed(() => creatorStore.state.goal)
const health = computed(() => {
  const publish = goal.value.publishCurrent / goal.value.publishTarget
  const followers = goal.value.followerCurrent / goal.value.followerTarget
  const quality = goal.value.qualityCurrent / goal.value.qualityTarget
  return Math.round(((publish + followers + quality) / 3) * 100)
})

const goalMetrics = computed(() => [
  {
    label: '发布进度',
    value: `${goal.value.publishCurrent} / ${goal.value.publishTarget} 篇`,
    detail: `还需 ${Math.max(0, goal.value.publishTarget - goal.value.publishCurrent)} 篇`,
    progress: Math.round((goal.value.publishCurrent / goal.value.publishTarget) * 100),
    icon: 'ph:paper-plane-tilt',
  },
  {
    label: '粉丝增长',
    value: `${goal.value.followerCurrent.toLocaleString()} / ${goal.value.followerTarget.toLocaleString()}`,
    detail: `还差 ${Math.max(0, goal.value.followerTarget - goal.value.followerCurrent)} 人`,
    progress: Math.round((goal.value.followerCurrent / goal.value.followerTarget) * 100),
    icon: 'ph:users-three',
  },
  {
    label: '质量达标',
    value: `${goal.value.qualityCurrent} / ${goal.value.qualityTarget} 条`,
    detail: '星级 4.5 以上',
    progress: Math.round((goal.value.qualityCurrent / goal.value.qualityTarget) * 100),
    icon: 'ph:star',
  },
])
</script>

<template>
  <div class="page page--goals">
    <PageHeader
      eyebrow="CREATOR NORTH STAR"
      title="看清离目标还有多远，也看清下一步。"
      description="产量、涨粉、质量三线合并成健康度；数字不是压力，而是节奏导航。"
    >
      <template #actions>
        <div class="page-actions">
          <button class="secondary-button" type="button">结束本阶段</button>
          <button class="solid-button" type="button">调整目标</button>
        </div>
      </template>
    </PageHeader>

    <section class="current-cycle">
      <div class="current-cycle__copy">
        <p>CURRENT CYCLE</p>
        <h2>{{ goal.title }}</h2>
        <div class="cycle-date">
          <Icon icon="ph:calendar-blank" width="19" />
          <span>{{ goal.startDate }} - {{ goal.endDate }}</span>
          <i />
          <strong>还需 {{ Math.max(0, goal.publishTarget - goal.publishCurrent) }} 篇</strong>
        </div>
      </div>
      <div class="cycle-ring" aria-label="阶段健康度 39%">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="65" />
          <circle
            class="cycle-ring__progress"
            cx="80"
            cy="80"
            r="65"
            :style="{ strokeDashoffset: 408 - (408 * health) / 100 }"
          />
        </svg>
        <span>
        <strong>{{ health }}%</strong>
          <small>阶段健康度</small>
        </span>
      </div>
    </section>

    <section class="goal-metrics">
      <article v-for="metric in goalMetrics" :key="metric.label" class="goal-metric panel">
        <header>
          <span class="goal-metric__icon">
            <Icon :icon="metric.icon" width="21" />
          </span>
          <span>{{ metric.label }}</span>
          <small>{{ metric.detail }}</small>
        </header>
        <strong>{{ metric.value }}</strong>
        <ProgressBar :value="metric.progress" />
      </article>
    </section>

    <section class="next-move panel">
      <div>
        <p class="eyebrow">NEXT MOVE</p>
        <h2>下一步，把两条高意向内容排进本周。</h2>
        <p>优先推进正在脚本和录制阶段的内容，保持节奏比临时加量更重要。</p>
      </div>
      <RouterLink to="/calendar">
        查看节奏日历
        <Icon icon="ph:arrow-right" width="18" />
      </RouterLink>
    </section>
  </div>
</template>
