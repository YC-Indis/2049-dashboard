<template>
  <ElSelect
    v-model="value"
    multiple
    collapse-tags
    collapse-tags-tooltip
    :max-collapse-tags="2"
    clearable
    filterable
    :placeholder="placeholder"
    :style="{ width }"
    teleported
  >
    <ElOption v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
  </ElSelect>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { dojoProjectStore, setSelectedProjects } from '@/store/dojoProjectStore'

  defineOptions({ name: 'DojoProjectSelect' })

  const props = withDefaults(
    defineProps<{
      modelValue?: string[]
      width?: string
      placeholder?: string
      /** 投放三页等需要与全局筛选隔离时传 false */
      syncStore?: boolean
    }>(),
    {
      modelValue: () => [],
      width: '240px',
      placeholder: '选择项目（可多选，留空=全部）',
      syncStore: true
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [ids: string[]]
  }>()

  const projects = computed(() => dojoProjectStore.projects.filter((p) => p.active !== false))

  const value = computed({
    get: () => props.modelValue,
    set: (ids: string[]) => {
      emit('update:modelValue', ids)
      if (props.syncStore) setSelectedProjects(ids)
    }
  })
</script>
