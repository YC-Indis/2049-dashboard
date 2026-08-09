<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>今日</h1>
        <p>项目经理看风险与阻塞；执行成员看任务。数据来自 dojo脚本 / dojo数据 Excel。</p>
      </div>
    </header>

    <div class="stat-row stat-row--5">
      <div v-for="item in stats" :key="item.label" class="stat">
        <span class="stat__n" :class="{ danger: item.danger }">{{ item.value }}</span>
        <span class="stat__l">{{ item.label }}</span>
      </div>
    </div>

    <section class="panel panel--actions">
      <div class="panel__title">三个最重要动作</div>
      <div class="action-tags">
        <span v-for="(a, i) in topActions" :key="i" class="action-tag" :class="a.tone">
          {{ a.text }}
        </span>
      </div>
      <p class="advice">{{ todayAdvice }}</p>
    </section>

    <section class="panel">
      <div class="panel__title">任务列表</div>
      <ElTable :data="tasks" stripe>
        <ElTableColumn prop="title" label="任务" min-width="220" />
        <ElTableColumn prop="type" label="类型" width="110" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag size="small" :type="statusType(row)">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="priority" label="优先级" width="90" />
        <ElTableColumn prop="owner" label="负责人" width="110" />
        <ElTableColumn prop="dueAt" label="截止" width="170" />
        <ElTableColumn prop="blockReason" label="阻塞原因" min-width="160">
          <template #default="{ row }">
            {{ row.blockReason || '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-if="row.confirmState === 'awaiting_pm'"
              link
              type="primary"
              @click="$router.push('/timeline')"
            >
              看时间条
            </ElButton>
            <ElButton
              v-else-if="row.role === 'executor'"
              link
              type="primary"
              @click="$router.push('/timeline')"
            >
              看进度
            </ElButton>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { demoTasks } from '@/mock/dojo/fixture'
  import type { DojoTask } from '@/mock/dojo/fixture'
  import { overviewStats, todayAdvice, topActions } from '@/store/dojoOverview'

  defineOptions({ name: 'DojoToday' })

  const tasks = demoTasks

  const stats = computed(() => {
    const s = overviewStats.value
    return [
      { label: '里程碑完成', value: `${s.milestonesDone}/${s.milestonesTotal}` },
      { label: '脚本条目', value: s.scriptItems },
      { label: '分发记录', value: s.distributionRows },
      { label: '阻塞', value: s.blocked, danger: true },
      { label: '今日任务', value: s.todayTasks }
    ]
  })

  function statusType(row: DojoTask) {
    if (row.status === 'blocked') return 'danger'
    if (row.status === 'doing') return 'primary'
    if (row.status === 'pending_review') return 'warning'
    return 'info'
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .stat-row--5 {
    grid-template-columns: repeat(5, minmax(0, 1fr));

    @media (max-width: 1200px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .panel--actions .advice {
    margin: 12px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .action-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-tag {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 13px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);

    &.warning {
      background: rgb(245 158 11 / 12%);
      color: #b45309;
    }

    &.danger {
      background: rgb(239 68 68 / 10%);
      color: #b91c1c;
    }

    &.primary {
      background: rgb(74 144 217 / 12%);
      color: #2563eb;
    }
  }

  .muted {
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  .stat__n.danger {
    color: var(--el-color-danger);
  }
</style>
