<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import PageHeader from '../components/common/PageHeader.vue'
import MetricCard from '../components/common/MetricCard.vue'
import { creatorStore } from '../stores/creatorStore'
import { uiStore } from '../stores/uiStore'

const completedReviews = computed(() =>
  creatorStore.state.reviews.filter((review) => review.reviewedAt),
)
const pendingReviews = computed(() =>
  creatorStore.state.reviews.filter((review) => !review.reviewedAt),
)
const averageRating = computed(() => {
  if (completedReviews.value.length === 0) {
    return '0.0'
  }
  const total = completedReviews.value.reduce((sum, review) => sum + review.rating, 0)
  return (total / completedReviews.value.length).toFixed(1)
})
const totalViews = computed(() =>
  completedReviews.value.reduce((sum, review) => sum + (review.views ?? 0), 0),
)
const totalSaves = computed(() =>
  completedReviews.value.reduce((sum, review) => sum + (review.saves ?? 0), 0),
)
const metrics = computed(() => [
  {
    value: pendingReviews.value.length,
    label: '待复盘',
    detail: '发布后 T+3 到期',
    tone: 'coral' as const,
  },
  { value: averageRating.value, label: '平均星级', detail: '最近 30 天', tone: 'purple' as const },
  {
    value: totalViews.value.toLocaleString(),
    label: '累计浏览',
    detail: '已复盘内容',
    tone: 'green' as const,
  },
  {
    value: totalSaves.value.toLocaleString(),
    label: '累计收藏',
    detail: totalViews.value
      ? `收藏率 ${((totalSaves.value / totalViews.value) * 100).toFixed(1)}%`
      : '暂无数据',
    tone: 'blue' as const,
  },
])

function getContentTitle(contentId: string) {
  return creatorStore.getContent(contentId)?.title ?? '未命名内容'
}

function handleCompleteReview(reviewId: string) {
  creatorStore.completeReview(reviewId, '先给真实结果，再解释判断过程。')
  uiStore.showToast('复盘已完成，规则已存入内容规则库')
}
</script>

<template>
  <div class="page page--review">
    <PageHeader
      eyebrow="REVIEW LAB"
      title="每次发布，都留下下一次能复用的判断。"
      description="数据快照、定型评价、原因分析、规则沉淀，组成一条完整的学习闭环。"
    />

    <section class="metrics-grid">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        v-bind="metric"
      />
    </section>

    <section class="review-split">
      <div class="review-column panel">
        <header class="section-heading">
          <div>
            <p class="eyebrow">TO REVIEW</p>
            <h2>待复盘</h2>
          </div>
          <span class="count-badge">{{ pendingReviews.length }}</span>
        </header>
        <article v-for="review in pendingReviews" :key="review.id" class="review-card review-card--pending">
          <div class="review-card__date">
            <Icon icon="ph:clock" width="17" />
            {{ review.dueDate }} 到期
          </div>
          <h3>{{ getContentTitle(review.contentId) }}</h3>
          <p>补上结果、原因和一条下次可以复用的规则。</p>
          <button type="button" @click="handleCompleteReview(review.id)">
            完成快速复盘
            <Icon icon="ph:arrow-right" width="16" />
          </button>
        </article>
      </div>

      <div class="review-column panel">
        <header class="section-heading">
          <div>
            <p class="eyebrow">REVIEWED</p>
            <h2>已复盘</h2>
          </div>
          <span class="count-badge">{{ completedReviews.length }}</span>
        </header>
        <article v-for="review in completedReviews" :key="review.id" class="review-card">
          <header>
            <span>{{ review.reviewedAt }}</span>
            <span class="stars" :aria-label="`${review.rating} 星`">
              <Icon
                v-for="index in 5"
                :key="index"
                icon="ph:star-fill"
                width="15"
                :class="{ 'is-muted': index > (review.rating ?? 0) }"
              />
            </span>
          </header>
          <h3>{{ getContentTitle(review.contentId) }}</h3>
          <p>{{ review.result }}</p>
          <button type="button">查看复盘</button>
        </article>
      </div>
    </section>

    <section class="rules-library panel">
      <header class="section-heading">
        <div>
          <p class="eyebrow">REUSABLE RULES</p>
          <h2>内容规则库</h2>
        </div>
        <span class="section-note">{{ creatorStore.state.rules.length }} 条可复用判断</span>
      </header>
      <div class="rule-grid">
        <article v-for="rule in creatorStore.state.rules" :key="rule.id" class="rule-card">
          <span class="rule-card__quote">“</span>
          <blockquote>{{ rule.text }}</blockquote>
          <footer>
            <p>来自《{{ rule.sourceContentId ? getContentTitle(rule.sourceContentId) : '个人规则' }}》</p>
            <span>{{ rule.createdAt }}</span>
            <span>已复用 {{ rule.usageCount }} 次</span>
          </footer>
        </article>
      </div>
    </section>
  </div>
</template>
