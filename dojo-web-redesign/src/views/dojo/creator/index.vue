<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRouter } from 'vue-router'
  import { creatorRoleLabel, creatorStageLabel } from '@/constants/dojoCreator'
  import {
    dojoCreatorStore,
    pendingCreatorReviews,
    scheduleCreatorContent,
    scheduledCreatorContents
  } from '@/store/dojoCreatorStore'
  import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
  import NewContentDialog from './components/NewContentDialog.vue'

  defineOptions({ name: 'DojoCreatorToday' })

  const router = useRouter()
  const newContentOpen = ref(false)

  const unscheduledContents = computed(() =>
    dojoCreatorStore.contents.filter((content) => !content.plannedDate).slice(0, 5)
  )

  const upcomingContents = computed(() => scheduledCreatorContents.value.slice(0, 6))

  const projectRows = computed(() =>
    dojoProjectStore.projects
      .filter((project) => project.active !== false)
      .map((project) => {
        const contents = dojoCreatorStore.contents.filter(
          (content) => content.projectId === project.id
        )
        return {
          ...project,
          activeCount: contents.length,
          scheduledCount: contents.filter((content) => content.plannedDate).length,
          publishCount: contents.filter((content) => content.currentStage === 'publish').length
        }
      })
      .filter((project) => project.activeCount > 0)
  )

  const metrics = computed(() => [
    { value: dojoCreatorStore.contents.length, label: '推进中的内容', tone: 'coral' },
    { value: unscheduledContents.value.length, label: '等待排期', tone: 'purple' },
    { value: upcomingContents.value.length, label: '已进入节奏', tone: 'blue' },
    { value: pendingCreatorReviews.value.length, label: '等待复盘', tone: 'green' }
  ])

  function projectName(projectId: string) {
    return getProjectById(projectId)?.name || '未关联项目'
  }

  function handleCreated() {
    router.push('/calendar')
  }
</script>

<template>
  <div class="creator-surface creator-home">
    <header class="creator-heading">
      <div class="creator-heading__copy">
        <h1>把项目里的机会，变成今天能推进的内容。</h1>
        <p>
          Creator OS 已经进入 2049：内容关联项目，排期进入同一张节奏日历，发布结果回到复盘规则库。
        </p>
      </div>
      <div class="creator-heading__actions">
        <ElButton @click="router.push('/timeline')">
          <Icon icon="ph:calendar-blank" width="17" />
          项目排期
        </ElButton>
        <ElButton
          type="primary"
          :disabled="!dojoProjectStore.projects.length"
          @click="newContentOpen = true"
        >
          <Icon icon="ph:plus" width="17" />
          捕捉内容
        </ElButton>
      </div>
    </header>

    <ElAlert
      v-if="!dojoProjectStore.projects.length"
      class="project-alert"
      title="先创建一个 2049 项目，内容才能拥有真实的业务上下文。"
      type="warning"
      show-icon
      :closable="false"
    >
      <template #default>
        <ElButton link type="primary" @click="router.push('/project')">前往项目总览</ElButton>
      </template>
    </ElAlert>

    <section class="metric-band" aria-label="创作进度摘要">
      <div v-for="metric in metrics" :key="metric.label" class="metric-band__item">
        <span :class="`metric-band__dot metric-band__dot--${metric.tone}`" />
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.label }}</small>
      </div>
      <button type="button" @click="router.push('/calendar')">
        打开执行日历
        <Icon icon="ph:arrow-right" width="17" />
      </button>
    </section>

    <div class="home-grid">
      <section class="creator-panel focus-panel">
        <div class="creator-section-head">
          <div>
            <h2>还没进入日历</h2>
            <p>给内容一个日期，它会同步出现在 2049 节奏日历。</p>
          </div>
          <span>{{ unscheduledContents.length }} 条</span>
        </div>

        <div v-if="unscheduledContents.length" class="focus-list">
          <article v-for="content in unscheduledContents" :key="content.id" class="focus-row">
            <div class="focus-row__stage" :title="creatorStageLabel(content.currentStage)">
              {{ creatorStageLabel(content.currentStage).slice(0, 1) }}
            </div>
            <div class="focus-row__copy">
              <h3>{{ content.title }}</h3>
              <p>{{ projectName(content.projectId) }} · {{ creatorRoleLabel(content.role) }}</p>
            </div>
            <ElDatePicker
              :model-value="content.plannedDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="安排日期"
              @update:model-value="(value) => scheduleCreatorContent(content.id, value)"
            />
          </article>
        </div>
        <div v-else class="creator-empty">
          <Icon icon="ph:calendar-check" width="26" />
          <strong>所有内容都已经有安排</strong>
          <span>去执行日历继续推进下一阶段。</span>
        </div>
      </section>

      <section class="creator-panel rhythm-panel">
        <div class="creator-section-head">
          <div>
            <h2>接下来的创作节奏</h2>
            <p>创作日历负责内容节奏；项目排期与 2049 节奏日历继续保留。</p>
          </div>
          <button type="button" @click="router.push('/creator/calendar')">打开创作日历</button>
        </div>

        <ol v-if="upcomingContents.length" class="rhythm-list">
          <li v-for="content in upcomingContents" :key="content.id">
            <time :datetime="content.plannedDate || undefined">{{
              content.plannedDate?.slice(5)
            }}</time>
            <span class="rhythm-list__line" aria-hidden="true" />
            <div>
              <strong>{{ content.title }}</strong>
              <small>
                {{ projectName(content.projectId) }} · {{ creatorStageLabel(content.currentStage) }}
              </small>
            </div>
          </li>
        </ol>
        <div v-else class="creator-empty">
          <Icon icon="ph:wind" width="26" />
          <strong>这一段节奏还是空的</strong>
          <span>从左侧给内容安排日期。</span>
        </div>
      </section>
    </div>

    <section class="creator-panel project-bridge">
      <div class="creator-section-head">
        <div>
          <h2>内容如何回到项目</h2>
          <p>每个项目都能看见正在生产、已经排期和等待复盘的内容。</p>
        </div>
      </div>

      <div v-if="projectRows.length" class="project-rows">
        <button
          v-for="project in projectRows"
          :key="project.id"
          type="button"
          @click="router.push({ path: '/calendar', query: { project: project.id } })"
        >
          <span class="project-rows__name">{{ project.name }}</span>
          <span
            ><strong>{{ project.activeCount }}</strong> 条内容</span
          >
          <span
            ><strong>{{ project.scheduledCount }}</strong> 已排期</span
          >
          <span
            ><strong>{{ project.publishCount }}</strong> 已发布</span
          >
          <Icon icon="ph:arrow-right" width="17" />
        </button>
      </div>
      <div v-else class="creator-empty">
        <Icon icon="ph:folders" width="26" />
        <strong>项目还没有内容</strong>
        <span>捕捉第一条内容后，这里会自动形成项目视角。</span>
      </div>
    </section>

    <NewContentDialog
      :open="newContentOpen"
      @close="newContentOpen = false"
      @created="handleCreated"
    />
  </div>
</template>

<style scoped lang="scss">
  @use './creator-theme.scss';

  .project-alert {
    margin-bottom: 18px;
  }

  .metric-band {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
    align-items: stretch;
    margin-bottom: 18px;
    overflow: hidden;
    border-radius: 15px;
    color: #f9f5f7;
    background: #292340;
    box-shadow: 0 14px 34px rgb(48 36 65 / 13%);
  }

  .metric-band__item {
    position: relative;
    display: grid;
    gap: 5px;
    padding: 22px 22px 20px;
    border-right: 1px solid rgb(255 255 255 / 9%);
  }

  .metric-band__item strong {
    font-family: Georgia, 'Songti SC', serif;
    font-size: 30px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .metric-band__item small {
    color: rgb(249 245 247 / 58%);
    font-size: 10px;
  }

  .metric-band__dot {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .metric-band__dot--coral {
    background: #e8685e;
  }

  .metric-band__dot--purple {
    background: #9a70bd;
  }

  .metric-band__dot--blue {
    background: #8295cf;
  }

  .metric-band__dot--green {
    background: #78a69f;
  }

  .metric-band > button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 22px;
    border: 0;
    color: #fff;
    background: rgb(255 255 255 / 7%);
    font-size: 11px;
    cursor: pointer;
  }

  .metric-band > button:hover,
  .metric-band > button:focus-visible {
    background: rgb(255 255 255 / 13%);
    outline: none;
  }

  .home-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(330px, 0.85fr);
    gap: 18px;
  }

  .focus-panel,
  .rhythm-panel,
  .project-bridge {
    padding: 24px;
  }

  .creator-section-head > span {
    color: var(--creator-faint);
    font-size: 11px;
  }

  .creator-section-head button {
    padding: 0;
    border: 0;
    color: var(--creator-deep);
    background: transparent;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
  }

  .focus-list {
    display: grid;
  }

  .focus-row {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 142px;
    align-items: center;
    gap: 12px;
    min-height: 66px;
    border-top: 1px solid var(--creator-line);
  }

  .focus-row:first-child {
    border-top: 0;
  }

  .focus-row__stage {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 10px;
    color: var(--creator-deep);
    background: #eee9f4;
    font-size: 11px;
    font-weight: 700;
  }

  .focus-row__copy {
    min-width: 0;
  }

  .focus-row h3 {
    margin: 0;
    overflow: hidden;
    font-family: 'Songti SC', STSong, serif;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .focus-row p {
    margin: 5px 0 0;
    color: var(--creator-faint);
    font-size: 10px;
  }

  .focus-row :deep(.el-date-editor) {
    width: 142px;
  }

  .rhythm-list {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rhythm-list li {
    display: grid;
    grid-template-columns: 42px 12px minmax(0, 1fr);
    gap: 8px;
    min-height: 57px;
  }

  .rhythm-list time {
    padding-top: 3px;
    color: var(--creator-deep);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .rhythm-list__line {
    position: relative;
  }

  .rhythm-list__line::before {
    position: absolute;
    top: 7px;
    left: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--creator-coral);
    content: '';
  }

  .rhythm-list__line::after {
    position: absolute;
    top: 15px;
    bottom: -2px;
    left: 5px;
    width: 1px;
    background: var(--creator-line);
    content: '';
  }

  .rhythm-list li:last-child .rhythm-list__line::after {
    display: none;
  }

  .rhythm-list strong,
  .rhythm-list small {
    display: block;
  }

  .rhythm-list strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rhythm-list small {
    margin-top: 5px;
    color: var(--creator-faint);
    font-size: 11px;
  }

  .project-bridge {
    margin-top: 18px;
  }

  .project-rows {
    display: grid;
  }

  .project-rows button {
    display: grid;
    grid-template-columns: minmax(180px, 1.5fr) repeat(3, minmax(86px, 0.6fr)) 24px;
    align-items: center;
    gap: 14px;
    min-height: 58px;
    padding: 0 8px;
    border: 0;
    border-top: 1px solid var(--creator-line);
    color: var(--creator-muted);
    background: transparent;
    font-size: 10px;
    text-align: left;
    cursor: pointer;
  }

  .project-rows button:first-child {
    border-top: 0;
  }

  .project-rows button:hover,
  .project-rows button:focus-visible {
    padding-right: 3px;
    color: var(--creator-ink);
    outline: none;
  }

  .project-rows__name {
    color: var(--creator-ink);
    font-size: 13px;
    font-weight: 650;
  }

  .project-rows strong {
    color: var(--creator-deep);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 1100px) {
    .metric-band {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .metric-band > button {
      display: none;
    }

    .home-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .metric-band {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-band__item:nth-child(2) {
      border-right: 0;
    }

    .focus-row {
      grid-template-columns: 34px minmax(0, 1fr);
      padding: 10px 0;
    }

    .focus-row :deep(.el-date-editor) {
      grid-column: 2;
      width: 100%;
    }

    .project-rows button {
      grid-template-columns: minmax(0, 1fr) 20px;
    }

    .project-rows button > span:not(.project-rows__name) {
      display: none;
    }
  }
</style>
