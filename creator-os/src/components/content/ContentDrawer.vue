<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { creatorStore } from '../../stores/creatorStore'
import { uiStore } from '../../stores/uiStore'
import { STAGE_CONFIG, STAGE_LABELS } from '../../constants/stages'

const content = computed(() => {
  const contentId = uiStore.state.selectedContentId
  return contentId ? creatorStore.getContent(contentId) : undefined
})

const currentTask = computed(() =>
  content.value ? creatorStore.getCurrentTask(content.value.id) : undefined,
)

const currentStageIndex = computed(() =>
  content.value
    ? STAGE_CONFIG.findIndex((stage) => stage.id === content.value?.currentStage)
    : -1,
)

const roleLabels = {
  acquisition: '获客',
  trust: '建立信任',
  conversion: '完成转化',
}

function handleComplete() {
  if (!currentTask.value) {
    return
  }
  const previousStage = STAGE_LABELS[currentTask.value.stage]
  creatorStore.completeTask(currentTask.value.id)
  uiStore.showToast(`${previousStage}阶段已完成，下一任务已生成`)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div
        v-if="uiStore.state.contentDrawerOpen && content"
        class="drawer-backdrop"
        @mousedown.self="uiStore.closeContentDrawer"
      >
        <aside class="content-drawer" aria-label="内容档案">
          <header class="content-drawer__topbar">
            <span>CONTENT FILE</span>
            <button type="button" aria-label="关闭" @click="uiStore.closeContentDrawer">
              <Icon icon="ph:x" width="20" />
            </button>
          </header>

          <div class="content-drawer__scroll">
            <section class="content-drawer__intro">
              <div class="content-drawer__badges">
                <span>{{ roleLabels[content.role] }}</span>
                <span>{{ content.tier }} 档</span>
                <span>{{ content.type }}</span>
              </div>
              <h2>{{ content.title }}</h2>
              <p>{{ content.rawIdea || content.summary }}</p>
            </section>

            <section class="drawer-section">
              <p class="eyebrow">PRODUCTION TIMELINE</p>
              <h3>制作进度</h3>
              <div class="production-timeline">
                <article
                  v-for="(stage, index) in STAGE_CONFIG"
                  :key="stage.id"
                  :class="{
                    'is-done': index < currentStageIndex,
                    'is-current': index === currentStageIndex,
                  }"
                >
                  <span class="timeline-marker">
                    <Icon v-if="index < currentStageIndex" icon="ph:check" width="13" />
                    <i v-else />
                  </span>
                  <strong>{{ stage.label }}</strong>
                  <small v-if="index === currentStageIndex">当前</small>
                </article>
              </div>
            </section>

            <section v-if="currentTask" class="drawer-section current-task-card">
              <p class="eyebrow">CURRENT STAGE TASK</p>
              <h3>{{ STAGE_LABELS[currentTask.stage] }}任务</h3>
              <dl>
                <div>
                  <dt>计划日期</dt>
                  <dd>{{ currentTask.plannedDate || '待安排' }}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{{ currentTask.status === 'scheduled' ? '已排期' : '待安排' }}</dd>
                </div>
                <div>
                  <dt>备注</dt>
                  <dd>{{ currentTask.note || '暂无备注' }}</dd>
                </div>
              </dl>
            </section>
          </div>

          <footer class="content-drawer__footer">
            <button class="secondary-button" type="button">打开完整档案</button>
            <button
              class="solid-button"
              type="button"
              :disabled="!currentTask"
              @click="handleComplete"
            >
              完成当前阶段
              <Icon icon="ph:arrow-right" width="18" />
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
