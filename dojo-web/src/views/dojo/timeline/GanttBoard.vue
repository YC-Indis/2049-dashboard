<template>
  <div class="tl">
    <div class="tl__chrome">
      <div class="tl__zoom">
        <button
          v-for="z in zooms"
          :key="z.value"
          type="button"
          class="tl__zoom-btn"
          :class="{ active: scale === z.value }"
          @click="scale = z.value"
        >
          {{ z.label }}
        </button>
      </div>
      <div class="tl__chrome-right">
        <span class="tl__meta">{{ projectCount }} projects</span>
        <button type="button" class="tl__today-btn" @click="scrollToToday">Today</button>
      </div>
    </div>

    <div v-if="dragPreview" class="tl__drag-hud">
      <strong>{{ dragPreview.name }}</strong>
      <span>{{ dragPreview.startLabel }} → {{ dragPreview.endLabel }}</span>
      <em>{{ dragPreview.days }} 天</em>
    </div>
    <div v-else-if="cursorDate" class="tl__cursor-hud">{{ formatHudDate(cursorDate) }}</div>

    <div class="tl__viewport" :class="{ 'is-dragging': !!drag }">
      <aside class="tl__list">
        <div class="tl__list-head">Project / Phase</div>
        <div
          v-for="row in rows"
          :key="`n-${row.id}`"
          class="tl__list-row"
          :class="{
            active: activeId === row.id || activeId === row.projectId,
            'is-phase': row.kind === 'phase',
            'is-project': row.kind === 'project'
          }"
          @click="onListClick(row)"
        >
          <template v-if="row.kind === 'project'">
            <button
              type="button"
              class="tl__expand"
              :class="{ open: !!expanded[row.projectId] }"
              aria-label="展开细项"
              @click.stop="toggleExpand(row.projectId)"
            >
              <span class="tl__expand-chevron" />
            </button>
            <i class="tl__status" :style="{ background: row.phaseColor }" />
            <div class="tl__list-text">
              <strong>{{ row.name }}</strong>
              <span>
                <em v-if="row.overdue">Overdue · </em>{{ row.phaseLabel }} · {{ row.progressPct }}%
                <template v-if="row.childCount"> · {{ row.childCount }} 细项</template>
              </span>
            </div>
            <button
              type="button"
              class="tl__add"
              title="加细项时间条"
              @click.stop="openAdd(row.projectId)"
            >
              +
            </button>
          </template>
          <template v-else>
            <span class="tl__indent" />
            <i class="tl__status" :style="{ background: row.phaseColor }" />
            <div class="tl__list-text">
              <strong>{{ row.name }}</strong>
              <span>{{ md(row.start) }} → {{ md(row.end) }}</span>
            </div>
            <button
              type="button"
              class="tl__del"
              title="删除细项"
              @click.stop="removePhase(row)"
            >
              ×
            </button>
          </template>
        </div>
        <p v-if="!rows.length" class="tl__empty-side">No projects with cycle dates</p>
      </aside>

      <div class="tl__board">
        <div ref="headScroller" class="tl__chrono">
          <div class="tl__chrono-inner" :style="canvasStyle">
            <div
              v-for="m in monthBands"
              :key="m.key"
              class="tl__band"
              :style="{ left: `${m.left}px`, width: `${m.width}px` }"
            >
              {{ m.label }}
            </div>
            <div class="tl__ticks">
              <div
                v-for="t in tickLabels"
                :key="t.key"
                class="tl__tick"
                :class="{ today: t.key === todayKey }"
                :style="{ left: `${t.left + pxPerDay / 2}px` }"
              >
                {{ t.label }}
              </div>
            </div>
          </div>
        </div>

        <div
          ref="scroller"
          class="tl__scroll"
          :class="{ panning }"
          @pointerdown="startPan"
          @pointermove="onBoardHover"
          @pointerleave="cursorX = null"
          @wheel="onWheel"
          @scroll="onScroll"
        >
          <div class="tl__sheet" :style="sheetStyle">
            <div
              v-if="todayLeft != null"
              class="tl__today"
              :style="{ left: `${todayLeft}px` }"
            />
            <div
              v-if="cursorX != null && !drag"
              class="tl__cursor"
              :style="{ left: `${cursorX}px` }"
            />
            <!-- 吸附日高亮：拖拽时对准「哪一天」 -->
            <div
              v-if="snapDayLeft != null"
              class="tl__day-snap"
              :style="{ left: `${snapDayLeft}px`, width: `${pxPerDay}px` }"
            />

            <div
              v-for="row in rows"
              :key="row.id"
              class="tl__row"
              :class="{
                active: activeId === row.id || activeId === row.projectId,
                'is-phase': row.kind === 'phase'
              }"
              @click="activeId = row.id"
            >
              <div
                class="tl__bar"
                :class="{
                  dragging: drag?.id === row.id,
                  overdue: row.overdue,
                  done: row.phaseKey === 'done',
                  'is-phase': row.kind === 'phase',
                  'is-light': row.phaseKey === 'ads' || row.phaseKey === 'approve'
                }"
                :style="barStyle(row)"
                :title="row.tip"
                @pointerdown.stop="onBarDown($event, row, 'move')"
              >
                <i
                  class="tl__handle tl__handle--l"
                  @pointerdown.stop="onBarDown($event, row, 'start')"
                />
                <div class="tl__progress" :style="{ width: `${row.progressPct}%` }" />
                <div class="tl__bar-label">
                  <span class="tl__bar-name">
                    {{
                      drag?.id === row.id && dragPreview
                        ? `${dragPreview.startLabel} → ${dragPreview.endLabel}`
                        : row.name
                    }}
                  </span>
                  <span v-if="row.kind === 'project' && !(drag?.id === row.id)" class="tl__bar-pct">
                    {{ row.progressPct }}%
                  </span>
                  <span v-else-if="drag?.id === row.id && dragPreview" class="tl__bar-pct">
                    {{ dragPreview.days }}d
                  </span>
                </div>
                <i
                  class="tl__handle tl__handle--r"
                  @pointerdown.stop="onBarDown($event, row, 'end')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!rows.length" class="tl__empty">暂无项目周期。请先在项目总览设置起止日期。</p>

    <ElDialog
      v-model="addVisible"
      title="添加细项时间条"
      width="420px"
      destroy-on-close
      @closed="resetAdd"
    >
      <p class="add-tip">选一个步骤，落在项目周期内；不必一次加满。</p>
      <ElForm label-width="72px">
        <ElFormItem label="步骤">
          <ElSelect v-model="addPhaseKey" placeholder="选择步骤" style="width: 100%">
            <ElOption
              v-for="p in addPhaseOptions"
              :key="p.key"
              :label="p.label"
              :value="p.key"
            >
              <span class="opt-dot" :style="{ background: p.color }" />
              {{ p.label }}
              <span v-if="p.target" class="opt-meta">目标 {{ p.target }}</span>
            </ElOption>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="区间">
          <ElDatePicker
            v-model="addRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="addVisible = false">取消</ElButton>
        <ElButton type="primary" :disabled="!addPhaseKey" @click="confirmAdd">添加</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { dojoProjectStore, matchesProjectIds } from '@/store/dojoProjectStore'
  import {
    getProjectRuntime,
    plannedScripts,
    projectRuntimeRevision,
    type ProjectRuntime
  } from '@/store/dojoProjectRuntime'
  import {
    addProjectPhaseBar,
    applyPhaseDates,
    applyProjectCycle,
    availablePhasesToAdd,
    listProjectPhaseBlocks,
    overallKpiProgressPct,
    phaseKeyFromBlockId,
    PLAN_PHASE_META,
    removeProjectPhaseBar,
    type PlanPhaseKey
  } from '@/store/dojoKpiSchedule'
  import { dojoScheduleStore } from '@/store/dojoScheduleStore'
  import { addDays, DOJO_TODAY, daysBetween } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoGanttBoard' })

  const props = defineProps<{ projectId?: string; projectIds?: string[] }>()

  const ROW_H = 44
  const todayKey = DOJO_TODAY
  const DAY_MS = 86400000
  /** 最短工期：1 天，方便精确拉到某一天 */
  const MIN_SPAN_DAYS = 1

  type Scale = 'week' | 'month' | 'quarter'
  type DragMode = 'move' | 'start' | 'end'

  interface TimelineRow {
    id: string
    kind: 'project' | 'phase'
    projectId: string
    name: string
    start: string
    end: string
    phaseKey: string
    phaseLabel: string
    phaseColor: string
    progressPct: number
    overdue: boolean
    priority: number
    tip: string
    childCount?: number
    left: number
    width: number
  }

  const zooms: Array<{ value: Scale; label: string }> = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' }
  ]

  const PHASE_COLORS: Record<string, string> = {
    accounts: '#8E8E93',
    scripts: '#5E6AD2',
    shoot: '#FF9F0A',
    edit: '#FF375F',
    approve: '#64D2FF',
    distribute: '#32ADE6',
    ads: '#FFD60A',
    done: '#30D158',
    cycle: '#5E6AD2'
  }

  const PHASE_LABEL: Record<string, string> = Object.fromEntries([
    ...PLAN_PHASE_META.map((p) => [p.key, p.label]),
    ['approve', '过审'],
    ['done', 'Done'],
    ['cycle', '周期']
  ])

  /** 默认 Week：天更宽，拖拽好对准 */
  const scale = ref<Scale>('week')
  const activeId = ref('')
  const scroller = ref<HTMLElement | null>(null)
  const headScroller = ref<HTMLElement | null>(null)
  const panning = ref(false)
  const cursorX = ref<number | null>(null)
  /** projectId → 是否展开细项行 */
  const expanded = ref<Record<string, boolean>>({})

  const addVisible = ref(false)
  const addProjectId = ref('')
  const addPhaseKey = ref<PlanPhaseKey | ''>('')
  const addRange = ref<[string, string] | null>(null)

  const drag = ref<{
    id: string
    kind: 'project' | 'phase'
    projectId: string
    phaseKey?: string
    mode: DragMode
    originX: number
    start: string
    end: string
    baseLeft: number
    baseWidth: number
  } | null>(null)
  const dragDx = ref(0)

  let panStart = { x: 0, scroll: 0 }
  let panRaf = 0
  let pendingPanX = 0
  let dragRaf = 0
  let pendingDragX = 0

  /** 天列加宽：拖拽好对准，时间轴更有「拉长」的沉浸感 */
  const pxPerDay = computed(() => {
    if (scale.value === 'week') return 36
    if (scale.value === 'month') return 16
    return 6
  })

  function formatHudDate(date: string) {
    if (!date) return ''
    const [, m, d] = date.split('-')
    return `${Number(m)}/${Number(d)}`
  }

  function previewRange(mode: DragMode, start: string, end: string, dayDelta: number) {
    let nextStart = start
    let nextEnd = end
    if (mode === 'move') {
      nextStart = addDays(start, dayDelta)
      nextEnd = addDays(end, dayDelta)
    } else if (mode === 'start') {
      nextStart = addDays(start, dayDelta)
      if (nextStart > nextEnd) nextStart = nextEnd
      const span = daysBetween(nextStart, nextEnd) + 1
      if (span < MIN_SPAN_DAYS) nextStart = addDays(nextEnd, -(MIN_SPAN_DAYS - 1))
    } else {
      nextEnd = addDays(end, dayDelta)
      if (nextEnd < nextStart) nextEnd = nextStart
      const span = daysBetween(nextStart, nextEnd) + 1
      if (span < MIN_SPAN_DAYS) nextEnd = addDays(nextStart, MIN_SPAN_DAYS - 1)
    }
    return { start: nextStart, end: nextEnd }
  }

  const filterIds = computed(() => {
    if (props.projectIds !== undefined) return props.projectIds
    if (props.projectId) return [props.projectId]
    return dojoProjectStore.selectedIds
  })

  const exactIds = computed(() => props.projectIds !== undefined)

  function currentPhase(rt: ProjectRuntime) {
    const scriptT = plannedScripts(rt.kpi)
    const stages = [
      { key: 'scripts', label: '脚本', done: rt.current.scripts, target: scriptT },
      { key: 'accounts', label: '起号', done: rt.current.accounts, target: rt.kpi.accounts },
      { key: 'shoot', label: '拍摄', done: Math.min(rt.current.edited, rt.kpi.videos), target: rt.kpi.videos },
      { key: 'edit', label: '剪辑', done: rt.current.edited, target: rt.kpi.videos },
      { key: 'distribute', label: '分发', done: rt.current.distributed, target: rt.kpi.videos },
      { key: 'ads', label: '投放', done: rt.current.exposure, target: rt.kpi.exposure }
    ]
    for (const s of stages) {
      if (s.target > 0 && s.done < s.target) {
        return { key: s.key, label: s.label, color: PHASE_COLORS[s.key] }
      }
    }
    return { key: 'done', label: 'Done', color: PHASE_COLORS.done }
  }

  function priorityRank(p: string) {
    if (p === 'high') return 0
    if (p === 'medium') return 1
    return 2
  }

  function md(date: string) {
    return date.slice(5).replace('-', '/')
  }

  function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function toggleExpand(projectId: string) {
    expanded.value = {
      ...expanded.value,
      [projectId]: !expanded.value[projectId]
    }
  }

  function onListClick(row: TimelineRow) {
    activeId.value = row.id
    if (row.kind === 'project' && !expanded.value[row.projectId]) {
      expanded.value = { ...expanded.value, [row.projectId]: true }
    }
  }

  const projectBases = computed(() => {
    void projectRuntimeRevision.value
    void dojoScheduleStore.revision
    const ids = filterIds.value
    const list = dojoProjectStore.projects
      .filter((p) => {
        if (p.active === false) return false
        if (exactIds.value) return ids.includes(p.id)
        return matchesProjectIds(p.id, ids)
      })
      .map((p) => {
        const rt = getProjectRuntime(p.id)
        const start = rt?.kpi.cycleStart
        const end = rt?.kpi.cycleEnd
        if (!rt || !start || !end) return null
        const phase = currentPhase(rt)
        const progressPct = overallKpiProgressPct(rt)
        const span = Math.max(1, daysBetween(start, end) + 1)
        const overdue = end < todayKey && phase.key !== 'done' && rt.runStatus !== '完结'
        const children = listProjectPhaseBlocks(p.id)
        return {
          id: p.id,
          kind: 'project' as const,
          projectId: p.id,
          name: p.name,
          start,
          end,
          phaseKey: phase.key,
          phaseLabel: phase.label,
          phaseColor: phase.color,
          progressPct,
          overdue,
          priority: priorityRank(rt.priority),
          childCount: children.length,
          tip: [
            p.name,
            `${start} → ${end}（${span}d）`,
            `综合 ${progressPct}% · 展开后可加脚本/起号/拍摄等细项`
          ].join('\n'),
          children
        }
      })
      .filter(Boolean) as Array<{
      id: string
      kind: 'project'
      projectId: string
      name: string
      start: string
      end: string
      phaseKey: string
      phaseLabel: string
      phaseColor: string
      progressPct: number
      overdue: boolean
      priority: number
      childCount: number
      tip: string
      children: ReturnType<typeof listProjectPhaseBlocks>
    }>

    list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.start.localeCompare(b.start)
    })
    return list
  })

  const projectCount = computed(() => projectBases.value.length)

  const flatRows = computed(() => {
    const out: Array<Omit<TimelineRow, 'left' | 'width'>> = []
    for (const p of projectBases.value) {
      out.push({
        id: p.id,
        kind: 'project',
        projectId: p.projectId,
        name: p.name,
        start: p.start,
        end: p.end,
        phaseKey: p.phaseKey,
        phaseLabel: p.phaseLabel,
        phaseColor: p.phaseColor,
        progressPct: p.progressPct,
        overdue: p.overdue,
        priority: p.priority,
        tip: p.tip,
        childCount: p.childCount
      })
      if (!expanded.value[p.projectId]) continue
      for (const b of p.children) {
        const key = phaseKeyFromBlockId(b.id, p.projectId) || 'other'
        const label = PHASE_LABEL[key] || b.title
        const color = PHASE_COLORS[key] || '#9b9b9f'
        const pct =
          b.target && b.target > 0
            ? Math.min(100, Math.round(((b.done || 0) / b.target) * 100))
            : 0
        out.push({
          id: b.id,
          kind: 'phase',
          projectId: p.projectId,
          name: label,
          start: b.start,
          end: b.end,
          phaseKey: key,
          phaseLabel: label,
          phaseColor: color,
          progressPct: pct,
          overdue: b.end < todayKey && pct < 100,
          priority: p.priority,
          tip: [`${p.name} · ${label}`, `${b.start} → ${b.end}`, b.title].join('\n')
        })
      }
    }
    return out
  })

  const bounds = computed(() => {
    const list = flatRows.value
    let min = list[0]?.start ?? todayKey
    let max = list[0]?.end ?? todayKey
    for (const r of list) {
      if (r.start < min) min = r.start
      if (r.end > max) max = r.end
    }
    if (todayKey < min) min = todayKey
    if (todayKey > max) max = todayKey
    // 两侧多留空白，滚动时像走进一条长轴
    const pad = scale.value === 'quarter' ? 45 : scale.value === 'month' ? 28 : 21
    return { min: addDays(min, -pad), max: addDays(max, pad) }
  })

  const rangeStart = computed(() => bounds.value.min)
  const rangeEnd = computed(() => bounds.value.max)
  const dayCount = computed(() => Math.max(1, daysBetween(rangeStart.value, rangeEnd.value) + 1))
  const totalWidth = computed(() => dayCount.value * pxPerDay.value)

  function offsetOf(date: string) {
    return Math.max(0, daysBetween(rangeStart.value, date)) * pxPerDay.value
  }

  const rows = computed<TimelineRow[]>(() => {
    const px = pxPerDay.value
    return flatRows.value.map((r) => {
      const left = offsetOf(r.start)
      const span = Math.max(MIN_SPAN_DAYS, daysBetween(r.start, r.end) + 1)
      return { ...r, left, width: Math.max(px * MIN_SPAN_DAYS, span * px) }
    })
  })

  /** 拖拽位移按整天吸附，避免条在「半天上」晃 */
  const snappedDx = computed(() => {
    if (!drag.value) return 0
    return Math.round(dragDx.value / pxPerDay.value) * pxPerDay.value
  })

  const dragDayDelta = computed(() => {
    if (!drag.value) return 0
    return Math.round(dragDx.value / pxPerDay.value)
  })

  const dragPreview = computed(() => {
    const d = drag.value
    if (!d) return null
    const { start, end } = previewRange(d.mode, d.start, d.end, dragDayDelta.value)
    const row = rows.value.find((r) => r.id === d.id)
    return {
      name: row?.name || '',
      start,
      end,
      startLabel: formatHudDate(start),
      endLabel: formatHudDate(end),
      days: Math.max(1, daysBetween(start, end) + 1)
    }
  })

  const cursorDate = computed(() => {
    if (cursorX.value == null) return ''
    const idx = Math.max(0, Math.min(dayCount.value - 1, Math.floor(cursorX.value / pxPerDay.value)))
    return addDays(rangeStart.value, idx)
  })

  /** 高亮当前对准的「天」列（拖拽边 / 光标） */
  const snapDayLeft = computed(() => {
    const px = pxPerDay.value
    if (drag.value && dragPreview.value) {
      const edge =
        drag.value.mode === 'end'
          ? dragPreview.value.end
          : drag.value.mode === 'start'
            ? dragPreview.value.start
            : dragPreview.value.start
      return offsetOf(edge)
    }
    if (cursorDate.value) return offsetOf(cursorDate.value)
    return null
  })

  const monthBands = computed(() => {
    const out: Array<{ key: string; label: string; left: number; width: number }> = []
    const px = pxPerDay.value
    let t = new Date(`${rangeStart.value}T00:00:00`).getTime()
    const end = new Date(`${rangeEnd.value}T00:00:00`).getTime()
    let i = 0
    while (t <= end) {
      const d = new Date(t)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const last = out[out.length - 1]
      if (last && last.key === key) last.width += px
      else {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec'
        ]
        out.push({
          key,
          label: `${months[d.getMonth()]} ${d.getFullYear()}`,
          left: i * px,
          width: px
        })
      }
      t += DAY_MS
      i++
    }
    return out
  })

  const tickLabels = computed(() => {
    const px = pxPerDay.value
    const out: Array<{ key: string; label: string; left: number; width: number }> = []
    let t = new Date(`${rangeStart.value}T00:00:00`).getTime()
    const end = new Date(`${rangeEnd.value}T00:00:00`).getTime()
    let i = 0
    while (t <= end) {
      const d = new Date(t)
      const key = iso(d)
      let show = false
      let label = String(d.getDate())
      if (scale.value === 'week') {
        // 每天都标日期，周一补星期
        show = true
        const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
        label = d.getDay() === 1 || i === 0 ? `${d.getDate()}·${wd}` : String(d.getDate())
      } else if (scale.value === 'month') {
        show =
          d.getDate() === 1 ||
          d.getDate() % 2 === 1 ||
          key === todayKey ||
          i === 0
        if (d.getDate() === 1) label = `${d.getMonth() + 1}/${d.getDate()}`
      } else {
        show = d.getDate() === 1 || d.getDate() === 15 || key === todayKey || i === 0
        if (d.getDate() === 1) label = `${d.getMonth() + 1}月`
      }
      if (show) out.push({ key, label, left: i * px, width: px })
      t += DAY_MS
      i++
    }
    return out
  })

  const todayLeft = computed(() => {
    if (todayKey < rangeStart.value || todayKey > rangeEnd.value) return null
    return offsetOf(todayKey)
  })

  const canvasStyle = computed(() => ({
    width: `${totalWidth.value}px`,
    minWidth: `${totalWidth.value}px`
  }))

  const sheetStyle = computed(() => ({
    width: `${totalWidth.value}px`,
    minWidth: `${totalWidth.value}px`,
    minHeight: `${Math.max(rows.value.length, 1) * ROW_H}px`,
    ['--day-px' as string]: `${pxPerDay.value}px`
  }))

  function barStyle(row: TimelineRow) {
    const d = drag.value
    const dx = snappedDx.value
    const minW = pxPerDay.value * MIN_SPAN_DAYS
    const base: Record<string, string> = {
      left: `${row.left}px`,
      width: `${row.width}px`,
      background: row.phaseColor,
      transform: 'translate3d(0,0,0)',
      transition:
        d?.id === row.id
          ? 'none'
          : 'left .2s cubic-bezier(.25,.1,.25,1), width .2s cubic-bezier(.25,.1,.25,1)'
    }
    if (!d || d.id !== row.id) return base
    if (d.mode === 'move') {
      return { ...base, transform: `translate3d(${dx}px,0,0)`, willChange: 'transform' }
    }
    if (d.mode === 'start') {
      const shiftX = Math.min(dx, d.baseWidth - minW)
      return {
        ...base,
        left: `${d.baseLeft}px`,
        width: `${Math.max(minW, d.baseWidth - shiftX)}px`,
        transform: `translate3d(${shiftX}px,0,0)`,
        willChange: 'transform,width'
      }
    }
    return {
      ...base,
      width: `${Math.max(minW, d.baseWidth + dx)}px`,
      willChange: 'width'
    }
  }

  function onBoardHover(e: PointerEvent) {
    if (!scroller.value || drag.value || panning.value) return
    const rect = scroller.value.getBoundingClientRect()
    cursorX.value = e.clientX - rect.left + scroller.value.scrollLeft
  }

  function onBarDown(e: PointerEvent, row: TimelineRow, mode: DragMode) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    activeId.value = row.id
    cursorX.value = null
    dragDx.value = 0
    pendingDragX = e.clientX
    drag.value = {
      id: row.id,
      kind: row.kind,
      projectId: row.projectId,
      phaseKey: row.kind === 'phase' ? row.phaseKey : undefined,
      mode,
      originX: e.clientX,
      start: row.start,
      end: row.end,
      baseLeft: row.left,
      baseWidth: row.width
    }
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize'
    document.body.style.userSelect = 'none'
    try {
      ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    window.addEventListener('pointermove', onBarMove)
    window.addEventListener('pointerup', onBarUp)
  }

  function maybeAutoScroll(clientX: number) {
    const el = scroller.value
    if (!el || !drag.value) return
    const rect = el.getBoundingClientRect()
    const edge = 56
    const step = Math.max(pxPerDay.value, 24)
    if (clientX < rect.left + edge) el.scrollLeft -= step
    else if (clientX > rect.right - edge) el.scrollLeft += step
  }

  function onBarMove(e: PointerEvent) {
    pendingDragX = e.clientX
    maybeAutoScroll(e.clientX)
    if (dragRaf) return
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0
      if (!drag.value) return
      dragDx.value = pendingDragX - drag.value.originX
    })
  }

  function onBarUp(e?: PointerEvent) {
    if (dragRaf) {
      cancelAnimationFrame(dragRaf)
      dragRaf = 0
    }
    const d = drag.value
    const clientX = e?.clientX ?? pendingDragX
    const dx = d ? clientX - d.originX : 0
    drag.value = null
    dragDx.value = 0
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onBarMove)
    window.removeEventListener('pointerup', onBarUp)
    if (!d) return
    const dayDelta = Math.round(dx / pxPerDay.value)
    const { start, end } = previewRange(d.mode, d.start, d.end, dayDelta)
    if (start === d.start && end === d.end) return
    if (d.kind === 'phase' && d.phaseKey) {
      applyPhaseDates(d.projectId, d.phaseKey as PlanPhaseKey, start, end)
    } else {
      applyProjectCycle(d.projectId, start, end)
    }
  }

  const addPhaseOptions = computed(() => {
    if (!addProjectId.value) return []
    return availablePhasesToAdd(addProjectId.value)
  })

  function openAdd(projectId: string) {
    expanded.value = { ...expanded.value, [projectId]: true }
    addProjectId.value = projectId
    const rt = getProjectRuntime(projectId)
    const start = rt?.kpi.cycleStart || todayKey
    const end = rt?.kpi.cycleEnd || start
    addRange.value = [start, addDays(start, Math.min(6, daysBetween(start, end)))]
    const opts = availablePhasesToAdd(projectId)
    addPhaseKey.value = opts[0]?.key || ''
    if (!opts.length) {
      ElMessage.info('六个步骤都已添加，可直接拖条改期')
      return
    }
    addVisible.value = true
  }

  function resetAdd() {
    addProjectId.value = ''
    addPhaseKey.value = ''
    addRange.value = null
  }

  function confirmAdd() {
    if (!addProjectId.value || !addPhaseKey.value) return
    const block = addProjectPhaseBar(addProjectId.value, addPhaseKey.value, {
      start: addRange.value?.[0],
      end: addRange.value?.[1]
    })
    if (block) {
      ElMessage.success(`已添加「${PHASE_LABEL[addPhaseKey.value] || addPhaseKey.value}」时间条`)
      expanded.value = { ...expanded.value, [addProjectId.value]: true }
      activeId.value = block.id
    }
    addVisible.value = false
  }

  function removePhase(row: TimelineRow) {
    if (row.kind !== 'phase') return
    const key = phaseKeyFromBlockId(row.id, row.projectId)
    if (!key || key === 'cycle') return
    removeProjectPhaseBar(row.projectId, key)
    ElMessage.success('已删除细项条')
  }

  function onScroll() {
    if (!scroller.value || !headScroller.value) return
    headScroller.value.scrollLeft = scroller.value.scrollLeft
  }

  function startPan(e: PointerEvent) {
    if (!scroller.value || e.button !== 0) return
    if ((e.target as HTMLElement).closest('.tl__bar')) return
    if ((e.target as HTMLElement).closest('.tl__handle')) return
    panning.value = true
    panStart = { x: e.clientX, scroll: scroller.value.scrollLeft }
    scroller.value.setPointerCapture(e.pointerId)
    window.addEventListener('pointermove', onPan)
    window.addEventListener('pointerup', endPan)
  }

  function onPan(e: PointerEvent) {
    if (!panning.value || !scroller.value) return
    pendingPanX = panStart.scroll - (e.clientX - panStart.x)
    if (panRaf) return
    panRaf = requestAnimationFrame(() => {
      panRaf = 0
      if (scroller.value) scroller.value.scrollLeft = pendingPanX
    })
  }

  function endPan() {
    panning.value = false
    if (panRaf) {
      cancelAnimationFrame(panRaf)
      panRaf = 0
    }
    window.removeEventListener('pointermove', onPan)
    window.removeEventListener('pointerup', endPan)
  }

  function onWheel(e: WheelEvent) {
    if (!scroller.value) return
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault()
      scroller.value.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX
    }
  }

  function scrollToToday() {
    if (!scroller.value || todayLeft.value == null) return
    const w = Math.max(120, scroller.value.clientWidth)
    scroller.value.scrollTo({
      left: Math.max(0, todayLeft.value - w * 0.28),
      behavior: 'smooth'
    })
  }

  onMounted(() => {
    // 有细项的项目默认展开，方便看见结构
    const next: Record<string, boolean> = { ...expanded.value }
    projectBases.value.forEach((p) => {
      if (p.childCount) next[p.projectId] = true
    })
    expanded.value = next
    nextTick(scrollToToday)
    window.addEventListener('resize', onScroll)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onScroll)
    endPan()
    onBarUp()
  })

  watch(scale, () => nextTick(scrollToToday))
</script>

<style scoped lang="scss">
  $line: color-mix(in srgb, var(--el-border-color) 55%, transparent);
  $muted: var(--el-text-color-secondary);
  $bg: var(--el-bg-color);
  $soft: color-mix(in srgb, var(--el-fill-color-lighter) 88%, $bg);
  $accent: #5e6ad2;
  $list-w: 268px;
  $row-h: 44px;
  $chrono-h: 56px;
  $ease: cubic-bezier(0.25, 0.1, 0.25, 1);

  .tl {
    position: relative;
    border: 1px solid $line;
    border-radius: 18px;
    background:
      linear-gradient(180deg, color-mix(in srgb, $soft 55%, $bg) 0%, $bg 48px),
      $bg;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgb(15 23 42 / 3%),
      0 12px 32px rgb(15 23 42 / 5%);
    font-feature-settings: 'ss01' on, 'cv11' on;
    -webkit-font-smoothing: antialiased;
  }

  .tl__chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid color-mix(in srgb, $line 70%, transparent);
    background: transparent;
  }

  .tl__zoom {
    display: inline-flex;
    padding: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, $soft 90%, rgb(0 0 0 / 3%));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, $line 80%, transparent);
  }

  .tl__zoom-btn {
    border: 0;
    background: transparent;
    color: $muted;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: -0.01em;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 0.18s $ease,
      color 0.18s $ease,
      box-shadow 0.18s $ease;

    &.active {
      background: $bg;
      color: var(--el-text-color-primary);
      box-shadow:
        0 1px 2px rgb(15 23 42 / 6%),
        0 0 0 1px color-mix(in srgb, $line 50%, transparent);
    }

    &:hover:not(.active) {
      color: var(--el-text-color-primary);
    }
  }

  .tl__chrome-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tl__meta {
    font-size: 12px;
    color: $muted;
    letter-spacing: -0.01em;
  }

  .tl__today-btn {
    border: 0;
    background: color-mix(in srgb, $accent 10%, $bg);
    color: $accent;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: -0.01em;
    padding: 7px 14px;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 0.18s $ease,
      transform 0.18s $ease;

    &:hover {
      background: color-mix(in srgb, $accent 16%, $bg);
    }

    &:active {
      transform: scale(0.98);
    }
  }

  .tl__cursor-hud,
  .tl__drag-hud {
    position: absolute;
    z-index: 20;
    top: 58px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: 999px;
    background: rgb(28 28 30 / 90%);
    backdrop-filter: blur(10px);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    pointer-events: none;
    box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
    white-space: nowrap;
  }

  .tl__drag-hud {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;

    strong {
      font-weight: 600;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    span {
      opacity: 0.92;
    }

    em {
      font-style: normal;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgb(255 255 255 / 14%);
      color: #c7c7ff;
      font-weight: 600;
      font-size: 11px;
    }
  }

  .tl__viewport {
    display: flex;
    height: min(78vh, 820px);
    min-height: 440px;

    &.is-dragging {
      cursor: grabbing;

      .tl__bar {
        transition: none !important;
      }
    }
  }

  .tl__list {
    flex: 0 0 $list-w;
    width: $list-w;
    border-right: 1px solid color-mix(in srgb, $line 75%, transparent);
    background: color-mix(in srgb, $soft 35%, $bg);
    overflow: auto;
  }

  .tl__list-head {
    position: sticky;
    top: 0;
    z-index: 2;
    height: $chrono-h;
    padding: 0 16px 12px;
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid color-mix(in srgb, $line 70%, transparent);
    background: color-mix(in srgb, $soft 45%, $bg);
    backdrop-filter: blur(8px);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: $muted;
  }

  .tl__list-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: $row-h;
    margin: 2px 8px;
    padding: 0 8px 0 6px;
    border: 0;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.16s $ease;

    &:hover {
      background: color-mix(in srgb, $soft 90%, transparent);
    }

    &.active {
      background: color-mix(in srgb, $accent 9%, $bg);
    }

    &.is-phase {
      margin-left: 12px;
      background: transparent;

      &:hover,
      &.active {
        background: color-mix(in srgb, $soft 70%, transparent);
      }
    }
  }

  .tl__expand {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    border-radius: 999px;
    background: color-mix(in srgb, $soft 80%, transparent);
    cursor: pointer;
    transition:
      background 0.16s $ease,
      transform 0.16s $ease;

    &:hover {
      background: color-mix(in srgb, $accent 12%, $soft);
    }

    &.open {
      background: color-mix(in srgb, $accent 14%, $bg);

      .tl__expand-chevron {
        transform: rotate(90deg);
        border-color: $accent;
      }
    }
  }

  .tl__expand-chevron {
    width: 6px;
    height: 6px;
    border-right: 1.5px solid $muted;
    border-bottom: 1.5px solid $muted;
    transform: rotate(-45deg);
    margin-left: -1px;
    transition:
      transform 0.18s $ease,
      border-color 0.18s $ease;
  }

  .tl__indent {
    flex: 0 0 22px;
  }

  .tl__add,
  .tl__del {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, $soft 85%, transparent);
    color: $muted;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    transition:
      background 0.16s $ease,
      color 0.16s $ease,
      transform 0.16s $ease;

    &:hover {
      color: $accent;
      background: color-mix(in srgb, $accent 12%, $bg);
      transform: scale(1.04);
    }
  }

  .tl__del:hover {
    color: #ff375f;
    background: color-mix(in srgb, #ff375f 10%, $bg);
  }

  .tl__status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 3px rgb(15 23 42 / 5%);
  }

  .tl__list-text {
    min-width: 0;
    flex: 1;
    overflow: hidden;

    strong {
      display: block;
      font-size: 13px;
      font-weight: 560;
      letter-spacing: -0.015em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    span {
      display: block;
      margin-top: 1px;
      font-size: 11px;
      color: $muted;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    em {
      font-style: normal;
      color: #ff453a;
      font-weight: 600;
    }
  }

  .tl__empty-side {
    margin: 28px 18px;
    font-size: 12px;
    line-height: 1.5;
    color: $muted;
  }

  .tl__board {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .tl__chrono {
    flex-shrink: 0;
    height: $chrono-h;
    overflow: hidden;
    border-bottom: 1px solid color-mix(in srgb, $line 70%, transparent);
    background: color-mix(in srgb, $soft 28%, $bg);
  }

  .tl__chrono-inner {
    position: relative;
    height: 100%;
  }

  .tl__band {
    position: absolute;
    top: 8px;
    height: 18px;
    padding-left: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--el-text-color-regular);
    border-left: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .tl__ticks {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 22px;
  }

  .tl__tick {
    position: absolute;
    bottom: 6px;
    font-size: 10px;
    color: color-mix(in srgb, $muted 88%, transparent);
    text-align: center;
    white-space: nowrap;
    transform: translateX(-50%);
    pointer-events: none;

    &.today {
      color: $accent;
      font-weight: 700;
    }
  }

  .tl__scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    cursor: grab;
    background: $bg;

    &.panning {
      cursor: grabbing;
    }
  }

  .tl__sheet {
    position: relative;
    background-image: repeating-linear-gradient(
      to right,
      transparent 0,
      transparent calc(var(--day-px) - 1px),
      color-mix(in srgb, $line 35%, transparent) calc(var(--day-px) - 1px),
      color-mix(in srgb, $line 35%, transparent) var(--day-px)
    );
  }

  .tl__today {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 2px;
    margin-left: -1px;
    background: linear-gradient(180deg, $accent, color-mix(in srgb, $accent 55%, transparent));
    pointer-events: none;
    box-shadow: 0 0 12px color-mix(in srgb, $accent 35%, transparent);

    &::before {
      content: '';
      position: absolute;
      top: 4px;
      left: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: $accent;
      box-shadow: 0 0 0 3px color-mix(in srgb, $accent 22%, transparent);
    }
  }

  .tl__cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 3;
    width: 1px;
    background: color-mix(in srgb, #1c1c1e 28%, transparent);
    pointer-events: none;
  }

  .tl__day-snap {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    pointer-events: none;
    background: color-mix(in srgb, $accent 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, $accent 22%, transparent);
  }

  .tl__row {
    position: relative;
    height: $row-h;
    border-bottom: 1px solid color-mix(in srgb, $line 28%, transparent);

    &.active {
      background: color-mix(in srgb, $accent 4.5%, transparent);
    }

    &.is-phase {
      background: color-mix(in srgb, $soft 22%, transparent);
    }
  }

  .tl__bar {
    position: absolute;
    top: 12px;
    z-index: 4;
    height: 20px;
    border-radius: 999px;
    color: #fff;
    cursor: grab;
    overflow: hidden;
    touch-action: none;
    box-shadow:
      0 1px 2px rgb(15 23 42 / 7%),
      inset 0 1px 0 rgb(255 255 255 / 22%);
    transition:
      box-shadow 0.18s $ease,
      filter 0.18s $ease,
      opacity 0.18s $ease;

    &.is-phase {
      top: 14px;
      height: 16px;
      opacity: 0.94;
      box-shadow:
        0 1px 2px rgb(15 23 42 / 5%),
        inset 0 1px 0 rgb(255 255 255 / 16%);
    }

    &.dragging {
      z-index: 8;
      cursor: grabbing;
      filter: saturate(1.05);
      box-shadow:
        0 10px 24px rgb(15 23 42 / 18%),
        inset 0 1px 0 rgb(255 255 255 / 22%);
    }

    &.overdue {
      box-shadow:
        0 0 0 2px color-mix(in srgb, #ff453a 45%, transparent),
        0 1px 2px rgb(15 23 42 / 8%);
    }

    &.done {
      opacity: 0.68;
      filter: saturate(0.85);
    }

    &.is-light {
      color: #1c1c1e;

      .tl__bar-name {
        text-shadow: none;
      }

      .tl__progress {
        background: linear-gradient(90deg, rgb(0 0 0 / 10%), rgb(0 0 0 / 4%));
      }

      .tl__handle::after {
        background: rgb(28 28 30 / 45%);
      }
    }

    &:hover .tl__handle {
      opacity: 1;
    }
  }

  .tl__progress {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 0;
    border-radius: 999px 0 0 999px;
    background: linear-gradient(90deg, rgb(255 255 255 / 28%), rgb(255 255 255 / 12%));
    pointer-events: none;
  }

  .tl__bar-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 100%;
    padding: 0 11px 0 12px;
    pointer-events: none;
    overflow: hidden;
  }

  .tl__bar-name {
    font-size: 11px;
    font-weight: 560;
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 1px rgb(0 0 0 / 12%);
  }

  .tl__bar-pct {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 500;
    opacity: 0.88;
    font-variant-numeric: tabular-nums;
  }

  .tl__handle {
    position: absolute;
    top: 0;
    z-index: 5;
    width: 12px;
    height: 100%;
    cursor: ew-resize;
    opacity: 0;
    background: transparent;
    transition: opacity 0.16s $ease;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 3px;
      height: 8px;
      margin-top: -4px;
      border-radius: 999px;
      background: rgb(255 255 255 / 72%);
    }

    &--l {
      left: 0;

      &::after {
        left: 5px;
      }
    }

    &--r {
      right: 0;

      &::after {
        right: 5px;
      }
    }
  }

  .tl__empty {
    margin: 0;
    padding: 32px 18px;
    text-align: center;
    color: $muted;
    font-size: 13px;
    letter-spacing: -0.01em;
  }

  .add-tip {
    margin: 0 0 12px;
    color: $muted;
    font-size: 13px;
    line-height: 1.55;
  }

  .opt-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 50%;
    vertical-align: middle;
  }

  .opt-meta {
    margin-left: 8px;
    color: $muted;
    font-size: 12px;
  }
</style>
