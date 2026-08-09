<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>时间规划</h1>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
      </div>
    </header>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ counts.done }}</span>
        <span class="stat__l">已完成 / 已达标</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ counts.doing }}</span>
        <span class="stat__l">进行中</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ counts.wait }}</span>
        <span class="stat__l">待确认</span>
      </div>
      <div class="stat">
        <span class="stat__n" :class="{ danger: counts.risk }">{{ counts.risk }}</span>
        <span class="stat__l">已过期未达标</span>
      </div>
    </div>

    <GanttBoard :project-ids="selectedProjectIds" />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import GanttBoard from './GanttBoard.vue'
  import { workflowStages } from '@/mock/dojo/imported'
  import { adTimeline } from '@/mock/dojo/imported/ads'
  import { dojoProjectStore, getProjectById, matchProjectText } from '@/store/dojoProjectStore'

  defineOptions({ name: 'DojoTimeline' })

  const todayKey = '2026-08-07'
  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])

  const counts = computed(() => {
    const ids = selectedProjectIds.value
    const showStages = !ids.length || ids.includes('dojo')
    const stages = showStages ? workflowStages : []
    const ads = adTimeline.filter((t) => {
      if (!ids.length) return true
      return ids.some((id) => {
        const p = getProjectById(id)
        return p && matchProjectText(`${t.name} ${t.project}`, p)
      })
    })
    const statuses = [...stages.map((s) => s.status), ...ads.map((t) => t.status)]
    return {
      done: statuses.filter((s) => s === '已完成' || s === '已达标').length,
      doing: statuses.filter((s) => s === '进行中' || s === '投放中').length,
      wait: statuses.filter((s) => s === '待确认').length,
      risk: ads.filter((t) => t.status !== '已完成' && t.endDate < todayKey && (t.viewsRate ?? 0) < 1)
        .length
    }
  })
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .stat__n.danger {
    color: var(--el-color-danger);
  }
</style>
