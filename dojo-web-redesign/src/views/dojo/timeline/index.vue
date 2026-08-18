<template>
  <div class="dojo-page timeline-page">
    <header class="dojo-page__head">
      <div>
        <h1>项目排期</h1>
        <p>
          一项目一条周期；点开项目后按需加细项时间条（脚本 / 起号 / 拍摄 / 剪辑 / 分发 /
          投放），不必一次划满。
        </p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
      </div>
    </header>

    <!-- 轻量阶段筛选，不是大统计卡 -->
    <div class="phase-filters">
      <button
        type="button"
        class="phase-chip"
        :class="{ active: !phaseFilter }"
        @click="phaseFilter = ''"
      >
        All {{ phaseStatsTotal }}
      </button>
      <button
        v-for="s in phaseStats"
        :key="s.key"
        type="button"
        class="phase-chip"
        :class="{ active: phaseFilter === s.key }"
        @click="phaseFilter = phaseFilter === s.key ? '' : s.key"
      >
        <i :style="{ background: s.color }" />
        {{ s.label }}
        <em>{{ s.count }}</em>
      </button>
    </div>

    <GanttBoard :project-ids="boardProjectIds" />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import GanttBoard from './GanttBoard.vue'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import {
    getProjectRuntime,
    plannedScripts,
    projectRuntimeRevision
  } from '@/store/dojoProjectRuntime'
  import { dojoScheduleStore, purgeOrphanScheduleBlocks } from '@/store/dojoScheduleStore'
  import { reconcileCycleFromSchedule, refreshKpiProgress } from '@/store/dojoKpiSchedule'

  defineOptions({ name: 'DojoTimeline' })

  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const phaseFilter = ref('')

  const PHASES = [
    { key: 'scripts', label: '脚本', color: '#5E6AD2' },
    { key: 'accounts', label: '起号', color: '#8E8E93' },
    { key: 'shoot', label: '拍摄', color: '#FF9F0A' },
    { key: 'edit', label: '剪辑', color: '#FF375F' },
    { key: 'distribute', label: '分发', color: '#32ADE6' },
    { key: 'ads', label: '投放', color: '#FFD60A' },
    { key: 'done', label: 'Done', color: '#30D158' }
  ] as const

  function phaseKeyOf(projectId: string): string {
    const rt = getProjectRuntime(projectId)
    if (!rt) return 'scripts'
    const scriptT = plannedScripts(rt.kpi)
    const stages = [
      { key: 'scripts', done: rt.current.scripts, target: scriptT },
      { key: 'accounts', done: rt.current.accounts, target: rt.kpi.accounts },
      {
        key: 'shoot',
        done: Math.min(rt.current.edited, rt.kpi.videos),
        target: rt.kpi.videos
      },
      { key: 'edit', done: rt.current.edited, target: rt.kpi.videos },
      { key: 'distribute', done: rt.current.distributed, target: rt.kpi.videos },
      { key: 'ads', done: rt.current.exposure, target: rt.kpi.exposure }
    ]
    for (const s of stages) {
      if (s.target > 0 && s.done < s.target) return s.key
    }
    return 'done'
  }

  onMounted(() => {
    const valid = new Set(dojoProjectStore.projects.map((p) => p.id))
    purgeOrphanScheduleBlocks(valid)
    // 旧版拖拽可能只改了排期块：先把周期回写进 runtime，项目总览才能跟上
    dojoProjectStore.projects.forEach((p) => {
      if (!reconcileCycleFromSchedule(p.id)) refreshKpiProgress(p.id)
    })
  })

  const scopedProjects = computed(() => {
    void projectRuntimeRevision.value
    const ids = selectedProjectIds.value
    return dojoProjectStore.projects.filter(
      (p) =>
        p.active !== false &&
        getProjectRuntime(p.id)?.kpi.cycleStart &&
        (!ids.length || ids.includes(p.id))
    )
  })

  const phaseStats = computed(() => {
    void dojoScheduleStore.revision
    const counts = Object.fromEntries(PHASES.map((p) => [p.key, 0])) as Record<string, number>
    scopedProjects.value.forEach((p) => {
      const key = phaseKeyOf(p.id)
      counts[key] = (counts[key] || 0) + 1
    })
    return PHASES.map((p) => ({ ...p, count: counts[p.key] || 0 })).filter((p) => p.count > 0)
  })

  const phaseStatsTotal = computed(() => scopedProjects.value.length)

  /** 始终传精确 id 列表给甘特（空数组=无项目，不再表示「全部」） */
  const boardProjectIds = computed(() => {
    let pool = scopedProjects.value
    if (phaseFilter.value) {
      pool = pool.filter((p) => phaseKeyOf(p.id) === phaseFilter.value)
    }
    return pool.map((p) => p.id)
  })
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .timeline-page {
    :deep(.dojo-page__head h1) {
      letter-spacing: -0.03em;
      font-weight: 650;
    }
  }

  .phase-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .phase-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--el-fill-color-lighter) 85%, transparent);
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-border-color) 45%, transparent);
    transition:
      background 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
      color 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
      box-shadow 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
      transform 0.18s cubic-bezier(0.25, 0.1, 0.25, 1);

    i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
    }

    em {
      font-style: normal;
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-placeholder);
    }

    &.active {
      background: color-mix(in srgb, #5e6ad2 10%, var(--el-bg-color));
      color: var(--el-text-color-primary);
      box-shadow:
        inset 0 0 0 1px color-mix(in srgb, #5e6ad2 28%, transparent),
        0 1px 2px rgb(15 23 42 / 4%);
    }

    &:hover {
      background: color-mix(in srgb, #5e6ad2 7%, var(--el-fill-color-lighter));
      transform: translateY(-1px);
    }
  }
</style>
