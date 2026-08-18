<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    addProjectPhaseBar,
    isKpiCycleBlock,
    listProjectPhaseBlocks,
    phaseKeyFromBlockId,
    PLAN_PHASE_META,
    removeProjectPhaseBar,
    type PlanPhaseKey
  } from '@/store/dojoKpiSchedule'
  import {
    dojoCreatorStore,
    removeCreatorPlanningItem,
    scheduleCreatorPlanningItem,
    unscheduleCreatorPlanningItem
  } from '@/store/dojoCreatorStore'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import {
    dojoScheduleStore,
    isKpiBlock,
    patchScheduleBlock,
    removeScheduleBlock,
    type ScheduleBlock
  } from '@/store/dojoScheduleStore'
  import type { CreatorPlanningItem } from '@/types/dojoCreator'
  import NewPlanningItemDialog from './components/NewPlanningItemDialog.vue'
  import NewProjectPhaseDialog from './components/NewProjectPhaseDialog.vue'
  import ScheduleBlockEditorDialog from './components/ScheduleBlockEditorDialog.vue'

  defineOptions({ name: 'DojoCreatorCalendar' })

  type CalendarView = 'week' | 'month'
  type PendingPlacement =
    | { type: 'schedule'; id: string; label: string }
    | { type: 'planning'; id: string; label: string }

  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const scheduleTypeLabels: Record<ScheduleBlock['type'], string> = {
    task: '任务',
    script: '脚本',
    publish: '发布',
    ad: '投放',
    milestone: '里程碑',
    other: '其他'
  }
  const view = ref<CalendarView>('month')
  const cursor = ref(startOfDay(new Date()))
  const newPhaseOpen = ref(false)
  const newPhaseProjectId = ref('')
  const newPlanningItemOpen = ref(false)
  const planningItemProjectId = ref('')
  const planningItemPhaseBlockId = ref('')
  const planningItemParentId = ref('')
  const editingBlockId = ref('')
  const pendingPlacement = ref<PendingPlacement | null>(null)
  const contextMenu = ref<{ x: number; y: number; blockId: string } | null>(null)

  const activeProjects = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )
  const projectGroups = computed(() => {
    void dojoScheduleStore.revision
    return activeProjects.value.map((project) => {
      const phaseBlocks = listProjectPhaseBlocks(project.id)
      return {
        project,
        phases: PLAN_PHASE_META.map((meta) => ({
          meta,
          block:
            phaseBlocks.find(
              (block) => phaseKeyFromBlockId(block.id, block.projectId) === meta.key
            ) || null
        }))
      }
    })
  })
  const planningScheduleIds = computed(
    () =>
      new Set(
        dojoCreatorStore.planningItems
          .map((item) => item.scheduleBlockId)
          .filter((id): id is string => Boolean(id))
      )
  )
  const otherExecutionBlocks = computed(() =>
    dojoScheduleStore.blocks
      .filter(
        (block) =>
          !isKpiBlock(block) &&
          !planningScheduleIds.value.has(block.id)
      )
      .sort((left, right) => left.start.localeCompare(right.start))
  )
  const currentMonth = computed(() => cursor.value.getMonth())
  const displayDays = computed(() =>
    view.value === 'month' ? buildMonthDays(cursor.value) : buildWeekDays(cursor.value)
  )
  const displayStart = computed(() => dateKey(displayDays.value[0]))
  const displayEnd = computed(() => dateKey(displayDays.value[displayDays.value.length - 1]))
  const calendarTitle = computed(() => {
    if (view.value === 'month') {
      return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(
        cursor.value
      )
    }
    const first = displayDays.value[0]
    const last = displayDays.value[displayDays.value.length - 1]
    return `${first.getMonth() + 1}月${first.getDate()}日 - ${last.getMonth() + 1}月${last.getDate()}日`
  })
  const visibleScheduleBlocks = computed(() => {
    const activeIds = new Set(activeProjects.value.map((project) => project.id))
    return dojoScheduleStore.blocks.filter(
      (block) =>
        activeIds.has(block.projectId) &&
        !isKpiCycleBlock(block.id) &&
        block.start <= displayEnd.value &&
        block.end >= displayStart.value
    )
  })

  function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function startOfWeek(date: Date) {
    const value = startOfDay(date)
    const offset = (value.getDay() + 6) % 7
    value.setDate(value.getDate() - offset)
    return value
  }

  function buildMonthDays(date: Date) {
    const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1))
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }

  function buildWeekDays(date: Date) {
    const start = startOfWeek(date)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }

  function dateKey(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-')
  }

  function navigateCalendar(direction: -1 | 1) {
    const next =
      view.value === 'month'
        ? new Date(cursor.value.getFullYear(), cursor.value.getMonth() + direction, 1)
        : new Date(cursor.value)
    if (view.value === 'week') next.setDate(next.getDate() + direction * 7)
    cursor.value = next
  }

  function phaseBlock(projectId: string, phaseKey: PlanPhaseKey) {
    return (
      listProjectPhaseBlocks(projectId).find(
        (block) => phaseKeyFromBlockId(block.id, block.projectId) === phaseKey
      ) || null
    )
  }

  function ensureProjectPhase(projectId: string, phaseKey: PlanPhaseKey) {
    const existing = phaseBlock(projectId, phaseKey)
    if (existing) return existing
    const created = addProjectPhaseBar(projectId, phaseKey)
    if (!created) {
      ElMessage.warning('请先在项目管理中设置项目周期')
      return null
    }
    ElMessage.success('项目环节已加入总规划')
    return created
  }

  function phaseLabel(block: ScheduleBlock) {
    const key = phaseKeyFromBlockId(block.id, block.projectId)
    return PLAN_PHASE_META.find((item) => item.key === key)?.label || block.title
  }

  function phaseTone(block: ScheduleBlock) {
    return phaseKeyFromBlockId(block.id, block.projectId) || block.type
  }

  function isBlockDone(block: ScheduleBlock) {
    return (
      block.status === '已完成' || Boolean(block.target && Number(block.done || 0) >= block.target)
    )
  }

  function blockProgress(block: ScheduleBlock) {
    if (!block.target) return block.status || '已安排'
    return `${Number(block.done || 0).toLocaleString()}/${block.target.toLocaleString()}`
  }

  function scheduleTypeLabel(type: ScheduleBlock['type']) {
    return scheduleTypeLabels[type] || '任务'
  }

  function phaseStatus(block: ScheduleBlock | null) {
    if (!block) return '未加入'
    if (isBlockDone(block)) return '已完成'
    return `${block.start.slice(5)}–${block.end.slice(5)}`
  }

  function planningItemsForPhase(phaseBlockId: string) {
    return dojoCreatorStore.planningItems.filter((item) => item.phaseBlockId === phaseBlockId)
  }

  function standaloneItemsForProject(projectId: string) {
    return dojoCreatorStore.planningItems.filter(
      (item) => item.projectId === projectId && !item.phaseBlockId && !item.contentId
    )
  }

  function openPhaseDialog(projectId = '') {
    newPhaseProjectId.value = projectId
    newPhaseOpen.value = true
  }

  function closePhaseDialog() {
    newPhaseOpen.value = false
    newPhaseProjectId.value = ''
  }

  function openPlanningItemDialog(projectId = '', phaseBlockId = '', parentId = '') {
    planningItemProjectId.value = projectId
    planningItemPhaseBlockId.value = phaseBlockId
    planningItemParentId.value = parentId
    newPlanningItemOpen.value = true
  }

  function openPhaseBreakdown(projectId: string, phaseKey: PlanPhaseKey) {
    const block = ensureProjectPhase(projectId, phaseKey)
    if (!block) return
    openPlanningItemDialog(projectId, block.id)
  }

  function closePlanningItemDialog() {
    newPlanningItemOpen.value = false
    planningItemProjectId.value = ''
    planningItemPhaseBlockId.value = ''
    planningItemParentId.value = ''
  }

  function openBlockEditor(blockId: string) {
    contextMenu.value = null
    editingBlockId.value = blockId
  }

  function openBlockMenu(event: MouseEvent, blockId: string) {
    contextMenu.value = {
      x: Math.min(event.clientX, window.innerWidth - 200),
      y: Math.min(event.clientY, window.innerHeight - 110),
      blockId
    }
  }

  function editBlockFromMenu() {
    const blockId = contextMenu.value?.blockId
    contextMenu.value = null
    if (blockId) openBlockEditor(blockId)
  }

  async function deleteBlockFromMenu() {
    const blockId = contextMenu.value?.blockId
    contextMenu.value = null
    if (!blockId) return
    const block = dojoScheduleStore.blocks.find((item) => item.id === blockId)
    if (block) await confirmDeleteCalendarBlock(block)
  }

  async function confirmDeleteCalendarBlock(block: ScheduleBlock) {
    contextMenu.value = null
    try {
      await ElMessageBox.confirm(
        `删除“${isKpiBlock(block) ? phaseLabel(block) : block.title}”？它会从执行日历和时间规划中同时移除。`,
        '删除时间条',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      const phaseKey = phaseKeyFromBlockId(block.id, block.projectId)
      if (isKpiBlock(block) && phaseKey && phaseKey !== 'cycle') {
        removeProjectPhaseBar(block.projectId, phaseKey)
      } else {
        removeScheduleBlock(block.id)
      }
      ElMessage.success('时间条已删除')
    } catch {
      return
    }
  }

  function closeContextMenu() {
    contextMenu.value = null
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeContextMenu()
  }

  onMounted(() => {
    window.addEventListener('pointerdown', closeContextMenu)
    window.addEventListener('keydown', onWindowKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('pointerdown', closeContextMenu)
    window.removeEventListener('keydown', onWindowKeydown)
  })

  async function confirmRemovePlanningItem(item: CreatorPlanningItem) {
    try {
      await ElMessageBox.confirm(
        `删除事项“${item.title}”？已安排的日历任务也会一并移除。`,
        '删除事项',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeCreatorPlanningItem(item.id)
      ElMessage.success('事项已删除')
    } catch {
      return
    }
  }

  async function confirmRemoveScheduleBlock(block: ScheduleBlock) {
    try {
      await ElMessageBox.confirm(
        `删除事项“${block.title}”？它会从执行日历和时间规划中同时移除。`,
        '删除执行事项',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeScheduleBlock(block.id)
      ElMessage.success('执行事项已删除')
    } catch {
      return
    }
  }

  function beginPlacement(placement: PendingPlacement) {
    pendingPlacement.value = placement
    ElMessage.info('请选择日历中的日期')
  }

  function placePending(date: Date) {
    const placement = pendingPlacement.value
    if (!placement) return
    const key = dateKey(date)
    if (placement.type === 'schedule') shiftScheduleBlock(placement.id, key)
    if (placement.type === 'planning') scheduleCreatorPlanningItem(placement.id, key)
    pendingPlacement.value = null
    ElMessage.success(`已安排到 ${date.getMonth() + 1}月${date.getDate()}日`)
  }

  function shiftScheduleBlock(blockId: string, nextStart: string) {
    const block = dojoScheduleStore.blocks.find((item) => item.id === blockId)
    if (!block) return
    const duration = Math.max(
      0,
      Math.round(
        (new Date(`${block.end}T12:00:00`).getTime() -
          new Date(`${block.start}T12:00:00`).getTime()) /
          86400000
      )
    )
    const end = new Date(`${nextStart}T12:00:00`)
    end.setDate(end.getDate() + duration)
    patchScheduleBlock(blockId, { start: nextStart, end: dateKey(end) })
  }

  function dragScheduleBlock(event: DragEvent, blockId: string) {
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-schedule-block', blockId)
  }

  function dragPlanningItem(event: DragEvent, itemId: string) {
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-creator-planning-item', itemId)
  }

  function dropOnDate(event: DragEvent, date: Date) {
    const key = dateKey(date)
    const planningItemId = event.dataTransfer?.getData('application/x-creator-planning-item')
    if (planningItemId) {
      scheduleCreatorPlanningItem(planningItemId, key)
      ElMessage.success(`细分事项已安排到 ${key}`)
      return
    }
    const scheduleBlockId = event.dataTransfer?.getData('application/x-schedule-block')
    if (scheduleBlockId) {
      shiftScheduleBlock(scheduleBlockId, key)
      ElMessage.success(`项目模块已改到 ${key}`)
    }
  }

  function dropBackToPool(event: DragEvent) {
    const planningItemId = event.dataTransfer?.getData('application/x-creator-planning-item')
    if (!planningItemId) return
    unscheduleCreatorPlanningItem(planningItemId)
    ElMessage.success('细分事项已移回待安排池')
  }

  function openPlanningItem(item: CreatorPlanningItem) {
    if (item.scheduleBlockId) {
      openBlockEditor(item.scheduleBlockId)
      return
    }
    beginPlacement({ type: 'planning', id: item.id, label: item.title })
  }

  function blocksCoveringDate(date: Date) {
    const key = dateKey(date)
    return visibleScheduleBlocks.value.filter(
      (block) => block.start <= key && block.end >= key
    )
  }

  function spanEdge(block: ScheduleBlock, date: Date) {
    const key = dateKey(date)
    const isStart = block.start === key || (block.start < displayStart.value && key === displayStart.value)
    const isEnd = block.end === key || (block.end > displayEnd.value && key === displayEnd.value)
    if (isStart && isEnd) return 'single'
    if (isStart) return 'start'
    if (isEnd) return 'end'
    return 'mid'
  }

  function isToday(date: Date) {
    return dateKey(date) === dateKey(new Date())
  }
</script>

<template>
  <div class="creator-surface creator-calendar-page">
    <header class="creator-heading">
      <div class="creator-heading__copy">
        <h1>执行日历</h1>
        <p>把项目环节拖进真实日期。按团队项目排，不是按个人作品流。</p>
      </div>
      <div class="creator-heading__actions">
        <div class="calendar-segmented" aria-label="日历视图">
          <button
            type="button"
            :class="{ 'is-active': view === 'week' }"
            :aria-pressed="view === 'week'"
            @click="view = 'week'"
          >
            周
          </button>
          <button
            type="button"
            :class="{ 'is-active': view === 'month' }"
            :aria-pressed="view === 'month'"
            @click="view = 'month'"
          >
            月
          </button>
        </div>
        <ElButton type="primary" @click="openPlanningItemDialog()">
          <Icon icon="ph:plus" width="16" />
          新增独立事项
        </ElButton>
      </div>
    </header>

    <section class="calendar-workspace creator-panel">
      <aside class="project-module-pool" @dragover.prevent @drop="dropBackToPool">
        <p class="project-module-pool__hint">
          固定环节可以重复改期；把左侧事项拖到右侧日期，就排进团队节奏。
        </p>
        <div class="project-module-pool__scroll">
          <section
            v-for="group in projectGroups"
            :key="group.project.id"
            class="project-module-group"
          >
            <header>
              <div>
                <strong>{{ group.project.name }}</strong>
                <span>项目总规划</span>
              </div>
              <div>
                <button
                  type="button"
                  title="添加项目环节"
                  :aria-label="`为${group.project.name}添加项目环节`"
                  @click="openPhaseDialog(group.project.id)"
                >
                  加环节
                </button>
                <button
                  type="button"
                  title="新增独立事项"
                  :aria-label="`为${group.project.name}新增独立事项`"
                  @click="openPlanningItemDialog(group.project.id)"
                >
                  加事项
                </button>
              </div>
            </header>

            <div class="project-phase-list">
              <article
                v-for="phase in group.phases"
                :key="phase.meta.key"
                :class="[
                  `phase-${phase.meta.key}`,
                  {
                    'is-created': phase.block,
                    'is-done': phase.block && isBlockDone(phase.block)
                  }
                ]"
              >
                <button
                  type="button"
                  :draggable="Boolean(phase.block)"
                  @click="
                    phase.block
                      ? openBlockEditor(phase.block.id)
                      : openPhaseBreakdown(group.project.id, phase.meta.key)
                  "
                  @dragstart="phase.block ? dragScheduleBlock($event, phase.block.id) : undefined"
                >
                  <span>
                    <strong>{{ phase.meta.label }}</strong>
                    <small>{{ phaseStatus(phase.block) }}</small>
                  </span>
                  <em v-if="phase.block">{{ blockProgress(phase.block) }}</em>
                  <span v-else class="phase-add-symbol" aria-hidden="true">+</span>
                </button>
                <button
                  type="button"
                  class="phase-breakdown"
                  :aria-label="`细分${phase.meta.label}环节`"
                  title="细分当前环节"
                  @click="openPhaseBreakdown(group.project.id, phase.meta.key)"
                >
                  细分
                </button>

                <div
                  v-if="phase.block && planningItemsForPhase(phase.block.id).length"
                  class="phase-child-list"
                >
                  <div
                    v-for="item in planningItemsForPhase(phase.block.id)"
                    :key="item.id"
                    :class="{ 'is-scheduled': item.plannedDate }"
                  >
                    <button
                      type="button"
                      draggable="true"
                      @click="openPlanningItem(item)"
                      @dragstart="dragPlanningItem($event, item.id)"
                    >
                      <Icon icon="ph:subtitles" width="13" />
                      <span>
                        <strong>{{ item.title }}</strong>
                        <small>{{ item.plannedDate ? item.plannedDate.slice(5) : '待安排' }}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      title="删除细分事项"
                      :aria-label="`删除${item.title}`"
                      @click="confirmRemovePlanningItem(item)"
                    >
                      <Icon icon="ph:trash" width="13" />
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div v-if="standaloneItemsForProject(group.project.id).length" class="standalone-items">
              <header>
                <strong>独立事项</strong>
                <span>{{ standaloneItemsForProject(group.project.id).length }}</span>
              </header>
              <div v-for="item in standaloneItemsForProject(group.project.id)" :key="item.id">
                <button
                  type="button"
                  draggable="true"
                  @click="openPlanningItem(item)"
                  @dragstart="dragPlanningItem($event, item.id)"
                >
                  <Icon icon="ph:note" width="14" />
                  <span>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.plannedDate ? item.plannedDate.slice(5) : '待安排' }}</small>
                  </span>
                </button>
                <button
                  type="button"
                  title="删除事项"
                  :aria-label="`删除${item.title}`"
                  @click="confirmRemovePlanningItem(item)"
                >
                  <Icon icon="ph:trash" width="13" />
                </button>
              </div>
            </div>
          </section>

          <section v-if="otherExecutionBlocks.length" class="other-execution">
            <header>
              <strong>其他执行事项</strong>
              <span>{{ otherExecutionBlocks.length }}</span>
            </header>
            <div
              v-for="block in otherExecutionBlocks"
              :key="block.id"
              class="other-execution__item"
            >
              <button
                type="button"
                draggable="true"
                @click="openBlockEditor(block.id)"
                @dragstart="dragScheduleBlock($event, block.id)"
              >
                <Icon icon="ph:dots-six-vertical" width="13" />
                <span>
                  <strong>{{ block.title }}</strong>
                  <small>{{ block.start.slice(5) }}–{{ block.end.slice(5) }} · {{ scheduleTypeLabel(block.type) }}</small>
                </span>
              </button>
              <button
                type="button"
                class="other-execution__delete"
                :aria-label="`删除${block.title}`"
                title="删除事项"
                @click="confirmRemoveScheduleBlock(block)"
              >
                <Icon icon="ph:trash" width="13" />
              </button>
            </div>
          </section>
        </div>
      </aside>

      <section class="execution-calendar">
        <header class="execution-calendar__toolbar">
          <div>
            <button type="button" aria-label="上一周期" @click="navigateCalendar(-1)">
              <ArrowLeft />
            </button>
            <button type="button" @click="cursor = startOfDay(new Date())">今天</button>
            <button type="button" aria-label="下一周期" @click="navigateCalendar(1)">
              <ArrowRight />
            </button>
          </div>
          <strong>{{ calendarTitle }}</strong>
          <span v-if="pendingPlacement">
            正在安排：{{ pendingPlacement.label }}
            <button type="button" @click="pendingPlacement = null">取消</button>
          </span>
        </header>

        <div class="weekday-row">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>

        <div class="calendar-grid" :class="`is-${view}`">
          <article
            v-for="day in displayDays"
            :key="dateKey(day)"
            :class="{
              'is-muted': view === 'month' && day.getMonth() !== currentMonth,
              'is-today': isToday(day),
              'is-pending': pendingPlacement
            }"
            @click="placePending(day)"
            @dragover.prevent
            @drop.stop="dropOnDate($event, day)"
          >
            <header>
              <span>{{ day.getDate() }}</span>
              <em v-if="isToday(day)">今天</em>
            </header>
            <div class="day-blocks">
              <button
                v-for="block in blocksCoveringDate(day)"
                :key="block.id"
                type="button"
                draggable="true"
                :class="[
                  `tone-${phaseTone(block)}`,
                  `is-span-${spanEdge(block, day)}`,
                  { 'is-done': isBlockDone(block) }
                ]"
                @click.stop="openBlockEditor(block.id)"
                @contextmenu.prevent.stop="openBlockMenu($event, block.id)"
                @dragstart.stop="dragScheduleBlock($event, block.id)"
              >
                <template v-if="['start', 'single'].includes(spanEdge(block, day))">
                  <span>{{ block.projectName }}</span>
                  <strong>{{ isKpiBlock(block) ? phaseLabel(block) : block.title }}</strong>
                  <small>
                    {{ block.start.slice(5) }}–{{ block.end.slice(5) }} · {{ blockProgress(block) }}
                  </small>
                  <em
                    class="day-block-delete"
                    title="删除时间条"
                    @click.stop.prevent="confirmDeleteCalendarBlock(block)"
                  >
                    删除
                  </em>
                </template>
                <strong v-else class="span-continue">
                  {{ isKpiBlock(block) ? phaseLabel(block) : block.title }}
                </strong>
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>

    <NewProjectPhaseDialog
      :open="newPhaseOpen"
      :initial-project-id="newPhaseProjectId"
      @close="closePhaseDialog"
    />
    <NewPlanningItemDialog
      :open="newPlanningItemOpen"
      :initial-project-id="planningItemProjectId"
      :initial-phase-block-id="planningItemPhaseBlockId"
      :initial-parent-id="planningItemParentId"
      @close="closePlanningItemDialog"
    />
    <ScheduleBlockEditorDialog
      :open="Boolean(editingBlockId)"
      :block-id="editingBlockId"
      @close="editingBlockId = ''"
      @saved="editingBlockId = ''"
    />

    <div
      v-if="contextMenu"
      class="calendar-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      role="menu"
      @pointerdown.stop
    >
      <button type="button" role="menuitem" @click="editBlockFromMenu">
        <Icon icon="ph:calendar-blank" width="14" />
        修改时间设定
      </button>
      <button type="button" role="menuitem" class="is-danger" @click="deleteBlockFromMenu">
        <Icon icon="ph:trash" width="13" />
        删除时间条
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  @use './creator-theme';

  .calendar-segmented {
    display: flex;
    align-items: center;
    height: var(--dojo-btn-height);
    padding: 3px;
    background: #fff;
    border: 1px solid var(--dojo-line);
    border-radius: var(--dojo-radius-sm);

    button {
      min-width: 40px;
      height: calc(var(--dojo-btn-height) - 8px);
      min-height: calc(var(--dojo-btn-height) - 8px);
      padding: 0 12px;
      font-size: var(--dojo-fs-ui);
      font-weight: 600;
      color: var(--creator-muted);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 6px;

      &.is-active {
        color: var(--dojo-accent);
        background: var(--dojo-paper-muted);
        box-shadow: none;
      }
    }
  }

  .creator-heading__actions {
    display: flex;
    gap: 8px;
    align-items: center;

    .el-button {
      min-height: var(--dojo-btn-height);
    }
  }

  .creator-calendar-page .creator-heading {
    flex: 0 0 auto;
  }

  .calendar-workspace {
    display: grid;
    grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
    align-items: stretch;
    min-height: calc(100dvh - 140px);
  }

  .project-module-pool {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 0;
    min-height: 100%;
    overflow: hidden;
    background: var(--creator-surface-soft);
    border-right: 1px solid var(--creator-line);
  }

  .project-module-pool__hint {
    flex: 0 0 auto;
    padding: 14px 16px 10px;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--creator-muted);
  }

  .project-module-pool__scroll {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .project-module-group {
    padding: 16px;
    border-bottom: 1px solid var(--creator-line);

    > header {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      > div:first-child {
        display: grid;
        gap: 2px;

        strong {
          font-size: 12px;
        }

        span {
          font-size: 11px;
          color: var(--creator-faint);
        }
      }

      > div:last-child {
        display: flex;
        gap: 5px;

        button {
          min-width: 48px;
          height: 30px;
          padding: 0 7px;
          font-size: 11px;
          color: var(--creator-muted);
          cursor: pointer;
          background: var(--creator-surface);
          border: 1px solid var(--creator-line);
          border-radius: 8px;
        }
      }
    }
  }

  .project-phase-list {
    display: grid;
    gap: 6px;

    > article {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 44px;
      overflow: hidden;
      background: var(--creator-surface);
      border: 1px solid var(--creator-line);
      border-radius: 8px;

      > button:first-child {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        min-height: 52px;
        padding: 8px 10px;
        color: var(--creator-muted);
        text-align: left;
        cursor: pointer;
        background: transparent;
        border: 0;

        > span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        strong {
          font-size: 11px;
          color: var(--creator-deep);
        }

        small,
        em {
          font-size: 10px;
          font-style: normal;
          color: var(--creator-faint);
          font-variant-numeric: tabular-nums;
        }
      }

      &.is-created > button:first-child {
        cursor: grab;
      }

      &.is-done {
        opacity: 0.68;
      }
    }
  }

  .phase-breakdown {
    display: grid;
    place-items: center;
    padding: 0 6px;
    font-size: 11px;
    color: var(--creator-muted);
    cursor: pointer;
    background: var(--creator-surface-soft);
    border: 0;
    border-left: 1px solid var(--creator-line);
  }

  .phase-add-symbol {
    font-size: 18px;
    line-height: 1;
  }

  .phase-child-list {
    grid-column: 1 / -1;
    background: var(--creator-surface-soft);
    border-top: 1px solid var(--creator-line);

    > div,
    .standalone-items > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 32px;
    }

    > div > button:first-child {
      display: grid;
      grid-template-columns: 17px minmax(0, 1fr);
      gap: 7px;
      align-items: center;
      min-height: 42px;
      padding: 7px 10px;
      color: var(--creator-muted);
      text-align: left;
      cursor: grab;
      background: transparent;
      border: 0;

      span {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      strong {
        overflow: hidden;
        font-size: 11px;
        color: var(--creator-deep);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 10px;
        color: var(--creator-faint);
      }
    }

    > div > button:last-child {
      color: var(--creator-faint);
      cursor: pointer;
      background: transparent;
      border: 0;
    }
  }

  .standalone-items {
    margin-top: 12px;
    border-top: 1px solid var(--creator-line);

    > header {
      display: flex;
      justify-content: space-between;
      padding: 10px 2px 6px;
      font-size: 11px;
      color: var(--creator-muted);
    }

    > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 32px;
      border-top: 1px solid var(--creator-line);

      > button:first-child {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 7px;
        align-items: center;
        padding: 8px 2px;
        color: var(--creator-muted);
        text-align: left;
        cursor: grab;
        background: transparent;
        border: 0;

        span {
          display: grid;
          min-width: 0;
        }

        strong {
          overflow: hidden;
          font-size: 11px;
          color: var(--creator-deep);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          font-size: 10px;
          color: var(--creator-faint);
        }
      }

      > button:last-child {
        color: var(--creator-faint);
        cursor: pointer;
        background: transparent;
        border: 0;
      }
    }
  }

  .other-execution {
    padding: 16px;

    > header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 10px;
    }

    &__item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 28px;
      align-items: stretch;
      border-top: 1px solid var(--creator-line);
    }

    &__item > button:first-child {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 7px;
      align-items: center;
      width: 100%;
      padding: 8px 2px;
      color: var(--creator-muted);
      text-align: left;
      cursor: grab;
      background: transparent;
      border: 0;

      span {
        display: grid;
      }

      strong {
        font-size: 11px;
        color: var(--creator-deep);
      }

      small {
        font-size: 10px;
        color: var(--creator-faint);
      }
    }

    &__delete {
      display: grid;
      place-items: center;
      color: var(--creator-faint);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-left: 1px solid var(--creator-line);

      &:hover,
      &:focus-visible {
        color: var(--dojo-danger);
        background: #fff1f3;
        outline: none;
      }
    }
  }

  .execution-calendar {
    min-width: 0;
    padding: 16px;
  }

  .execution-calendar__toolbar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-height: 42px;
    margin-bottom: 10px;

    > div {
      display: flex;
      gap: 5px;

      button {
        min-width: 34px;
        min-height: 32px;
        padding: 0 9px;
        color: var(--creator-muted);
        cursor: pointer;
        background: var(--creator-surface);
        border: 1px solid var(--creator-line);
        border-radius: 8px;
      }
    }

    > strong {
      text-align: center;
    }

    > span {
      display: flex;
      gap: 7px;
      align-items: center;
      font-size: 11px;
      color: var(--dojo-accent);

      button {
        padding: 0;
        color: var(--creator-muted);
        cursor: pointer;
        background: transparent;
        border: 0;
      }
    }
  }

  .weekday-row,
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .weekday-row {
    background: var(--creator-surface-soft);
    border: 1px solid var(--creator-line);
    border-bottom: 0;
    border-radius: 10px 10px 0 0;

    span {
      padding: 8px;
      font-size: 11px;
      color: var(--creator-muted);
      text-align: center;
      border-right: 1px solid var(--creator-line);

      &:last-child {
        border-right: 0;
      }
    }
  }

  .calendar-grid {
    border-top: 1px solid var(--creator-line);
    border-left: 1px solid var(--creator-line);

    > article {
      min-width: 0;
      min-height: 155px;
      padding: 7px;
      background: var(--creator-surface);
      border-right: 1px solid var(--creator-line);
      border-bottom: 1px solid var(--creator-line);

      &.is-muted {
        opacity: 0.5;
      }

      &.is-today {
        background: #f2f7ff;
        box-shadow: inset 0 0 0 1px #b9cef6;
      }

      &.is-pending {
        cursor: crosshair;
      }

      > header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;

        span {
          font-size: 10px;
          font-weight: 700;
        }

        em {
          font-size: 10px;
          font-style: normal;
          color: var(--dojo-accent);
        }
      }
    }

    &.is-month > article {
      min-height: 118px;
    }
  }

  .day-blocks {
    display: grid;
    gap: 4px;

    > button {
      position: relative;
      display: grid;
      gap: 2px;
      width: 100%;
      min-width: 0;
      padding: 6px 22px 6px 8px;
      color: #264863;
      text-align: left;
      cursor: grab;
      background: #dce9f4;
      border: 1px solid #9fb9cf;
      border-radius: 7px;

      > span,
      small {
        overflow: hidden;
        font-size: 7px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      > span {
        opacity: 0.7;
      }

      strong {
        overflow: hidden;
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .span-continue {
        font-size: 10px;
        opacity: 0.85;
      }

      .day-block-delete {
        position: absolute;
        top: 4px;
        right: 5px;
        font-size: 8px;
        font-style: normal;
        font-weight: 650;
        line-height: 1;
        color: #a53f49;
        letter-spacing: 0.02em;
        cursor: pointer;
        opacity: 0.72;

        &:hover,
        &:focus-visible {
          opacity: 1;
          text-decoration: underline;
        }
      }

      &.is-span-start {
        border-radius: 7px 2px 2px 7px;
        box-shadow: 2px 0 0 #9fb9cf;
      }

      &.is-span-mid {
        border-radius: 2px;
        box-shadow:
          -2px 0 0 #9fb9cf,
          2px 0 0 #9fb9cf;
      }

      &.is-span-end {
        border-radius: 2px 7px 7px 2px;
        box-shadow: -2px 0 0 #9fb9cf;
      }

      &.is-span-single {
        border-radius: 7px;
      }

      svg {
        position: absolute;
        top: 8px;
        right: 7px;
      }

      &.tone-accounts {
        color: #4f5966;
        background: #e5e8ec;
        border-color: #bdc4cd;
      }

      &.tone-shoot {
        color: #6a405f;
        background: #ead8e5;
        border-color: #c7a9bf;
      }

      &.tone-edit {
        color: #56436f;
        background: #e4dcf0;
        border-color: #b9a7cf;
      }

      &.tone-distribute {
        color: #35655a;
        background: #d5e7e0;
        border-color: #9fc4b6;
      }

      &.tone-ads {
        color: #655327;
        background: #efe4bd;
        border-color: #cdbb7d;
      }

      &.is-done {
        color: #737d89;
        background: #dfe3e8;
        border-color: #bac2cc;
      }
    }
  }

  .calendar-context-menu {
    position: fixed;
    z-index: 3200;
    min-width: 168px;
    padding: 5px;
    background: #fff;
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
    box-shadow: 0 16px 36px rgb(21 33 50 / 16%);

    button {
      display: flex;
      gap: 7px;
      align-items: center;
      width: 100%;
      min-height: 32px;
      padding: 0 8px;
      font-size: 12px;
      color: var(--dojo-ink);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 8px;

      &:hover,
      &:focus-visible {
        background: var(--dojo-paper-muted);
        outline: none;
      }

      &.is-danger {
        min-height: 28px;
        font-size: 10px;
        color: #a53f49;
      }
    }
  }

  @media (max-width: 980px) {
    .calendar-workspace {
      grid-template-columns: 1fr;
    }

    .project-module-pool {
      height: auto;
      min-height: 0;
      max-height: 440px;
      border-right: 0;
      border-bottom: 1px solid var(--creator-line);
    }
  }

  @media (max-width: 760px) {
    .creator-heading__actions {
      width: 100%;
      justify-content: space-between;
    }

    .execution-calendar {
      overflow-x: auto;
    }

    .weekday-row,
    .calendar-grid {
      min-width: 760px;
    }

    .execution-calendar__toolbar {
      grid-template-columns: 1fr auto;

      > strong {
        text-align: right;
      }

      > span {
        grid-column: 1 / -1;
      }
    }
  }
</style>
