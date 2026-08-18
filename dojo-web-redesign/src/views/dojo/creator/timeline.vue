<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import {
    listProjectPhaseBlocks,
    overallKpiProgressPct,
    phaseKeyFromBlockId,
    PLAN_PHASE_META,
    removeProjectPhaseBar
  } from '@/store/dojoKpiSchedule'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import { getProjectRuntime } from '@/store/dojoProjectRuntime'
  import {
    executionBriefForBlock,
    projectExecutionBrief,
    type ExecutionBrief
  } from '@/store/dojoExecutionGuide'
  import {
    dojoScheduleStore,
    patchScheduleBlock,
    removeScheduleBlock,
    type ScheduleBlock
  } from '@/store/dojoScheduleStore'
  import NewProjectPhaseDialog from './components/NewProjectPhaseDialog.vue'
  import ScheduleBlockEditorDialog from './components/ScheduleBlockEditorDialog.vue'

  defineOptions({ name: 'DojoCreatorTimeline' })

  const DAY_WIDTH = 64
  const LANE_HEIGHT = 48
  const MAX_VISIBLE_DAYS = 120

  interface EditingPhase {
    id: string
    title: string
    start: string
    end: string
  }

  interface ResizeState {
    id: string
    edge: 'start' | 'end'
    originX: number
    start: string
    end: string
  }

  interface PhaseLayout {
    id: string
    lane: number
  }

  interface DragState {
    id: string
    projectId: string
    originX: number
    originY: number
    originScrollLeft: number
    start: string
    end: string
    originLane: number
    moved: boolean
  }

  const route = useRoute()
  const router = useRouter()
  const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : '')
  const todayOnly = ref(route.path === '/today')
  const newPhaseOpen = ref(route.query.new === '1')
  const newPhaseProjectId = ref('')
  const editingBlockId = ref('')
  const editingPhase = ref<EditingPhase | null>(null)
  const resizeState = ref<ResizeState | null>(null)
  const resizePreview = ref<ScheduleBlock | null>(null)
  const dragState = ref<DragState | null>(null)
  const dragPreview = ref<ScheduleBlock | null>(null)
  const timelineScroll = ref<HTMLElement | null>(null)
  const contextMenu = ref<{
    kind: 'track' | 'phase'
    projectId: string
    phaseId?: string
    x: number
    y: number
  } | null>(null)
  const timelinePanning = ref(false)
  let panStart: { x: number; y: number; left: number; top: number } | null = null
  let dragFrame = 0
  let panFrame = 0
  let pendingDragPoint: { x: number; y: number } | null = null
  let pendingPanPoint: { x: number; y: number } | null = null
  let suppressClickUntil = 0
  const today = dateKey(new Date())

  const projectOptions = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )
  const scopedProjects = computed(() =>
    projectOptions.value.filter(
      (project) => !projectFilter.value || project.id === projectFilter.value
    )
  )
  const allPhases = computed(() => {
    void dojoScheduleStore.revision
    return scopedProjects.value.flatMap((project) => listProjectPhaseBlocks(project.id))
  })
  const projectGroups = computed(() =>
    scopedProjects.value
      .map((project) => {
        const phases = listProjectPhaseBlocks(project.id)
        return {
          project,
          phases,
          hasTodayPhase: phases.some((phase) => phase.start <= today && phase.end >= today)
        }
      })
      .filter((group) => !todayOnly.value || group.hasTodayPhase)
  )
  const deadlineCount = computed(
    () => allPhases.value.filter((phase) => !isPhaseDone(phase) && phase.end < today).length
  )
  const todayPhases = computed(() =>
    allPhases.value.filter((phase) => phase.start <= today && phase.end >= today)
  )
  const todayProjectGroups = computed(() =>
    scopedProjects.value
      .map((project) => ({
        project,
        phases: todayPhases.value.filter((phase) => phase.projectId === project.id)
      }))
      .filter((group) => group.phases.length)
  )
  const todayDoneCount = computed(
    () => todayPhases.value.filter((phase) => isPhaseDone(phase)).length
  )
  const todayProgress = computed(() =>
    todayPhases.value.length
      ? Math.round((todayDoneCount.value / todayPhases.value.length) * 100)
      : 0
  )
  const todayExecutionRows = computed(() =>
    scopedProjects.value.flatMap((project) => {
      const brief = projectExecutionBrief(project.id, today)
      return brief ? [{ project, brief }] : []
    })
  )
  const editingExecutionBrief = computed(() => {
    const phase = editingPhase.value ? phaseById(editingPhase.value.id) : null
    return phase ? executionBriefForBlock(phase, today) : null
  })
  const timelineDays = computed(() => {
    const values = allPhases.value.flatMap((phase) => [phase.start, phase.end])
    values.push(today)
    values.sort()
    const start = addDays(values[0], -2)
    const naturalEnd = addDays(values[values.length - 1], 3)
    const end = addDays(start, Math.min(MAX_VISIBLE_DAYS - 1, daysBetween(start, naturalEnd)))
    return buildDays(start, end)
  })
  const timelineWidth = computed(() => `${timelineDays.value.length * DAY_WIDTH}px`)

  function dateKey(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-')
  }

  function addDays(date: string, days: number) {
    const value = new Date(`${date}T12:00:00`)
    value.setDate(value.getDate() + days)
    return dateKey(value)
  }

  function daysBetween(start: string, end: string) {
    return Math.max(
      0,
      Math.round(
        (new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000
      )
    )
  }

  function buildDays(start: string, end: string) {
    return Array.from({ length: daysBetween(start, end) + 1 }, (_, index) => addDays(start, index))
  }

  function phaseById(id: string) {
    return dojoScheduleStore.blocks.find((phase) => phase.id === id) || null
  }

  function phaseLabel(phase: ScheduleBlock) {
    const key = phaseKeyFromBlockId(phase.id, phase.projectId)
    return PLAN_PHASE_META.find((item) => item.key === key)?.label || phase.title
  }

  function phaseClass(phase: ScheduleBlock) {
    return phaseKeyFromBlockId(phase.id, phase.projectId) || 'other'
  }

  function phaseProgress(phase: ScheduleBlock) {
    if (!phase.target) return phase.status || '进行中'
    return `${Number(phase.done || 0).toLocaleString()}/${phase.target.toLocaleString()}`
  }

  function projectProgress(projectId: string) {
    const runtime = getProjectRuntime(projectId)
    return runtime ? overallKpiProgressPct(runtime) : 0
  }

  function goToExecution(brief: ExecutionBrief) {
    void router.push({ path: brief.route, query: { project: brief.projectId } })
  }

  function focusExecutionBrief(brief: ExecutionBrief) {
    const phase = phaseById(brief.blockId)
    if (phase) openPhaseEditor(phase)
  }

  function isPhaseDone(phase: ScheduleBlock) {
    if (phase.status === '已完成') return true
    return Boolean(phase.target && Number(phase.done || 0) >= phase.target)
  }

  function windowFor(phase: ScheduleBlock) {
    if (dragState.value?.id === phase.id && dragPreview.value) return dragPreview.value
    if (resizeState.value?.id === phase.id && resizePreview.value) return resizePreview.value
    return phase
  }

  function projectPhases(projectId: string) {
    return projectGroups.value.find((group) => group.project.id === projectId)?.phases || []
  }

  function phaseLayout(projectId: string, excludedId?: string): PhaseLayout[] {
    return projectPhases(projectId)
      .filter((phase) => phase.id !== excludedId)
      .map((phase) => {
        const window = windowFor(phase)
        return {
          id: phase.id,
          lane: Math.max(0, Math.floor(window.lane ?? 0))
        }
      })
  }

  function resolveTargetLane(requestedLane: number) {
    return Math.max(0, Math.floor(requestedLane))
  }

  function laneCount(projectId: string) {
    const layout = phaseLayout(projectId)
    const occupied = layout.map((item) => item.lane)
    const dragLane =
      dragState.value?.projectId === projectId && dragPreview.value
        ? dragPreview.value.lane ?? 0
        : -1
    const maxLane = Math.max(0, ...occupied, dragLane)
    // 底部始终多留一行空轨道，方便拖出重叠时间条
    return maxLane + 2
  }

  function phasesInLane(projectId: string, lane: number) {
    const ids = new Set(
      phaseLayout(projectId)
        .filter((item) => item.lane === lane)
        .map((item) => item.id)
    )
    return projectPhases(projectId).filter((phase) => ids.has(phase.id))
  }

  function phaseStyle(phase: ScheduleBlock) {
    const window = windowFor(phase)
    const first = timelineDays.value[0]
    const lastOffset = Math.max(0, timelineDays.value.length - 1)
    const offset = Math.min(lastOffset, Math.max(0, daysBetween(first, window.start)))
    const span = Math.max(1, daysBetween(window.start, window.end) + 1)
    const visibleSpan = Math.max(1, Math.min(span, timelineDays.value.length - offset))
    return {
      gridColumn: `${offset + 1} / span ${visibleSpan}`
    }
  }

  function isWeekend(date: string) {
    const day = new Date(`${date}T12:00:00`).getDay()
    return day === 0 || day === 6
  }

  function openPhaseEditor(phase: ScheduleBlock) {
    if (performance.now() < suppressClickUntil) return
    editingPhase.value = {
      id: phase.id,
      title: `${phase.projectName} · ${phaseLabel(phase)}`,
      start: phase.start,
      end: phase.end
    }
  }

  function applyPhaseWindow() {
    const phase = editingPhase.value
    if (!phase) return
    if (!phase.start || !phase.end || phase.end < phase.start) {
      ElMessage.warning('截止日期不能早于开始日期')
      return
    }
    patchScheduleBlock(phase.id, { start: phase.start, end: phase.end })
    ElMessage.success('项目环节周期已更新，并同步到执行日历')
  }

  function startPhaseDrag(event: PointerEvent, phase: ScheduleBlock, lane: number) {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    dragState.value = {
      id: phase.id,
      projectId: phase.projectId,
      originX: event.clientX,
      originY: event.clientY,
      originScrollLeft: timelineScroll.value?.scrollLeft || 0,
      start: phase.start,
      end: phase.end,
      originLane: lane,
      moved: false
    }
    dragPreview.value = { ...phase, lane }
    document.body.classList.add('is-timeline-dragging')
    window.addEventListener('pointermove', handlePhaseDragMove)
    window.addEventListener('pointerup', finishPhaseDrag, { once: true })
    window.addEventListener('pointercancel', cancelPhaseDrag, { once: true })
  }

  function handlePhaseDragMove(event: PointerEvent) {
    event.preventDefault()
    pendingDragPoint = { x: event.clientX, y: event.clientY }
    if (dragFrame) return
    dragFrame = requestAnimationFrame(updatePhaseDragPreview)
  }

  function updatePhaseDragPreview() {
    dragFrame = 0
    const state = dragState.value
    const point = pendingDragPoint
    const phase = state ? phaseById(state.id) : null
    if (!state || !point || !phase) return

    const scroll = timelineScroll.value
    let didAutoScroll = false
    if (scroll) {
      const bounds = scroll.getBoundingClientRect()
      const before = scroll.scrollLeft
      if (point.x > bounds.right - 56) scroll.scrollLeft += 18
      if (point.x < bounds.left + 56) scroll.scrollLeft -= 18
      didAutoScroll = before !== scroll.scrollLeft
    }

    const dx =
      point.x - state.originX + ((timelineScroll.value?.scrollLeft || 0) - state.originScrollLeft)
    const dy = point.y - state.originY
    const laneDelta = Math.round(dy / LANE_HEIGHT)
    const requestedLane = Math.max(0, state.originLane + laneDelta)
    const isChangingLane = laneDelta !== 0
    const dayDelta =
      isChangingLane && Math.abs(dx) < DAY_WIDTH * 0.55 ? 0 : Math.round(dx / DAY_WIDTH)
    const start = addDays(state.start, dayDelta)
    const end = addDays(state.end, dayDelta)
    const lane = resolveTargetLane(requestedLane)
    state.moved = state.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4
    dragPreview.value = {
      ...phase,
      start,
      end,
      lane
    }
    if (didAutoScroll && !dragFrame) dragFrame = requestAnimationFrame(updatePhaseDragPreview)
  }

  function finishPhaseDrag() {
    if (dragFrame) cancelAnimationFrame(dragFrame)
    const state = dragState.value
    const preview = dragPreview.value
    window.removeEventListener('pointermove', handlePhaseDragMove)
    window.removeEventListener('pointercancel', cancelPhaseDrag)
    document.body.classList.remove('is-timeline-dragging')
    if (state?.moved && preview) {
      patchScheduleBlock(state.id, {
        start: preview.start,
        end: preview.end,
        lane: preview.lane
      })
      suppressClickUntil = performance.now() + 240
      ElMessage.success('已移到新轨道/日期，可与其它环节并行显示')
    }
    dragState.value = null
    dragPreview.value = null
    pendingDragPoint = null
  }

  function cancelPhaseDrag() {
    if (dragFrame) cancelAnimationFrame(dragFrame)
    window.removeEventListener('pointermove', handlePhaseDragMove)
    window.removeEventListener('pointerup', finishPhaseDrag)
    document.body.classList.remove('is-timeline-dragging')
    dragState.value = null
    dragPreview.value = null
    pendingDragPoint = null
  }

  function startResize(event: PointerEvent, phase: ScheduleBlock, edge: 'start' | 'end') {
    event.preventDefault()
    event.stopPropagation()
    resizeState.value = {
      id: phase.id,
      edge,
      originX: event.clientX,
      start: phase.start,
      end: phase.end
    }
    resizePreview.value = { ...phase }
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', finishResize, { once: true })
  }

  function handleResizeMove(event: PointerEvent) {
    const state = resizeState.value
    if (!state || !resizePreview.value) return
    const dayDelta = Math.round((event.clientX - state.originX) / DAY_WIDTH)
    if (state.edge === 'start') {
      const nextStart = addDays(state.start, dayDelta)
      resizePreview.value = {
        ...resizePreview.value,
        start: nextStart <= state.end ? nextStart : state.end
      }
      return
    }
    const nextEnd = addDays(state.end, dayDelta)
    resizePreview.value = {
      ...resizePreview.value,
      end: nextEnd >= state.start ? nextEnd : state.start
    }
  }

  function finishResize() {
    const state = resizeState.value
    const preview = resizePreview.value
    window.removeEventListener('pointermove', handleResizeMove)
    if (state && preview) {
      patchScheduleBlock(state.id, { start: preview.start, end: preview.end })
      ElMessage.success('项目环节长度已调整，执行日历同步更新')
    }
    resizeState.value = null
    resizePreview.value = null
  }

  function startTimelinePan(event: PointerEvent) {
    if (event.button !== 0 || !timelineScroll.value) return
    const target = event.target as HTMLElement
    if (target.closest('.phase-block, button, input, select')) return
    panStart = {
      x: event.clientX,
      y: event.clientY,
      left: timelineScroll.value.scrollLeft,
      top: timelineScroll.value.scrollTop
    }
    pendingPanPoint = { x: event.clientX, y: event.clientY }
    timelinePanning.value = true
    timelineScroll.value.setPointerCapture?.(event.pointerId)
    document.body.classList.add('is-timeline-dragging')
    window.addEventListener('pointermove', handleTimelinePanMove)
    window.addEventListener('pointerup', endTimelinePan)
    window.addEventListener('pointercancel', endTimelinePan)
  }

  function handleTimelinePanMove(event: PointerEvent) {
    if (!timelinePanning.value || !panStart || !timelineScroll.value) return
    pendingPanPoint = { x: event.clientX, y: event.clientY }
    if (panFrame) return
    panFrame = requestAnimationFrame(() => {
      panFrame = 0
      if (!panStart || !pendingPanPoint || !timelineScroll.value) return
      timelineScroll.value.scrollLeft = panStart.left - (pendingPanPoint.x - panStart.x)
      timelineScroll.value.scrollTop = panStart.top - (pendingPanPoint.y - panStart.y)
    })
  }

  function endTimelinePan() {
    timelinePanning.value = false
    panStart = null
    pendingPanPoint = null
    if (panFrame) {
      cancelAnimationFrame(panFrame)
      panFrame = 0
    }
    window.removeEventListener('pointermove', handleTimelinePanMove)
    window.removeEventListener('pointerup', endTimelinePan)
    window.removeEventListener('pointercancel', endTimelinePan)
    if (!dragState.value && !resizeState.value) {
      document.body.classList.remove('is-timeline-dragging')
    }
  }

  function openNewPhase(projectId = '') {
    contextMenu.value = null
    newPhaseProjectId.value = projectId || projectFilter.value
    newPhaseOpen.value = true
  }

  function openTrackMenu(event: MouseEvent, projectId: string) {
    contextMenu.value = {
      kind: 'track',
      projectId,
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 120)
    }
  }

  function openPhaseMenu(event: MouseEvent, phase: ScheduleBlock) {
    event.stopPropagation()
    contextMenu.value = {
      kind: 'phase',
      projectId: phase.projectId,
      phaseId: phase.id,
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 120)
    }
  }

  function editPhaseFromMenu() {
    const phaseId = contextMenu.value?.phaseId
    contextMenu.value = null
    const phase = phaseId ? phaseById(phaseId) : null
    if (phase) openPhaseEditor(phase)
  }

  function deletePhaseFromMenu() {
    const menu = contextMenu.value
    contextMenu.value = null
    if (!menu?.phaseId) return
    const phase = phaseById(menu.phaseId)
    if (!phase) return
    const phaseKey = phaseKeyFromBlockId(phase.id, phase.projectId)
    if (phaseKey && phaseKey !== 'cycle') removeProjectPhaseBar(phase.projectId, phaseKey)
    else removeScheduleBlock(phase.id)
    if (editingPhase.value?.id === phase.id) editingPhase.value = null
    ElMessage.success(`已删除「${phaseLabel(phase)}」时间条`)
  }

  function handleTrackKeydown(event: KeyboardEvent, projectId: string) {
    const key = event.key.toLowerCase()
    if (key !== 'n' && event.key !== 'Insert') return
    event.preventDefault()
    openNewPhase(projectId)
  }

  function closeNewPhase() {
    newPhaseOpen.value = false
    newPhaseProjectId.value = ''
    if (route.query.new !== '1') return
    const nextQuery = { ...route.query }
    delete nextQuery.new
    void router.replace({ path: route.path, query: nextQuery })
  }

  function handlePhaseCreated(blockId: string) {
    closeNewPhase()
    todayOnly.value = false
    const phase = phaseById(blockId)
    if (phase) openPhaseEditor(phase)
  }

  watch(
    () => route.query.new,
    (value) => {
      if (value === '1') openNewPhase()
    }
  )

  onMounted(() => {
    window.addEventListener('pointerdown', closeContextMenu)
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  function closeContextMenu() {
    contextMenu.value = null
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeContextMenu()
  }

  onBeforeUnmount(() => {
    endTimelinePan()
    window.removeEventListener('pointerdown', closeContextMenu)
    window.removeEventListener('keydown', handleGlobalKeydown)
    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', finishResize)
    window.removeEventListener('pointermove', handlePhaseDragMove)
    window.removeEventListener('pointerup', finishPhaseDrag)
    window.removeEventListener('pointercancel', cancelPhaseDrag)
    document.body.classList.remove('is-timeline-dragging')
    if (dragFrame) cancelAnimationFrame(dragFrame)
  })
</script>

<template>
  <div class="creator-surface creator-timeline-page">
    <header class="creator-heading">
      <div class="creator-heading__copy">
        <h1>时间规划</h1>
        <p>一条时间轴看各项目环节。右侧是今天要完成的团队事项。</p>
      </div>
      <div class="creator-heading__actions">
        <ElSelect v-model="projectFilter" clearable filterable placeholder="全部项目">
          <ElOption
            v-for="project in projectOptions"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </ElSelect>
        <ElButton
          type="primary"
          :disabled="!dojoProjectStore.projects.length"
          @click="openNewPhase()"
        >
          <Icon icon="ph:plus" width="16" />
          添加项目环节
        </ElButton>
      </div>
    </header>

    <section class="today-overview" aria-label="今日执行概览">
      <div>
        <span>{{ today.slice(5).replace('-', '月') }}日</span>
        <strong>今日执行 {{ todayDoneCount }}/{{ todayPhases.length }}</strong>
      </div>
      <div class="today-overview__progress" aria-label="今日完成进度">
        <i :style="{ width: `${todayProgress}%` }" />
      </div>
      <span>{{ todayProgress }}%</span>
      <button
        type="button"
        :class="{ 'is-active': todayOnly }"
        :aria-pressed="todayOnly"
        @click="todayOnly = !todayOnly"
      >
        <Icon icon="ph:crosshair" width="15" />
        {{ todayOnly ? '显示全部轨道' : '只看今天' }}
      </button>
    </section>

    <section v-if="route.path === '/today'" class="execution-brief" aria-label="按项目阶段推进">
      <header class="execution-brief__head">
        <div>
          <h2>按当前阶段推进</h2>
          <p>每个项目只显示此刻最需要执行、监看和对齐的一组信息。</p>
        </div>
        <button type="button" @click="router.push('/project')">
          校准项目 KPI
          <Icon icon="ph:arrow-right" width="15" />
        </button>
      </header>

      <div v-if="todayExecutionRows.length" class="execution-brief__rows">
        <article v-for="row in todayExecutionRows" :key="row.project.id">
          <button
            type="button"
            class="execution-brief__identity"
            @click="focusExecutionBrief(row.brief)"
          >
            <span :class="[`is-${row.brief.phaseKey}`, `is-${row.brief.timing}`]">
              {{ row.brief.phaseLabel.slice(0, 1) }}
            </span>
            <span>
              <strong>{{ row.project.name }}</strong>
              <small>{{ row.brief.phaseLabel }} · {{ row.brief.timingLabel }}</small>
            </span>
          </button>

          <div class="execution-brief__cell">
            <small>今天做</small>
            <strong>{{ row.brief.actions.slice(0, 2).join(' · ') }}</strong>
          </div>

          <div class="execution-brief__cell">
            <small>重点监看</small>
            <strong>{{ row.brief.monitorSummary }}</strong>
            <span>{{ row.brief.monitors.join(' / ') }}</span>
          </div>

          <div class="execution-brief__kpi">
            <span>
              <small>{{ row.brief.kpiLabel }}</small>
              <strong>{{ row.brief.kpiText }}</strong>
            </span>
            <div aria-label="KPI 完成进度">
              <i :style="{ width: `${row.brief.progressPct}%` }" />
            </div>
          </div>

          <button
            type="button"
            class="execution-brief__go"
            :aria-label="`${row.project.name}：${row.brief.actionLabel}`"
            @click="goToExecution(row.brief)"
          >
            <Icon icon="ph:arrow-up-right" width="16" />
          </button>
        </article>
      </div>
      <div v-else class="execution-brief__empty">
        当前项目还没有排入执行环节，先到项目管理校准周期与 KPI。
      </div>
    </section>

    <section class="timeline-status" aria-label="项目周期概览">
      <span
        ><strong>{{ scopedProjects.length }}</strong> 个项目</span
      >
      <span
        ><strong>{{ allPhases.length }}</strong> 个项目环节</span
      >
      <span :class="{ 'has-risk': deadlineCount }">
        <strong>{{ deadlineCount }}</strong> 个截止风险
      </span>
      <p><Icon icon="ph:calendar-blank" width="15" /> 项目完整周期</p>
    </section>

    <section v-if="editingPhase" class="phase-inspector" aria-label="项目环节周期编辑">
      <div class="phase-inspector__editor">
        <div>
          <small>当前项目环节</small>
          <strong>{{ editingPhase.title }}</strong>
        </div>
        <label>
          <span>开始</span>
          <input v-model="editingPhase.start" type="date" />
        </label>
        <Icon icon="ph:arrow-right" width="16" />
        <label>
          <span>截止</span>
          <input v-model="editingPhase.end" type="date" />
        </label>
        <button type="button" @click="applyPhaseWindow">应用周期</button>
        <button type="button" class="is-quiet" @click="editingPhase = null">关闭</button>
      </div>

      <div v-if="editingExecutionBrief" class="phase-inspector__guide">
        <div>
          <small>这个阶段要做</small>
          <strong>{{ editingExecutionBrief.actions.join(' · ') }}</strong>
        </div>
        <div>
          <small>监看</small>
          <strong>{{ editingExecutionBrief.monitorSummary }}</strong>
          <span>{{ editingExecutionBrief.monitors.join(' / ') }}</span>
        </div>
        <div>
          <small>对齐 KPI</small>
          <strong>{{ editingExecutionBrief.kpiLabel }} {{ editingExecutionBrief.kpiText }}</strong>
          <span>{{ editingExecutionBrief.scheduleLabel }}</span>
        </div>
        <button type="button" class="is-quiet" @click="editingBlockId = editingPhase!.id">
          编辑阶段文案
        </button>
        <button type="button" @click="goToExecution(editingExecutionBrief)">
          {{ editingExecutionBrief.actionLabel }}
          <Icon icon="ph:arrow-up-right" width="14" />
        </button>
      </div>
    </section>

    <div class="timeline-workspace" :class="{ 'is-today': route.path === '/today' }">
      <section class="timeline-board creator-panel">
        <div
          ref="timelineScroll"
          class="timeline-board__scroll"
          :class="{ 'is-panning': timelinePanning }"
          @pointerdown="startTimelinePan"
        >
          <div class="timeline-board__canvas" :style="{ '--timeline-width': timelineWidth }">
            <header class="timeline-axis-row">
              <div class="timeline-axis-row__identity">
                <strong>项目 / 总规划环节</strong>
                <small>进度由项目数据同步</small>
              </div>
              <div class="timeline-axis" :style="{ width: timelineWidth }">
                <span
                  v-for="day in timelineDays"
                  :key="day"
                  :class="{ 'is-weekend': isWeekend(day), 'is-today': day === today }"
                >
                  <small>{{ day.slice(5, 7) }}月</small>
                  <strong>{{ day.slice(8) }}</strong>
                </span>
              </div>
            </header>

            <template v-for="group in projectGroups" :key="group.project.id">
              <div class="timeline-project-row">
                <span><i />{{ group.project.name }}</span>
                <div>
                  <strong>{{ projectProgress(group.project.id) }}%</strong>
                  <button
                    type="button"
                    title="添加项目环节"
                    :aria-label="`为${group.project.name}添加项目环节`"
                    @click="openNewPhase(group.project.id)"
                  >
                    <Icon icon="ph:plus" width="13" />
                  </button>
                </div>
              </div>

              <article class="timeline-plan-row">
                <div class="timeline-plan-row__identity">
                  <span>
                    <strong>项目总规划</strong>
                    <em>{{ group.phases.length }} 个环节</em>
                  </span>
                  <div class="project-plan-actions">
                    <span class="project-progress">{{ projectProgress(group.project.id) }}%</span>
                    <button
                      type="button"
                      title="在当前项目添加环节"
                      :aria-label="`在${group.project.name}添加项目环节`"
                      @click="openNewPhase(group.project.id)"
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                </div>

                <div
                  class="timeline-plan-row__tracks"
                  :style="{ width: timelineWidth }"
                  tabindex="0"
                  :aria-label="`${group.project.name}项目轨道`"
                  @keydown="handleTrackKeydown($event, group.project.id)"
                  @contextmenu.prevent="openTrackMenu($event, group.project.id)"
                >
                  <div
                    v-for="lane in laneCount(group.project.id)"
                    :key="lane"
                    class="timeline-lane"
                    :class="{
                      'is-drop-target':
                        dragState?.projectId === group.project.id && dragPreview?.lane === lane - 1,
                      'is-spare': lane === laneCount(group.project.id)
                    }"
                    :style="{ width: timelineWidth }"
                  >
                    <div class="timeline-lane__days" aria-hidden="true">
                      <i
                        v-for="day in timelineDays"
                        :key="day"
                        :class="{ 'is-weekend': isWeekend(day), 'is-today': day === today }"
                      />
                    </div>
                    <div class="timeline-lane__phases">
                      <div
                        v-for="phase in phasesInLane(group.project.id, lane - 1)"
                        :key="phase.id"
                        class="phase-block"
                        :class="[
                          `phase-${phaseClass(phase)}`,
                          {
                            'is-done': isPhaseDone(windowFor(phase)),
                            'is-dragging': dragState?.id === phase.id
                          }
                        ]"
                        :style="phaseStyle(phase)"
                        role="button"
                        tabindex="0"
                        @click="openPhaseEditor(phase)"
                        @keydown.enter="openPhaseEditor(phase)"
                        @contextmenu.prevent="openPhaseMenu($event, phase)"
                        @pointerdown="startPhaseDrag($event, phase, lane - 1)"
                      >
                        <span
                          class="phase-block__check"
                          :aria-label="isPhaseDone(windowFor(phase)) ? '环节已完成' : '环节进行中'"
                        >
                          <Icon
                            :icon="
                              isPhaseDone(windowFor(phase)) ? 'ph:check-circle-fill' : 'ph:circle'
                            "
                            width="13"
                          />
                        </span>
                        <button
                          class="phase-block__handle is-start"
                          type="button"
                          :aria-label="`调整${phaseLabel(phase)}开始日期`"
                          @pointerdown="startResize($event, phase, 'start')"
                        />
                        <span>
                          <strong>{{ phaseLabel(phase) }}</strong>
                          <small>
                            {{ windowFor(phase).start.slice(5) }}–{{
                              windowFor(phase).end.slice(5)
                            }}
                            · {{ phaseProgress(phase) }}
                          </small>
                        </span>
                        <button
                          class="phase-block__handle is-end"
                          type="button"
                          :aria-label="`调整${phaseLabel(phase)}截止日期`"
                          @pointerdown="startResize($event, phase, 'end')"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    v-if="!group.phases.length"
                    type="button"
                    class="empty-project-plan"
                    @click="openNewPhase(group.project.id)"
                  >
                    <Icon icon="ph:plus-circle" width="18" />
                    添加第一个项目环节
                  </button>
                </div>
              </article>
            </template>

            <div v-if="!projectGroups.length" class="creator-empty">
              <Icon icon="ph:path" width="26" />
              <strong>{{ todayOnly ? '今天没有执行中的项目环节' : '暂无可显示的项目' }}</strong>
              <span>{{
                todayOnly ? '切换为全部轨道查看完整项目周期。' : '先在项目管理中建立项目。'
              }}</span>
            </div>
          </div>
        </div>
      </section>

      <aside v-if="route.path === '/today'" class="today-task-list creator-panel">
        <header>
          <div>
            <h2>今天要完成</h2>
            <p>{{ todayDoneCount }}/{{ todayPhases.length }} 已完成</p>
          </div>
          <span>{{ todayProgress }}%</span>
        </header>
        <div v-if="todayProjectGroups.length" class="today-task-list__groups">
          <section v-for="group in todayProjectGroups" :key="group.project.id">
            <header>
              <strong>{{ group.project.name }}</strong>
              <span>{{ group.phases.length }} 项</span>
            </header>
            <button
              v-for="phase in group.phases"
              :key="phase.id"
              type="button"
              :class="{ 'is-done': isPhaseDone(phase) }"
              @click="openPhaseEditor(phase)"
            >
              <Icon :icon="isPhaseDone(phase) ? 'ph:check-circle-fill' : 'ph:circle'" width="18" />
              <span>
                <strong>{{ phaseLabel(phase) }}</strong>
                <small>
                  {{ phase.start.slice(5) }}–{{ phase.end.slice(5) }} ·
                  {{ phaseProgress(phase) }}
                </small>
              </span>
            </button>
          </section>
        </div>
        <div v-else class="today-task-list__empty">
          <Icon icon="ph:check-circle-duotone" width="30" />
          <strong>今天没有排入项目环节</strong>
          <span>完整轨道会保留项目的全部计划。</span>
        </div>
      </aside>
    </div>

    <NewProjectPhaseDialog
      :open="newPhaseOpen"
      :initial-project-id="newPhaseProjectId"
      @close="closeNewPhase"
      @created="handlePhaseCreated"
    />
    <ScheduleBlockEditorDialog
      :open="Boolean(editingBlockId)"
      :block-id="editingBlockId"
      @close="editingBlockId = ''"
      @saved="editingBlockId = ''"
    />

    <div
      v-if="contextMenu"
      class="track-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      role="menu"
      @pointerdown.stop
    >
      <template v-if="contextMenu.kind === 'phase'">
        <button type="button" role="menuitem" @click="editPhaseFromMenu">
          <Icon icon="ph:calendar-blank" width="12" />
          修改时间设定
        </button>
        <button type="button" role="menuitem" class="is-danger" @click="deletePhaseFromMenu">
          <Icon icon="ph:trash" width="11" />
          删除时间条
        </button>
      </template>
      <button
        v-else
        type="button"
        role="menuitem"
        @click="openNewPhase(contextMenu.projectId)"
      >
        <span aria-hidden="true">+</span>
        添加项目环节
        <kbd>N</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  @use './creator-theme';

  .creator-heading__actions {
    display: flex;
    gap: 8px;
    align-items: center;

    :deep(.el-select) {
      width: 220px;
    }
  }

  .today-overview {
    display: grid;
    grid-template-columns: auto minmax(160px, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    margin-bottom: 12px;
    color: var(--creator-muted);
    background: var(--creator-surface);
    border: 1px solid var(--creator-line);
    border-radius: 12px;

    > div:first-child {
      display: grid;
      gap: 2px;

      span {
        font-size: 10px;
        color: var(--creator-faint);
      }

      strong {
        font-size: 12px;
        color: var(--creator-deep);
      }
    }

    > span {
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    > button {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      color: var(--creator-muted);
      cursor: pointer;
      background: var(--creator-surface-soft);
      border: 1px solid var(--creator-line);
      border-radius: 8px;

      &.is-active {
        color: var(--dojo-accent);
        background: var(--dojo-paper-muted);
        border-color: #cbdaf8;
      }
    }
  }

  .today-overview__progress {
    height: 7px;
    overflow: hidden;
    background: var(--creator-surface-soft);
    border-radius: 4px;

    i {
      display: block;
      height: 100%;
      background: var(--creator-cyan);
      border-radius: inherit;
    }
  }

  .execution-brief {
    margin-bottom: 13px;
    background: var(--creator-surface);
    border: 1px solid var(--creator-line);
    border-radius: 12px;
  }

  .execution-brief__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: 61px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--creator-line);

    h2 {
      margin: 0;
      color: var(--creator-deep);
      font-size: 13px;
    }

    p {
      margin: 4px 0 0;
      color: var(--creator-faint);
      font-size: 11px;
    }

    > button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0;
      color: var(--dojo-accent);
      background: transparent;
      border: 0;
      font-size: 11px;
      cursor: pointer;
    }
  }

  .execution-brief__rows {
    display: grid;
  }

  .execution-brief__rows article {
    display: grid;
    grid-template-columns: minmax(180px, 1.15fr) minmax(160px, 1fr) minmax(180px, 1.1fr) 150px 32px;
    gap: 15px;
    align-items: center;
    min-height: 76px;
    padding: 9px 12px;
    border-top: 1px solid var(--creator-line);

    &:first-child {
      border-top: 0;
    }
  }

  .execution-brief__identity {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
    padding: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    > span:first-child {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      color: var(--dojo-accent);
      background: var(--dojo-paper-muted);
      border-radius: 9px;
      font-size: 10px;
      font-weight: 750;

      &.is-overdue {
        color: #a33f4a;
        background: #fff0f1;
      }

      &.is-upcoming {
        color: #785419;
        background: #fff7e8;
      }

      &.is-complete {
        color: #19705e;
        background: #eaf7f3;
      }
    }

    > span:last-child {
      display: grid;
      min-width: 0;
      gap: 4px;
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: var(--creator-deep);
      font-size: 11px;
    }

    small {
      color: var(--creator-faint);
      font-size: 11px;
    }
  }

  .execution-brief__cell {
    display: grid;
    min-width: 0;
    gap: 4px;

    small,
    span {
      color: var(--creator-faint);
      font-size: 10px;
    }

    strong,
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: var(--creator-deep);
      font-size: 10px;
      font-weight: 650;
    }
  }

  .execution-brief__kpi {
    display: grid;
    gap: 7px;

    > span {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    small {
      color: var(--creator-faint);
      font-size: 10px;
    }

    strong {
      color: var(--creator-deep);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    > div {
      height: 4px;
      overflow: hidden;
      background: var(--creator-surface-soft);
      border-radius: 3px;

      i {
        display: block;
        height: 100%;
        background: var(--dojo-accent);
        border-radius: inherit;
      }
    }
  }

  .execution-brief__go {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    padding: 0;
    color: var(--dojo-accent);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 8px;

    &:hover,
    &:focus-visible {
      background: var(--dojo-paper-muted);
      outline: none;
    }
  }

  .execution-brief__empty {
    padding: 18px 14px;
    color: var(--creator-faint);
    font-size: 10px;
  }

  .timeline-status {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--creator-muted);

    > span {
      padding: 7px 10px;
      font-size: 10px;
      background: var(--creator-surface-soft);
      border: 1px solid var(--creator-line);
      border-radius: 8px;

      strong {
        margin-right: 3px;
        color: var(--creator-deep);
        font-variant-numeric: tabular-nums;
      }

      &.has-risk strong {
        color: #b5474f;
      }
    }

    p {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      margin: 0 0 0 auto;
      font-size: 10px;
    }
  }

  .phase-inspector {
    padding: 12px;
    margin-bottom: 12px;
    background: var(--dojo-paper-muted);
    border: 1px solid var(--creator-line);
    border-radius: 12px;
  }

  .phase-inspector__editor {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto 16px auto auto auto;
    gap: 10px;
    align-items: end;

    > div,
    label {
      display: grid;
      gap: 4px;
    }

    small,
    label span {
      font-size: 10px;
      color: var(--creator-faint);
    }

    > div strong {
      overflow: hidden;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    input,
    button {
      min-height: 34px;
      border-radius: 8px;

      > span {
        font-size: 18px;
        line-height: 1;
      }
    }

    input {
      padding: 0 9px;
      color: var(--creator-deep);
      background: var(--creator-surface);
      border: 1px solid var(--creator-line);
    }

    button {
      padding: 0 11px;
      color: #fff;
      cursor: pointer;
      background: var(--creator-deep);
      border: 0;

      &.is-quiet {
        color: var(--creator-muted);
        background: transparent;
        border: 1px solid var(--creator-line);
      }
    }
  }

  .phase-inspector__guide {
    display: grid;
    grid-template-columns: minmax(210px, 1.2fr) minmax(180px, 1fr) minmax(150px, 0.8fr) auto;
    gap: 18px;
    align-items: center;
    padding-top: 11px;
    margin-top: 11px;
    border-top: 1px solid var(--creator-line);

    > div {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    small,
    span {
      color: var(--creator-faint);
      font-size: 10px;
    }

    strong,
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: var(--creator-deep);
      font-size: 10px;
    }

    > button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-height: 32px;
      padding: 0 10px;
      color: var(--dojo-accent);
      cursor: pointer;
      background: var(--creator-surface);
      border: 1px solid #cbdaf8;
      border-radius: 8px;
      font-size: 11px;
    }
  }

  .timeline-workspace {
    display: grid;
    min-width: 0;

    &.is-today {
      grid-template-columns: minmax(0, 1fr) 310px;
      gap: 14px;
    }
  }

  .timeline-board {
    min-width: 0;
    min-height: 620px;
    overflow: hidden;
  }

  :global(body.is-timeline-dragging) {
    cursor: grabbing;
    user-select: none;
  }

  .timeline-board__scroll {
    min-height: 620px;
    max-height: calc(100dvh - 168px);
    overflow: auto;
    cursor: grab;
    scrollbar-color: #9caabc #e5e9ef;

    &.is-panning {
      cursor: grabbing;
      user-select: none;
    }
  }

  .timeline-board__canvas {
    min-width: calc(250px + var(--timeline-width));
  }

  .timeline-axis-row,
  .timeline-plan-row {
    display: grid;
    grid-template-columns: 250px var(--timeline-width);
  }

  .timeline-axis-row {
    position: sticky;
    top: 0;
    z-index: 8;
    min-height: 58px;
    background: var(--creator-surface);
    border-bottom: 1px solid var(--creator-line);
  }

  .timeline-axis-row__identity,
  .timeline-plan-row__identity {
    position: sticky;
    left: 0;
    z-index: 5;
    background: var(--creator-surface);
    border-right: 1px solid var(--creator-line);
  }

  .timeline-axis-row__identity {
    display: grid;
    gap: 3px;
    align-content: center;
    padding: 0 17px;

    strong {
      font-size: 11px;
    }

    small {
      font-size: 10px;
      color: var(--creator-faint);
    }
  }

  .timeline-axis,
  .timeline-lane__days,
  .timeline-lane__phases {
    display: grid;
    grid-template-columns: repeat(auto-fill, 64px);
  }

  .timeline-axis > span {
    display: grid;
    place-items: center;
    align-content: center;
    border-right: 1px solid var(--creator-line);

    small {
      font-size: 7px;
      color: var(--creator-faint);
    }

    strong {
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    &.is-weekend {
      background: #f2f4f7;
    }

    &.is-today {
      color: var(--dojo-accent);
      background: var(--dojo-paper-muted);
    }
  }

  .timeline-project-row {
    position: sticky;
    left: 0;
    z-index: 6;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    width: calc(250px + var(--timeline-width));
    min-height: 36px;
    padding: 0 16px;
    color: #f7fbff;
    background: linear-gradient(90deg, var(--dojo-accent-strong), var(--dojo-accent));
    box-shadow: inset 0 -1px rgb(255 255 255 / 16%);

    > span {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      font-size: 11px;
      font-weight: 650;

      i {
        width: 7px;
        height: 7px;
        background: var(--creator-cyan);
        border-radius: 3px;
      }
    }

    > div {
      display: flex;
      gap: 8px;
      align-items: center;

      strong {
        font-size: 11px;
        color: #d9e7ff;
        font-variant-numeric: tabular-nums;
      }

      button {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        padding: 0;
        color: #e7edf5;
        cursor: pointer;
        background: rgb(255 255 255 / 8%);
        border: 0;
        border-radius: 7px;
      }
    }
  }

  .timeline-plan-row {
    border-bottom: 1px solid var(--creator-line);
  }

  .timeline-plan-row__identity {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 9px 14px 9px 17px;

    > span:first-child {
      display: grid;
      gap: 2px;
      min-width: 0;

      strong {
        font-size: 10px;
      }

      em {
        font-size: 10px;
        font-style: normal;
        color: var(--creator-faint);
      }
    }
  }

  .project-progress {
    font-size: 10px;
    font-weight: 700;
    color: var(--dojo-accent);
    font-variant-numeric: tabular-nums;
  }

  .project-plan-actions {
    display: flex;
    gap: 8px;
    align-items: center;

    button {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      color: var(--dojo-accent);
      cursor: pointer;
      background: var(--dojo-paper-muted);
      border: 1px solid #c8d9f7;
      border-radius: 8px;
    }

    button > span:first-child {
      font-size: 16px;
      line-height: 1;
      text-align: center;
    }
  }

  .timeline-plan-row__tracks {
    position: relative;
    display: grid;
    align-content: center;

    &:focus-visible {
      outline: 2px solid #4d78d8;
      outline-offset: -2px;
    }
  }

  .timeline-lane {
    position: relative;
    min-height: 48px;

    &.is-drop-target {
      background: #edf4ff;
      box-shadow:
        inset 0 1px #c8d9f7,
        inset 0 -1px #c8d9f7;
    }

    &:empty::after,
    &.is-spare::after {
      position: absolute;
      inset: 10px 12px;
      content: '';
      pointer-events: none;
      border: 1px dashed transparent;
      border-radius: 8px;
    }
  }

  .timeline-lane__days,
  .timeline-lane__phases {
    position: absolute;
    inset: 0;
  }

  .timeline-lane__days i {
    border-right: 1px solid var(--creator-line);

    &.is-weekend {
      background: #f7f8fa;
    }

    &.is-today {
      background: #f1f6ff;
      box-shadow: inset 1px 0 #b9cef6;
    }
  }

  .timeline-lane__phases {
    z-index: 2;
    align-items: center;
    pointer-events: none;
  }

  .phase-block {
    position: relative;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 4px;
    align-items: center;
    min-width: 0;
    min-height: 34px;
    padding: 3px 9px 3px 6px;
    margin: 0 2px;
    overflow: hidden;
    color: #264863;
    pointer-events: auto;
    touch-action: none;
    cursor: grab;
    background: #dce9f4;
    border: 1px solid #9fb9cf;
    border-radius: 3px;
    transition:
      box-shadow 120ms ease-out,
      opacity 120ms ease-out,
      transform 120ms ease-out;

    &:active {
      cursor: grabbing;
    }

    &:focus-visible {
      outline: 2px solid #4d78d8;
      outline-offset: 1px;
    }

    &.is-dragging {
      z-index: 8;
      cursor: grabbing;
      box-shadow: 0 12px 28px rgb(31 67 117 / 20%);
      opacity: 0.9;
      transform: scale(1.015);
    }

    &.phase-accounts {
      color: #4f5966;
      background: #e5e8ec;
      border-color: #bdc4cd;
    }

    &.phase-shoot {
      color: #6a405f;
      background: #ead8e5;
      border-color: #c7a9bf;
    }

    &.phase-edit {
      color: #56436f;
      background: #e4dcf0;
      border-color: #b9a7cf;
    }

    &.phase-distribute {
      color: #35655a;
      background: #d5e7e0;
      border-color: #9fc4b6;
    }

    &.phase-ads {
      color: #655327;
      background: #efe4bd;
      border-color: #cdbb7d;
    }

    &.is-done {
      color: #737d89;
      background: #dfe3e8;
      border-color: #bac2cc;

      strong {
        text-decoration: line-through;
      }
    }

    > span {
      display: grid;
      gap: 1px;
      min-width: 0;
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 10px;
    }

    small {
      font-size: 7px;
      font-variant-numeric: tabular-nums;
      opacity: 0.76;
    }
  }

  .phase-block__check {
    display: grid;
    place-items: center;
    width: 18px;
    height: 24px;
    padding: 0;
    color: currentcolor;
    background: transparent;
  }

  .phase-block__handle {
    position: absolute;
    top: 3px;
    bottom: 3px;
    width: 11px;
    padding: 0;
    touch-action: none;
    cursor: ew-resize;
    background: transparent;
    border: 0;

    &::after {
      position: absolute;
      top: 50%;
      left: 5px;
      width: 1px;
      height: 14px;
      content: '';
      background: currentcolor;
      opacity: 0.35;
      transform: translateY(-50%);
    }

    &.is-start {
      left: 0;
    }

    &.is-end {
      right: 0;
    }
  }

  .track-context-menu {
    position: fixed;
    z-index: 3200;
    min-width: 148px;
    padding: 4px;
    background: var(--creator-surface);
    border: 1px solid var(--creator-line);
    border-radius: 8px;
    box-shadow: 0 12px 28px rgb(21 33 50 / 14%);

    button {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      width: 100%;
      min-height: 26px;
      padding: 0 7px;
      font-size: 11px;
      font-weight: 550;
      line-height: 1.2;
      color: var(--creator-deep);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 6px;

      &:hover,
      &:focus-visible {
        background: var(--creator-surface-soft);
        outline: none;
      }

      &.is-danger {
        min-height: 24px;
        font-size: 10px;
        color: #a53f49;
      }
    }

    kbd {
      padding: 1px 4px;
      font: inherit;
      font-size: 9px;
      color: var(--creator-faint);
      background: var(--creator-surface-soft);
      border: 1px solid var(--creator-line);
      border-radius: 4px;
    }
  }

  .empty-project-plan {
    position: absolute;
    top: 50%;
    left: 18px;
    z-index: 3;
    display: inline-flex;
    gap: 7px;
    align-items: center;
    padding: 7px 10px;
    color: var(--creator-muted);
    cursor: pointer;
    background: var(--creator-surface-soft);
    border: 1px dashed var(--creator-line);
    border-radius: 8px;
    transform: translateY(-50%);
  }

  .today-task-list {
    display: flex;
    flex-direction: column;
    min-height: 620px;
    padding: 16px;

    > header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 13px;
      border-bottom: 1px solid var(--creator-line);

      h2 {
        margin: 0;
        font-size: 15px;
      }

      p {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--creator-faint);
      }

      > span {
        font-size: 18px;
        font-weight: 750;
        color: var(--dojo-accent);
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .today-task-list__groups {
    display: grid;
    gap: 16px;
    margin-top: 14px;

    section > header {
      display: flex;
      justify-content: space-between;
      padding-bottom: 8px;
      font-size: 11px;

      span {
        color: var(--creator-faint);
      }
    }

    section > button {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      width: 100%;
      padding: 10px 2px;
      color: var(--dojo-accent);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-bottom: 1px solid var(--creator-line);

      > span {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      strong {
        overflow: hidden;
        font-size: 10px;
        color: var(--creator-deep);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 10px;
        color: var(--creator-faint);
        font-variant-numeric: tabular-nums;
      }

      &.is-done {
        color: var(--creator-faint);

        strong {
          color: var(--creator-faint);
          text-decoration: line-through;
        }
      }
    }
  }

  .today-task-list__empty {
    display: grid;
    gap: 7px;
    place-items: center;
    min-height: 220px;
    color: var(--creator-faint);
    text-align: center;

    strong {
      color: var(--creator-muted);
    }
  }

  @media (max-width: 1080px) {
    .execution-brief__rows article {
      grid-template-columns: minmax(180px, 1.15fr) minmax(160px, 1fr) 150px 32px;
    }

    .execution-brief__cell:nth-of-type(2) {
      display: none;
    }

    .timeline-workspace.is-today {
      grid-template-columns: 1fr;
    }

    .today-task-list {
      min-height: auto;
    }
  }

  @media (max-width: 760px) {
    .creator-heading__actions {
      width: 100%;

      :deep(.el-select) {
        flex: 1;
        width: auto;
      }
    }

    .today-overview {
      grid-template-columns: 1fr auto;

      .today-overview__progress {
        grid-row: 2;
        grid-column: 1 / -1;
      }
    }

    .phase-inspector__editor {
      grid-template-columns: 1fr 1fr;

      > div {
        grid-column: 1 / -1;
      }

      > svg {
        display: none;
      }
    }

    .phase-inspector__guide {
      grid-template-columns: 1fr 1fr;

      > button {
        width: 100%;
      }
    }

    .execution-brief__head {
      align-items: flex-start;
    }

    .execution-brief__rows article {
      grid-template-columns: minmax(0, 1fr) 30px;
      gap: 10px;
    }

    .execution-brief__cell,
    .execution-brief__kpi {
      grid-column: 1 / -1;
      padding-left: 44px;
    }

    .execution-brief__go {
      grid-row: 1;
      grid-column: 2;
    }

    .timeline-axis-row,
    .timeline-plan-row {
      grid-template-columns: 190px var(--timeline-width);
    }

    .timeline-board__canvas {
      min-width: calc(190px + var(--timeline-width));
    }

    .timeline-project-row {
      width: calc(190px + var(--timeline-width));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .phase-block {
      transition: none;
    }
  }
</style>
