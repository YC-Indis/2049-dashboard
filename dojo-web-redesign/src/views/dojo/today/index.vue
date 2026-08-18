<!--
  DIRECTION: A friendly daily desk where work reads like a hand-arranged agenda, not an admin database.
  FIRST VIEWPORT: Today's task stream owns the center; projects remain close on the left and handoffs stay visible at the right edge without becoming equal cards.
  FORM: Personal work desk, user-selected Superlist-adjacent direction, seed cdaed56f.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useRouter } from 'vue-router'
  import { pendingCreatorReviews, scheduledCreatorContents } from '@/store/dojoCreatorStore'
  import { dojoProjectStore, setSelectedProjects } from '@/store/dojoProjectStore'
  import {
    applyTodoQuantity,
    buildTodayTodos,
    getProjectRuntime,
    patchTodoMeta,
    projectRuntimeRevision,
    upsertProjectRuntime,
    type TodayTodoRow,
    type TodoTaskStatus
  } from '@/store/dojoProjectRuntime'

  defineOptions({ name: 'DojoToday' })

  type TaskView = 'open' | 'all' | 'done'

  const router = useRouter()
  const selectedProjectId = ref('all')
  const taskView = ref<TaskView>('open')
  const expandedTaskId = ref('')

  const projectOptions = computed(() =>
    dojoProjectStore.projects.filter((project) => project.active !== false)
  )

  const projectRows = computed(() => {
    void projectRuntimeRevision.value
    return projectOptions.value.flatMap((project) => {
      const runtime = getProjectRuntime(project.id)
      if (!runtime) return []
      const tasks = buildTodayTodos(project.id, project.name, runtime)
      const openCount = tasks.filter((task) => task.status !== '已完成').length
      return [{ project, runtime, openCount }]
    })
  })

  const allTasks = computed(() =>
    projectRows.value.flatMap(({ project, runtime }) =>
      buildTodayTodos(project.id, project.name, runtime)
    )
  )

  const visibleTasks = computed(() => {
    const priority = { high: 0, medium: 1, low: 2 }
    return allTasks.value
      .filter(
        (task) => selectedProjectId.value === 'all' || task.projectId === selectedProjectId.value
      )
      .filter((task) => {
        if (taskView.value === 'done') return task.status === '已完成'
        if (taskView.value === 'open') return task.status !== '已完成'
        return true
      })
      .sort((left, right) => {
        const leftPriority = getProjectRuntime(left.projectId)?.priority || 'medium'
        const rightPriority = getProjectRuntime(right.projectId)?.priority || 'medium'
        return priority[leftPriority] - priority[rightPriority]
      })
  })

  const openTasks = computed(() => allTasks.value.filter((task) => task.status !== '已完成'))
  const completedTasks = computed(() => allTasks.value.filter((task) => task.status === '已完成'))
  const completionRate = computed(() =>
    allTasks.value.length
      ? Math.round((completedTasks.value.length / allTasks.value.length) * 100)
      : 0
  )
  const waitingRows = computed(() =>
    openTasks.value.filter((task) => task.status === '进行中' && task.clientContact).slice(0, 4)
  )
  const handoffRows = computed(() =>
    openTasks.value.filter((task) => task.owner && task.owner !== '我').slice(0, 4)
  )

  const todayTitle = computed(() =>
    new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(new Date())
  )

  watch(projectOptions, (projects) => {
    if (
      selectedProjectId.value !== 'all' &&
      !projects.some((project) => project.id === selectedProjectId.value)
    ) {
      selectedProjectId.value = 'all'
    }
  })

  function taskId(row: TodayTodoRow) {
    return `${row.projectId}:${row.key}`
  }

  function projectColor(projectId: string) {
    const colors = ['coral', 'purple', 'blue', 'green', 'amber']
    const index = projectOptions.value.findIndex((project) => project.id === projectId)
    return colors[Math.max(0, index) % colors.length]
  }

  function priorityLabel(projectId: string) {
    const value = getProjectRuntime(projectId)?.priority
    if (value === 'high') return '高优先'
    if (value === 'low') return '低优先'
    return '中优先'
  }

  function quantityLabel(row: TodayTodoRow) {
    if (row.quantity === '—') return '待确认'
    if (row.key === 'ads_progress') return `进度 ${row.quantity}`
    return `${row.quantity} 项`
  }

  function toggleTask(row: TodayTodoRow) {
    const status: TodoTaskStatus = row.status === '已完成' ? '未开始' : '已完成'
    patchTodoMeta(row.projectId, row.key, { status })
  }

  function setStatus(row: TodayTodoRow, status: TodoTaskStatus) {
    patchTodoMeta(row.projectId, row.key, { status })
  }

  function setOwner(row: TodayTodoRow, owner: string) {
    patchTodoMeta(row.projectId, row.key, { owner })
  }

  function setClient(row: TodayTodoRow, clientContact: string) {
    patchTodoMeta(row.projectId, row.key, { clientContact })
  }

  function setNote(row: TodayTodoRow, note: string) {
    patchTodoMeta(row.projectId, row.key, { note })
  }

  function setQuantity(row: TodayTodoRow, value: number | string) {
    applyTodoQuantity(row.projectId, row.key, value)
  }

  function setProjectPriority(projectId: string, priority: 'high' | 'medium' | 'low') {
    upsertProjectRuntime(projectId, { priority })
  }

  function toggleDetails(row: TodayTodoRow) {
    const id = taskId(row)
    expandedTaskId.value = expandedTaskId.value === id ? '' : id
  }

  function focusTask(row: TodayTodoRow) {
    selectedProjectId.value = row.projectId
    expandedTaskId.value = taskId(row)
  }

  function goProject(projectId: string) {
    setSelectedProjects([projectId])
    router.push('/project')
  }
</script>

<template>
  <div class="today-workspace">
    <aside class="project-rail" aria-label="项目筛选">
      <div class="project-rail__heading">
        <span>进行中的项目</span>
        <button type="button" aria-label="打开项目总览" @click="router.push('/project')">
          <Icon icon="ph:plus" width="15" />
        </button>
      </div>
      <button
        type="button"
        class="project-filter"
        :class="{ 'is-active': selectedProjectId === 'all' }"
        @click="selectedProjectId = 'all'"
      >
        <span class="project-filter__dot is-all" />
        <span>全部项目</span>
        <small>{{ openTasks.length }}</small>
      </button>
      <button
        v-for="item in projectRows"
        :key="item.project.id"
        type="button"
        class="project-filter"
        :class="{ 'is-active': selectedProjectId === item.project.id }"
        @click="selectedProjectId = item.project.id"
      >
        <span class="project-filter__dot" :class="`is-${projectColor(item.project.id)}`" />
        <span>{{ item.project.name }}</span>
        <small>{{ item.openCount }}</small>
      </button>
      <button type="button" class="project-rail__link" @click="router.push('/calendar')">
        <Icon icon="ph:calendar-dots" width="17" />
        查看本周节奏
      </button>
    </aside>

    <main class="today-main">
      <header class="today-head">
        <div>
          <h1>{{ todayTitle }}</h1>
          <p v-if="openTasks.length">先把最重要的 {{ openTasks.length }} 件事向前推一点。</p>
          <p v-else>今天的执行项已经清空，可以安心复盘了。</p>
        </div>
        <div class="today-head__progress" aria-label="今日完成进度">
          <strong>{{ completionRate }}%</strong>
          <span>今日完成</span>
        </div>
      </header>

      <div class="task-toolbar">
        <div class="task-toolbar__views" aria-label="任务状态筛选">
          <button
            v-for="view in [
              { value: 'open', label: '待处理' },
              { value: 'all', label: '全部' },
              { value: 'done', label: '已完成' }
            ]"
            :key="view.value"
            type="button"
            :class="{ 'is-active': taskView === view.value }"
            @click="taskView = view.value as TaskView"
          >
            {{ view.label }}
          </button>
        </div>
        <span>{{ visibleTasks.length }} 项</span>
      </div>

      <section v-if="visibleTasks.length" class="task-stream" aria-label="今日任务">
        <article
          v-for="row in visibleTasks"
          :key="taskId(row)"
          class="task-row"
          :class="{
            'is-done': row.status === '已完成',
            'is-expanded': expandedTaskId === taskId(row)
          }"
        >
          <div class="task-row__primary">
            <button
              type="button"
              class="task-check"
              :aria-label="row.status === '已完成' ? '恢复任务' : '完成任务'"
              @click="toggleTask(row)"
            >
              <Icon
                :icon="row.status === '已完成' ? 'ph:check-circle-fill' : 'ph:circle'"
                width="21"
              />
            </button>
            <button type="button" class="task-row__content" @click="toggleDetails(row)">
              <span class="task-row__project">
                <i :class="`is-${projectColor(row.projectId)}`" />
                {{ row.projectName }}
              </span>
              <strong>{{ row.task }}</strong>
              <small>
                {{ quantityLabel(row) }}
                <template v-if="row.note"> · {{ row.note }}</template>
              </small>
            </button>
            <div class="task-row__meta">
              <span v-if="row.owner" class="task-owner">{{ row.owner.slice(0, 1) }}</span>
              <span class="task-status" :class="`is-${row.status}`">{{ row.status }}</span>
              <button
                type="button"
                class="task-more"
                aria-label="编辑任务"
                @click="toggleDetails(row)"
              >
                <Icon icon="ph:dots-three" width="20" />
              </button>
            </div>
          </div>

          <div v-if="expandedTaskId === taskId(row)" class="task-row__details">
            <label>
              <span>数量 / 进度</span>
              <ElInputNumber
                :model-value="
                  typeof row.quantity === 'number' ? row.quantity : parseFloat(row.quantity) || 0
                "
                :min="0"
                :max="row.key === 'ads_progress' ? 100 : undefined"
                :controls="false"
                @update:model-value="(value) => setQuantity(row, value ?? 0)"
              />
            </label>
            <label>
              <span>负责人</span>
              <ElInput
                :model-value="row.owner"
                placeholder="填写负责人"
                @update:model-value="(value) => setOwner(row, String(value))"
              />
            </label>
            <label>
              <span>客户对接</span>
              <ElInput
                :model-value="row.clientContact"
                placeholder="填写对接人"
                @update:model-value="(value) => setClient(row, String(value))"
              />
            </label>
            <label>
              <span>状态</span>
              <ElSelect
                :model-value="row.status"
                @update:model-value="(value) => setStatus(row, value as TodoTaskStatus)"
              >
                <ElOption label="未开始" value="未开始" />
                <ElOption label="已安排" value="已安排" />
                <ElOption label="进行中" value="进行中" />
                <ElOption label="已完成" value="已完成" />
              </ElSelect>
            </label>
            <label class="task-row__note">
              <span>备注</span>
              <ElInput
                :model-value="row.note"
                placeholder="补充交接、阻塞或下一步"
                @update:model-value="(value) => setNote(row, String(value))"
              />
            </label>
          </div>
        </article>
      </section>

      <section v-else class="today-empty">
        <Icon icon="ph:check-circle-duotone" width="42" />
        <h2>{{ taskView === 'done' ? '还没有已完成任务' : '这个视图已经清空' }}</h2>
        <p>换一个项目或状态看看，也可以去执行日历安排下一件事。</p>
        <ElButton @click="router.push('/calendar')">打开执行日历</ElButton>
      </section>

      <section v-if="projectRows.length" class="project-rhythm">
        <div class="section-heading">
          <div>
            <h2>项目节奏</h2>
            <p>优先级和周期状态仍由原项目数据驱动。</p>
          </div>
          <button type="button" @click="router.push('/timeline')">查看完整排期</button>
        </div>
        <div class="project-rhythm__list">
          <article v-for="item in projectRows" :key="item.project.id">
            <button type="button" class="project-rhythm__name" @click="goProject(item.project.id)">
              <i :class="`is-${projectColor(item.project.id)}`" />
              <span>
                <strong>{{ item.project.name }}</strong>
                <small>{{ item.runtime.runStatus }} · {{ item.openCount }} 项待处理</small>
              </span>
            </button>
            <ElSelect
              :model-value="item.runtime.priority"
              size="small"
              class="project-rhythm__priority"
              @update:model-value="(value) => setProjectPriority(item.project.id, value)"
            >
              <ElOption label="高优先" value="high" />
              <ElOption label="中优先" value="medium" />
              <ElOption label="低优先" value="low" />
            </ElSelect>
          </article>
        </div>
      </section>
    </main>

    <aside class="today-aside">
      <section>
        <div class="aside-heading">
          <h2>等待反馈</h2>
          <span>{{ waitingRows.length }}</span>
        </div>
        <div v-if="waitingRows.length" class="aside-list">
          <button
            v-for="row in waitingRows"
            :key="taskId(row)"
            type="button"
            @click="focusTask(row)"
          >
            <span>{{ row.task }}</span>
            <small>{{ row.clientContact }} · {{ row.projectName }}</small>
          </button>
        </div>
        <p v-else class="aside-empty">暂无等待中的客户反馈。</p>
      </section>

      <section>
        <div class="aside-heading">
          <h2>团队交接</h2>
          <span>{{ handoffRows.length }}</span>
        </div>
        <div v-if="handoffRows.length" class="aside-list">
          <button
            v-for="row in handoffRows"
            :key="taskId(row)"
            type="button"
            @click="focusTask(row)"
          >
            <span>{{ row.task }}</span>
            <small>{{ row.owner }} 正在处理 · {{ priorityLabel(row.projectId) }}</small>
          </button>
        </div>
        <p v-else class="aside-empty">当前没有明确指派给团队的任务。</p>
      </section>

      <section>
        <div class="aside-heading">
          <h2>接下来</h2>
          <button type="button" @click="router.push('/creator/calendar')">日历</button>
        </div>
        <div v-if="scheduledCreatorContents.length" class="aside-list aside-list--schedule">
          <button
            v-for="content in scheduledCreatorContents.slice(0, 3)"
            :key="content.id"
            type="button"
            @click="router.push('/creator/timeline')"
          >
            <time>{{ content.plannedDate?.slice(5).replace('-', '/') }}</time>
            <span>{{ content.title }}</span>
          </button>
        </div>
        <p v-else class="aside-empty">还没有安排好的内容，去执行日历安排一条任务。</p>
      </section>

      <button type="button" class="review-callout" @click="router.push('/creator/review')">
        <span>
          <Icon icon="ph:flask-duotone" width="21" />
          <strong>{{ pendingCreatorReviews.length }} 条内容待复盘</strong>
        </span>
        <Icon icon="ph:arrow-right" width="17" />
      </button>
    </aside>
  </div>
</template>

<style scoped lang="scss">
  .today-workspace {
    display: grid;
    grid-template-columns: 176px minmax(440px, 1fr) 270px;
    align-items: start;
    min-height: calc(100dvh - 58px);
  }

  .project-rail {
    position: sticky;
    top: 58px;
    align-self: stretch;
    min-height: calc(100dvh - 58px);
    padding: 32px 13px 24px 22px;
    border-right: 1px solid var(--dojo-line-soft);

    &__heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 8px 10px;
      color: var(--dojo-muted-light);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;

      button {
        display: grid;
        width: 25px;
        height: 25px;
        place-items: center;
        padding: 0;
        color: var(--dojo-muted);
        background: transparent;
        border: 0;
        border-radius: 8px;
        cursor: pointer;

        &:hover {
          color: var(--dojo-ink);
          background: var(--dojo-paper);
        }
      }
    }

    &__link {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 36px;
      margin-top: 20px;
      padding: 0 9px;
      color: var(--dojo-muted);
      background: transparent;
      border: 0;
      border-top: 1px solid var(--dojo-line-soft);
      font-size: 11px;
      cursor: pointer;
    }
  }

  .project-filter {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    margin: 2px 0;
    padding: 0 9px;
    color: var(--dojo-muted-strong);
    background: transparent;
    border: 0;
    border-radius: 10px;
    font-size: 11px;
    text-align: left;
    cursor: pointer;

    &:hover,
    &.is-active {
      color: var(--dojo-ink);
      background: var(--dojo-paper);
    }

    span:nth-child(2) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: var(--dojo-muted-light);
      font-size: 10px;
    }

    &__dot {
      width: 7px;
      height: 7px;
      border-radius: 3px;

      &.is-all {
        background: var(--dojo-ink);
      }
    }
  }

  .is-coral {
    background: var(--dojo-accent);
  }

  .is-purple {
    background: var(--dojo-purple);
  }

  .is-blue {
    background: var(--dojo-blue);
  }

  .is-green {
    background: var(--dojo-green);
  }

  .is-amber {
    background: var(--dojo-amber);
  }

  .today-main {
    min-width: 0;
    padding: 46px clamp(26px, 4vw, 64px) 72px;
  }

  .today-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 33px;

    h1 {
      margin: 0;
      font-family: 'Noto Serif SC', 'Songti SC', serif;
      font-size: clamp(30px, 3vw, 43px);
      font-weight: 650;
      letter-spacing: -0.035em;
      line-height: 1.15;
    }

    p {
      margin: 8px 0 0;
      color: var(--dojo-muted);
      font-size: 13px;
    }

    &__progress {
      display: grid;
      gap: 2px;
      flex: 0 0 auto;
      text-align: right;

      strong {
        font-size: 23px;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.03em;
      }

      span {
        color: var(--dojo-muted);
        font-size: 10px;
      }
    }
  }

  .task-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 37px;
    margin-bottom: 7px;
    border-bottom: 1px solid var(--dojo-line);

    > span {
      color: var(--dojo-muted-light);
      font-size: 11px;
    }

    &__views {
      display: flex;
      gap: 18px;

      button {
        position: relative;
        align-self: stretch;
        padding: 0;
        color: var(--dojo-muted);
        background: transparent;
        border: 0;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;

        &.is-active {
          color: var(--dojo-ink);

          &::after {
            position: absolute;
            right: 0;
            bottom: -1px;
            left: 0;
            height: 2px;
            background: var(--dojo-accent);
            border-radius: 2px 2px 0 0;
            content: '';
          }
        }
      }
    }
  }

  .task-stream {
    min-height: 200px;
  }

  .task-row {
    border-bottom: 1px solid var(--dojo-line-soft);
    transition: background 150ms ease;

    &:hover,
    &.is-expanded {
      background: rgb(255 253 249 / 56%);
    }

    &.is-done {
      .task-row__content strong {
        color: var(--dojo-muted-light);
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }

      .task-check {
        color: var(--dojo-green);
      }
    }

    &__primary {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 78px;
      padding: 9px 7px;
    }

    &__content {
      display: grid;
      min-width: 0;
      gap: 3px;
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      text-align: left;
      cursor: pointer;

      strong {
        overflow: hidden;
        font-size: 14px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        overflow: hidden;
        color: var(--dojo-muted);
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__project {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--dojo-muted-strong);
      font-size: 10px;

      i {
        width: 6px;
        height: 6px;
        border-radius: 2px;
      }
    }

    &__meta {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    &__details {
      display: grid;
      grid-template-columns: 100px repeat(3, minmax(110px, 1fr));
      gap: 12px;
      padding: 3px 12px 18px 45px;
      animation: reveal-details 220ms cubic-bezier(0.22, 1, 0.36, 1);

      label {
        display: grid;
        gap: 6px;

        > span {
          color: var(--dojo-muted);
          font-size: 10px;
        }
      }
    }

    &__note {
      grid-column: 1 / -1;
    }
  }

  .task-check,
  .task-more {
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--dojo-muted-light);
    background: transparent;
    border: 0;
    cursor: pointer;

    &:hover {
      color: var(--dojo-accent);
    }
  }

  .task-owner {
    display: grid;
    width: 25px;
    height: 25px;
    place-items: center;
    color: var(--dojo-purple);
    background: color-mix(in srgb, var(--dojo-purple) 10%, white);
    border-radius: 9px;
    font-size: 10px;
    font-weight: 750;
  }

  .task-status {
    min-width: 49px;
    color: var(--dojo-muted);
    font-size: 10px;
    text-align: right;

    &.is-进行中 {
      color: var(--dojo-blue);
    }

    &.is-已完成 {
      color: var(--dojo-green);
    }
  }

  .today-empty {
    display: grid;
    min-height: 310px;
    place-items: center;
    align-content: center;
    color: var(--dojo-green);
    text-align: center;

    h2 {
      margin: 12px 0 5px;
      color: var(--dojo-ink);
      font-size: 16px;
    }

    p {
      margin: 0 0 18px;
      color: var(--dojo-muted);
      font-size: 12px;
    }
  }

  .project-rhythm {
    margin-top: 54px;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 17px;

    h2 {
      margin: 0;
      font-size: 17px;
      letter-spacing: -0.02em;
    }

    p {
      margin: 4px 0 0;
      color: var(--dojo-muted);
      font-size: 10px;
    }

    button {
      padding: 0;
      color: var(--dojo-accent);
      background: transparent;
      border: 0;
      font-size: 10px;
      cursor: pointer;
    }
  }

  .project-rhythm__list {
    border-top: 1px solid var(--dojo-line);

    article {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 62px;
      gap: 20px;
      border-bottom: 1px solid var(--dojo-line-soft);
    }
  }

  .project-rhythm__name {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    text-align: left;
    cursor: pointer;

    > i {
      width: 9px;
      height: 34px;
      border-radius: 5px;
    }

    > span {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    strong {
      overflow: hidden;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: var(--dojo-muted);
      font-size: 10px;
    }
  }

  .project-rhythm__priority {
    width: 92px;
  }

  .today-aside {
    position: sticky;
    top: 58px;
    display: grid;
    gap: 30px;
    min-height: calc(100dvh - 58px);
    align-content: start;
    padding: 46px 25px 30px 0;

    > section {
      padding-left: 21px;
      border-left: 1px solid var(--dojo-line-soft);
    }
  }

  .aside-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    h2 {
      margin: 0;
      font-size: 12px;
    }

    span,
    button {
      color: var(--dojo-muted-light);
      font-size: 10px;
    }

    button {
      padding: 0;
      background: transparent;
      border: 0;
      cursor: pointer;
    }
  }

  .aside-list {
    display: grid;

    button {
      display: grid;
      gap: 3px;
      padding: 10px 0;
      color: inherit;
      background: transparent;
      border: 0;
      border-bottom: 1px solid var(--dojo-line-soft);
      text-align: left;
      cursor: pointer;

      &:hover span {
        color: var(--dojo-accent);
      }

      span {
        overflow: hidden;
        font-size: 11px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        overflow: hidden;
        color: var(--dojo-muted);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &--schedule button {
      grid-template-columns: 35px minmax(0, 1fr);
      align-items: center;

      time {
        color: var(--dojo-accent);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .aside-empty {
    margin: 0;
    color: var(--dojo-muted-light);
    font-size: 10px;
    line-height: 1.6;
  }

  .review-callout {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    margin-left: 21px;
    padding: 0 14px;
    color: var(--dojo-purple);
    background: color-mix(in srgb, var(--dojo-purple) 7%, var(--dojo-paper));
    border: 0;
    border-radius: 13px;
    cursor: pointer;

    > span {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    strong {
      color: var(--dojo-ink);
      font-size: 10px;
    }
  }

  @keyframes reveal-details {
    from {
      opacity: 0;
      clip-path: inset(0 0 100% 0);
    }

    to {
      opacity: 1;
      clip-path: inset(0);
    }
  }

  @media (max-width: 1180px) {
    .today-workspace {
      grid-template-columns: 160px minmax(420px, 1fr);
    }

    .today-aside {
      position: static;
      grid-column: 2;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      min-height: 0;
      padding: 0 32px 50px;

      .review-callout {
        margin-left: 0;
      }
    }
  }

  @media (max-width: 800px) {
    .today-workspace {
      display: block;
    }

    .project-rail {
      position: static;
      display: flex;
      min-height: 0;
      gap: 6px;
      padding: 14px 15px 4px;
      overflow-x: auto;
      border-right: 0;

      &__heading,
      &__link {
        display: none;
      }
    }

    .project-filter {
      display: inline-flex;
      flex: 0 0 auto;
      width: auto;
      min-height: 32px;
      padding: 0 11px;
      background: rgb(255 255 255 / 44%);

      small {
        margin-left: 2px;
      }
    }

    .today-main {
      padding: 28px 18px 48px;
    }

    .today-aside {
      display: grid;
      grid-template-columns: 1fr;
      gap: 26px;
      padding: 0 18px 45px;
    }

    .task-row__details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding-left: 45px;
    }
  }

  @media (max-width: 480px) {
    .today-head {
      align-items: flex-start;

      &__progress {
        padding-top: 3px;
      }
    }

    .task-row__primary {
      grid-template-columns: 26px minmax(0, 1fr) auto;
    }

    .task-status,
    .task-owner {
      display: none;
    }

    .task-row__details {
      grid-template-columns: 1fr;
      padding-left: 42px;
    }

    .task-row__note {
      grid-column: auto;
    }
  }
</style>
