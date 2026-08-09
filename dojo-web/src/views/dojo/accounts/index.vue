<template>
  <div class="dojo-page worklog-page">
    <header class="dojo-page__head">
      <div>
        <h1>工作复盘</h1>
        <p>自动记录账号进出、归属变更、粉丝/视频与项目现状变化；也可补人手记。</p>
      </div>
      <div class="head-ops">
        <ElButton :loading="reconciling" @click="refreshLog">刷新记录</ElButton>
        <ElButton type="primary" @click="openManual">补记一条</ElButton>
      </div>
    </header>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ stats.total }}</span>
        <span class="stat__l">当日事件</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.accountAdd }}</span>
        <span class="stat__l">账号入池</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.accountChange }}</span>
        <span class="stat__l">账号变更</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.metric }}</span>
        <span class="stat__l">指标变化</span>
      </div>
    </div>

    <div class="worklog-layout">
      <aside class="date-rail panel">
        <div class="date-rail__title">日期</div>
        <button
          v-for="d in dates"
          :key="d"
          type="button"
          class="date-rail__item"
          :class="{ active: d === selectedDate }"
          @click="selectedDate = d"
        >
          <strong>{{ d }}</strong>
          <span>{{ dayStats(d).total }} 条</span>
        </button>
      </aside>

      <section class="panel worklog-main">
        <div class="worklog-main__head">
          <div>
            <h2>{{ selectedDate }}</h2>
            <p class="muted">{{ selectedDate === todayKey ? '今天' : '历史日' }} · 自动 + 人工</p>
          </div>
          <ElSelect v-model="typeFilter" clearable placeholder="事件类型" style="width: 140px">
            <ElOption label="全部类型" value="" />
            <ElOption label="账号入池" value="account_add" />
            <ElOption label="账号移出" value="account_remove" />
            <ElOption label="账号变更" value="account_change" />
            <ElOption label="指标变化" value="metric" />
            <ElOption label="人工补记" value="manual" />
          </ElSelect>
        </div>

        <div class="day-note">
          <label>当日手记</label>
          <ElInput
            :model-value="dayNote"
            type="textarea"
            :rows="2"
            placeholder="可写今日结论、风险、待跟进…"
            @update:model-value="onNoteInput"
          />
        </div>

        <ul v-if="dayEvents.length" class="event-list">
          <li v-for="ev in dayEvents" :key="ev.id" class="event-item">
            <i class="event-item__dot" :class="`is-${ev.type}`" />
            <div class="event-item__body">
              <div class="event-item__top">
                <ElTag size="small" effect="plain">{{ typeLabel(ev.type) }}</ElTag>
                <span class="muted">{{ formatTime(ev.createdAt) }}</span>
                <span v-if="ev.source === 'manual'" class="muted">人工</span>
                <span v-else class="muted">自动</span>
              </div>
              <strong>{{ ev.title }}</strong>
              <p v-if="ev.detail" class="event-item__detail">{{ ev.detail }}</p>
              <p v-if="ev.projectName || ev.handle" class="event-item__meta muted">
                <template v-if="ev.projectName">项目 {{ ev.projectName }}</template>
                <template v-if="ev.projectName && ev.handle"> · </template>
                <template v-if="ev.handle">{{ ev.handle }}</template>
              </p>
            </div>
            <div class="event-item__ops">
              <ElButton
                v-if="ev.source === 'manual' || ev.edited"
                link
                type="primary"
                @click="editManual(ev)"
              >
                编辑
              </ElButton>
              <ElButton link type="danger" @click="removeEvent(ev.id)">删除</ElButton>
            </div>
          </li>
        </ul>
        <p v-else class="empty">
          这一天还没有复盘事件。导入/删除账号、改归属或同步指标后会自动出现；也可点「补记一条」。
        </p>
      </section>
    </div>

    <ElDialog
      v-model="manualVisible"
      :title="editingId ? '编辑补记' : '补记一条'"
      width="520px"
      align-center
      destroy-on-close
    >
      <ElForm label-width="80px">
        <ElFormItem label="日期">
          <ElDatePicker
            v-model="manualForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="标题" required>
          <ElInput v-model="manualForm.title" placeholder="例如：英国线节奏偏慢" />
        </ElFormItem>
        <ElFormItem label="项目">
          <ElSelect
            v-model="manualForm.projectId"
            clearable
            filterable
            placeholder="可选"
            style="width: 100%"
          >
            <ElOption
              v-for="p in dojoProjectStore.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="账号">
          <ElInput v-model="manualForm.handle" placeholder="@handle，可选" />
        </ElFormItem>
        <ElFormItem label="详情">
          <ElInput v-model="manualForm.detail" type="textarea" :rows="4" placeholder="补充说明" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="manualVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveManual">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { DOJO_TODAY } from '@/utils/dojoDates'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import {
    addManualEvent,
    dayStats,
    dojoWorklogStore,
    eventsOnDate,
    getDayNote,
    listWorklogDates,
    reconcileWorklog,
    removeWorklogEvent,
    setDayNote,
    updateWorklogEvent,
    type WorklogEvent,
    type WorklogEventType
  } from '@/store/dojoWorklogStore'

  defineOptions({ name: 'DojoWorklog' })

  const todayKey = DOJO_TODAY
  const selectedDate = ref(todayKey)
  const typeFilter = ref('')
  const reconciling = ref(false)
  const manualVisible = ref(false)
  const editingId = ref('')
  const manualForm = reactive({
    date: todayKey,
    title: '',
    detail: '',
    projectId: '',
    handle: ''
  })

  const dates = computed(() => {
    void dojoWorklogStore.revision
    return listWorklogDates(45)
  })

  const dayEvents = computed(() => {
    void dojoWorklogStore.revision
    let list = eventsOnDate(selectedDate.value)
    if (typeFilter.value) list = list.filter((e) => e.type === typeFilter.value)
    return list
  })

  const stats = computed(() => {
    void dojoWorklogStore.revision
    return dayStats(selectedDate.value)
  })

  const dayNote = computed(() => {
    void dojoWorklogStore.revision
    return getDayNote(selectedDate.value)
  })

  function typeLabel(type: WorklogEventType) {
    const map: Record<WorklogEventType, string> = {
      account_add: '入池',
      account_remove: '移出',
      account_change: '变更',
      metric: '指标',
      manual: '补记'
    }
    return map[type] || type
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleTimeString()
  }

  function onNoteInput(v: string) {
    setDayNote(selectedDate.value, v)
  }

  async function refreshLog() {
    reconciling.value = true
    try {
      const n = reconcileWorklog()
      ElMessage.success(n ? `已写入 ${n} 条新变化` : '已是最新，无新增变化')
    } finally {
      reconciling.value = false
    }
  }

  function openManual() {
    editingId.value = ''
    manualForm.date = selectedDate.value
    manualForm.title = ''
    manualForm.detail = ''
    manualForm.projectId = ''
    manualForm.handle = ''
    manualVisible.value = true
  }

  function editManual(ev: WorklogEvent) {
    editingId.value = ev.id
    manualForm.date = ev.date
    manualForm.title = ev.title
    manualForm.detail = ev.detail || ''
    manualForm.projectId = ev.projectId || ''
    manualForm.handle = ev.handle || ''
    manualVisible.value = true
  }

  function saveManual() {
    const title = manualForm.title.trim()
    if (!title) {
      ElMessage.warning('请填写标题')
      return
    }
    if (editingId.value) {
      updateWorklogEvent(editingId.value, {
        date: manualForm.date || todayKey,
        title,
        detail: manualForm.detail.trim(),
        projectId: manualForm.projectId || undefined,
        handle: manualForm.handle.trim() || undefined
      })
      ElMessage.success('已更新')
    } else {
      addManualEvent({
        date: manualForm.date || todayKey,
        title,
        detail: manualForm.detail.trim(),
        projectId: manualForm.projectId || undefined,
        handle: manualForm.handle.trim() || undefined
      })
      ElMessage.success('已补记')
    }
    selectedDate.value = manualForm.date || todayKey
    manualVisible.value = false
  }

  async function removeEvent(id: string) {
    try {
      await ElMessageBox.confirm('删除这条复盘事件？', '删除', { type: 'warning' })
      removeWorklogEvent(id)
      ElMessage.success('已删除')
    } catch {
      /* cancel */
    }
  }

  onMounted(() => {
    reconcileWorklog()
  })
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .worklog-layout {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 14px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  }

  .date-rail {
    padding: 12px;
    max-height: 70vh;
    overflow: auto;

    &__title {
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 650;
    }

    &__item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 4px;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;

      strong {
        font-size: 13px;
      }

      span {
        color: var(--el-text-color-placeholder);
        font-size: 12px;
      }

      &:hover {
        background: var(--el-fill-color-lighter);
      }

      &.active {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);

        span {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .worklog-main {
    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 14px;

      h2 {
        margin: 0 0 4px;
        font-size: 18px;
      }
    }
  }

  .day-note {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 600;
    }
  }

  .event-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .event-item {
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-extra-light);

    &__dot {
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--el-text-color-placeholder);

      &.is-account_add {
        background: var(--el-color-success);
      }
      &.is-account_remove {
        background: var(--el-color-danger);
      }
      &.is-account_change {
        background: var(--el-color-warning);
      }
      &.is-metric {
        background: var(--el-color-primary);
      }
      &.is-manual {
        background: #8b5cf6;
      }
    }

    &__top {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
    }

    strong {
      display: block;
      font-size: 14px;
      font-weight: 650;
    }

    &__detail,
    &__meta {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 1.45;
    }

    &__ops {
      display: flex;
      gap: 4px;
      white-space: nowrap;
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .empty {
    margin: 28px 0;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 14px;
    line-height: 1.6;
  }
</style>
