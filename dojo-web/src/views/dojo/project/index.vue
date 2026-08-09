<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>项目进度</h1>
        <p>{{ project.name }} · TikTok 矩阵</p>
      </div>
    </header>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ doneStages }}/{{ workflowStages.length }}</span>
        <span class="stat__l">里程碑已完成</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ scriptTotal }}</span>
        <span class="stat__l">脚本条目</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ distributionTotal }}</span>
        <span class="stat__l">分发记录</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ accountTotal }}</span>
        <span class="stat__l">矩阵账号</span>
      </div>
    </div>

    <section class="panel">
      <div class="panel__title">{{ workflowStages.length }} 个里程碑（dojo脚本 · 时间规划）</div>
      <ElTable :data="workflowStages" stripe>
        <ElTableColumn type="index" label="#" width="50" />
        <ElTableColumn prop="name" label="事项" min-width="200" />
        <ElTableColumn prop="owner" label="负责" width="80" />
        <ElTableColumn label="状态" width="140">
          <template #default="{ row }">
            <ElTag :type="tagType(row.status)" size="small">{{ row.statusLabel }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="startDate" label="计划开始" width="110" />
        <ElTableColumn prop="endDate" label="计划结束" width="110" />
      </ElTable>
      <div class="actions">
        <ElButton type="primary" @click="$router.push('/timeline')">时间规划</ElButton>
        <ElButton @click="$router.push('/scripts')">脚本进度</ElButton>
        <ElButton @click="$router.push('/accounts/review')">总账号预览</ElButton>
      </div>
    </section>

    <section class="panel">
      <div class="panel__title">复盘与账号（{{ accountPlans.length }} 组内容细分）</div>
      <ElTable :data="accountPlans" stripe size="small">
        <ElTableColumn prop="segment" label="内容细分" width="160" />
        <ElTableColumn label="在运/规划" width="100">
          <template #default="{ row }">{{ row.activeCount }}/{{ row.plannedCount }}</template>
        </ElTableColumn>
        <ElTableColumn prop="sceneExample" label="场景示例" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="账号数" width="80">
          <template #default="{ row }">{{ row.accounts.length }}</template>
        </ElTableColumn>
      </ElTable>
      <div class="actions">
        <ElButton @click="$router.push('/accounts')">复盘总结</ElButton>
        <ElButton @click="$router.push('/accounts/review')">总账号预览</ElButton>
      </div>
    </section>

    <section class="panel">
      <div class="panel__title">待办与风险</div>
      <ul class="risk-list">
        <li v-for="(r, i) in risks" :key="i" :class="r.level">{{ r.text }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import {
    accountPlans,
    distributionRecords,
    importSummary,
    workflowStages
  } from '@/mock/dojo/imported'
  import { historyImport } from '@/mock/dojo/imported/historyImport'
  import { scriptProgressRows } from '@/mock/dojo/flowData'

  defineOptions({ name: 'DojoProject' })

  const project = {
    name: 'Dojo UK 矩阵',
    platform: 'TikTok'
  }

  const doneStages = computed(() => workflowStages.filter((s) => s.status === '已完成').length)
  const scriptTotal = computed(() => scriptProgressRows.length)
  const distributionTotal = computed(() => distributionRecords.length)
  const accountTotal = computed(() => accountPlans.reduce((n, p) => n + p.accounts.length, 0))

  const risks = computed(() => {
    const list: { text: string; level: string }[] = []
    const pending = workflowStages.filter((s) => s.status === '待确认')
    if (pending.length) {
      list.push({ text: `待确认：${pending.map((p) => p.name).join('、')}`, level: 'warn' })
    }
    const doing = workflowStages.filter((s) => s.status === '进行中')
    if (doing.length) {
      list.push({ text: `进行中：${doing.map((p) => p.statusLabel).join('；')}`, level: 'info' })
    }
    list.push({
      text: `数据已导入 ${importSummary.counts.distributionRecords} 条分发 · ${importSummary.counts.accountMonitor} 个账号可监看 · 历史 CSV ${historyImport.counts.accounts} 账号 / ${historyImport.counts.posts} 帖子`,
      level: 'ok'
    })
    return list
  })

  function tagType(s: string) {
    if (s === '已完成') return 'success'
    if (s === '待确认') return 'warning'
    if (s === '进行中') return 'primary'
    return 'info'
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }

  .risk-list {
    margin: 0;
    padding-left: 1.2rem;
    line-height: 1.8;
    font-size: 14px;

    .warn {
      color: #e6a23c;
    }

    .info {
      color: var(--el-text-color-regular);
    }

    .ok {
      color: #67c23a;
    }
  }
</style>
