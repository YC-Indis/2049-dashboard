<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    dojoCreatorStore,
    getCreatorContent,
    pendingCreatorReviews
  } from '@/store/dojoCreatorStore'
  import { dojoInspirationStore } from '@/store/dojoInspirationStore'
  import { getProjectById } from '@/store/dojoProjectStore'
  import type { CreatorReview } from '@/types/dojoCreator'
  import CreatorReviewDialog from './components/CreatorReviewDialog.vue'

  defineOptions({ name: 'DojoCreatorReview' })

  const route = useRoute()
  const router = useRouter()
  const reviewDialogOpen = ref(false)
  const activeReviewId = ref('')
  const initialInspirationId = ref('')

  const completedReviews = computed(() =>
    dojoCreatorStore.reviews
      .filter((review) => review.reviewedAt)
      .sort((left, right) => String(right.reviewedAt).localeCompare(String(left.reviewedAt)))
  )
  const averageRating = computed(() => {
    if (!completedReviews.value.length) return '—'
    const total = completedReviews.value.reduce((sum, review) => sum + review.rating, 0)
    return (total / completedReviews.value.length).toFixed(1)
  })
  const totalViews = computed(() =>
    completedReviews.value.reduce((sum, review) => sum + (review.views || 0), 0)
  )
  const totalSaves = computed(() =>
    completedReviews.value.reduce((sum, review) => sum + (review.saves || 0), 0)
  )
  const knowledgeDimensions = [
    {
      id: 'shot' as const,
      label: '镜头知识',
      description: '构图、动作、节奏与可拍替代方案',
      icon: 'ph:film-strip-duotone'
    },
    {
      id: 'copy' as const,
      label: '话术知识',
      description: 'Hook、结构、承诺与表达顺序',
      icon: 'ph:chat-text-duotone'
    },
    {
      id: 'music' as const,
      label: '音乐知识',
      description: '情绪、卡点、声音证据与静默策略',
      icon: 'ph:waveform-duotone'
    }
  ]

  function dimensionRules(dimension: 'shot' | 'copy' | 'music') {
    return dojoCreatorStore.rules.filter((rule) => (rule.dimension || 'copy') === dimension)
  }

  function contentTitle(contentId: string) {
    return getCreatorContent(contentId)?.title || '未命名内容'
  }

  function reviewTitle(review: CreatorReview) {
    if (review.contentId) return contentTitle(review.contentId)
    return (
      dojoInspirationStore.executableInspirations.find(
        (inspiration) => inspiration.id === review.inspirationId
      )?.title || '灵感知识记录'
    )
  }

  function projectName(contentId: string) {
    if (!contentId) return '灵感库'
    const projectId = getCreatorContent(contentId)?.projectId || ''
    return getProjectById(projectId)?.name || '未关联项目'
  }

  function num(value = 0) {
    return value.toLocaleString('zh-CN')
  }

  function openNewReview() {
    activeReviewId.value = ''
    initialInspirationId.value = ''
    reviewDialogOpen.value = true
  }

  function openReview(review: CreatorReview) {
    activeReviewId.value = review.id
    initialInspirationId.value = review.inspirationId || ''
    reviewDialogOpen.value = true
  }

  function closeReviewDialog() {
    reviewDialogOpen.value = false
    activeReviewId.value = ''
    initialInspirationId.value = ''
    if (route.query.new || route.query.inspiration) router.replace('/creator/review')
  }

  watch(
    () => [route.query.new, route.query.inspiration],
    ([isNew, inspirationId]) => {
      if (isNew !== '1' || typeof inspirationId !== 'string') return
      activeReviewId.value = ''
      initialInspirationId.value = inspirationId
      reviewDialogOpen.value = true
    },
    { immediate: true }
  )
</script>

<template>
  <div class="creator-surface creator-review">
    <header class="creator-heading">
      <div class="creator-heading__copy">
        <h1>每条视频都留下数据、脚本和你自己的判断。</h1>
        <p
          >AI
          可以帮你整理，但原始事实与个人记录必须由你保留；这些文档会逐步形成可复用的内容知识库。</p
        >
      </div>
      <div class="creator-heading__actions">
        <ElButton
          type="primary"
          :disabled="
            !dojoCreatorStore.contents.length && !dojoInspirationStore.executableInspirations.length
          "
          @click="openNewReview"
        >
          <Icon icon="ph:note-pencil" width="16" />
          新建复盘记录
        </ElButton>
      </div>
    </header>

    <section class="review-summary" aria-label="复盘摘要">
      <div>
        <strong>{{ pendingCreatorReviews.length }}</strong>
        <span>等待复盘</span>
        <small>发布后自动进入，也可手动新建</small>
      </div>
      <div>
        <strong>{{ completedReviews.length }}</strong>
        <span>本地文档</span>
        <small>数据、脚本与个人记录</small>
      </div>
      <div>
        <strong>{{ averageRating }}</strong>
        <span>平均评价</span>
        <small>来自已完成的内容复盘</small>
      </div>
      <div>
        <strong>{{ num(totalViews) }}</strong>
        <span>累计播放</span>
        <small>{{ totalSaves ? `累计收藏 ${num(totalSaves)}` : '等待录入真实数据' }}</small>
      </div>
    </section>

    <div class="review-grid">
      <section class="creator-panel review-queue">
        <div class="creator-section-head">
          <div>
            <h2>待复盘队列</h2>
            <p>自动提醒只是入口，任何内容都能主动建立复盘。</p>
          </div>
          <span>{{ pendingCreatorReviews.length }}</span>
        </div>

        <div v-if="pendingCreatorReviews.length" class="review-list">
          <article v-for="review in pendingCreatorReviews" :key="review.id">
            <div class="review-list__date">
              <Icon icon="ph:clock" width="15" />
              {{ review.dueDate }} 到期
            </div>
            <h3>{{ reviewTitle(review) }}</h3>
            <p>{{ projectName(review.contentId) }}</p>
            <button type="button" @click="openReview(review)">
              开始记录
              <Icon icon="ph:arrow-right" width="15" />
            </button>
          </article>
        </div>
        <div v-else class="creator-empty">
          <Icon icon="ph:check-circle" width="26" />
          <strong>没有自动待办</strong>
          <span>仍可以点击右上角，为任意历史内容主动建立复盘文档。</span>
        </div>
      </section>

      <section class="creator-panel knowledge-index">
        <div class="creator-section-head">
          <div>
            <h2>内容知识文档</h2>
            <p>每次记录都保存在本地，按内容持续积累。</p>
          </div>
          <span>{{ completedReviews.length }} 篇</span>
        </div>

        <div v-if="completedReviews.length" class="knowledge-list">
          <article
            v-for="review in completedReviews"
            :key="review.id"
            tabindex="0"
            role="button"
            @click="openReview(review)"
            @keydown.enter="openReview(review)"
          >
            <header>
              <div>
                <time :datetime="review.reviewedAt">{{ review.reviewedAt }}</time>
                <span>{{ projectName(review.contentId) }}</span>
              </div>
              <span class="knowledge-list__rating">
                <Icon icon="ph:star-fill" width="13" />
                {{ review.rating }} / 5
              </span>
            </header>
            <h3>{{ review.title || reviewTitle(review) }}</h3>
            <p>{{ review.manualNotes || review.result }}</p>

            <dl>
              <div>
                <dt>播放</dt>
                <dd>{{ num(review.views) }}</dd>
              </div>
              <div>
                <dt>点赞</dt>
                <dd>{{ num(review.likes) }}</dd>
              </div>
              <div>
                <dt>评论</dt>
                <dd>{{ num(review.comments) }}</dd>
              </div>
              <div>
                <dt>收藏</dt>
                <dd>{{ num(review.saves) }}</dd>
              </div>
            </dl>

            <div v-if="review.scriptSnapshot" class="knowledge-snippet">
              <span>脚本快照</span>
              <p>{{ review.scriptSnapshot }}</p>
            </div>
            <div v-if="review.manualNotes" class="knowledge-snippet is-personal">
              <span>我的启发</span>
              <p>{{ review.manualNotes }}</p>
            </div>
            <div v-if="review.aiSummary" class="knowledge-snippet is-ai">
              <span>AI 整理</span>
              <p>{{ review.aiSummary }}</p>
            </div>
            <div
              v-if="review.shotNotes || review.copyNotes || review.musicNotes"
              class="knowledge-dimension-notes"
            >
              <span v-if="review.shotNotes">画面：{{ review.shotNotes }}</span>
              <span v-if="review.copyNotes">内容：{{ review.copyNotes }}</span>
              <span v-if="review.musicNotes">音乐：{{ review.musicNotes }}</span>
            </div>
            <footer>
              <span v-for="tag in review.tags || []" :key="tag">#{{ tag }}</span>
              <strong v-if="review.nextAction">下一步：{{ review.nextAction }}</strong>
            </footer>
          </article>
        </div>
        <div v-else class="creator-empty">
          <Icon icon="ph:notebook" width="26" />
          <strong>知识库还没有第一篇文档</strong>
          <span>新建一条复盘，把视频、脚本、数据和个人判断一起保存下来。</span>
        </div>
      </section>
    </div>

    <section class="creator-panel rule-library">
      <div class="creator-section-head">
        <div>
          <h2>三维内容知识库</h2>
          <p>规则不再混成一堆：分别积累镜头、话术和音乐的筛选规律与制作逻辑。</p>
        </div>
        <span>{{ dojoCreatorStore.rules.length }} 条</span>
      </div>

      <div class="knowledge-ai-state">
        <Icon icon="ph:brain-duotone" width="22" />
        <div>
          <strong>每条记录都可以再次交给 DeepSeek 整理</strong>
          <p
            >AI
            只读取你保存的启发、画面、话术、音乐和数据记录，再按三维整理；不会假装直接看过视频。</p
          >
        </div>
        <button type="button" @click="openNewReview">记录一条启发</button>
      </div>

      <div class="knowledge-dimensions">
        <section v-for="dimension in knowledgeDimensions" :key="dimension.id">
          <header>
            <Icon :icon="dimension.icon" width="20" />
            <div>
              <h3>{{ dimension.label }}</h3>
              <p>{{ dimension.description }}</p>
            </div>
            <span>{{ dimensionRules(dimension.id).length }}</span>
          </header>
          <div v-if="dimensionRules(dimension.id).length" class="dimension-rules">
            <blockquote v-for="rule in dimensionRules(dimension.id)" :key="rule.id">
              <p>{{ rule.text }}</p>
              <footer>
                <span>{{ rule.createdAt }}</span>
                <span>复用 {{ rule.usageCount }} 次</span>
                <span v-if="rule.sourceContentId"
                  >来自「{{ contentTitle(rule.sourceContentId) }}」</span
                >
              </footer>
            </blockquote>
          </div>
          <div v-else class="dimension-empty">
            <Icon icon="ph:plus-circle" width="18" />
            <span>复盘时选择“{{ dimension.label.slice(0, 2) }}”维度，沉淀第一条规则。</span>
          </div>
        </section>
      </div>
    </section>

    <CreatorReviewDialog
      :open="reviewDialogOpen"
      :review-id="activeReviewId"
      :initial-inspiration-id="initialInspirationId"
      @close="closeReviewDialog"
      @saved="closeReviewDialog"
    />
  </div>
</template>

<style scoped lang="scss">
  @use './creator-theme';

  .review-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 18px;
    overflow: hidden;
    background: var(--creator-surface);
    border-radius: 15px;
    box-shadow: 0 9px 26px rgb(37 50 69 / 7%);
  }

  .review-summary > div {
    display: grid;
    gap: 5px;
    padding: 20px 22px;
    border-right: 1px solid var(--creator-line);
  }

  .review-summary > div:last-child {
    border-right: 0;
  }

  .review-summary strong {
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    color: var(--creator-deep);
  }

  .review-summary span {
    font-size: 11px;
    font-weight: 700;
  }

  .review-summary small {
    font-size: 11px;
    color: var(--creator-faint);
  }

  .review-grid {
    display: grid;
    grid-template-columns: minmax(260px, 0.7fr) minmax(0, 1.7fr);
    gap: 18px;
    align-items: start;
  }

  .review-queue,
  .knowledge-index,
  .rule-library {
    padding: 20px;
  }

  .creator-section-head {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .creator-section-head h2,
  .creator-section-head p {
    margin: 0;
  }

  .creator-section-head h2 {
    font-size: 14px;
  }

  .creator-section-head p {
    margin-top: 4px;
    font-size: 11px;
    color: var(--creator-muted);
  }

  .creator-section-head > span {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    color: var(--creator-cyan);
  }

  .review-list,
  .knowledge-list {
    display: grid;
    gap: 10px;
  }

  .review-list article {
    padding: 14px;
    background: var(--creator-surface-soft);
    border-radius: 11px;
  }

  .review-list__date {
    display: flex;
    gap: 5px;
    align-items: center;
    font-size: 10px;
    color: var(--creator-faint);
  }

  .review-list h3 {
    margin: 8px 0 0;
    font-size: 12px;
  }

  .review-list p {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--creator-muted);
  }

  .review-list button {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 9px;
    margin-top: 12px;
    font-size: 11px;
    color: #fff;
    cursor: pointer;
    background: var(--creator-deep);
    border: 0;
    border-radius: 8px;
  }

  .knowledge-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .knowledge-list > article {
    min-width: 0;
    padding: 16px;
    cursor: pointer;
    background: #f8fafc;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--creator-line);
    transition:
      background 160ms ease,
      transform 160ms ease;
  }

  .knowledge-list > article:hover,
  .knowledge-list > article:focus-visible {
    background: #f1f6fc;
    outline: none;
    transform: translateY(-1px);
  }

  .knowledge-list article > header {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .knowledge-list article > header > div {
    display: grid;
    gap: 2px;
    font-size: 10px;
    color: var(--creator-faint);
  }

  .knowledge-list__rating {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    font-weight: 700;
    color: #956d19;
  }

  .knowledge-list h3 {
    margin: 11px 0 0;
    font-size: 13px;
    line-height: 1.4;
  }

  .knowledge-list article > p {
    display: -webkit-box;
    margin: 7px 0 0;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.6;
    color: var(--creator-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .knowledge-list dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 5px;
    margin: 13px 0 0;
  }

  .knowledge-list dl div {
    display: grid;
    gap: 2px;
    padding: 7px;
    background: #eaf0f6;
    border-radius: 7px;
  }

  .knowledge-list dt {
    font-size: 7px;
    color: var(--creator-faint);
  }

  .knowledge-list dd {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--creator-deep);
  }

  .knowledge-snippet {
    padding: 9px;
    margin-top: 10px;
    background: var(--dojo-paper-muted);
    border-radius: 8px;
  }

  .knowledge-snippet.is-personal {
    background: #eef5f2;
  }

  .knowledge-snippet.is-ai {
    background: #f1eefb;
  }

  .knowledge-snippet span {
    font-size: 7px;
    color: var(--creator-faint);
  }

  .knowledge-snippet p {
    display: -webkit-box;
    margin: 4px 0 0;
    overflow: hidden;
    font-size: 10px;
    line-height: 1.55;
    color: var(--creator-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .knowledge-dimension-notes {
    display: grid;
    gap: 5px;
    margin-top: 10px;
  }

  .knowledge-dimension-notes span {
    padding: 7px 9px;
    font-size: 10px;
    line-height: 1.5;
    color: var(--creator-muted);
    background: var(--creator-surface-soft);
    border-radius: 7px;
  }

  .knowledge-list article > footer {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
  }

  .knowledge-list footer span {
    font-size: 10px;
    color: #43698f;
  }

  .knowledge-list footer strong {
    width: 100%;
    font-size: 10px;
    color: var(--creator-deep);
  }

  .rule-library {
    margin-top: 18px;
  }

  .knowledge-dimensions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .knowledge-ai-state {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 13px 14px;
    margin-bottom: 12px;
    color: #38526e;
    background: var(--dojo-paper-muted);
    border-radius: 10px;
  }

  .knowledge-ai-state strong {
    font-size: 10px;
  }

  .knowledge-ai-state p {
    margin: 4px 0 0;
    font-size: 10px;
    line-height: 1.55;
    color: var(--creator-muted);
  }

  .knowledge-ai-state button {
    min-height: 30px;
    padding: 0 10px;
    font-size: 10px;
    color: var(--creator-deep);
    cursor: pointer;
    background: rgb(255 255 255 / 60%);
    border: 1px solid var(--creator-line);
    border-radius: 7px;
  }

  .knowledge-dimensions > section {
    min-width: 0;
    overflow: hidden;
    background: var(--creator-surface-soft);
    border-radius: 11px;
  }

  .knowledge-dimensions > section > header {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
    padding: 13px;
    border-bottom: 1px solid var(--creator-line);
  }

  .knowledge-dimensions h3,
  .knowledge-dimensions header p {
    margin: 0;
  }

  .knowledge-dimensions h3 {
    font-size: 10px;
  }

  .knowledge-dimensions header p {
    margin-top: 3px;
    font-size: 10px;
    line-height: 1.45;
    color: var(--creator-muted);
  }

  .knowledge-dimensions header > span {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    font-size: 10px;
    color: var(--creator-deep);
    background: var(--creator-surface);
    border-radius: 6px;
  }

  .dimension-rules {
    display: grid;
    gap: 1px;
  }

  .dimension-rules blockquote {
    padding: 14px;
    margin: 0;
    background: var(--creator-surface);
  }

  .dimension-rules blockquote > p {
    margin: 0;
    font-size: 10px;
    line-height: 1.65;
  }

  .dimension-rules footer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-top: 10px;
    font-size: 10px;
    color: var(--creator-faint);
  }

  .dimension-empty {
    display: grid;
    gap: 7px;
    justify-items: center;
    padding: 26px 15px;
    font-size: 10px;
    line-height: 1.5;
    color: var(--creator-faint);
    text-align: center;
  }

  @media (width <= 980px) {
    .review-grid {
      grid-template-columns: 1fr;
    }

    .knowledge-dimensions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 680px) {
    .review-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .review-summary > div:nth-child(2) {
      border-right: 0;
    }

    .review-summary > div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--creator-line);
    }

    .knowledge-list,
    .knowledge-dimensions {
      grid-template-columns: 1fr;
    }

    .knowledge-ai-state {
      grid-template-columns: 24px minmax(0, 1fr);
    }

    .knowledge-ai-state button {
      grid-column: 1 / -1;
    }
  }
</style>
