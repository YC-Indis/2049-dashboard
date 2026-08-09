<template>
  <div class="dojo-page calendar-page">
    <header class="dojo-page__head">
      <div>
        <h1>节奏日历</h1>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
      </div>
    </header>

    <div class="month-strip">
      <button
        v-for="m in activeMonths"
        :key="m.key"
        type="button"
        class="month-strip__item"
        :class="{ on: m.key === monthKey }"
        @click="jumpTo(m.key)"
      >
        <span class="month-strip__label">{{ m.label }}</span>
        <span class="month-strip__bar">
          <i :style="{ height: `${Math.max(8, (m.count / maxMonthCount) * 100)}%` }" />
        </span>
        <span class="month-strip__count">{{ m.count }}</span>
      </button>
    </div>

    <div class="calendar-layout">
      <aside class="backlog">
        <div class="backlog__head">
          <span class="backlog__title">待排脚本</span>
          <ElDatePicker
            v-model="dateRange"
            type="daterange"
            size="small"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            unlink-panels
            style="width: 220px"
          />
        </div>
        <p class="backlog__hint">拖到右侧日期格，已排的可再次拖动调整</p>
        <VueDraggable
          v-model="backlog"
          :group="{ name: 'dojo-calendar', pull: 'clone', put: false }"
          :sort="false"
          :clone="cloneBacklog"
          item-key="id"
          class="backlog__list"
          @start="onBacklogDragStart"
        >
          <div v-for="item in backlog" :key="item.id" class="backlog-card">
            <div class="backlog-card__top">
              <span v-if="item.week" class="week">{{ item.week }}</span>
              <span class="no">#{{ item.no }}</span>
            </div>
            <h4 :title="item.title">{{ item.title }}</h4>
            <span class="req" :title="item.requirement">{{ item.requirement || '无特殊拍摄要求' }}</span>
          </div>
          <p v-if="!backlog.length" class="backlog__empty">
            {{ backlogEmptyText }}
          </p>
        </VueDraggable>
      </aside>

      <section class="calendar-main">
        <div class="calendar-toolbar">
          <ElButton size="small" type="primary" plain @click="openAddPlan(selectedDate)">添加计划</ElButton>
          <ElButton size="small" @click="shiftMonth(-1)">上月</ElButton>
          <strong>{{ monthLabel }}</strong>
          <ElButton size="small" @click="shiftMonth(1)">下月</ElButton>
          <ElButton size="small" type="primary" plain @click="goToday">今天</ElButton>
          <span class="calendar-toolbar__legend">
            <i class="lg lg--deliver" />投放
            <i class="lg lg--milestone" />里程碑
            <i class="lg lg--script" />已排脚本
          </span>
        </div>

        <div class="week-head">
          <span v-for="w in weekNames" :key="w">{{ w }}</span>
        </div>

        <div class="month-grid">
          <div
            v-for="cell in monthCells"
            :key="cell.key"
            class="day-cell"
            :class="{
              muted: !cell.inMonth,
              today: cell.isToday,
              selected: cell.date === selectedDate,
              drop: dropTarget === cell.date
            }"
            @dragover.prevent="dropTarget = cell.date"
            @dragleave="dropTarget = dropTarget === cell.date ? '' : dropTarget"
            @drop="onDrop(cell.date)"
            @click="onDayClick(cell.date)"
          >
            <div class="day-cell__top">
              <span class="day-num">{{ cell.day }}</span>
              <button
                type="button"
                class="day-add"
                title="在此日期添加计划"
                @click.stop="openAddPlan(cell.date)"
              >
                +
              </button>
              <div class="day-badges">
                <span
                  v-if="cell.deliveries"
                  class="day-load day-load--deliver"
                  :title="`${cell.deliveries} 条投放`"
                >
                  {{ cell.deliveries }}
                </span>
                <span
                  v-if="cell.scriptCount"
                  class="day-load day-load--script"
                  :title="`${cell.scriptCount} 个已排脚本`"
                >
                  {{ cell.scriptCount }}
                </span>
                <span
                  v-if="cell.pendingScripts"
                  class="day-pending"
                  :title="`该月所属周还有 ${cell.pendingScripts} 个待排脚本`"
                />
              </div>
            </div>
            <div v-if="cell.taskLoad" class="day-heat">
              <i :style="{ width: `${Math.min(100, (cell.taskLoad / maxDayLoad) * 100)}%` }" />
            </div>
            <div class="day-events">
              <div v-for="ms in cell.milestones" :key="ms.id" class="day-chip day-chip--milestone">
                {{ ms.label }}
              </div>
              <div
                v-for="ev in cell.scripts"
                :key="ev.id"
                class="day-chip day-chip--script"
                draggable="true"
                @dragstart="draggingEvent = ev"
                @click.stop="selectedDate = cell.date"
              >
                {{ ev.week ? `${ev.week} · ` : '' }}{{ ev.title }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="day-detail">
        <div class="day-detail__head">
          <strong>{{ selectedDate }}</strong>
          <span>{{ weekdayLabel(selectedDate) }}</span>
        </div>

        <div class="day-detail__block">
          <span class="day-detail__label">投放</span>
          <template v-if="detail.deliveries.length">
            <p class="day-detail__lead">{{ detail.deliveries.length }} 条视频投放</p>
            <ul class="day-detail__list">
              <li v-for="d in detail.deliveries.slice(0, 8)" :key="d.id">
                <span class="tag">{{ d.batch }}</span>
                <a :href="d.videoUrl" target="_blank" rel="noopener">{{ d.device || '未编号' }}</a>
              </li>
            </ul>
            <p v-if="detail.deliveries.length > 8" class="day-detail__more">
              还有 {{ detail.deliveries.length - 8 }} 条
              <ElButton link type="primary" @click="goVideos">去视频监控</ElButton>
            </p>
          </template>
          <p v-else class="day-detail__none">这天没有投放记录</p>
        </div>

        <div class="day-detail__block">
          <span class="day-detail__label">里程碑</span>
          <ul v-if="detail.milestones.length" class="day-detail__list">
            <li v-for="m in detail.milestones" :key="m.id">
              <span class="tag tag--ms">{{ m.kind }}</span>{{ m.name }}
            </li>
          </ul>
          <p v-else class="day-detail__none">无里程碑节点</p>
        </div>

        <div class="day-detail__block">
          <span class="day-detail__label">已排脚本</span>
          <ul v-if="detail.scripts.length" class="day-detail__list">
            <li v-for="s in detail.scripts" :key="s.id">
              <span v-if="s.week" class="tag tag--script">{{ s.week }}</span>{{ s.title }}
              <ElButton link type="danger" size="small" @click="unschedule(s.id)">移除</ElButton>
            </li>
          </ul>
          <p v-else class="day-detail__none">还没排脚本，从左侧拖过来或点击日期添加</p>
          <ElButton type="primary" plain size="small" @click="openAddPlan(selectedDate)">添加计划</ElButton>
        </div>
      </aside>
    </div>

    <ElDialog v-model="planDialogVisible" title="添加日历计划" width="440px" align-center destroy-on-close>
      <ElForm label-width="72px">
        <ElFormItem label="日期">
          <ElDatePicker
            v-model="planForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="计划">
          <ElInput v-model="planForm.title" placeholder="脚本 / 任务标题" />
        </ElFormItem>
        <ElFormItem label="从待排选">
          <ElSelect v-model="planForm.backlogId" clearable placeholder="可选" style="width: 100%" @change="pickBacklog">
            <ElOption
              v-for="item in backlog"
              :key="item.id"
              :label="`${item.week ? item.week + ' · ' : ''}${item.title}`"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="planDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitPlan">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { VueDraggable } from 'vue-draggable-plus'
  import { ElMessage } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { weeklyScripts, workflowStages } from '@/mock/dojo/imported'
  import { adVideos } from '@/mock/dojo/imported/ads'
  import { dojoProjectStore, matchesAnyProject } from '@/store/dojoProjectStore'
  import { clearFocusRange, dojoScheduleStore, setFocusRange } from '@/store/dojoScheduleStore'
  import { buildWeekOptions, monthsInWeekRange } from '@/utils/dojoWeeks'

  defineOptions({ name: 'DojoCalendar' })

  const router = useRouter()
  const TODAY = '2026-08-07'

  interface ScriptItem {
    id: string
    week: string
    no: string
    title: string
    requirement: string
  }
  interface ScheduledScript extends ScriptItem {
    date: string
  }

  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const dateRange = ref<[string, string] | null>(
    dojoScheduleStore.focusRange
      ? [dojoScheduleStore.focusRange.start, dojoScheduleStore.focusRange.end]
      : null
  )
  const cursor = ref(new Date(`${TODAY}T00:00:00`))
  const selectedDate = ref(TODAY)
  const dropTarget = ref('')
  const planDialogVisible = ref(false)
  const planForm = reactive({ date: TODAY, title: '', backlogId: '' })

  const weekKeys = Object.keys(weeklyScripts)

  watch(dateRange, (v) => {
    if (v?.[0] && v[1]) {
      setFocusRange(v[0], v[1])
      cursor.value = new Date(`${v[0]}T00:00:00`)
    } else clearFocusRange()
  })

  watch(
    () => dojoScheduleStore.focusRange,
    (v) => {
      if (!v) return
      if (!dateRange.value || dateRange.value[0] !== v.start || dateRange.value[1] !== v.end) {
        dateRange.value = [v.start, v.end]
      }
    }
  )

  function buildPreseeded(): ScheduledScript[] {
    const weekDates: Record<string, string[]> = {
      W1: ['2026-02-14', '2026-02-17', '2026-02-21'],
      W2: ['2026-03-05', '2026-03-12', '2026-03-19'],
      W3: ['2026-04-02', '2026-04-09', '2026-04-16'],
      W4: ['2026-05-07', '2026-05-14', '2026-06-04'],
      W5: ['2026-06-18', '2026-07-02', '2026-07-15']
    }
    const result: ScheduledScript[] = []
    for (const [week, dates] of Object.entries(weekDates)) {
      const scripts = weeklyScripts[week] || []
      dates.forEach((date, i) => {
        const r = scripts[i]
        if (!r) return
        result.push({
          id: `${week}-${r.rowIndex}`,
          week,
          no: String(r['序号'] ?? r.rowIndex),
          title: String(r['内容方向'] || '未命名脚本'),
          requirement: String(r['拍摄要求'] || ''),
          date
        })
      })
    }
    return result
  }

  const scheduled = ref<ScheduledScript[]>(buildPreseeded())
  const draggingBacklog = ref<ScriptItem | null>(null)
  const draggingEvent = ref<ScheduledScript | null>(null)

  const weekNames = ['一', '二', '三', '四', '五', '六', '日']

  const allScripts: ScriptItem[] = weekKeys.flatMap((w) =>
    (weeklyScripts[w] || []).map((r) => ({
      id: `${w}-${r.rowIndex}`,
      week: w,
      no: String(r['序号'] ?? r.rowIndex),
      title: String(r['内容方向'] || '未命名脚本'),
      requirement: String(r['拍摄要求'] || '')
    }))
  )

  function scriptsVisibleForProjects(ids: string[]) {
    if (!ids.length) return true
    return ids.includes('dojo')
  }

  function deliveryMatchesProjects(v: (typeof adVideos)[0], ids: string[]) {
    return matchesAnyProject(`${v.batch} ${v.content} ${v.device}`, ids)
  }

  const filteredScripts = computed(() =>
    allScripts.filter(() => scriptsVisibleForProjects(selectedProjectIds.value))
  )

  const filteredScheduled = computed(() =>
    scheduled.value.filter(() => scriptsVisibleForProjects(selectedProjectIds.value))
  )

  const weekOptions = computed(() =>
    buildWeekOptions(weekKeys, (key) =>
      filteredScripts.value.filter((s) => s.week === key).length
    )
  )

  function weekOverlapsRange(weekKey: string) {
    if (!dateRange.value) return true
    const meta = weekOptions.value.find((w) => w.key === weekKey)
    if (!meta) return true
    const [start, end] = dateRange.value
    return meta.start <= end && meta.end >= start
  }

  const backlog = computed({
    get: () =>
      filteredScripts.value.filter(
        (s) =>
          weekOverlapsRange(s.week) &&
          !filteredScheduled.value.some((x) => x.id === s.id)
      ),
    set: () => {
      /* clone 模式下不改写源列表 */
    }
  })

  const backlogEmptyText = computed(() => {
    if (!scriptsVisibleForProjects(selectedProjectIds.value)) return '当前所选项目暂无脚本数据'
    if (dateRange.value) return '该日期区间内的脚本都已排完'
    return '待排脚本已全部排入日历'
  })

  const filteredDeliveries = computed(() =>
    adVideos.filter((v) => v.date && deliveryMatchesProjects(v, selectedProjectIds.value))
  )

  const deliveriesByDate = computed(() => {
    const map = new Map<string, typeof adVideos>()
    for (const v of filteredDeliveries.value) {
      if (!v.date) continue
      if (!map.has(v.date)) map.set(v.date, [])
      map.get(v.date)!.push(v)
    }
    return map
  })

  const milestonesByDate = computed(() => {
    const map = new Map<string, Array<{ id: string; name: string; kind: string; label: string }>>()
    if (selectedProjectIds.value.length && !selectedProjectIds.value.includes('dojo')) return map

    const push = (date: string | null, id: string, name: string, kind: string) => {
      if (!date) return
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push({ id: `${id}-${kind}`, name, kind, label: `${name} ${kind}` })
    }
    for (const s of workflowStages) {
      push(s.startDate, s.id, s.name, '开始')
      push(s.endDate, s.id, s.name, '截止')
    }
    return map
  })

  const pendingByWeek = computed(() => {
    const map = new Map<string, number>()
    for (const s of filteredScripts.value) {
      if (filteredScheduled.value.some((x) => x.id === s.id)) continue
      map.set(s.week, (map.get(s.week) ?? 0) + 1)
    }
    return map
  })

  function pendingScriptsForMonth(monthKey: string) {
    let n = 0
    for (const week of weekKeys) {
      if (monthsInWeekRange(week, weekKeys).includes(monthKey)) {
        n += pendingByWeek.value.get(week) ?? 0
      }
    }
    return n
  }

  const maxDayLoad = computed(() => {
    let max = 1
    const dates = new Set<string>()
    for (const date of deliveriesByDate.value.keys()) dates.add(date)
    for (const s of filteredScheduled.value) dates.add(s.date)
    for (const date of dates) {
      const load =
        (deliveriesByDate.value.get(date)?.length ?? 0) +
        filteredScheduled.value.filter((s) => s.date === date).length
      if (load > max) max = load
    }
    return max
  })

  const activeMonths = computed(() => {
    const counts = new Map<string, number>()
    for (const [date, list] of deliveriesByDate.value) {
      const k = date.slice(0, 7)
      counts.set(k, (counts.get(k) ?? 0) + list.length)
    }
    for (const [date, list] of milestonesByDate.value) {
      const k = date.slice(0, 7)
      counts.set(k, (counts.get(k) ?? 0) + list.length)
    }
    for (const s of filteredScheduled.value) {
      const k = s.date.slice(0, 7)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    counts.set(TODAY.slice(0, 7), counts.get(TODAY.slice(0, 7)) ?? 0)
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count, label: `${Number(key.slice(5))} 月` }))
  })

  const maxMonthCount = computed(() => Math.max(1, ...activeMonths.value.map((m) => m.count)))

  const monthKey = computed(() => fmt(cursor.value).slice(0, 7))

  const monthLabel = computed(
    () => `${cursor.value.getFullYear()} 年 ${cursor.value.getMonth() + 1} 月`
  )

  const monthCells = computed(() => {
    const y = cursor.value.getFullYear()
    const m = cursor.value.getMonth()
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7
    const start = new Date(y, m, 1 - startOffset)
    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const date = fmt(d)
      const scripts = filteredScheduled.value.filter((s) => s.date === date)
      const deliveries = deliveriesByDate.value.get(date)?.length ?? 0
      const month = date.slice(0, 7)
      cells.push({
        key: date,
        date,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        isToday: date === TODAY,
        deliveries,
        scriptCount: scripts.length,
        taskLoad: deliveries + scripts.length,
        pendingScripts: pendingScriptsForMonth(month),
        milestones: milestonesByDate.value.get(date) ?? [],
        scripts
      })
    }
    return cells
  })

  const detail = computed(() => ({
    deliveries: deliveriesByDate.value.get(selectedDate.value) ?? [],
    milestones: milestonesByDate.value.get(selectedDate.value) ?? [],
    scripts: filteredScheduled.value.filter((s) => s.date === selectedDate.value)
  }))

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function weekdayLabel(date: string) {
    const d = new Date(`${date}T00:00:00`)
    return `周${weekNames[(d.getDay() + 6) % 7]}`
  }

  function cloneBacklog(item: ScriptItem) {
    return { ...item }
  }

  function onBacklogDragStart(evt: { oldIndex?: number }) {
    if (evt.oldIndex != null) draggingBacklog.value = backlog.value[evt.oldIndex]
  }

  function onDrop(date: string) {
    dropTarget.value = ''
    if (draggingEvent.value) {
      const target = scheduled.value.find((s) => s.id === draggingEvent.value!.id)
      if (target) target.date = date
      draggingEvent.value = null
      selectedDate.value = date
      ElMessage.success(`已移动到 ${date}`)
      return
    }
    if (!draggingBacklog.value) return
    const item = draggingBacklog.value
    if (scheduled.value.some((s) => s.id === item.id)) {
      draggingBacklog.value = null
      return
    }
    scheduled.value.push({ ...item, date })
    draggingBacklog.value = null
    selectedDate.value = date
    ElMessage.success(`${item.week ? item.week + ' ' : ''}#${item.no} 已排入 ${date}`)
  }

  function unschedule(id: string) {
    scheduled.value = scheduled.value.filter((s) => s.id !== id)
  }

  function onDayClick(date: string) {
    selectedDate.value = date
    openAddPlan(date)
  }

  function openAddPlan(date: string) {
    planForm.date = date
    planForm.title = ''
    planForm.backlogId = ''
    planDialogVisible.value = true
  }

  function pickBacklog(id: string) {
    const item = backlog.value.find((b) => b.id === id)
    if (item) planForm.title = item.title
  }

  function submitPlan() {
    const date = planForm.date
    if (!date) {
      ElMessage.warning('请选择日期')
      return
    }
    if (planForm.backlogId) {
      const item = backlog.value.find((b) => b.id === planForm.backlogId)
      if (item && !scheduled.value.some((s) => s.id === item.id)) {
        scheduled.value.push({ ...item, date })
        planDialogVisible.value = false
        selectedDate.value = date
        ElMessage.success(`已排入 ${date}`)
        return
      }
    }
    const title = planForm.title.trim()
    if (!title) {
      ElMessage.warning('请填写计划标题或从待排选择')
      return
    }
    scheduled.value.push({
      id: `cal-${Date.now()}`,
      week: '',
      no: String(scheduled.value.length + 1),
      title,
      requirement: '',
      date
    })
    planDialogVisible.value = false
    selectedDate.value = date
    ElMessage.success(`已在 ${date} 添加计划`)
  }

  function shiftMonth(delta: number) {
    const d = new Date(cursor.value)
    d.setDate(1)
    d.setMonth(d.getMonth() + delta)
    cursor.value = d
  }

  function jumpTo(key: string) {
    cursor.value = new Date(`${key}-01T00:00:00`)
  }

  function goToday() {
    cursor.value = new Date(`${TODAY}T00:00:00`)
    selectedDate.value = TODAY
  }

  function goVideos() {
    router.push('/ads/videos')
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .month-strip {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);
    overflow-x: auto;

    &__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: 54px;
      padding: 4px 6px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &.on {
        border-color: #4a90d9;
        background: rgb(74 144 217 / 8%);
      }
    }

    &__label {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }

    &__bar {
      display: flex;
      align-items: flex-end;
      width: 100%;
      height: 26px;

      i {
        width: 100%;
        border-radius: 3px;
        background: linear-gradient(180deg, #7db2e8, #4a90d9);
      }
    }

    &__count {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .calendar-layout {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr) 260px;
    gap: 14px;
    align-items: start;

    @media (max-width: 1400px) {
      grid-template-columns: 220px minmax(0, 1fr);
    }

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  }

  .backlog {
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);

    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    &__title {
      font-weight: 600;
    }

    &__hint {
      margin: 6px 0 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 560px;
      overflow-y: auto;
    }

    &__empty {
      margin: 0;
      padding: 20px 0;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .backlog-card {
    padding: 8px 10px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-fill-color-blank);
    cursor: grab;

    &:hover {
      border-color: #4a90d9;
    }

    &__top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .week {
      font-weight: 700;
      color: #4a90d9;
    }

    .no {
      color: var(--el-text-color-secondary);
    }

    h4 {
      margin: 0 0 5px;
      font-size: 13px;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .req {
      display: block;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .calendar-main {
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
  }

  .calendar-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;

    &__legend {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    .lg {
      width: 9px;
      height: 9px;
      border-radius: 2px;

      &--deliver {
        background: #4a90d9;
      }

      &--milestone {
        background: #f59e0b;
      }

      &--script {
        background: #13c2c2;
      }
    }
  }

  .week-head {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 96px;
    padding: 5px;
    border: 1px solid var(--el-border-color-extra-light);
    border-radius: 8px;
    background: var(--el-fill-color-blank);
    cursor: pointer;
    transition: border-color 0.15s ease;

    &.muted {
      opacity: 0.42;
    }

    &.today {
      border-color: #ef4444;
    }

    &.selected {
      border-color: #4a90d9;
      box-shadow: inset 0 0 0 1px rgb(74 144 217 / 35%);
    }

    &.drop {
      border-color: #4a90d9;
      border-style: dashed;
      background: rgb(74 144 217 / 8%);
    }

    &__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  .day-num {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .day-add {
    width: 18px;
    height: 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 5px;
    background: var(--el-bg-color);
    color: #4a90d9;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;

    .day-cell:hover &,
    .day-cell.selected & {
      opacity: 1;
    }

    &:hover {
      border-color: #4a90d9;
      background: rgb(74 144 217 / 10%);
    }
  }

  .day-badges {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .day-load {
    padding: 0 5px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;

    &--deliver {
      background: rgb(74 144 217 / 14%);
      color: #2e6fb5;
    }

    &--script {
      background: rgb(19 194 194 / 16%);
      color: #0e8f8f;
    }
  }

  .day-pending {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
  }

  .day-heat {
    height: 3px;
    border-radius: 2px;
    background: var(--el-fill-color-light);
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #4a90d9, #13c2c2);
    }
  }

  .day-events {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .day-chip {
    padding: 2px 5px;
    border-radius: 4px;
    color: #fff;
    font-size: 10px;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--milestone {
      background: #f59e0b;
    }

    &--script {
      background: #13c2c2;
      cursor: grab;
    }
  }

  .day-detail {
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);

    @media (max-width: 1400px) {
      grid-column: 1 / -1;
    }

    &__head {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--el-border-color-extra-light);

      strong {
        font-size: 15px;
      }

      span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__block {
      padding: 12px 0;
      border-bottom: 1px solid var(--el-border-color-extra-light);
    }

    &__label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
    }

    &__lead {
      margin: 0 0 6px;
      font-size: 13px;
    }

    &__list {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        font-size: 12px;
        overflow: hidden;

        a {
          color: var(--el-color-primary);
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    &__more,
    &__none {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .tag {
      flex-shrink: 0;
      max-width: 96px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgb(74 144 217 / 12%);
      color: #2e6fb5;
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &--ms {
        background: rgb(245 158 11 / 16%);
        color: #b45309;
      }

      &--script {
        background: rgb(19 194 194 / 16%);
        color: #0e8f8f;
      }
    }
  }
</style>
