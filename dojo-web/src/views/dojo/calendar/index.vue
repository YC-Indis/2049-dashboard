<template>
  <div class="dojo-page calendar-bi">
    <header class="dojo-page__head">
      <div>
        <h1>节奏日历</h1>
        <p>只看项目周期的起止节点和自建任务；中间日期不刷重复阶段，点格子看当天详情。</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="240px" />
        <ElRadioGroup v-model="typeFilter" size="default">
          <ElRadioButton value="all">全部</ElRadioButton>
          <ElRadioButton value="project">项目周期</ElRadioButton>
          <ElRadioButton value="task">自建</ElRadioButton>
        </ElRadioGroup>
        <ElButton type="primary" @click="openCreate(selectedDate)">新建任务</ElButton>
      </div>
    </header>

    <div class="bi-row">
      <div class="bi-card">
        <span class="bi-card__n">{{ monthStats.starts }}</span>
        <span class="bi-card__l">本月起点</span>
      </div>
      <div class="bi-card">
        <span class="bi-card__n">{{ monthStats.ends }}</span>
        <span class="bi-card__l">本月截止</span>
      </div>
      <div class="bi-card">
        <span class="bi-card__n">{{ monthStats.ongoing }}</span>
        <span class="bi-card__l">进行中项目</span>
      </div>
      <div class="bi-card">
        <span class="bi-card__n accent">{{ monthStats.tasks }}</span>
        <span class="bi-card__l">自建任务</span>
      </div>
      <div class="bi-card">
        <span class="bi-card__n">{{ monthStats.projects }}</span>
        <span class="bi-card__l">项目周期</span>
      </div>
    </div>

    <div class="calendar-layout">
      <section class="calendar-main">
        <div class="calendar-toolbar">
          <ElButton size="small" @click="shiftMonth(-1)">上月</ElButton>
          <strong>{{ monthLabel }}</strong>
          <ElButton size="small" @click="shiftMonth(1)">下月</ElButton>
          <ElButton size="small" type="primary" plain @click="goToday">今天</ElButton>
          <span class="muted">格子上只标起点/截止；中间有热力=有项目在跑，详情看右侧</span>
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
              busy: cell.events.length > 0
            }"
            @click="selectedDate = cell.date"
          >
            <div class="day-cell__top">
              <span class="day-num">{{ cell.day }}</span>
              <button type="button" class="day-add" title="新建任务" @click.stop="openCreate(cell.date)">
                +
              </button>
              <span v-if="cell.chips.length" class="day-count">{{ cell.chips.length }}</span>
            </div>
            <div v-if="cell.load" class="day-heat">
              <i :style="{ width: `${Math.min(100, (cell.load / maxDayLoad) * 100)}%` }" />
            </div>
            <div class="day-events">
              <div
                v-for="ev in cell.chips.slice(0, 2)"
                :key="ev.key"
                class="day-chip"
                :class="`day-chip--${ev.tone}`"
                :title="ev.tip"
              >
                {{ ev.label }}
              </div>
              <span v-if="cell.chips.length > 2" class="day-more">+{{ cell.chips.length - 2 }}</span>
            </div>
          </div>
        </div>
      </section>

      <aside class="day-panel">
        <div class="day-panel__head">
          <div>
            <strong>{{ selectedDate }}</strong>
            <span class="muted">{{ weekdayLabel(selectedDate) }}</span>
          </div>
          <ElButton type="primary" size="small" @click="openCreate(selectedDate)">添加</ElButton>
        </div>

        <p v-if="!dayEvents.length" class="day-panel__empty">
          这天没有节奏节点。可添加自建任务，或到项目总览同步项目周期。
        </p>

        <article
          v-for="ev in dayEvents"
          :key="ev.id"
          class="event-card"
          :class="{ kpi: isKpiCycleBlock(ev) }"
        >
          <header class="event-card__head">
            <ElTag size="small" :type="isKpiCycleBlock(ev) ? 'warning' : 'primary'" effect="plain">
              {{ isKpiCycleBlock(ev) ? '项目周期' : '任务' }}
            </ElTag>
            <ElTag v-if="boundaryTag(ev)" size="small" effect="dark">{{ boundaryTag(ev) }}</ElTag>
            <span class="muted">{{ ev.projectName || '未归属' }}</span>
          </header>
          <h3>{{ displayTitle(ev) }}</h3>
          <p class="event-card__range">
            {{ ev.start }} → {{ ev.end }}
            <em>{{ spanDays(ev) }} 天</em>
          </p>
          <p v-if="ev.note && !isKpiCycleBlock(ev)" class="event-card__note">{{ ev.note }}</p>
          <p v-if="ev.owner || ev.status" class="event-card__meta">
            <span v-if="ev.owner">负责人 {{ ev.owner }}</span>
            <span v-if="ev.status">{{ ev.status }}</span>
          </p>
          <footer class="event-card__ops">
            <ElButton v-if="!isKpiCycleBlock(ev)" link type="primary" @click="openEdit(ev)">
              编辑
            </ElButton>
            <ElButton v-if="!isKpiCycleBlock(ev)" link type="danger" @click="removeEvent(ev)">
              删除
            </ElButton>
            <span v-else class="muted">周期请在项目总览 / 项目排期调整</span>
          </footer>
        </article>
      </aside>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑事项' : '新建任务'"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="88px">
        <ElFormItem label="标题" prop="title">
          <ElInput v-model="form.title" placeholder="例：客户过审节点 / 拍摄日" />
        </ElFormItem>
        <ElFormItem label="归属项目">
          <ElSelect v-model="form.projectId" clearable filterable placeholder="可选" style="width: 100%">
            <ElOption
              v-for="p in dojoProjectStore.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
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
          <ElInput v-model="form.owner" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.note" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
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
  import { DOJO_TODAY, daysBetween } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoCalendar' })

  const weekNames = ['一', '二', '三', '四', '五', '六', '日']
  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const typeFilter = ref<'all' | 'project' | 'task'>('all')
  const selectedDate = ref(DOJO_TODAY)
  const cursor = ref(DOJO_TODAY.slice(0, 7))

  const dialogVisible = ref(false)
  const editingId = ref('')
  const formRef = ref<FormInstance>()
  const form = reactive({
    title: '',
    projectId: '',
    range: null as [string, string] | null,
    status: '进行中',
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

  /** 项目周期主条：日历只认这条，不铺起号/脚本等阶段细条 */
  function isKpiCycleBlock(b: ScheduleBlock) {
    return b.id.startsWith('KPI-CYCLE-')
  }

  /** 节奏日历可见：项目周期 + 自建任务；KPI 阶段明细一律隐藏 */
  function isCalendarBlock(b: ScheduleBlock) {
    if (!isKpiBlock(b)) return true
    return isKpiCycleBlock(b)
  }

  const filteredBlocks = computed(() => {
    void dojoScheduleStore.revision
    return dojoScheduleStore.blocks.filter((b) => {
      if (!isCalendarBlock(b)) return false
      if (selectedProjectIds.value.length && !selectedProjectIds.value.includes(b.projectId)) {
        if (b.projectId) return false
      }
      if (typeFilter.value === 'project' && !isKpiCycleBlock(b)) return false
      if (typeFilter.value === 'task' && isKpiBlock(b)) return false
      return true
    })
  })

  const monthKey = computed(() => cursor.value)
  const monthLabel = computed(() => {
    const [y, m] = monthKey.value.split('-')
    return `${y} 年 ${Number(m)} 月`
  })

  const monthStats = computed(() => {
    const key = monthKey.value
    let starts = 0
    let ends = 0
    let ongoing = 0
    let tasks = 0
    let projects = 0
    filteredBlocks.value.forEach((b) => {
      if (b.start.startsWith(key)) starts++
      if (b.end.startsWith(key)) ends++
      if (b.start < `${key}-01` && b.end > lastDayOfMonth(key)) ongoing++
      else if (b.start < `${key}-01` && b.end.startsWith(key)) ongoing++
      else if (b.start.startsWith(key) && b.end > lastDayOfMonth(key)) ongoing++
      if (isKpiCycleBlock(b)) projects++
      else tasks++
    })
    return { starts, ends, ongoing, tasks, projects }
  })

  function lastDayOfMonth(ym: string) {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m, 0)
    return `${ym}-${String(d.getDate()).padStart(2, '0')}`
  }

  function weekdayLabel(date: string) {
    const map = ['日', '一', '二', '三', '四', '五', '六']
    return `周${map[new Date(`${date}T00:00:00`).getDay()]}`
  }

  function spanDays(b: ScheduleBlock) {
    return Math.max(1, daysBetween(b.start, b.end) + 1)
  }

  function boundaryTag(b: ScheduleBlock) {
    if (b.start === selectedDate.value && b.end === selectedDate.value) return '当天'
    if (b.start === selectedDate.value) return '起点'
    if (b.end === selectedDate.value) return '截止'
    if (b.start < selectedDate.value && b.end > selectedDate.value) return '进行中'
    return ''
  }

  function displayTitle(b: ScheduleBlock) {
    if (isKpiCycleBlock(b)) return b.projectName || b.title.replace(/\s*·\s*周期.*$/, '')
    return b.title
  }

  function chipName(b: ScheduleBlock) {
    const name = displayTitle(b)
    return name.length > 8 ? `${name.slice(0, 8)}…` : name
  }

  type Chip = { key: string; label: string; tip: string; tone: 'start' | 'end' | 'task' }

  /**
   * 格子规则：只标「起 / 止 / 当天任务」。
   * 跨天中间不写字，避免起号/脚本每天刷一遍。
   */
  function chipsForDate(date: string, events: ScheduleBlock[]): Chip[] {
    const chips: Chip[] = []
    events.forEach((b) => {
      if (b.start === date && b.end === date) {
        chips.push({
          key: `${b.id}-d`,
          label: chipName(b),
          tip: displayTitle(b),
          tone: 'task'
        })
        return
      }
      if (b.start === date) {
        chips.push({
          key: `${b.id}-s`,
          label: `起 · ${chipName(b)}`,
          tip: `${displayTitle(b)} 开始`,
          tone: 'start'
        })
      }
      if (b.end === date) {
        chips.push({
          key: `${b.id}-e`,
          label: `止 · ${chipName(b)}`,
          tip: `${displayTitle(b)} 截止`,
          tone: 'end'
        })
      }
    })
    return chips
  }

  const monthCells = computed(() => {
    const [y, m] = monthKey.value.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const pad = (first.getDay() + 6) % 7
    const start = new Date(y, m - 1, 1 - pad)
    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const covering = filteredBlocks.value.filter((b) => b.start <= date && b.end >= date)
      const chips = chipsForDate(date, covering)
      cells.push({
        key: date,
        date,
        day: d.getDate(),
        inMonth: d.getMonth() === m - 1,
        isToday: date === DOJO_TODAY,
        events: covering,
        chips,
        // 热力：有多少项目/任务覆盖这天（不写字，只提示「有事在跑」）
        load: covering.length
      })
    }
    return cells
  })

  const maxDayLoad = computed(() => Math.max(1, ...monthCells.value.map((c) => c.load)))

  const dayEvents = computed(() =>
    filteredBlocks.value
      .filter((b) => b.start <= selectedDate.value && b.end >= selectedDate.value)
      .sort((a, b) => {
        const rank = (x: ScheduleBlock) => {
          if (x.start === selectedDate.value || x.end === selectedDate.value) return 0
          if (!isKpiBlock(x)) return 1
          return 2
        }
        const d = rank(a) - rank(b)
        if (d) return d
        return a.start.localeCompare(b.start) || displayTitle(a).localeCompare(displayTitle(b))
      })
  )

  function shiftMonth(delta: number) {
    const [y, m] = monthKey.value.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    cursor.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function goToday() {
    cursor.value = DOJO_TODAY.slice(0, 7)
    selectedDate.value = DOJO_TODAY
  }

  function openCreate(date: string) {
    editingId.value = ''
    form.title = ''
    form.projectId = selectedProjectIds.value[0] || ''
    form.range = [date, date]
    form.status = '进行中'
    form.owner = ''
    form.note = ''
    dialogVisible.value = true
  }

  function openEdit(ev: ScheduleBlock) {
    editingId.value = ev.id
    form.title = ev.title
    form.projectId = ev.projectId
    form.range = [ev.start, ev.end]
    form.status = ev.status || '进行中'
    form.owner = ev.owner || ''
    form.note = ev.note || ''
    dialogVisible.value = true
  }

  function resetForm() {
    formRef.value?.clearValidate()
  }

  async function submitForm() {
    const ok = await formRef.value?.validate().catch(() => false)
    if (!ok || !form.range) return
    const project = form.projectId ? getProjectById(form.projectId) : null
    const existing = editingId.value
      ? dojoScheduleStore.blocks.find((b) => b.id === editingId.value)
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
    ElMessage.success(editingId.value ? '已更新' : '已创建任务')
    dialogVisible.value = false
  }

  async function removeEvent(ev: ScheduleBlock) {
    await ElMessageBox.confirm(`删除「${ev.title}」？`, '删除事项', { type: 'warning' })
    removeScheduleBlock(ev.id)
    ElMessage.success('已删除')
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .bi-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;

    @media (max-width: 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .bi-card {
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);

    &__n {
      display: block;
      font-size: 22px;
      font-weight: 650;
      line-height: 1.2;

      &.accent {
        color: var(--el-color-primary);
      }
    }

    &__l {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .calendar-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 14px;
    align-items: start;

    @media (max-width: 1100px) {
      grid-template-columns: 1fr;
    }
  }

  .calendar-main {
    padding: 14px 16px 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
  }

  .calendar-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;

    strong {
      min-width: 7rem;
      text-align: center;
      font-size: 15px;
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .week-head {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    text-align: center;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-cell {
    min-height: 104px;
    padding: 6px;
    border: 1px solid var(--el-border-color-extra-light);
    border-radius: 8px;
    background: var(--el-fill-color-blank);
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }

    &.muted {
      opacity: 0.45;
    }

    &.today {
      border-color: var(--el-color-primary);
    }

    &.selected {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary);
    }

    &.busy .day-num {
      font-weight: 700;
    }

    &__top {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
  }

  .day-num {
    font-size: 13px;
  }

  .day-add {
    margin-left: auto;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-placeholder);
    cursor: pointer;

    &:hover {
      background: var(--el-color-primary-light-8);
      color: var(--el-color-primary);
    }
  }

  .day-count {
    min-width: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    font-size: 11px;
    text-align: center;
  }

  .day-heat {
    height: 3px;
    margin-bottom: 4px;
    border-radius: 2px;
    background: var(--el-fill-color);

    i {
      display: block;
      height: 100%;
      border-radius: 2px;
      background: var(--el-color-primary-light-3);
    }
  }

  .day-events {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .day-chip {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &--start {
      background: rgb(34 197 94 / 14%);
      color: #15803d;
    }

    &--end {
      background: rgb(239 68 68 / 12%);
      color: #b91c1c;
    }

    &--span {
      background: rgb(245 158 11 / 14%);
      color: #b45309;
    }

    &--task {
      background: rgb(59 130 246 / 12%);
      color: #1d4ed8;
    }
  }

  .day-more {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
  }

  .day-panel {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 140px);
    overflow: auto;
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);

    &__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;

      strong {
        display: block;
        font-size: 16px;
      }
    }

    &__empty {
      margin: 24px 0;
      color: var(--el-text-color-secondary);
      font-size: 13px;
      line-height: 1.5;
      text-align: center;
    }
  }

  .event-card {
    margin-bottom: 10px;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;

    &.kpi {
      border-color: color-mix(in srgb, #f59e0b 35%, var(--el-border-color-lighter));
      background: color-mix(in srgb, #f59e0b 6%, var(--el-bg-color));
    }

    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }

    h3 {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 650;
    }

    &__range {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--el-text-color-regular);

      em {
        margin-left: 6px;
        font-style: normal;
        color: var(--el-text-color-secondary);
      }
    }

    &__note,
    &__meta {
      margin: 0 0 4px;
      color: var(--el-text-color-secondary);
      font-size: 12px;
      line-height: 1.4;
    }

    &__meta {
      display: flex;
      gap: 10px;
    }

    &__ops {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }
  }
</style>
