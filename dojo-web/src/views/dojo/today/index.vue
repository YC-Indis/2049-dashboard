<template>
  <div class="dojo-page today-board">
    <header class="dojo-page__head">
      <div>
        <h1>今日待办</h1>
        <p>优先级可先判定、可手改；项目状态按周期相对今天自动判定，改周期会跟着变</p>
      </div>
      <div class="head-ops">
        <ElSelect
          v-model="projectFilterIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          filterable
          placeholder="选择项目（默认全选）"
          style="width: 280px"
        >
          <ElOption
            v-for="p in projectOptions"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </ElSelect>
      </div>
    </header>

    <p v-if="!projectOptions.length" class="empty-state">
      暂无可见项目。请先在「项目总览」新建；已结束的可在总览里隐藏/恢复。
    </p>
    <p v-else-if="!projectCards.length" class="empty-state">
      当前筛选下没有项目，请在右上角重新勾选。
    </p>

    <template v-else>
      <section class="project-cards">
        <article
          v-for="card in projectCards"
          :key="card.project.id"
          class="proj-card"
          :class="{ 'is-active': focusProjectId === card.project.id }"
          @click="focusProject(card.project.id)"
        >
          <button type="button" class="proj-card__title" @click.stop="goProject(card.project.id)">
            {{ card.project.name }}
          </button>
          <p class="proj-card__status">
            状态
            <ElTag size="small" :type="statusTagType(card.runtime.runStatus)">
              {{ card.runtime.runStatus || '未开始' }}
            </ElTag>
            <span class="hint">随周期自动变</span>
          </p>
          <p class="proj-card__priority" @click.stop>
            优先级
            <ElSelect
              :model-value="card.runtime.priority"
              size="small"
              style="width: 96px"
              @update:model-value="(v) => onPriority(card.project.id, v)"
            >
              <ElOption label="高" value="high" />
              <ElOption label="中" value="medium" />
              <ElOption label="低" value="low" />
            </ElSelect>
          </p>
        </article>
      </section>

      <section class="panel">
        <div class="panel__title">
          项目待办明细
          <span class="muted">
            {{
              focusProjectId
                ? `当前聚焦：${projectName(focusProjectId)}`
                : '点击上方卡片可筛选；点项目名进入项目总览'
            }}
          </span>
        </div>
        <ElTable :data="todoRows" stripe empty-text="当前筛选下暂无待办">
          <ElTableColumn prop="projectName" label="项目名称" min-width="150" show-overflow-tooltip />
          <ElTableColumn prop="task" label="任务" min-width="160" />
          <ElTableColumn label="数量" width="110" align="right">
            <template #default="{ row }">
              <div v-if="row.key === 'ads_progress'" class="qty-pct">
                <ElInputNumber
                  v-if="row.quantity !== '—'"
                  :model-value="adsPct(row.quantity)"
                  :min="0"
                  :max="100"
                  :controls="false"
                  size="small"
                  class="qty-input qty-input--pct"
                  @update:model-value="(v) => onQuantity(row, v ?? 0)"
                />
                <span v-else class="muted">—</span>
                <span v-if="row.quantity !== '—'" class="qty-pct__suffix">%</span>
              </div>
              <ElInputNumber
                v-else
                :model-value="numQuantity(row.quantity)"
                :min="0"
                :controls="false"
                size="small"
                class="qty-input"
                @update:model-value="(v) => onQuantity(row, v ?? 0)"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="负责人" min-width="130">
            <template #default="{ row }">
              <ElInput
                :model-value="row.owner"
                size="small"
                placeholder="填写负责人"
                @update:model-value="(v) => onOwner(row, String(v))"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="130">
            <template #default="{ row }">
              <ElSelect
                :model-value="row.status"
                size="small"
                style="width: 100%"
                @update:model-value="(v) => onStatus(row, v)"
              >
                <ElOption label="未开始" value="未开始" />
                <ElOption label="已安排" value="已安排" />
                <ElOption label="进行中" value="进行中" />
              </ElSelect>
            </template>
          </ElTableColumn>
          <ElTableColumn label="客户对接人" min-width="130">
            <template #default="{ row }">
              <ElInput
                :model-value="row.clientContact"
                size="small"
                placeholder="客户对接人"
                @update:model-value="(v) => onClient(row, String(v))"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="备注" min-width="140">
            <template #default="{ row }">
              <ElInput
                :model-value="row.note"
                size="small"
                placeholder="备注"
                @update:model-value="(v) => onNote(row, String(v))"
              />
            </template>
          </ElTableColumn>
        </ElTable>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    dojoProjectStore,
    getProjectById,
    setSelectedProjects
  } from '@/store/dojoProjectStore'
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

  const router = useRouter()
  /** 勾选的项目 id；默认全选；清空时回填为全选 */
  const projectFilterIds = ref<string[]>([])
  const focusProjectId = ref('')
  let prevOptionIds: string[] = []

  const projectOptions = computed(() => {
    void dojoProjectStore.projects.length
    return dojoProjectStore.projects.filter((p) => p.active !== false)
  })

  watch(
    projectOptions,
    (list) => {
      const ids = list.map((p) => p.id)
      const idSet = new Set(ids)
      if (!projectFilterIds.value.length) {
        projectFilterIds.value = [...ids]
      } else {
        const pruned = projectFilterIds.value.filter((id) => idSet.has(id))
        const wasAll =
          prevOptionIds.length > 0 && prevOptionIds.every((id) => projectFilterIds.value.includes(id))
        projectFilterIds.value = wasAll
          ? [...ids]
          : pruned.length
            ? pruned
            : [...ids]
      }
      prevOptionIds = ids
    },
    { immediate: true }
  )

  watch(projectFilterIds, (ids) => {
    if (!ids.length && projectOptions.value.length) {
      projectFilterIds.value = projectOptions.value.map((p) => p.id)
    }
  })

  const projectCards = computed(() => {
    void dojoProjectStore.projects.length
    void projectRuntimeRevision.value
    const allow = new Set(projectFilterIds.value)
    return projectOptions.value.flatMap((project) => {
      if (allow.size && !allow.has(project.id)) return []
      const runtime = getProjectRuntime(project.id)
      if (!runtime) return []
      return [{ project, runtime }]
    })
  })

  watch(projectCards, (cards) => {
    if (focusProjectId.value && !cards.some((c) => c.project.id === focusProjectId.value)) {
      focusProjectId.value = ''
    }
  })

  const todoRows = computed(() => {
    void projectRuntimeRevision.value
    const rows = projectCards.value.flatMap(({ project, runtime }) =>
      buildTodayTodos(project.id, project.name, runtime)
    )
    if (!focusProjectId.value) return rows
    return rows.filter((r) => r.projectId === focusProjectId.value)
  })

  function projectName(id: string) {
    return getProjectById(id)?.name || id
  }

  function focusProject(id: string) {
    focusProjectId.value = focusProjectId.value === id ? '' : id
  }

  function goProject(id: string) {
    setSelectedProjects([id])
    router.push('/project')
  }

  function statusTagType(status: string) {
    if (status === '进行中') return 'primary'
    if (status === '完结' || status === '已完成') return 'success'
    return 'info'
  }

  function onPriority(projectId: string, priority: 'high' | 'medium' | 'low') {
    upsertProjectRuntime(projectId, { priority })
  }

  function onOwner(row: TodayTodoRow, owner: string) {
    patchTodoMeta(row.projectId, row.key, { owner })
  }

  function onStatus(row: TodayTodoRow, status: TodoTaskStatus) {
    patchTodoMeta(row.projectId, row.key, { status })
  }

  function onNote(row: TodayTodoRow, note: string) {
    patchTodoMeta(row.projectId, row.key, { note })
  }

  function onClient(row: TodayTodoRow, clientContact: string) {
    patchTodoMeta(row.projectId, row.key, { clientContact })
  }

  function numQuantity(q: string | number) {
    return typeof q === 'number' ? q : parseInt(String(q), 10) || 0
  }

  function adsPct(q: string | number) {
    if (typeof q === 'number') return q
    return parseFloat(String(q).replace('%', '')) || 0
  }

  function onQuantity(row: TodayTodoRow, value: number | string) {
    applyTodoQuantity(row.projectId, row.key, value)
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .empty-state {
    padding: 28px;
    text-align: center;
    color: var(--el-text-color-secondary);
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;
  }

  .project-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .proj-card {
    padding: 16px 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }

    &.is-active {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
    }

    &__title {
      display: block;
      margin: 0 0 10px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--el-color-primary);
      font-size: 18px;
      font-weight: 650;
      text-align: left;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    &__status,
    &__priority {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0 0 8px;
      color: var(--el-text-color-secondary);
      font-size: 13px;

      &:last-child {
        margin-bottom: 0;
      }

      .hint {
        color: var(--el-text-color-placeholder);
        font-size: 11px;
      }
    }
  }

  .panel__title {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: baseline;
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    font-weight: 400;
  }

  .qty-input {
    width: 72px;

    :deep(.el-input__inner) {
      text-align: right;
    }
  }

  .qty-pct {
    position: relative;
    display: inline-flex;
    justify-content: flex-end;
    width: 76px;

    .qty-input--pct {
      width: 100%;

      :deep(.el-input__wrapper) {
        padding-right: 22px;
      }

      :deep(.el-input__inner) {
        text-align: right;
      }
    }

    &__suffix {
      position: absolute;
      top: 50%;
      right: 9px;
      color: var(--el-text-color-placeholder);
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      pointer-events: none;
      user-select: none;
      transform: translateY(-50%);
    }
  }
</style>
