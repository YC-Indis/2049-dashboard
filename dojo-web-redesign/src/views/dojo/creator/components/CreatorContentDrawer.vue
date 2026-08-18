<script setup lang="ts">
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage } from 'element-plus'
  import { CREATOR_STAGES, creatorStageLabel } from '@/constants/dojoCreator'
  import {
    getCreatorContent,
    markCreatorPublished,
    moveCreatorContent,
    nextCreatorStage,
    scheduleCreatorContent
  } from '@/store/dojoCreatorStore'
  import { getProjectById } from '@/store/dojoProjectStore'

  const props = defineProps<{
    open: boolean
    contentId: string
  }>()

  const emit = defineEmits<{
    close: []
  }>()

  const content = computed(() => getCreatorContent(props.contentId))
  const currentStageIndex = computed(() =>
    content.value
      ? CREATOR_STAGES.findIndex((stage) => stage.key === content.value?.currentStage)
      : -1
  )
  const projectName = computed(() =>
    content.value ? getProjectById(content.value.projectId)?.name || '未关联项目' : ''
  )

  function completeCurrentStage() {
    if (!content.value) return
    const nextStage = nextCreatorStage(content.value.currentStage)
    if (nextStage) {
      moveCreatorContent(content.value.id, nextStage)
      ElMessage.success(`已进入${creatorStageLabel(nextStage)}阶段`)
      return
    }
    markCreatorPublished(content.value.id)
    ElMessage.success('已完成发布并进入复盘队列')
  }

  function handleSchedule(value: string | null) {
    if (!content.value) return
    scheduleCreatorContent(content.value.id, value)
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="creator-drawer-fade">
      <div v-if="open && content" class="creator-drawer-backdrop" @mousedown.self="emit('close')">
        <aside class="creator-content-drawer" aria-label="内容档案">
          <header class="creator-content-drawer__topbar">
            <span>CONTENT FILE</span>
            <button type="button" aria-label="关闭内容档案" @click="emit('close')">
              <Icon icon="ph:x" width="20" />
            </button>
          </header>

          <div class="creator-content-drawer__scroll">
            <section class="creator-content-drawer__intro">
              <h2>{{ content.title }}</h2>
              <p v-if="content.summary">{{ content.summary }}</p>
              <div class="creator-content-drawer__project">
                <Icon icon="ph:folders" width="15" />
                {{ projectName }}
              </div>
            </section>

            <section class="creator-drawer-section">
              <p class="creator-drawer-eyebrow">PRODUCTION TIMELINE</p>
              <h3>制作进度</h3>
              <div class="creator-production-timeline">
                <article
                  v-for="(stage, index) in CREATOR_STAGES"
                  :key="stage.key"
                  :class="{
                    'is-done': index < currentStageIndex,
                    'is-current': index === currentStageIndex
                  }"
                >
                  <span class="creator-timeline-marker">
                    <Icon v-if="index < currentStageIndex" icon="ph:check-bold" width="12" />
                    <i v-else />
                  </span>
                  <strong>{{ stage.label }}</strong>
                  <small v-if="index === currentStageIndex">当前</small>
                </article>
              </div>
            </section>

            <section class="creator-drawer-section creator-current-task">
              <p class="creator-drawer-eyebrow">CURRENT STAGE</p>
              <h3>{{ creatorStageLabel(content.currentStage) }}</h3>
              <dl>
                <div>
                  <dt>计划日期</dt>
                  <dd>
                    <ElDatePicker
                      :model-value="content.plannedDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="待安排"
                      @update:model-value="handleSchedule"
                    />
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <footer class="creator-content-drawer__footer">
            <ElButton @click="emit('close')">稍后继续</ElButton>
            <ElButton type="primary" @click="completeCurrentStage">
              {{ content.currentStage === 'publish' ? '完成发布并复盘' : '完成当前阶段' }}
              <Icon icon="ph:arrow-right" width="17" />
            </ElButton>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
  .creator-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3000;
    background: rgb(24 20 35 / 38%);
    backdrop-filter: blur(4px);
  }

  .creator-content-drawer {
    position: absolute;
    top: 0;
    right: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(520px, 94vw);
    height: 100%;
    color: #24202b;
    background: #f6f1ef;
    box-shadow: -24px 0 60px rgb(25 19 35 / 18%);
  }

  .creator-content-drawer__topbar,
  .creator-content-drawer__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid #e3dcdb;
  }

  .creator-content-drawer__topbar > span,
  .creator-drawer-eyebrow {
    font-size: 10px;
    font-weight: 750;
    color: #8b818a;
    letter-spacing: 0.14em;
  }

  .creator-content-drawer__topbar button {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: #403666;
    cursor: pointer;
    background: #ece6ed;
    border: 0;
    border-radius: 10px;
  }

  .creator-content-drawer__scroll {
    overflow-y: auto;
  }

  .creator-content-drawer__intro,
  .creator-drawer-section {
    padding: 28px;
    border-bottom: 1px solid #e3dcdb;
  }

  .creator-content-drawer__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .creator-content-drawer__badges span {
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 650;
    color: #403666;
    background: #eae4ef;
    border-radius: 7px;
  }

  .creator-content-drawer__intro h2 {
    margin: 18px 0 0;
    font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
    font-size: 18px;
    font-weight: 550;
    line-height: 1.35;
  }

  .creator-content-drawer__intro > p {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.75;
    color: #716a72;
  }

  .creator-content-drawer__project {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 16px;
    font-size: 11px;
    color: #8b818a;
  }

  .creator-drawer-section h3 {
    margin: 7px 0 20px;
    font-size: 18px;
  }

  .creator-production-timeline {
    display: grid;
  }

  .creator-production-timeline article {
    position: relative;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 42px;
    font-size: 12px;
    color: #aaa1a7;
  }

  .creator-production-timeline article:not(:last-child)::before {
    position: absolute;
    top: 26px;
    bottom: -16px;
    left: 11px;
    width: 1px;
    content: '';
    background: #ddd5da;
  }

  .creator-timeline-marker {
    z-index: 1;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    background: #f6f1ef;
    border: 1px solid #d8cfd5;
    border-radius: 50%;
  }

  .creator-timeline-marker i {
    width: 6px;
    height: 6px;
    background: #c8bec4;
    border-radius: 50%;
  }

  .creator-production-timeline article.is-done,
  .creator-production-timeline article.is-current {
    color: #403666;
  }

  .creator-production-timeline article.is-done .creator-timeline-marker {
    color: #fff;
    background: #7860cc;
    border-color: #7860cc;
  }

  .creator-production-timeline article.is-current .creator-timeline-marker {
    border-color: #e8685e;
    box-shadow: 0 0 0 4px rgb(232 104 94 / 12%);
  }

  .creator-production-timeline article.is-current .creator-timeline-marker i {
    background: #e8685e;
  }

  .creator-production-timeline article small {
    font-size: 11px;
    color: #e8685e;
  }

  .creator-current-task {
    margin: 20px;
    background: #fffdfc;
    border: 1px solid #e3dcdb;
    border-radius: 14px;
  }

  .creator-current-task dl {
    display: grid;
    gap: 12px;
    margin: 0;
  }

  .creator-current-task dl > div {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }

  .creator-current-task dt {
    font-size: 10px;
    color: #9a9297;
  }

  .creator-current-task dd {
    margin: 0;
    font-size: 11px;
    font-weight: 650;
    color: #403666;
  }

  .creator-current-task :deep(.el-date-editor) {
    width: 100%;
  }

  .creator-content-drawer__footer {
    justify-content: flex-end;
    background: #fffdfc;
    border-top: 1px solid #e3dcdb;
    border-bottom: 0;
  }

  .creator-drawer-fade-enter-active,
  .creator-drawer-fade-leave-active {
    transition: opacity 180ms ease;
  }

  .creator-drawer-fade-enter-active .creator-content-drawer,
  .creator-drawer-fade-leave-active .creator-content-drawer {
    transition: transform 220ms ease;
  }

  .creator-drawer-fade-enter-from,
  .creator-drawer-fade-leave-to {
    opacity: 0;
  }

  .creator-drawer-fade-enter-from .creator-content-drawer,
  .creator-drawer-fade-leave-to .creator-content-drawer {
    transform: translateX(100%);
  }
</style>
