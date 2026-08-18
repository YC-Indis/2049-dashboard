<template>
  <div class="dojo-page calendar-os">
    <!--
      THESIS: Execution is arranged by moving real work onto time, not by reading BI cards around a calendar.
      OWN-WORLD: Creator OS rhythm-kit composition inside the 2049 cool-silver, cobalt, cyan, and violet system.
      STORY: Pick an item, drag it to a day, scan the resulting rhythm, then edit it in place.
      FIRST VIEWPORT: A 300px draggable work kit sits beside one uninterrupted week/month calendar with actions in its toolbar.
      FORM: User-pinned Creator OS scheduling form, adapted to the shared local schedule store.
      FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
    -->
    <header class="dojo-page__head calendar-heading">
      <div>
        <h1>执行日历</h1>
        <p>把项目、任务和固定动作拖进真实日期；排期、执行和改期都在同一个工作面完成。</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="220px" />
        <div class="view-switch" aria-label="日历视图">
          <button
            type="button"
            :class="{ 'is-active': viewMode === 'week' }"
            @click="viewMode = 'week'"
          >
            周
          </button>
          <button
            type="button"
            :class="{ 'is-active': viewMode === 'month' }"
            @click="viewMode = 'month'"
          >
            月
          </button>
        </div>
        <ElButton type="primary" @click="openCreate(selectedDate)">
          <Icon icon="ph:plus-bold" width="15" />
          新建任务
        </ElButton>
      </div>
    </header>

    <section class="calendar-workspace">
      <aside class="rhythm-kit">
        <header class="rhythm-kit__head">
          <div>
            <span>RHYTHM KIT</span>
            <strong>拖进日历安排</strong>
          </div>
          <small>{{ kitTasks.length }} 项可调整</small>
          <p>拖动普通任务可直接改期；项目周期保持只读，避免打乱 KPI 基线。</p>
        </header>

        <div class="rhythm-kit__filters" aria-label="事项筛选">
          <button
            v-for="filter in typeFilters"
            :key="filter.value"
            type="button"
            :class="{ 'is-active': typeFilter === filter.value }"
            @click="typeFilter = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>

        <div class="rhythm-kit__scroll">
          <section class="kit-section">
            <h2>固定动作</h2>
            <article
              v-for="action in fixedActions"
              :key="action.id"
              class="fixed-action"
              draggable="true"
              @dragstart="handleFixedDragStart($event, action.id)"
              @dragend="clearDragState"
            >
              <span class="fixed-action__icon">
                <Icon :icon="action.icon" width="18" />
              </span>
              <span>
                <strong>{{ action.title }}</strong>
                <small>{{ action.detail }}</small>
              </span>
              <button type="button" @click="scheduleFixed(action.id, selectedDate)">
                安排到所选日
              </button>
            </article>
          </section>

          <section class="kit-section kit-section--tasks">
            <h2>执行事项</h2>
            <article
              v-for="task in kitTasks"
              :key="task.id"
              class="kit-task"
              :class="[`tone-${eventTone(task)}`, { 'is-dragging': draggingId === task.id }]"
              draggable="true"
              tabindex="0"
              role="button"
              :aria-label="`编辑并安排 ${displayTitle(task)}`"
              @click="openEdit(task)"
              @keydown.enter="openEdit(task)"
              @keydown.space.prevent="openEdit(task)"
              @dragstart="handleTaskDragStart($event, task)"
              @dragend="clearDragState"
            >
              <span class="drag-handle" aria-hidden="true">
                <Icon icon="ph:dots-six-vertical-bold" width="16" />
              </span>
              <span class="kit-task__copy">
                <small>{{ task.projectName || '个人事项' }} · {{ task.start.slice(5) }}</small>
                <strong>{{ displayTitle(task) }}</strong>
              </span>
              <span class="kit-task__status">{{ task.status || '未开始' }}</span>
            </article>

            <div v-if="!kitTasks.length" class="kit-empty">
              <Icon icon="ph:calendar-check-duotone" width="23" />
              <strong>当前筛选下没有待调整任务</strong>
              <button type="button" @click="openCreate(selectedDate)">创建一个任务</button>
            </div>
          </section>
        </div>
      </aside>

      <section class="calendar-stage">
        <header class="calendar-toolbar">
          <div class="calendar-nav">
            <button
              type="button"
              :aria-label="viewMode === 'month' ? '上个月' : '上一周'"
              @click="shiftPeriod(-1)"
            >
              <Icon icon="ph:caret-left-bold" width="15" />
            </button>
            <button type="button" @click="goToday">今</button>
            <button
              type="button"
              :aria-label="viewMode === 'month' ? '下个月' : '下一周'"
              @click="shiftPeriod(1)"
            >
              <Icon icon="ph:caret-right-bold" width="15" />
            </button>
          </div>
          <div class="calendar-period">
            <strong>{{ periodLabel }}</strong>
            <small>{{ visibleSummary }}</small>
          </div>
          <button type="button" class="calendar-add" @click="openCreate(selectedDate)">
            <Icon icon="ph:plus" width="15" />
            添加到 {{ formatShortDate(selectedDate) }}
          </button>
        </header>

        <div v-if="viewMode === 'month'" class="month-calendar">
          <div class="month-grid">
            <div v-for="weekday in weekNames" :key="weekday" class="weekday-label">
              {{ weekday }}
            </div>

            <article
              v-for="cell in monthCells"
              :key="cell.date"
              class="calendar-day"
              :class="{
                'is-outside': !cell.inMonth,
                'is-today': cell.isToday,
                'is-selected': selectedDate === cell.date,
                'is-drop-target': dragoverDate === cell.date
              }"
              @click="selectedDate = cell.date"
              @dragenter.prevent="dragoverDate = cell.date"
              @dragover.prevent
              @dragleave="handleDragLeave($event, cell.date)"
              @drop.prevent="handleDrop($event, cell.date)"
            >
              <header>
                <span>{{ cell.day }}</span>
                <small v-if="cell.isToday">今天</small>
                <button
                  type="button"
                  :aria-label="`在 ${cell.date} 新建任务`"
                  @click.stop="openCreate(cell.date)"
                >
                  <Icon icon="ph:plus" width="13" />
                </button>
              </header>
              <div class="day-events">
                <button
                  v-for="event in cell.events.slice(0, 4)"
                  :key="event.id"
                  type="button"
                  class="calendar-event"
                  :class="[
                    `tone-${eventTone(event)}`,
                    { 'is-locked': isKpiCycleBlock(event), 'is-dragging': draggingId === event.id }
                  ]"
                  :draggable="!isKpiCycleBlock(event)"
                  :title="eventTitle(event)"
                  @click.stop="handleEventClick(event, cell.date)"
                  @dragstart.stop="handleTaskDragStart($event, event)"
                  @dragend="clearDragState"
                >
                  <small>{{ eventBadge(event) }}</small>
                  <span>{{ displayTitle(event) }}</span>
                </button>
                <button
                  v-if="cell.events.length > 4"
                  type="button"
                  class="day-more"
                  @click.stop="selectOverflowDay(cell.date)"
                >
                  还有 {{ cell.events.length - 4 }} 项
                </button>
              </div>
            </article>
          </div>
        </div>

        <div v-else class="week-calendar">
          <article
            v-for="day in weekDays"
            :key="day.date"
            class="week-day"
            :class="{
              'is-today': day.date === DOJO_TODAY,
              'is-selected': selectedDate === day.date,
              'is-drop-target': dragoverDate === day.date
            }"
            @click="selectedDate = day.date"
            @dragenter.prevent="dragoverDate = day.date"
            @dragover.prevent
            @dragleave="handleDragLeave($event, day.date)"
            @drop.prevent="handleDrop($event, day.date)"
          >
            <header>
              <span>
                <small>{{ day.english }}</small>
                <strong>{{ day.weekday }}</strong>
              </span>
              <b>{{ day.day }}</b>
            </header>
            <div class="week-day__events">
              <button
                v-for="event in day.events"
                :key="event.id"
                type="button"
                class="calendar-event calendar-event--week"
                :class="[
                  `tone-${eventTone(event)}`,
                  { 'is-locked': isKpiCycleBlock(event), 'is-dragging': draggingId === event.id }
                ]"
                :draggable="!isKpiCycleBlock(event)"
                @click.stop="handleEventClick(event, day.date)"
                @dragstart.stop="handleTaskDragStart($event, event)"
                @dragend="clearDragState"
              >
                <small>{{ eventBadge(event) }}</small>
                <span>{{ displayTitle(event) }}</span>
                <em>{{ event.owner || event.projectName || '个人事项' }}</em>
              </button>
              <button
                v-if="!day.events.length"
                type="button"
                class="week-empty"
                @click.stop="openCreate(day.date)"
              >
                <Icon icon="ph:plus" width="14" />
                放入第一项安排
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑执行事项' : '新建执行事项'"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="82px">
        <ElFormItem label="标题" prop="title">
          <ElInput v-model="form.title" placeholder="例如：客户过审节点 / 拍摄日" />
        </ElFormItem>
        <ElFormItem label="归属项目">
          <ElSelect
            v-model="form.projectId"
            clearable
            filterable
            placeholder="可选"
            style="width: 100%"
          >
            <ElOption
              v-for="project in dojoProjectStore.projects"
              :key="project.id"
              :label="project.name"
              :value="project.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="起止日期" prop="range">
          <ElDatePicker
            v-model="form.range"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="截止"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect v-model="form.status" style="width: 100%">
            <ElOption label="未开始" value="未开始" />
            <ElOption label="进行中" value="进行中" />
            <ElOption label="已完成" value="已完成" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="负责人">
          <ElInput v-model="form.owner" placeholder="个人任务可以留空" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.note" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton v-if="editingId" type="danger" plain @click="removeEditingEvent">删除</ElButton>
        <span class="dialog-spacer" />
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
  import {
    dojoScheduleStore,
    isKpiBlock,
    removeScheduleBlock,
    upsertScheduleBlock,
    type ScheduleBlock
  } from '@/store/dojoScheduleStore'
  import { DOJO_TODAY, addDays, daysBetween } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoCalendar' })

  type TypeFilter = 'all' | 'project' | 'task'
  type FixedActionId = 'review' | 'live'

  const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const weekEnglish = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const typeFilters: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'project', label: '项目周期' },
    { value: 'task', label: '执行任务' }
  ]
  const fixedActions: Array<{
    id: FixedActionId
    title: string
    detail: string
    icon: string
    note: string
  }> = [
    {
      id: 'review',
      title: '批量复盘',
      detail: '集中处理到期内容与数据',
      icon: 'ph:stack-duotone',
      note: '固定动作 · 汇总到期内容、账号与投流结果'
    },
    {
      id: 'live',
      title: '直播安排',
      detail: '补充主题、平台和负责人',
      icon: 'ph:broadcast-duotone',
      note: '固定动作 · 确认直播主题、平台与时间'
    }
  ]

  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const typeFilter = ref<TypeFilter>('all')
  const viewMode = ref<'week' | 'month'>('month')
  const selectedDate = ref(DOJO_TODAY)
  const cursor = ref(DOJO_TODAY.slice(0, 7))
  const draggingId = ref('')
  const draggingFixedId = ref<FixedActionId | ''>('')
  const dragoverDate = ref('')

  const dialogVisible = ref(false)
  const editingId = ref('')
  const formRef = ref<FormInstance>()
  const form = reactive({
    title: '',
    projectId: '',
    range: null as [string, string] | null,
    status: '未开始',
    owner: '',
    note: ''
  })
  const rules: FormRules = {
    title: [{ required: true, message: '请填写标题', trigger: 'blur' }],
    range: [{ required: true, message: '请选择起止日期', trigger: 'change' }]
  }

  watch(selectedProjectIds, (ids) => {
    dojoProjectStore.selectedIds = [...ids]
  })

  function isKpiCycleBlock(block: ScheduleBlock) {
    return block.id.startsWith('KPI-CYCLE-')
  }

  function isCalendarBlock(block: ScheduleBlock) {
    if (!isKpiBlock(block)) return true
    return isKpiCycleBlock(block)
  }

  const projectFilteredBlocks = computed(() => {
    void dojoScheduleStore.revision
    return dojoScheduleStore.blocks.filter((block) => {
      if (!isCalendarBlock(block)) return false
      if (
        selectedProjectIds.value.length &&
        block.projectId &&
        !selectedProjectIds.value.includes(block.projectId)
      ) {
        return false
      }
      return true
    })
  })

  const filteredBlocks = computed(() =>
    projectFilteredBlocks.value.filter((block) => {
      if (typeFilter.value === 'project') return isKpiCycleBlock(block)
      if (typeFilter.value === 'task') return !isKpiBlock(block)
      return true
    })
  )

  const kitTasks = computed(() =>
    filteredBlocks.value
      .filter((block) => !isKpiBlock(block) && block.status !== '已完成')
      .sort(
        (a, b) => a.start.localeCompare(b.start) || displayTitle(a).localeCompare(displayTitle(b))
      )
  )

  const monthKey = computed(() => cursor.value)
  const periodLabel = computed(() => {
    if (viewMode.value === 'month') {
      const [year, month] = monthKey.value.split('-')
      return `${year}年${Number(month)}月`
    }
    const dates = weekDates.value
    return `${formatShortDate(dates[0])} — ${formatShortDate(dates[6])}`
  })

  const visibleSummary = computed(() => {
    const dates =
      viewMode.value === 'month' ? monthCells.value.map((cell) => cell.date) : weekDates.value
    const start = dates[0]
    const end = dates.at(-1) || start
    const count = filteredBlocks.value.filter(
      (block) => block.start <= end && block.end >= start
    ).length
    return `${count} 项安排 · 拖动即可改期`
  })

  function startOfWeek(date: string) {
    const day = new Date(`${date}T00:00:00`).getDay()
    return addDays(date, -((day + 6) % 7))
  }

  const weekDates = computed(() => {
    const start = startOfWeek(selectedDate.value)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  })

  function blocksForDate(date: string) {
    return filteredBlocks.value
      .filter((block) => block.start <= date && block.end >= date)
      .sort((a, b) => {
        const rank = (block: ScheduleBlock) =>
          isKpiCycleBlock(block) ? 2 : block.status === '已完成' ? 1 : 0
        return rank(a) - rank(b) || a.start.localeCompare(b.start)
      })
  }

  const monthCells = computed(() => {
    const [year, month] = monthKey.value.split('-').map(Number)
    const first = new Date(year, month - 1, 1)
    const padding = (first.getDay() + 6) % 7
    const start = new Date(year, month - 1, 1 - padding)
    return Array.from({ length: 42 }, (_, index) => {
      const dateValue = new Date(start)
      dateValue.setDate(start.getDate() + index)
      const date = toIsoDate(dateValue)
      return {
        date,
        day: dateValue.getDate(),
        inMonth: dateValue.getMonth() === month - 1,
        isToday: date === DOJO_TODAY,
        events: blocksForDate(date)
      }
    })
  })

  const weekDays = computed(() =>
    weekDates.value.map((date, index) => ({
      date,
      english: weekEnglish[index],
      weekday: weekNames[index],
      day: Number(date.slice(-2)),
      events: blocksForDate(date)
    }))
  )

  function toIsoDate(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatShortDate(date: string) {
    const [, month, day] = date.split('-')
    return `${Number(month)}月${Number(day)}日`
  }

  function displayTitle(block: ScheduleBlock) {
    if (isKpiCycleBlock(block))
      return block.projectName || block.title.replace(/\s*·\s*周期.*$/, '')
    return block.title
  }

  function eventTone(block: ScheduleBlock) {
    if (isKpiCycleBlock(block)) return 'cycle'
    if (block.status === '已完成') return 'done'
    if (/复盘|review/i.test(block.title)) return 'review'
    if (block.type === 'publish' || block.type === 'ad' || /直播/.test(block.title)) return 'signal'
    return 'task'
  }

  function eventBadge(block: ScheduleBlock) {
    if (isKpiCycleBlock(block)) return '项目周期'
    if (block.start !== block.end) return `${daysBetween(block.start, block.end) + 1}天`
    return block.status || '任务'
  }

  function eventTitle(block: ScheduleBlock) {
    return `${displayTitle(block)} · ${block.start} 至 ${block.end}`
  }

  function shiftPeriod(delta: number) {
    if (viewMode.value === 'week') {
      selectedDate.value = addDays(selectedDate.value, delta * 7)
      cursor.value = selectedDate.value.slice(0, 7)
      return
    }
    const [year, month] = monthKey.value.split('-').map(Number)
    const date = new Date(year, month - 1 + delta, 1)
    cursor.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    selectedDate.value = `${cursor.value}-01`
  }

  function goToday() {
    selectedDate.value = DOJO_TODAY
    cursor.value = DOJO_TODAY.slice(0, 7)
  }

  function handleTaskDragStart(event: DragEvent, block: ScheduleBlock) {
    if (isKpiCycleBlock(block) || !event.dataTransfer) {
      event.preventDefault()
      return
    }
    draggingId.value = block.id
    draggingFixedId.value = ''
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-dojo-schedule', block.id)
    event.dataTransfer.setData('text/plain', block.id)
  }

  function handleFixedDragStart(event: DragEvent, id: FixedActionId) {
    if (!event.dataTransfer) return
    draggingFixedId.value = id
    draggingId.value = ''
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-dojo-fixed', id)
  }

  function clearDragState() {
    draggingId.value = ''
    draggingFixedId.value = ''
    dragoverDate.value = ''
  }

  function handleDragLeave(event: DragEvent, date: string) {
    const current = event.currentTarget as HTMLElement
    if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return
    if (dragoverDate.value === date) dragoverDate.value = ''
  }

  function handleDrop(event: DragEvent, date: string) {
    const fixedId = event.dataTransfer?.getData('application/x-dojo-fixed') as FixedActionId
    if (fixedId === 'review' || fixedId === 'live') {
      scheduleFixed(fixedId, date)
      clearDragState()
      return
    }

    const blockId = event.dataTransfer?.getData('application/x-dojo-schedule') || draggingId.value
    const block = dojoScheduleStore.blocks.find((item) => item.id === blockId)
    if (!block || isKpiCycleBlock(block)) {
      clearDragState()
      return
    }

    const duration = Math.max(0, daysBetween(block.start, block.end))
    const previousStart = block.start
    upsertScheduleBlock({
      ...block,
      start: date,
      end: addDays(date, duration)
    })
    selectedDate.value = date
    cursor.value = date.slice(0, 7)
    ElMessage.success(
      `${displayTitle(block)}：${formatShortDate(previousStart)} → ${formatShortDate(date)}`
    )
    clearDragState()
  }

  function scheduleFixed(id: FixedActionId, date: string) {
    const action = fixedActions.find((item) => item.id === id)
    if (!action) return
    const projectId = selectedProjectIds.value[0] || ''
    const project = projectId ? getProjectById(projectId) : null
    upsertScheduleBlock({
      projectId,
      projectName: project?.name || '',
      title: action.title,
      type: id === 'live' ? 'publish' : 'task',
      start: date,
      end: date,
      note: action.note,
      source: 'calendar',
      owner: '',
      status: '未开始'
    })
    selectedDate.value = date
    cursor.value = date.slice(0, 7)
    ElMessage.success(`${action.title}已安排到 ${formatShortDate(date)}`)
  }

  function handleEventClick(block: ScheduleBlock, date: string) {
    selectedDate.value = date
    if (isKpiCycleBlock(block)) {
      ElMessage.info('项目周期由项目 KPI 同步；普通执行任务可以直接拖动改期')
      return
    }
    openEdit(block)
  }

  function selectOverflowDay(date: string) {
    selectedDate.value = date
    viewMode.value = 'week'
  }

  function openCreate(date: string) {
    editingId.value = ''
    form.title = ''
    form.projectId = selectedProjectIds.value[0] || ''
    form.range = [date, date]
    form.status = '未开始'
    form.owner = ''
    form.note = ''
    selectedDate.value = date
    dialogVisible.value = true
  }

  function openEdit(block: ScheduleBlock) {
    if (isKpiCycleBlock(block)) return
    editingId.value = block.id
    form.title = block.title
    form.projectId = block.projectId
    form.range = [block.start, block.end]
    form.status = block.status || '未开始'
    form.owner = block.owner || ''
    form.note = block.note || ''
    dialogVisible.value = true
  }

  function resetForm() {
    formRef.value?.clearValidate()
  }

  async function submitForm() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid || !form.range) return
    const project = form.projectId ? getProjectById(form.projectId) : null
    const existing = editingId.value
      ? dojoScheduleStore.blocks.find((block) => block.id === editingId.value)
      : null
    upsertScheduleBlock({
      id: editingId.value || undefined,
      projectId: form.projectId || existing?.projectId || '',
      projectName: project?.name || existing?.projectName || '',
      title: form.title.trim(),
      type: existing?.type || 'task',
      start: form.range[0],
      end: form.range[1] || form.range[0],
      note: form.note.trim(),
      source: existing?.source || 'calendar',
      owner: form.owner.trim(),
      status: form.status
    })
    ElMessage.success(editingId.value ? '执行事项已更新' : '执行事项已创建')
    dialogVisible.value = false
  }

  async function removeEvent(block: ScheduleBlock) {
    try {
      await ElMessageBox.confirm(`删除「${block.title}」？`, '删除执行事项', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    removeScheduleBlock(block.id)
    ElMessage.success('已删除')
  }

  function removeEditingEvent() {
    const block = dojoScheduleStore.blocks.find((item) => item.id === editingId.value)
    if (!block) return
    void removeEvent(block).then(() => {
      if (!dojoScheduleStore.blocks.some((item) => item.id === editingId.value)) {
        dialogVisible.value = false
      }
    })
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page';

  .calendar-os {
    min-width: 0;
    padding-bottom: 18px;
  }

  .calendar-heading {
    margin-bottom: 18px;

    h1 {
      font-size: 34px;
    }

    p {
      max-width: 650px;
    }
  }

  .head-ops {
    align-items: center;
  }

  .view-switch {
    display: inline-grid;
    grid-template-columns: repeat(2, 34px);
    padding: 3px;
    background: var(--dojo-paper-muted);
    border: 1px solid var(--dojo-line-soft);
    border-radius: 10px;

    button {
      height: 30px;
      padding: 0;
      font-size: 11px;
      font-weight: 650;
      color: var(--dojo-muted);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 7px;

      &.is-active {
        color: #fffdfc;
        background: #403666;
        box-shadow: none;
      }

      &:focus-visible {
        outline: 2px solid var(--dojo-action-soft);
        outline-offset: 2px;
      }
    }
  }

  .calendar-workspace {
    display: grid;
    grid-template-columns: minmax(260px, 330px) minmax(0, 1fr);
    min-width: 0;
    height: calc(100dvh - 260px);
    min-height: 610px;
    overflow: hidden;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 24px;
    box-shadow: var(--dojo-shadow-sm);
  }

  .rhythm-kit {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--dojo-paper-muted);
    border-right: 1px solid var(--dojo-line);

    &__head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px 12px;
      padding: 19px 19px 15px;
      border-bottom: 1px solid var(--dojo-line-soft);

      > div {
        display: grid;
        gap: 5px;
      }

      span {
        font-size: 10px;
        font-weight: 800;
        color: var(--dojo-action);
        letter-spacing: 0.14em;
      }

      strong {
        font-family: 'Source Han Serif SC', 'Songti SC', serif;
        font-size: 21px;
        font-weight: 650;
        color: var(--dojo-ink);
      }

      small {
        align-self: end;
        padding-bottom: 2px;
        font-size: 11px;
        color: var(--dojo-muted);
      }

      p {
        grid-column: 1 / -1;
        margin: 3px 0 0;
        font-size: 11px;
        line-height: 1.55;
        color: var(--dojo-muted);
      }
    }

    &__filters {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--dojo-line-soft);

      button {
        min-height: 29px;
        padding: 0 6px;
        font-size: 11px;
        color: var(--dojo-muted);
        cursor: pointer;
        background: transparent;
        border: 0;
        border-radius: 7px;

        &.is-active {
          color: var(--dojo-action-strong);
          background: #fff;
          box-shadow: 0 2px 8px rgb(20 37 64 / 7%);
        }

        &:focus-visible {
          outline: 2px solid var(--dojo-action-soft);
        }
      }
    }

    &__scroll {
      flex: 1;
      min-height: 0;
      padding: 16px 14px 22px;
      overflow-y: auto;
      scrollbar-color: #bdc8d8 transparent;
    }
  }

  .kit-section {
    & + & {
      margin-top: 24px;
    }

    h2 {
      margin: 0 0 9px 2px;
      font-size: 11px;
      font-weight: 750;
      color: var(--dojo-muted);
      letter-spacing: 0.11em;
    }
  }

  .fixed-action {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 8px 9px;
    align-items: center;
    padding: 10px;
    cursor: grab;
    background: #fff;
    border: 1px solid var(--dojo-line-soft);
    border-radius: 11px;

    & + & {
      margin-top: 7px;
    }

    &:active {
      cursor: grabbing;
    }

    > span:nth-child(2) {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    strong {
      font-size: 10px;
      color: var(--dojo-ink);
    }

    small {
      overflow: hidden;
      font-size: 10px;
      color: var(--dojo-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    button {
      grid-column: 2;
      justify-self: start;
      padding: 0;
      font-size: 10px;
      font-weight: 650;
      color: var(--dojo-action);
      cursor: pointer;
      background: transparent;
      border: 0;

      &:hover,
      &:focus-visible {
        color: var(--dojo-action-strong);
        text-decoration: underline;
        text-underline-offset: 2px;
        outline: 0;
      }
    }
  }

  .fixed-action__icon {
    display: grid;
    grid-row: span 2;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--dojo-purple);
    background: #eeeafd;
    border-radius: 9px;
  }

  .kit-task {
    position: relative;
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: center;
    width: 100%;
    padding: 10px 9px 10px 6px;
    color: var(--dojo-ink);
    text-align: left;
    cursor: grab;
    background: #fff;
    border: 1px solid var(--dojo-line-soft);
    border-radius: 10px;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      opacity 150ms ease;

    & + & {
      margin-top: 7px;
    }

    &:hover,
    &:focus-visible {
      border-color: #9eb8ea;
      outline: 0;
      box-shadow: 0 7px 16px rgb(28 52 88 / 8%);
    }

    &:active {
      cursor: grabbing;
    }

    &.is-dragging {
      opacity: 0.42;
    }

    &.tone-review {
      background: #faf8ff;
    }

    &.tone-signal {
      background: #f4fbfc;
    }
  }

  .drag-handle {
    color: #98a6b9;
  }

  .kit-task__copy {
    display: grid;
    gap: 3px;
    min-width: 0;

    small,
    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      font-size: 7px;
      color: var(--dojo-muted);
    }

    strong {
      font-size: 10px;
      font-weight: 650;
    }
  }

  .kit-task__status {
    font-size: 7px;
    color: var(--dojo-muted);
    white-space: nowrap;
  }

  .kit-empty {
    display: grid;
    gap: 7px;
    place-items: center;
    align-content: center;
    min-height: 132px;
    color: var(--dojo-muted);
    border: 1px dashed var(--dojo-line);
    border-radius: 11px;

    strong {
      font-size: 11px;
    }

    button {
      padding: 0;
      font-size: 10px;
      color: var(--dojo-action);
      cursor: pointer;
      background: transparent;
      border: 0;
    }
  }

  .calendar-stage {
    min-width: 0;
    overflow: auto;
    background: #fbfcff;
    scrollbar-color: #b9c5d7 transparent;
  }

  .calendar-toolbar {
    position: sticky;
    top: 0;
    z-index: 8;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-width: 900px;
    height: 66px;
    padding: 0 16px;
    background: rgb(251 252 255 / 96%);
    border-bottom: 1px solid var(--dojo-line);
  }

  .calendar-nav {
    display: flex;
    gap: 5px;

    button {
      display: grid;
      place-items: center;
      width: 31px;
      height: 31px;
      padding: 0;
      font-size: 10px;
      color: var(--dojo-ink);
      cursor: pointer;
      background: #fff;
      border: 1px solid var(--dojo-line);
      border-radius: 8px;

      &:hover,
      &:focus-visible {
        color: var(--dojo-action);
        border-color: #9db8ef;
        outline: 0;
      }
    }
  }

  .calendar-period {
    display: grid;
    gap: 2px;
    text-align: center;

    strong {
      font-family: 'Source Han Serif SC', 'Songti SC', serif;
      font-size: 18px;
      color: var(--dojo-ink);
    }

    small {
      font-size: 10px;
      color: var(--dojo-muted);
    }
  }

  .calendar-add {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-self: end;
    min-height: 32px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 650;
    color: var(--dojo-ink);
    cursor: pointer;
    background: color-mix(in srgb, var(--dojo-accent) 12%, var(--dojo-paper));
    border: 1px solid var(--dojo-line);
    border-radius: 10px;

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--dojo-accent) 18%, var(--dojo-paper));
      border-color: var(--dojo-accent-soft);
      outline: 0;
    }
  }

  .month-calendar {
    min-width: 900px;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(128px, 1fr));
  }

  .weekday-label {
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 9px;
    font-size: 10px;
    font-weight: 700;
    color: var(--dojo-muted);
    border-right: 1px solid var(--dojo-line-soft);
    border-bottom: 1px solid var(--dojo-line);
  }

  .calendar-day {
    min-height: 126px;
    padding: 7px;
    background: #fff;
    border-right: 1px solid var(--dojo-line-soft);
    border-bottom: 1px solid var(--dojo-line-soft);
    transition:
      background 140ms ease,
      box-shadow 140ms ease;

    &:hover {
      background: var(--dojo-paper-muted);
    }

    &.is-outside {
      color: var(--dojo-muted-light);
      background: var(--dojo-paper-muted);
    }

    &.is-today {
      background: color-mix(in srgb, var(--dojo-accent) 10%, var(--dojo-paper));
    }

    &.is-selected {
      box-shadow: inset 0 0 0 1px var(--dojo-line-strong, var(--dojo-line));
    }

    &.is-drop-target {
      background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
      box-shadow: inset 0 0 0 2px var(--dojo-action);
    }

    > header {
      display: flex;
      gap: 5px;
      align-items: center;
      height: 23px;
      margin-bottom: 4px;

      > span {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--dojo-ink);
      }

      > small {
        font-size: 7px;
        color: var(--dojo-action);
      }

      > button {
        display: grid;
        place-items: center;
        width: 21px;
        height: 21px;
        padding: 0;
        margin-left: auto;
        color: var(--dojo-muted);
        cursor: pointer;
        background: transparent;
        border: 0;
        border-radius: 6px;
        opacity: 0;

        &:focus-visible {
          outline: 2px solid var(--dojo-action-soft);
          opacity: 1;
        }
      }
    }

    &:hover > header > button {
      opacity: 1;
    }

    &.is-today > header > span {
      color: #fff;
      background: var(--dojo-action);
      border-radius: 7px;
    }
  }

  .day-events {
    display: grid;
    gap: 4px;
  }

  .calendar-event {
    display: grid;
    gap: 1px;
    width: 100%;
    min-width: 0;
    padding: 5px 6px;
    color: var(--dojo-ink);
    text-align: left;
    cursor: grab;
    background: color-mix(in srgb, var(--dojo-accent) 10%, var(--dojo-paper));
    border: 1px solid #d0def7;
    border-radius: 6px;

    &:hover,
    &:focus-visible {
      border-color: #82a4e4;
      outline: 0;
    }

    &:active {
      cursor: grabbing;
    }

    small,
    span,
    em {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      font-size: 6px;
      font-weight: 650;
      color: #5574ad;
    }

    span {
      font-size: 10px;
      font-weight: 650;
    }

    em {
      font-size: 7px;
      font-style: normal;
      color: var(--dojo-muted);
    }

    &.tone-cycle {
      background: #eaf8fa;
      border-color: #bce2e7;

      small {
        color: #267e89;
      }
    }

    &.tone-review {
      background: #f2edff;
      border-color: #d9cef7;

      small {
        color: #7357b4;
      }
    }

    &.tone-signal {
      background: #edf9f6;
      border-color: #c3e5dc;

      small {
        color: #247f69;
      }
    }

    &.tone-done {
      background: #f0f3f5;
      border-color: #d8dee5;
      opacity: 0.67;

      span {
        text-decoration: line-through;
      }
    }

    &.is-locked {
      cursor: default;
    }

    &.is-dragging {
      opacity: 0.35;
    }

    &--week {
      gap: 3px;
      min-height: 58px;
      padding: 9px 8px;

      small {
        font-size: 7px;
      }

      span {
        font-size: 11px;
        line-height: 1.35;
        white-space: normal;
      }
    }
  }

  .day-more {
    padding: 2px 4px;
    font-size: 7px;
    color: var(--dojo-muted);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover,
    &:focus-visible {
      color: var(--dojo-action);
      outline: 0;
    }
  }

  .week-calendar {
    display: grid;
    grid-template-columns: repeat(7, minmax(128px, 1fr));
    min-width: 900px;
    min-height: calc(100% - 66px);
  }

  .week-day {
    min-height: 100%;
    padding: 11px 8px 16px;
    background: #fff;
    border-right: 1px solid var(--dojo-line-soft);
    transition:
      background 140ms ease,
      box-shadow 140ms ease;

    &:hover,
    &.is-selected {
      background: #f8faff;
    }

    &.is-drop-target {
      background: #eaf2ff;
      box-shadow: inset 0 0 0 2px var(--dojo-action);
    }

    > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1px 3px 11px;
      border-bottom: 1px solid var(--dojo-line-soft);

      > span {
        display: grid;
        gap: 3px;
      }

      small {
        font-size: 7px;
        font-weight: 750;
        color: var(--dojo-muted);
        letter-spacing: 0.1em;
      }

      strong {
        font-size: 11px;
        color: var(--dojo-ink);
      }

      b {
        display: grid;
        place-items: center;
        width: 29px;
        height: 29px;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--dojo-ink);
        border-radius: 8px;
      }
    }

    &.is-today > header b {
      color: #fff;
      background: var(--dojo-action);
    }

    &__events {
      display: grid;
      gap: 6px;
      padding-top: 9px;
    }
  }

  .week-empty {
    display: flex;
    gap: 5px;
    align-items: center;
    justify-content: center;
    min-height: 72px;
    font-size: 10px;
    color: #8b99ad;
    cursor: pointer;
    background: transparent;
    border: 1px dashed var(--dojo-line);
    border-radius: 8px;

    &:hover,
    &:focus-visible {
      color: var(--dojo-action);
      border-color: #93afe5;
      outline: 0;
    }
  }

  .dialog-spacer {
    flex: 1;
  }

  :deep(.el-dialog__footer) {
    display: flex;
    align-items: center;
  }

  @container workspace (max-width: 720px) {
    .calendar-workspace {
      grid-template-columns: 1fr;
      height: auto;
      min-height: 0;
      overflow: visible;
    }

    .rhythm-kit {
      order: 2;
      max-height: 320px;
      border-top: 1px solid var(--dojo-line);
      border-right: 0;
    }

    .calendar-stage {
      order: 1;
      min-height: 560px;
      overflow-x: auto;
    }
  }

  @media (width <= 800px) {
    .calendar-heading {
      align-items: flex-start;

      h1 {
        font-size: 29px;
      }
    }

    .calendar-workspace {
      grid-template-columns: 1fr;
      height: auto;
      min-height: 0;
      overflow: visible;
    }

    .rhythm-kit {
      order: 2;
      max-height: 350px;
      border-top: 1px solid var(--dojo-line);
      border-right: 0;
    }

    .calendar-stage {
      order: 1;
      min-height: 660px;
      border-radius: 14px 14px 0 0;
    }
  }

  @media (width <= 640px) {
    .calendar-heading {
      margin-bottom: 14px;

      .head-ops {
        display: grid;
        grid-template-columns: 1fr auto auto;
        width: 100%;
      }

      :deep(.dojo-project-select) {
        width: 100% !important;
      }
    }

    .rhythm-kit__head {
      padding: 16px;
    }

    .calendar-workspace {
      border-radius: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-task,
    .calendar-day,
    .week-day {
      transition: none;
    }
  }
</style>
