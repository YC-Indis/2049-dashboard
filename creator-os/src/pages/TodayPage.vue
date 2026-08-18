<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '../components/common/PageHeader.vue'
import MetricCard from '../components/common/MetricCard.vue'
import CreatorFlowSteps from '../components/today/CreatorFlowSteps.vue'
import QuickCapture from '../components/today/QuickCapture.vue'
import WeeklyRhythm from '../components/today/WeeklyRhythm.vue'
import { creatorStore } from '../stores/creatorStore'

const metrics = computed(() => [
  {
    value: creatorStore.activeContents.value.length,
    label: '推进内容',
    detail: '跨越多个制作阶段',
    tone: 'coral' as const,
  },
  {
    value: creatorStore.scheduledTasks.value.length,
    label: '计划阶段',
    detail: '已经排入真实节奏',
    tone: 'purple' as const,
  },
  {
    value: creatorStore.state.stageTasks.filter((task) => task.status === 'done').length,
    label: '已完成阶段',
    detail: '持续积累生产进度',
    tone: 'green' as const,
  },
  {
    value: creatorStore.state.reviews.filter((review) => !review.reviewedAt).length,
    label: '待复盘',
    detail: '发布后 T+3 到期',
    tone: 'blue' as const,
  },
])
</script>

<template>
  <div class="page page--today">
    <PageHeader
      eyebrow="TODAY · CREATOR FLOW"
      title="看清这一周，哪里需要补一口气。"
      description="所有任务都来自真实档期；完成一个阶段，内容会自动进入下一站。"
    >
      <template #actions>
        <div class="segmented-control" aria-label="时间范围">
          <button type="button">今天</button>
          <button class="is-active" type="button">本周</button>
        </div>
      </template>
    </PageHeader>

    <CreatorFlowSteps />
    <QuickCapture />

    <section class="metrics-grid">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        v-bind="metric"
      />
    </section>

    <WeeklyRhythm />
  </div>
</template>
