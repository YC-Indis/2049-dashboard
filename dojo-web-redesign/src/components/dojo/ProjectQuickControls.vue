<script setup lang="ts">
  import { ref } from 'vue'
  import {
    Calendar,
    CopyDocument,
    Delete,
    EditPen,
    Flag,
    Hide,
    MoreFilled,
    Refresh,
    UserFilled
  } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { updateProject, type DojoProject } from '@/store/dojoProjectStore'
  import type { ProjectRuntime } from '@/store/dojoProjectRuntime'

  const props = defineProps<{
    project: DojoProject
    runtime: ProjectRuntime
    refreshing?: boolean
  }>()

  const emit = defineEmits<{
    edit: [id: string]
    duplicate: [id: string]
    sync: [id: string]
    refresh: [id: string]
    hide: [id: string]
    remove: [id: string]
  }>()

  const ownerDraft = ref(props.runtime.owner)
  const clientDraft = ref(props.runtime.clientContact)
  const cycleDraft = ref<[string, string] | null>([
    props.runtime.kpi.cycleStart,
    props.runtime.kpi.cycleEnd
  ])

  function setPriority(priority: ProjectRuntime['priority']) {
    updateProject(props.project.id, { priority })
    ElMessage.success(
      `优先级已调整为${priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}`
    )
  }

  function savePeople() {
    updateProject(props.project.id, {
      owner: ownerDraft.value.trim(),
      clientContact: clientDraft.value.trim()
    })
    ElMessage.success('项目协作人已更新')
  }

  function saveCycle() {
    if (!cycleDraft.value?.length) return
    updateProject(props.project.id, {
      cycleStart: cycleDraft.value[0],
      cycleEnd: cycleDraft.value[1]
    })
    ElMessage.success('项目周期已更新')
  }
</script>

<template>
  <div class="quick-controls" aria-label="项目快捷控制">
    <ElPopover trigger="click" width="218" placement="bottom-end">
      <template #reference>
        <button type="button" title="调整优先级" aria-label="调整优先级">
          <Flag />
          <i :class="`is-${runtime.priority}`" />
        </button>
      </template>
      <div class="quick-popover">
        <strong>优先级</strong>
        <div class="priority-options">
          <button
            type="button"
            :class="{ active: runtime.priority === 'high' }"
            @click="setPriority('high')"
            >高</button
          >
          <button
            type="button"
            :class="{ active: runtime.priority === 'medium' }"
            @click="setPriority('medium')"
            >中</button
          >
          <button
            type="button"
            :class="{ active: runtime.priority === 'low' }"
            @click="setPriority('low')"
            >低</button
          >
        </div>
      </div>
    </ElPopover>

    <ElPopover trigger="click" width="286" placement="bottom-end">
      <template #reference>
        <button type="button" title="负责人和客户对接" aria-label="负责人和客户对接">
          <UserFilled />
          <span v-if="runtime.owner" class="quick-controls__initial">{{
            runtime.owner.slice(0, 1)
          }}</span>
        </button>
      </template>
      <div class="quick-popover people-form">
        <label>负责人<ElInput v-model="ownerDraft" size="small" placeholder="未设置" /></label>
        <label>客户对接<ElInput v-model="clientDraft" size="small" placeholder="未设置" /></label>
        <ElButton size="small" type="primary" @click="savePeople">立即保存</ElButton>
      </div>
    </ElPopover>

    <ElPopover trigger="click" width="330" placement="bottom-end">
      <template #reference>
        <button type="button" title="调整项目周期" aria-label="调整项目周期">
          <Calendar />
        </button>
      </template>
      <div class="quick-popover cycle-form">
        <strong>项目周期</strong>
        <ElDatePicker
          v-model="cycleDraft"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          size="small"
          style="width: 100%"
        />
        <ElButton size="small" type="primary" @click="saveCycle">应用周期</ElButton>
      </div>
    </ElPopover>

    <button
      type="button"
      title="同步到执行日历"
      aria-label="同步到执行日历"
      @click="emit('sync', project.id)"
    >
      <Calendar />
    </button>
    <button
      type="button"
      title="从台账拉取现状"
      aria-label="从台账拉取现状"
      :disabled="refreshing"
      @click="emit('refresh', project.id)"
    >
      <Refresh :class="{ spin: refreshing }" />
    </button>

    <ElDropdown trigger="click" placement="bottom-end">
      <button type="button" title="更多操作" aria-label="更多操作">
        <MoreFilled />
      </button>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem @click="emit('edit', project.id)"><EditPen /> 编辑项目</ElDropdownItem>
          <ElDropdownItem @click="emit('duplicate', project.id)"
            ><CopyDocument /> 复制项目</ElDropdownItem
          >
          <ElDropdownItem @click="emit('hide', project.id)"><Hide /> 隐藏项目</ElDropdownItem>
          <ElDropdownItem divided @click="emit('remove', project.id)"
            ><Delete /> 删除项目</ElDropdownItem
          >
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<style scoped lang="scss">
  .quick-controls {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px;
    background: var(--dojo-paper-muted);
    border-radius: 11px;

    > button,
    :deep(.el-tooltip__trigger) {
      position: relative;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      color: var(--dojo-muted-strong);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: 8px;

      > svg {
        width: 17px;
        height: 17px;
      }

      &:hover,
      &:focus-visible {
        color: var(--dojo-accent);
        background: var(--dojo-paper);
        outline: 0;
      }
    }

    i {
      position: absolute;
      right: 5px;
      bottom: 5px;
      width: 6px;
      height: 6px;
      border: 1px solid var(--dojo-paper-muted);
      border-radius: 50%;

      &.is-high {
        background: var(--dojo-danger);
      }

      &.is-medium {
        background: var(--dojo-amber);
      }

      &.is-low {
        background: var(--dojo-cyan);
      }
    }

    &__initial {
      position: absolute;
      right: 2px;
      bottom: 1px;
      display: grid;
      place-items: center;
      width: 13px;
      height: 13px;
      font-size: 7px;
      color: #fff;
      background: var(--dojo-purple);
      border: 1px solid var(--dojo-paper-muted);
      border-radius: 50%;
    }
  }

  .spin {
    animation: spin 850ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

<style lang="scss">
  .quick-popover {
    display: grid;
    gap: 10px;

    > strong {
      font-size: 12px;
      color: var(--dojo-ink);
    }

    label {
      display: grid;
      gap: 5px;
      font-size: 10px;
      color: var(--dojo-muted);
    }
  }

  .priority-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;

    button {
      min-height: 32px;
      color: var(--dojo-muted-strong);
      cursor: pointer;
      background: var(--dojo-paper-muted);
      border: 0;
      border-radius: 8px;

      &.active {
        color: #fff;
        background: var(--dojo-accent);
      }
    }
  }
</style>
