<script setup lang="ts">
  import { computed } from 'vue'
  import type {
    LibraryGroupBy,
    LibraryLayerGroup,
    LibraryLayerItem
  } from '@/utils/dojoInspirationLayers'
  import { groupLibraryItems, LIBRARY_GROUP_LABELS } from '@/utils/dojoInspirationLayers'

  const props = withDefaults(
    defineProps<{
      items: LibraryLayerItem[]
      selectedId: string
      groupBy: LibraryGroupBy
      layer: string
      emptyText?: string
      groupByOptions?: LibraryGroupBy[]
      removable?: boolean
    }>(),
    {
      groupByOptions: () => ['time', 'category', 'tag'],
      removable: false
    }
  )

  const emit = defineEmits<{
    'update:groupBy': [value: LibraryGroupBy]
    'update:layer': [value: string]
    select: [id: string]
    remove: [id: string]
  }>()

  const groups = computed(() => {
    const all = groupLibraryItems(props.items, props.groupBy)
    if (!props.layer) return all
    return all.filter((group) => group.key === props.layer)
  })

  const chips = computed(() =>
    groupLibraryItems(props.items, props.groupBy).map((group) => ({
      key: group.key,
      label: group.label,
      count: group.items.length
    }))
  )

  function toggleLayer(key: string) {
    emit('update:layer', props.layer === key ? '' : key)
  }

  function itemIndex(group: LibraryLayerGroup, index: number) {
    const before = groups.value
      .slice(0, groups.value.findIndex((item) => item.key === group.key))
      .reduce((sum, item) => sum + item.items.length, 0)
    return before + index + 1
  }
</script>

<template>
  <div class="layer-index">
    <div class="layer-switch" role="tablist" aria-label="分层方式">
      <button
        v-for="option in groupByOptions"
        :key="option"
        type="button"
        :class="{ 'is-active': groupBy === option }"
        @click="
          emit('update:groupBy', option);
          emit('update:layer', '')
        "
      >
        按{{ LIBRARY_GROUP_LABELS[option] }}
      </button>
    </div>

    <div v-if="chips.length" class="layer-chips">
      <button type="button" :class="{ 'is-active': !layer }" @click="emit('update:layer', '')">
        全部 {{ items.length }}
      </button>
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        :class="{ 'is-active': layer === chip.key }"
        @click="toggleLayer(chip.key)"
      >
        {{ chip.label }} {{ chip.count }}
      </button>
    </div>

    <div class="layer-groups">
      <section v-for="group in groups" :key="group.key">
        <header>
          <strong>{{ group.label }}</strong>
          <small>{{ group.items.length }}</small>
        </header>
        <article
          v-for="(item, index) in group.items"
          :key="item.id"
          class="layer-item"
          :class="{ 'is-active': item.id === selectedId }"
        >
          <button type="button" class="layer-item__main" @click="emit('select', item.id)">
            <span>{{ String(itemIndex(group, index)).padStart(2, '0') }}</span>
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.subtitle || item.category }}</small>
            </span>
          </button>
          <button
            v-if="removable"
            type="button"
            class="layer-item__remove"
            :aria-label="`删除${item.title}`"
            @click.stop="emit('remove', item.id)"
          >
            删除
          </button>
        </article>
      </section>
      <p v-if="!groups.length">{{ emptyText || '这一层还没有内容' }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .layer-index {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .layer-switch,
  .layer-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .layer-switch button,
  .layer-chips button {
    min-height: 40px;
    height: auto;
    padding: 0 12px;
    font-size: 12px;
    color: var(--dojo-muted-strong);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .layer-switch button.is-active,
  .layer-chips button.is-active {
    color: #fffdfc;
    background: #403666;
    border-color: #403666;
  }

  .layer-groups {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  @container workspace (max-width: 720px) {
    .layer-groups {
      max-height: 240px;
      overflow: auto;
    }

    .layer-chips {
      flex-wrap: nowrap;
      overflow-x: auto;
    }
  }

  .layer-groups header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .layer-groups header strong {
    font-size: 11px;
  }

  .layer-groups header small,
  .layer-groups > p {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .layer-groups .layer-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px;
    align-items: center;
    margin-top: 4px;
    border-radius: 9px;
  }

  .layer-groups .layer-item.is-active {
    background: color-mix(in srgb, var(--dojo-accent) 16%, var(--dojo-paper));
    box-shadow: inset 3px 0 0 var(--dojo-accent);
  }

  .layer-groups .layer-item__main {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 58px;
    padding: 8px;
    color: var(--dojo-muted-strong);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 9px;
  }

  .layer-groups .layer-item__main:hover {
    color: var(--dojo-ink);
    background: var(--dojo-paper);
  }

  .layer-groups .layer-item.is-active .layer-item__main {
    color: var(--dojo-ink);
  }

  .layer-groups .layer-item__main > span:first-child {
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .layer-groups .layer-item__main > span:nth-child(2) {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .layer-groups .layer-item__remove {
    min-height: 28px;
    padding: 0 8px;
    margin-right: 6px;
    font-size: 11px;
    color: #a53f49;
    cursor: pointer;
    background: #fff7f8;
    border: 1px solid #e7c9ce;
    border-radius: 8px;
  }

  .layer-groups button strong,
  .layer-groups button small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-groups button strong {
    font-size: 12px;
  }

  .layer-groups button small {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .layer-groups > p {
    padding: 16px 6px;
  }
</style>
