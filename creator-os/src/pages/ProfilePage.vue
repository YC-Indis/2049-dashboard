<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import PageHeader from '../components/common/PageHeader.vue'
import { creatorStore } from '../stores/creatorStore'

const dataSummary = computed(() => [
  {
    label: '内容档案',
    value: creatorStore.state.contents.length,
    icon: 'ph:files',
  },
  {
    label: '阶段任务',
    value: creatorStore.state.stageTasks.length,
    icon: 'ph:check-square-offset',
  },
  {
    label: '复用规则',
    value: creatorStore.state.rules.length,
    icon: 'ph:bookmark-simple',
  },
])
</script>

<template>
  <div class="page page--profile">
    <PageHeader
      eyebrow="PERSONAL SYSTEM"
      title="让这套系统，真正适合你的节奏。"
      description="你的内容、任务和复盘规则只保存在当前浏览器中，刷新页面后仍会保留。"
    />

    <section class="profile-overview panel">
      <div class="profile-overview__identity">
        <span class="profile-overview__avatar">夏</span>
        <div>
          <h2>小夏</h2>
          <p>AI × 高客单 IP 运营</p>
        </div>
      </div>
      <div class="profile-overview__status">
        <Icon icon="ph:check-circle" width="19" />
        本地数据已自动保存
      </div>
    </section>

    <section class="profile-data-grid">
      <article v-for="item in dataSummary" :key="item.label" class="profile-data-card panel">
        <span>
          <Icon :icon="item.icon" width="21" />
        </span>
        <strong>{{ item.value }}</strong>
        <p>{{ item.label }}</p>
      </article>
    </section>

    <section class="profile-settings panel">
      <header>
        <div>
          <h2>数据与隐私</h2>
          <p>Creator OS 不会把你的个人内容上传到服务器。</p>
        </div>
        <span class="local-only-badge">
          <Icon icon="ph:hard-drives" width="17" />
          LOCAL ONLY
        </span>
      </header>
      <div class="profile-setting-row">
        <span>
          <strong>浏览器本地持久化</strong>
          <small>所有操作都会自动写入 localStorage</small>
        </span>
        <span class="setting-state">已开启</span>
      </div>
    </section>
  </div>
</template>
