<template>
  <div class="gantt">
    <div class="gantt__toolbar">
      <div class="gantt__filters">
        <div class="gantt__field">
          <span>分组</span>
          <ElSelect
            v-model="groupBy"
            size="default"
            class="gantt__select"
            style="width: 140px"
            teleported
          >
            <ElOption v-for="g in groupOptions" :key="g.value" :label="g.label" :value="g.value" />
          </ElSelect>
        </div>
        <div class="gantt__field">
          <span>来源</span>
          <ElSelect
            v-model="sourceFilter"
            size="default"
            class="gantt__select"
            clearable
            placeholder="全部"
            style="width: 140px"
            teleported
          >
            <ElOption label="全部" value="" />
            <ElOption v-for="s in sources" :key="s" :label="s" :value="s" />
          </ElSelect>
        </div>
        <div class="gantt__field">
          <span>状态</span>
          <ElSelect
            v-model="statusFilter"
            size="default"
            class="gantt__select"
            clearable
            placeholder="全部"
            style="width: 140px"
            teleported
          >
            <ElOption label="全部" value="" />
            <ElOption v-for="s in statuses" :key="s" :label="s" :value="s" />
          </ElSelect>
        </div>
        <ElInput v-model="keyword" placeholder="搜索项目 / 地区 / 产品" clearable style="width: 200px" />
      </div>
      <div class="gantt__actions">
        <ElRadioGroup v-model="interactMode" size="default">
          <ElRadioButton value="pan">浏览平移</ElRadioButton>
          <ElRadioButton value="box">框选排期</ElRadioButton>
        </ElRadioGroup>
        <span class="gantt__hint">
          {{
            interactMode === 'box'
              ? '在任意轨道行上按住拖拽，松手即可按所选日期添加任务'
              : '按住轨道空白处拖动平移；Shift+滚轮横向滚动'
          }}
        </span>
        <ElButton size="default" @click="scrollToContent">看全部条</ElButton>
        <ElButton size="default" @click="scrollToToday">回到今天</ElButton>
      </div>
    </div>

    <div class="gantt__legend">
      <span v-for="l in legend" :key="l.key" class="gantt__legend-item">
        <i :style="{ background: l.color }" />{{ l.label }}
      </span>
      <span class="gantt__legend-item">
        <i style="background: #a78bfa" />自建排期
      </span>
      <span class="gantt__legend-count">
        {{ trackRowCount }} 条轨道 · {{ rangeStart }} → {{ rangeEnd }}
      </span>
    </div>

    <div class="gantt__viewport">
      <div class="gantt__sticky-head">
        <div class="gantt__names-head">类目 / 项目</div>
        <div ref="headScroller" class="gantt__head-track">
          <div class="gantt__head" :style="canvasStyle">
            <div class="gantt__months">
              <div
                v-for="m in months"
                :key="m.key"
                class="gantt__month"
                :style="{ left: `${m.left}px`, width: `${m.width}px` }"
              >
                {{ m.label }}
              </div>
            </div>
            <div class="gantt__days">
              <div
                v-for="d in days"
                :key="d.key"
                class="gantt__day"
                :class="{ weekend: d.weekend, today: d.key === todayKey }"
                :style="{ width: `${PX}px` }"
              >
                {{ d.dom }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref="scroller"
        class="gantt__sheet-scroll"
        :class="{ panning, 'gantt__sheet-scroll--box': interactMode === 'box' }"
        @pointerdown="startPan"
        @wheel="onWheel"
        @scroll="onScroll"
      >
        <div class="gantt__sheet" :style="sheetStyle">
          <div
            v-if="todayLeft != null"
            class="gantt__today-sheet"
            :style="{ left: `${NAME_W + todayLeft}px` }"
          />

          <template v-for="row in displayRows" :key="`line-${row.key}`">
            <div class="gantt__line" :class="{ 'gantt__line--group': row.type === 'group' }">
              <div v-if="row.type === 'group'" class="gantt__name-cell gantt__name-cell--group">
                {{ row.label }}
                <em>{{ row.count }}</em>
              </div>
              <div v-else class="gantt__name-cell" :class="{ active: activeId === row.item.id }">
                <i class="gantt__dot" :style="{ background: colorOf(row.item) }" />
                <div class="gantt__name-text">
                  <strong :title="row.item.name">{{ row.item.name }}</strong>
                  <span>{{ row.item.unscheduled ? '待排期' : `${md(row.item.start)}–${md(row.item.end)}` }}</span>
                </div>
                <button
                  v-if="offscreenOf(row.item)"
                  type="button"
                  class="gantt__name-jump"
                  @click="jumpTo(row.item)"
                >
                  {{ offscreenOf(row.item) === 'left' ? '‹' : '›' }}
                </button>
              </div>

              <div
                v-if="row.type === 'group'"
                class="gantt__track-cell gantt__track-cell--group"
                :style="trackCellStyle"
              />
              <div
                v-else
                class="gantt__track-cell"
                :style="trackCellStyle"
                :class="{
                  'gantt__track-cell--boxable': interactMode === 'box',
                  'gantt__track-cell--boxing': boxSel && boxSel.itemId === row.item.id
                }"
                @pointerdown="onRowPointerDown($event, row.item)"
              >
                <div class="gantt__rail" />
                <div
                  v-if="boxSel && boxSel.itemId === row.item.id"
                  class="gantt__box"
                  :style="boxStyle"
                >
                  <span class="gantt__box-label">{{ boxDateLabel }}</span>
                </div>
                <button
                  v-if="offscreenOf(row.item)"
                  type="button"
                  class="gantt__jump"
                  :class="offscreenOf(row.item)"
                  :style="jumpStyle(row.item)"
                  @pointerdown.stop
                  @click="jumpTo(row.item)"
                >
                  <template v-if="offscreenOf(row.item) === 'left'">
                    ‹ {{ md(row.item.start) }}–{{ md(row.item.end) }}
                  </template>
                  <template v-else> {{ md(row.item.start) }}–{{ md(row.item.end) }} › </template>
                </button>
                <div
                  v-if="!row.item.unscheduled && !row.item.laneOnly"
                  class="gantt__bar"
                  :class="{ active: activeId === row.item.id, custom: row.item.source === '自建排期' }"
                  :style="barStyle(row.item)"
                  :title="tooltip(row.item)"
                  @pointerdown.stop
                  @click="select(row.item)"
                >
                  <span v-if="row.item.progress != null" class="gantt__fill" :style="fillStyle(row.item)" />
                  <span class="gantt__bar-date">{{ md(row.item.start) }}</span>
                  <span class="gantt__bar-label">{{ row.item.name }}</span>
                  <span class="gantt__bar-date">{{ md(row.item.end) }}</span>
                </div>
                <div
                  v-else-if="row.item.unscheduled && !row.item.laneOnly"
                  class="gantt__slot"
                  :style="{ left: `${offsetOf(row.item.start)}px` }"
                  title="未排期"
                >
                  待排期
                </div>
                <div v-if="row.item.laneOnly" class="gantt__lane-hint">空轨道 · 拖拽框选添加任务</div>
                <div
                  v-if="!row.item.unscheduled && !row.item.laneOnly"
                  class="gantt__meta"
                  :style="{ left: `${offsetOf(row.item.end) + PX + 10}px` }"
                >
                  {{ metaOf(row.item) }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <p v-if="!items.length" class="gantt__empty">没有符合筛选条件的项目</p>

    <ElDialog v-model="taskDialog" title="在框选区间添加任务" width="480px" destroy-on-close>
      <ElForm label-width="88px">
        <ElFormItem label="项目">
          <ElSelect v-model="taskForm.projectId" filterable style="width: 100%">
            <ElOption v-for="p in activeProjects" :key="p.id" :label="p.name" :value="p.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="时间">
          <span>{{ taskForm.start }} → {{ taskForm.end }}</span>
        </ElFormItem>
        <ElFormItem label="任务名">
          <ElInput v-model="taskForm.title" placeholder="如：脚本拍摄 / 分发窗口" />
        </ElFormItem>
        <ElFormItem label="类型">
          <ElSelect v-model="taskForm.type" style="width: 100%">
            <ElOption label="脚本" value="script" />
            <ElOption label="分发" value="publish" />
            <ElOption label="投放" value="ad" />
            <ElOption label="里程碑" value="milestone" />
            <ElOption label="其他" value="other" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="taskForm.note" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="taskDialog = false">取消</ElButton>
        <ElButton type="primary" :loading="aiConfirming" @click="confirmAddTask">
          添加并由 AI 确认同步
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="aiDialog" title="AI 二次确认 · 日历 / 时间规划" width="520px">
      <p class="ai-confirm-text">{{ aiConfirmText }}</p>
      <template #footer>
        <ElButton type="primary" @click="aiDialog = false">知道了</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { chatAgent } from '@/api/llm'
  import { workflowStages } from '@/mock/dojo/imported'
  import { adTimeline } from '@/mock/dojo/imported/ads'
  import { dojoProjectStore, matchProjectText, matchesProjectIds, getProjectById } from '@/store/dojoProjectStore'
  import { addScheduleBlock, dojoScheduleStore } from '@/store/dojoScheduleStore'

  defineOptions({ name: 'DojoGanttBoard' })

  const props = defineProps<{ projectId?: string; projectIds?: string[] }>()

  /** 每天固定 30px，面板始终是大尺寸，靠横向滚动看更长的时间跨度 */
  const PX = 30
  const NAME_W = 240
  const DAY = 86400000
  const todayKey = '2026-08-07'

  interface GanttItem {
    id: string
    name: string
    sub: string
    source: string
    owner: string
    region: string
    product: string
    project: string
    projectId: string
    status: string
    start: string
    end: string
    /** 0–1，投放项目为播放达成率，里程碑为阶段完成度 */
    progress: number | null
    metaText: string
    /** Excel 里没有任何日期标记的节点，画在今天位置上提示要补排期 */
    unscheduled?: boolean
    /** 项目空轨道：只占一行供框选 */
    laneOnly?: boolean
  }

  const interactMode = ref<'pan' | 'box'>('box')
  const taskDialog = ref(false)
  const aiDialog = ref(false)
  const aiConfirming = ref(false)
  const aiConfirmText = ref('')
  const taskForm = reactive({
    projectId: '',
    start: '',
    end: '',
    title: '',
    type: 'other' as 'script' | 'publish' | 'ad' | 'milestone' | 'other',
    note: ''
  })

  type BoxSel = { itemId: string; projectId: string; x0: number; x1: number }
  const boxSel = ref<BoxSel | null>(null)

  const MILESTONE_PROGRESS: Record<string, number> = {
    已完成: 1,
    进行中: 0.5,
    待确认: 0.9,
    未开始: 0
  }

  function fmtNum(n: number | null | undefined) {
    if (n == null) return '—'
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
    return String(n)
  }

  /** 程序侧梳理：纠正起止颠倒、空日期；不做 AI 决策，只修显示 */
  function normalizeRange(start?: string | null, end?: string | null) {
    let s = (start || '').trim()
    let e = (end || '').trim()
    const unscheduled = !s || !e
    if (unscheduled) return { start: todayKey, end: todayKey, unscheduled: true as const }
    if (s > e) [s, e] = [e, s]
    return { start: s, end: e, unscheduled: false as const }
  }

  function resolveProject(text: string) {
    const hit = dojoProjectStore.projects.find((p) => matchProjectText(text, p))
    return hit || dojoProjectStore.projects.find((p) => p.id === 'dojo')!
  }

  const activeProjects = computed(() =>
    dojoProjectStore.projects.filter((p) => p.active !== false)
  )

  const filterIds = computed(() => {
    if (props.projectIds?.length) return props.projectIds
    if (props.projectId) return [props.projectId]
    if (dojoProjectStore.selectedIds.length) return dojoProjectStore.selectedIds
    return [] as string[]
  })

  const projectLanes = computed(() => {
    const ids = filterIds.value
    if (ids.length) return activeProjects.value.filter((p) => ids.includes(p.id))
    return activeProjects.value
  })

  const milestoneItems: GanttItem[] = workflowStages.map((s) => {
    const range = normalizeRange(s.startDate, s.endDate)
    const proj = resolveProject(`dojo ${s.name}`)
    return {
      id: `MS-${s.id}`,
      name: s.name,
      sub: s.owner || '未指派',
      source: '内容流转',
      owner: s.owner || '未指派',
      region: '—',
      product: '—',
      project: proj.name,
      projectId: proj.id,
      status: s.status,
      start: range.start,
      end: range.end,
      progress: range.unscheduled ? null : (MILESTONE_PROGRESS[s.status] ?? null),
      metaText: range.unscheduled ? '未填日期' : s.statusLabel || s.status,
      unscheduled: range.unscheduled
    }
  })

  const adItems: GanttItem[] = adTimeline.map((t) => {
    const range = normalizeRange(t.startDate, t.endDate)
    const proj = resolveProject(`${t.name} ${t.project}`)
    return {
      id: t.id,
      name: t.name,
      sub: [t.product, t.videoCount ? `${t.videoCount} 条` : ''].filter(Boolean).join(' · '),
      source: '投放项目',
      owner: '投流组',
      region: t.region || '未标注',
      product: t.product || '未标注',
      project: proj.name,
      projectId: proj.id,
      status: t.status,
      start: range.start,
      end: range.end,
      progress: t.viewsRate,
      metaText:
        t.viewsRate != null
          ? `${Math.round(t.viewsRate * 100)}% · ${fmtNum(t.currentViews)}/${fmtNum(t.targetViews)}`
          : '无播放数据',
      unscheduled: range.unscheduled
    }
  })

  const scheduleItems = computed<GanttItem[]>(() =>
    dojoScheduleStore.blocks.map((b) => ({
      id: b.id,
      name: b.title,
      sub: b.note || b.type,
      source: '自建排期',
      owner: '运营',
      region: '—',
      product: '—',
      project: b.projectName,
      projectId: b.projectId,
      status: '进行中',
      start: b.start,
      end: b.end,
      progress: 0.3,
      metaText: `来源：${b.source}`,
      unscheduled: false
    }))
  )

  const allItems = computed(() => {
    const ids = filterIds.value
    const showMilestones = !ids.length || ids.includes('dojo')
    const milestones = showMilestones ? milestoneItems : []
    const ads = adItems.filter(
      (i) => !ids.length || ids.includes(i.projectId) || ids.some((id) => matchProjectText(`${i.name} ${i.product}`, getProjectById(id)))
    )
    const customs = scheduleItems.value.filter((i) => matchesProjectIds(i.projectId, ids))
    const base = [...milestones, ...ads, ...customs]

    // 每个项目至少保留一条空轨道，方便框选排期（剪辑时间线体验）
    const present = new Set(base.map((i) => i.projectId))
    const lanes: GanttItem[] = []
    for (const p of projectLanes.value) {
      if (!present.has(p.id)) {
        lanes.push({
          id: `LANE-${p.id}`,
          name: `${p.name} · 轨道`,
          sub: '空轨道',
          source: '项目轨道',
          owner: '—',
          region: '—',
          product: '—',
          project: p.name,
          projectId: p.id,
          status: '未开始',
          start: todayKey,
          end: todayKey,
          progress: null,
          metaText: '可框选添加',
          unscheduled: true,
          laneOnly: true
        })
      }
    }
    return [...base, ...lanes]
  })

  const groupOptions = [
    { label: '按项目', value: 'project' },
    { label: '按来源', value: 'source' },
    { label: '按状态', value: 'status' },
    { label: '按投放地区', value: 'region' },
    { label: '按产品', value: 'product' },
    { label: '按负责方', value: 'owner' },
    { label: '不分组', value: 'none' }
  ] as const

  const groupBy = ref<(typeof groupOptions)[number]['value']>('project')
  const sourceFilter = ref('')
  const statusFilter = ref('')
  const keyword = ref('')
  const activeId = ref('')

  const sources = computed(() => [...new Set(allItems.value.map((i) => i.source))])
  const statuses = computed(() => [...new Set(allItems.value.map((i) => i.status))])

  const legend = [
    { key: 'done', label: '已完成 / 已达标', color: '#22c55e' },
    { key: 'doing', label: '进行中', color: '#4a90d9' },
    { key: 'wait', label: '待确认', color: '#f59e0b' },
    { key: 'risk', label: '逾期未达标', color: '#ef4444' },
    { key: 'none', label: '未开始', color: '#94a3b8' }
  ]

  const items = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return allItems.value.filter((i) => {
      if (i.laneOnly) return true
      if (sourceFilter.value && i.source !== sourceFilter.value) return false
      if (statusFilter.value && i.status !== statusFilter.value) return false
      if (kw && !`${i.name} ${i.region} ${i.product} ${i.sub} ${i.project}`.toLowerCase().includes(kw))
        return false
      return true
    })
  })

  const displayRows = computed(() => {
    const list = [...items.value].sort((a, b) => {
      if (a.project !== b.project) return a.project.localeCompare(b.project)
      if (a.laneOnly !== b.laneOnly) return a.laneOnly ? 1 : -1
      return a.start.localeCompare(b.start)
    })
    if (groupBy.value === 'none') {
      return list.map((item) => ({ type: 'item' as const, key: item.id, item }))
    }
    const buckets = new Map<string, GanttItem[]>()
    for (const item of list) {
      const k = (item[groupBy.value as keyof GanttItem] as string) || '未分组'
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k)!.push(item)
    }
    // 按项目分组时，保证所有活跃项目组都出现
    if (groupBy.value === 'project') {
      for (const p of projectLanes.value) {
        if (!buckets.has(p.name)) buckets.set(p.name, [])
      }
    }
    const rows: Array<
      | { type: 'group'; key: string; label: string; count: number }
      | { type: 'item'; key: string; item: GanttItem }
    > = []
    for (const [label, group] of buckets) {
      const real = group.filter((g) => !g.laneOnly)
      rows.push({ type: 'group', key: `g-${label}`, label, count: real.length || group.length })
      if (!group.length) {
        const p = projectLanes.value.find((x) => x.name === label)
        if (p) {
          const lane: GanttItem = {
            id: `LANE-${p.id}`,
            name: `${p.name} · 轨道`,
            sub: '空轨道',
            source: '项目轨道',
            owner: '—',
            region: '—',
            product: '—',
            project: p.name,
            projectId: p.id,
            status: '未开始',
            start: todayKey,
            end: todayKey,
            progress: null,
            metaText: '可框选添加',
            unscheduled: true,
            laneOnly: true
          }
          rows.push({ type: 'item', key: lane.id, item: lane })
        }
        continue
      }
      for (const item of group) rows.push({ type: 'item', key: item.id, item })
    }
    return rows
  })

  /** 时间范围取全部数据的最小/最大日期，前后各留 3 天余量；分发焦点区间会扩展视野 */
  const bounds = computed(() => {
    const src = items.value.filter((i) => !i.laneOnly)
    const fallback = allItems.value.filter((i) => !i.laneOnly)
    const use = src.length ? src : fallback
    let min = use[0]?.start ?? todayKey
    let max = use[0]?.end ?? todayKey
    for (const i of use) {
      if (i.start < min) min = i.start
      if (i.end > max) max = i.end
    }
    const focus = dojoScheduleStore.focusRange
    if (focus) {
      if (focus.start < min) min = focus.start
      if (focus.end > max) max = focus.end
    }
    if (todayKey < min) min = todayKey
    if (todayKey > max) max = todayKey
    return { min: shift(min, -3), max: shift(max, 3) }
  })

  const rangeStart = computed(() => bounds.value.min)
  const rangeEnd = computed(() => bounds.value.max)

  const days = computed(() => {
    const out: Array<{ key: string; dom: number; weekend: boolean }> = []
    const end = new Date(`${rangeEnd.value}T00:00:00`).getTime()
    let t = new Date(`${rangeStart.value}T00:00:00`).getTime()
    while (t <= end) {
      const d = new Date(t)
      out.push({ key: iso(d), dom: d.getDate(), weekend: d.getDay() === 0 || d.getDay() === 6 })
      t += DAY
    }
    return out
  })

  const totalWidth = computed(() => days.value.length * PX)

  const canvasStyle = computed(() => ({
    width: `${totalWidth.value}px`,
    minWidth: `${totalWidth.value}px`
  }))

  const sheetStyle = computed(() => ({
    width: `${NAME_W + totalWidth.value}px`,
    minWidth: `${NAME_W + totalWidth.value}px`
  }))

  const trackCellStyle = computed(() => ({
    width: `${totalWidth.value}px`,
    minWidth: `${totalWidth.value}px`
  }))

  const trackRowCount = computed(
    () => displayRows.value.filter((r) => r.type === 'item').length
  )

  const months = computed(() => {
    const out: Array<{ key: string; label: string; left: number; width: number }> = []
    days.value.forEach((d, idx) => {
      const key = d.key.slice(0, 7)
      const last = out[out.length - 1]
      if (last && last.key === key) {
        last.width += PX
      } else {
        out.push({
          key,
          label: `${Number(key.slice(5))} 月 ${key.slice(0, 4)}`,
          left: idx * PX,
          width: PX
        })
      }
    })
    return out
  })

  const todayLeft = computed(() => {
    const i = days.value.findIndex((d) => d.key === todayKey)
    return i < 0 ? null : i * PX
  })

  function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function shift(date: string, delta: number) {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + delta)
    return iso(d)
  }

  function diffDays(from: string, to: string) {
    return Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / DAY
    )
  }

  function offsetOf(date: string) {
    return Math.max(0, diffDays(rangeStart.value, date)) * PX
  }

  function md(date: string) {
    return date.slice(5).replace('-', '/')
  }

  function isRisk(item: GanttItem) {
    if (item.status === '已完成' || item.status === '已达标') return false
    return item.end < todayKey && (item.progress == null || item.progress < 1)
  }

  function colorOf(item: GanttItem) {
    if (item.source === '自建排期') return '#a78bfa'
    if (isRisk(item)) return '#ef4444'
    if (item.status === '已完成' || item.status === '已达标') return '#22c55e'
    if (item.status === '待确认') return '#f59e0b'
    if (item.status === '未开始') return '#94a3b8'
    return '#4a90d9'
  }

  const boxStyle = computed(() => {
    if (!boxSel.value) return {}
    const left = Math.min(boxSel.value.x0, boxSel.value.x1)
    const width = Math.max(PX, Math.abs(boxSel.value.x1 - boxSel.value.x0))
    return { left: `${left}px`, width: `${width}px` }
  })

  const boxDateLabel = computed(() => {
    if (!boxSel.value) return ''
    const start = xToDate(Math.min(boxSel.value.x0, boxSel.value.x1))
    const end = xToDate(Math.max(boxSel.value.x0, boxSel.value.x1))
    return `${md(start)} → ${md(end)}`
  })

  function xToDate(x: number) {
    const idx = Math.max(0, Math.min(days.value.length - 1, Math.floor(x / PX)))
    return days.value[idx]?.key || todayKey
  }

  function trackX(ev: PointerEvent) {
    if (!scroller.value) return 0
    const rect = scroller.value.getBoundingClientRect()
    return ev.clientX - rect.left - NAME_W + scroller.value.scrollLeft
  }

  function onRowPointerDown(e: PointerEvent, item: GanttItem) {
    if (interactMode.value !== 'box' || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const x = trackX(e)
    boxSel.value = { itemId: item.id, projectId: item.projectId, x0: x, x1: x }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) => {
      if (!boxSel.value) return
      boxSel.value = {
        ...boxSel.value,
        x1: trackX(ev)
      }
    }
    const onUp = () => {
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      finishBoxSelect()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function finishBoxSelect() {
    const sel = boxSel.value
    if (!sel) return
    const start = xToDate(Math.min(sel.x0, sel.x1))
    const end = xToDate(Math.max(sel.x0, sel.x1))
    if (Math.abs(sel.x1 - sel.x0) < PX * 0.4) {
      boxSel.value = null
      return
    }
    taskForm.projectId = sel.projectId
    taskForm.start = start
    taskForm.end = end
    taskForm.title = ''
    taskForm.type = 'other'
    taskForm.note = ''
    taskDialog.value = true
    boxSel.value = null
  }

  async function confirmAddTask() {
    if (!taskForm.title.trim()) {
      ElMessage.warning('请填写任务名')
      return
    }
    const proj = activeProjects.value.find((p) => p.id === taskForm.projectId)
    if (!proj) {
      ElMessage.warning('请选择项目')
      return
    }
    addScheduleBlock({
      projectId: proj.id,
      projectName: proj.name,
      title: taskForm.title.trim(),
      type: taskForm.type,
      start: taskForm.start,
      end: taskForm.end,
      note: taskForm.note,
      source: 'timeline'
    })
    taskDialog.value = false
    ElMessage.success('已添加到时间规划轨道')

    aiConfirming.value = true
    try {
      const reply = await chatAgent(
        `用户刚在时间规划上框选添加了任务。请二次确认应如何同步到节奏日历，用简短中文说明（3–6 句）。
项目：${proj.name}
任务：${taskForm.title}
类型：${taskForm.type}
区间：${taskForm.start} ~ ${taskForm.end}
备注：${taskForm.note || '无'}`,
        { scene: 'timeline', project: proj.name }
      )
      aiConfirmText.value = reply.content
      aiDialog.value = true
    } catch {
      aiConfirmText.value = `已写入时间规划「${proj.name}」轨道（${taskForm.start} → ${taskForm.end}）。建议在节奏日历同区间挂一条「${taskForm.title}」事项，并与分发/脚本计划对齐。`
      aiDialog.value = true
    } finally {
      aiConfirming.value = false
    }
  }

  function barStyle(item: GanttItem) {
    const left = offsetOf(item.start)
    if (item.unscheduled) return { left: `${left}px`, width: '92px' }
    const span = Math.max(1, diffDays(item.start, item.end) + 1)
    return {
      left: `${left}px`,
      width: `${span * PX}px`,
      background: colorOf(item)
    }
  }

  function fillStyle(item: GanttItem) {
    return { width: `${Math.min(100, Math.max(0, (item.progress ?? 0) * 100))}%` }
  }

  function metaOf(item: GanttItem) {
    return isRisk(item) ? `逾期 · ${item.metaText}` : item.metaText
  }

  function tooltip(item: GanttItem) {
    return [
      item.name,
      item.unscheduled
        ? '尚未排期'
        : `${item.start} → ${item.end}（${diffDays(item.start, item.end) + 1} 天）`,
      `状态：${item.status}`,
      item.region !== '—' ? `地区：${item.region}` : '',
      item.product !== '—' ? `产品：${item.product}` : '',
      item.metaText
    ]
      .filter(Boolean)
      .join('\n')
  }

  function select(item: GanttItem) {
    activeId.value = item.id
  }

  // ── 拖动平移 ──────────────────────────────────────────
  const scroller = ref<HTMLElement | null>(null)
  const headScroller = ref<HTMLElement | null>(null)
  const panning = ref(false)
  const scrollLeft = ref(0)
  const viewWidth = ref(0)
  let panStart = { x: 0, scroll: 0 }

  function onScroll() {
    if (!scroller.value) return
    scrollLeft.value = scroller.value.scrollLeft
    viewWidth.value = scroller.value.clientWidth
    if (headScroller.value) {
      headScroller.value.scrollLeft = scroller.value.scrollLeft
    }
  }

  /** 长条完全在可视区左边还是右边；在视野内返回 null */
  function offscreenOf(item: GanttItem): 'left' | 'right' | null {
    if (!viewWidth.value) return null
    const trackViewW = Math.max(0, viewWidth.value - NAME_W)
    const left = offsetOf(item.start)
    const right = left + Math.max(1, diffDays(item.start, item.end) + 1) * PX
    if (right < scrollLeft.value + 8) return 'left'
    if (left > scrollLeft.value + trackViewW - 8) return 'right'
    return null
  }

  function jumpStyle(item: GanttItem) {
    const trackViewW = Math.max(0, viewWidth.value - NAME_W)
    return offscreenOf(item) === 'left'
      ? { left: `${scrollLeft.value + 8}px` }
      : { left: `${scrollLeft.value + trackViewW - 128}px` }
  }

  function jumpTo(item: GanttItem) {
    if (!scroller.value) return
    activeId.value = item.id
    scroller.value.scrollTo({
      left: Math.max(0, offsetOf(item.start) - 80),
      behavior: 'smooth'
    })
  }

  function startPan(e: PointerEvent) {
    if (!scroller.value || e.button !== 0) return
    if (interactMode.value === 'box') return
    if ((e.target as HTMLElement).closest('.gantt__name-cell')) return
    panning.value = true
    panStart = { x: e.clientX, scroll: scroller.value.scrollLeft }
    scroller.value.setPointerCapture(e.pointerId)
    window.addEventListener('pointermove', onPan)
    window.addEventListener('pointerup', endPan)
  }

  function onPan(e: PointerEvent) {
    if (!panning.value || !scroller.value) return
    scroller.value.scrollLeft = panStart.scroll - (e.clientX - panStart.x)
  }

  function endPan() {
    panning.value = false
    window.removeEventListener('pointermove', onPan)
    window.removeEventListener('pointerup', endPan)
  }

  /** 触控板横向 / Shift+滚轮横向滚动；普通滚轮纵向翻页 */
  function onWheel(e: WheelEvent) {
    if (!scroller.value) return
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault()
      scroller.value.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX
    }
  }

  /**
   * 「断层」主因：默认滚到今天后，多数投放条在 3–7 月，全部落在视野左侧外。
   * 看全部条 = 滚到当前列表最早一条附近，让时间条重新进视野。
   */
  function scrollToContent() {
    if (!scroller.value || !items.value.length) return
    const earliest = [...items.value].sort((a, b) => a.start.localeCompare(b.start))[0]
    scroller.value.scrollTo({
      left: Math.max(0, offsetOf(earliest.start) - 80),
      behavior: 'smooth'
    })
    nextTick(onScroll)
  }

  function scrollToToday() {
    if (!scroller.value || todayLeft.value == null) return
    const trackViewW = Math.max(120, scroller.value.clientWidth - NAME_W)
    scroller.value.scrollTo({
      left: Math.max(0, todayLeft.value - trackViewW * 0.72),
      behavior: 'smooth'
    })
  }

  let ro: ResizeObserver | null = null

  onMounted(() => {
    nextTick(() => {
      onScroll()
      // 有历史条时优先滚到内容区，避免「左侧有名、右侧空白」
      if (items.value.some((i) => !i.unscheduled && i.end < todayKey)) scrollToContent()
      else scrollToToday()
    })
    window.addEventListener('resize', onScroll)
    if (scroller.value && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => onScroll())
      ro.observe(scroller.value)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onScroll)
    ro?.disconnect()
    endPan()
  })

  watch([groupBy, sourceFilter, statusFilter, keyword, () => props.projectId, () => props.projectIds], () =>
    nextTick(() => {
      onScroll()
      scrollToContent()
    })
  )
</script>

<style scoped lang="scss">
  $border: var(--el-border-color-lighter);
  $muted: var(--el-text-color-secondary);
  $name-w: 240px;
  $row-h: 46px;
  $group-h: 34px;
  $head-h: 56px;
  $surface: var(--el-bg-color);
  $surface-soft: var(--el-fill-color-light);

  .ai-confirm-text {
    margin: 0;
    line-height: 1.7;
    white-space: pre-wrap;
    color: var(--el-text-color-regular);
  }

  .gantt {
    border: 1px solid $border;
    border-radius: 12px;
    background: $surface;
    color: var(--el-text-color-primary);
    overflow: hidden;

    &__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid $border;
      background: $surface;
    }

    &__filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    &__field {
      display: flex;
      align-items: center;
      gap: 6px;

      > span {
        font-size: 13px;
        color: $muted;
        white-space: nowrap;
        flex-shrink: 0;
      }
    }

    &__select {
      :deep(.el-select__wrapper) {
        background: $surface;
        box-shadow: 0 0 0 1px var(--el-border-color) inset;
      }

      :deep(.el-select__selected-item),
      :deep(.el-select__placeholder),
      :deep(.el-select__caret) {
        color: var(--el-text-color-regular);
      }

      :deep(.el-select__selected-item) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    &__hint {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }

    &__legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 8px 16px;
      border-bottom: 1px solid $border;
      background: $surface-soft;
      font-size: 12px;
      color: $muted;
    }

    &__legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      i {
        width: 12px;
        height: 8px;
        border-radius: 3px;
      }
    }

    &__legend-count {
      margin-left: auto;
      color: var(--el-text-color-placeholder);
    }

    &__viewport {
      display: flex;
      flex-direction: column;
      max-height: 640px;
      overflow: hidden;
      background: $surface;
      border-top: 1px solid $border;
    }

    &__sticky-head {
      display: flex;
      flex-shrink: 0;
      z-index: 6;
      background: $surface;
      border-bottom: 1px solid $border;
    }

    &__head-track {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    &__sheet-scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      cursor: grab;
      user-select: none;
      background: $surface;

      &.panning {
        cursor: grabbing;
      }

      &--box {
        cursor: default;
      }
    }

    &__sheet {
      position: relative;
      background: $surface;
    }

    &__today-sheet {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 4;
      width: 2px;
      background: #ef4444;
      pointer-events: none;
    }

    &__line {
      display: flex;
      width: 100%;

      &--group {
        min-height: $group-h;
      }
    }

    &__name-cell {
      position: sticky;
      left: 0;
      z-index: 3;
      flex: 0 0 $name-w;
      width: $name-w;
      display: flex;
      align-items: center;
      gap: 8px;
      height: $row-h;
      padding: 0 14px;
      border-right: 1px solid $border;
      border-bottom: 1px solid var(--el-border-color-extra-light);
      background: $surface;
      overflow: hidden;

      &.active {
        background: rgb(74 144 217 / 12%);
      }

      &--group {
        height: $group-h;
        background: $surface-soft;
        border-bottom: 1px solid $border;
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        text-overflow: ellipsis;
        white-space: nowrap;

        em {
          font-style: normal;
          font-weight: 400;
          color: var(--el-text-color-placeholder);
          flex-shrink: 0;
        }
      }
    }

    &__track-cell {
      position: relative;
      flex: 0 0 auto;
      height: $row-h;
      border-bottom: 1px solid var(--el-border-color-extra-light);
      background-color: $surface;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image: repeating-linear-gradient(
          to right,
          transparent 0,
          transparent 29px,
          color-mix(in srgb, var(--el-border-color) 90%, #64748b) 29px,
          color-mix(in srgb, var(--el-border-color) 90%, #64748b) 30px
        );
      }

      &--group {
        height: $group-h;
        background: color-mix(in srgb, $surface-soft 90%, transparent);
      }

      &--boxable {
        cursor: crosshair;

        .gantt__rail {
          background: color-mix(in srgb, #8b5cf6 18%, var(--el-border-color-lighter));
          border-color: color-mix(in srgb, #8b5cf6 35%, var(--el-border-color));
        }
      }

      &--boxing {
        .gantt__rail {
          border-color: #7c3aed;
          background: color-mix(in srgb, #8b5cf6 28%, var(--el-fill-color-light));
        }
      }
    }

    &__names-head {
      display: flex;
      align-items: flex-end;
      flex: 0 0 $name-w;
      width: $name-w;
      height: $head-h;
      padding: 0 14px 10px;
      border-right: 1px solid $border;
      background: $surface;
      font-size: 12px;
      font-weight: 600;
      color: $muted;
    }

    &__dot {
      width: 8px;
      height: 8px;
      flex-shrink: 0;
      border-radius: 50%;
    }

    &__name-text {
      min-width: 0;
      flex: 1;
      overflow: hidden;

      strong {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      span {
        display: block;
        font-size: 11px;
        color: var(--el-text-color-placeholder);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    &__head {
      height: $head-h;
      background: $surface;
    }

    &__months {
      position: relative;
      height: 26px;
    }

    &__month {
      position: absolute;
      top: 0;
      display: flex;
      align-items: center;
      height: 26px;
      padding-left: 8px;
      border-left: 1px solid $border;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    &__days {
      display: flex;
      height: 29px;
    }

    &__day {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--el-text-color-placeholder);

      &.weekend {
        background: $surface-soft;
      }

      &.today {
        color: #fff;
        font-weight: 700;
        background: #ef4444;
      }
    }

    &__name-jump {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      margin-left: auto;
      border: 1px solid var(--el-border-color);
      border-radius: 6px;
      background: var(--el-fill-color-light);
      color: #4a90d9;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;

      &:hover {
        border-color: #4a90d9;
        background: rgb(74 144 217 / 10%);
      }
    }

    &__today {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 1;
      width: 2px;
      background: #ef4444;
      pointer-events: none;

      span {
        position: absolute;
        top: 2px;
        left: 4px;
        padding: 1px 5px;
        border-radius: 4px;
        background: #ef4444;
        color: #fff;
        font-size: 10px;
        white-space: nowrap;
      }
    }

    &__box {
      position: absolute;
      top: 5px;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      border-radius: 8px;
      background: color-mix(in srgb, #8b5cf6 28%, #fff);
      border: 2px solid #7c3aed;
      box-shadow:
        0 0 0 1px rgb(124 58 237 / 15%),
        inset 0 1px 0 rgb(255 255 255 / 50%);
      pointer-events: none;
    }

    &__box-label {
      padding: 0 8px;
      font-size: 11px;
      font-weight: 600;
      color: #5b21b6;
      white-space: nowrap;
      user-select: none;
    }

    &__offscreen-hint {
      position: absolute;
      top: 10px;
      z-index: 0;
      height: 26px;
      border-radius: 6px;
      border: 1px dashed color-mix(in srgb, #4a90d9 55%, var(--el-border-color));
      background: color-mix(in srgb, #4a90d9 12%, transparent);
      pointer-events: none;

      &.left {
        border-left-width: 3px;
        border-left-color: #4a90d9;
      }

      &.right {
        border-right-width: 3px;
        border-right-color: #4a90d9;
      }
    }

    &__lane-hint {
      position: absolute;
      left: 12px;
      top: 14px;
      z-index: 1;
      font-size: 11px;
      color: var(--el-text-color-placeholder);
      pointer-events: none;
    }

    &__rail {
      position: absolute;
      left: 8px;
      right: 8px;
      top: 10px;
      z-index: 1;
      height: 26px;
      border-radius: 8px;
      border: 1px solid var(--el-border-color);
      background: color-mix(in srgb, var(--el-fill-color-light) 70%, $surface);
      pointer-events: none;
    }

    &__slot {
      position: absolute;
      top: 12px;
      z-index: 2;
      min-width: 64px;
      height: 22px;
      padding: 0 8px;
      border: 1px dashed var(--el-border-color);
      border-radius: 6px;
      background: var(--el-fill-color-blank);
      color: var(--el-text-color-placeholder);
      font-size: 11px;
      line-height: 20px;
      white-space: nowrap;
    }

    &__bar {
      position: absolute;
      top: 9px;
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 28px;
      padding: 0 10px;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      overflow: hidden;
      box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
      transition: filter 0.15s ease;

      &:hover {
        filter: brightness(1.06);
      }

      &.active {
        outline: 2px solid #1f2937;
        outline-offset: 1px;
      }

      &.unscheduled {
        border: 1px dashed #cbd5e1;
        background: transparent;
        color: #94a3b8;
        box-shadow: none;
        justify-content: center;
        font-size: 11px;
      }
    }

    /** 达成度覆盖层：亮色部分是已完成的比例 */
    &__fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: rgb(255 255 255 / 26%);
      pointer-events: none;
    }

    &__bar-date {
      position: relative;
      flex-shrink: 0;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      opacity: 0.85;
    }

    &__bar-label {
      position: relative;
      flex: 1;
      min-width: 0;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__jump {
      position: absolute;
      top: 11px;
      z-index: 2;
      min-width: 118px;
      height: 24px;
      padding: 0 8px;
      border: 1px solid rgb(74 144 217 / 45%);
      border-radius: 10px;
      background: rgb(74 144 217 / 12%);
      color: #2563eb;
      font-size: 11px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: 0 1px 2px rgb(0 0 0 / 6%);

      &.left {
        text-align: left;
      }

      &.right {
        text-align: right;
      }

      &:hover {
        border-color: #4a90d9;
        background: rgb(74 144 217 / 22%);
      }
    }

    &__meta {
      position: absolute;
      top: 15px;
      font-size: 11px;
      color: var(--el-text-color-placeholder);
      white-space: nowrap;
      pointer-events: none;
    }

    &__empty {
      padding: 32px;
      text-align: center;
      color: var(--el-text-color-placeholder);
    }
  }
</style>
