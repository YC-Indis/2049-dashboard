<script setup lang="ts">
import { Icon } from '@iconify/vue'
import PageHeader from '../components/common/PageHeader.vue'
import GradientButton from '../components/common/GradientButton.vue'

defineEmits<{
  newContent: []
}>()

const businessModules = [
  { number: '01', name: '定位', status: '建设中', progress: 72 },
  { number: '02', name: '产品', status: '建设中', progress: 55 },
  { number: '03', name: '流量', status: '建设中', progress: 38 },
  { number: '04', name: '转化', status: '未建立', progress: 0 },
  { number: '05', name: '交付', status: '未建立', progress: 0 },
]

const topicSources = [
  { name: '客户问题', value: 84 },
  { name: '真实案例', value: 68 },
  { name: '行业变化', value: 46 },
  { name: '个人判断', value: 73 },
  { name: '产品场景', value: 39 },
]

const contentJobs = [
  { name: '获客', value: 42, description: '让匹配的人第一次看见你' },
  { name: '信任', value: 38, description: '用判断与案例缩短理解距离' },
  { name: '转化', value: 20, description: '给已有需求一个行动入口' },
]
</script>

<template>
  <div class="page page--strategy">
    <PageHeader
      eyebrow="XIA · IP BUSINESS LOOP"
      title="内容不是终点，它要推动一门生意向前。"
      description="这张地图来自你的 IP 方法：先看商业闭环缺口，再决定下一条内容是获客、建立信任，还是完成转化。"
    >
      <template #actions>
        <GradientButton @click="$emit('newContent')">
          <Icon icon="ph:plus" width="18" />
          按策略新增内容
        </GradientButton>
      </template>
    </PageHeader>

    <section class="business-completeness">
      <div class="business-score">
        <p>BUSINESS COMPLETENESS</p>
        <strong>30<span>%</span></strong>
        <small>你的内容系统已经开始工作，接下来要补上转化与交付。</small>
      </div>
      <div class="business-modules">
        <article v-for="module in businessModules" :key="module.number">
          <span>{{ module.number }}</span>
          <strong>{{ module.name }}</strong>
          <small>{{ module.status }}</small>
          <div class="business-module__line">
            <span :style="{ width: `${module.progress}%` }" />
          </div>
        </article>
      </div>
    </section>

    <div class="strategy-grid">
      <section class="strategy-panel panel">
        <header class="section-heading">
          <div>
            <p class="eyebrow">TOPIC SOURCES</p>
            <h2>五类选题雷达</h2>
          </div>
          <span class="section-note">近 30 天</span>
        </header>
        <div class="topic-radar">
          <article v-for="source in topicSources" :key="source.name">
            <span>{{ source.name }}</span>
            <div><i :style="{ width: `${source.value}%` }" /></div>
            <strong>{{ source.value }}</strong>
          </article>
        </div>
      </section>

      <section class="strategy-panel panel">
        <header class="section-heading">
          <div>
            <p class="eyebrow">CONTENT JOB</p>
            <h2>内容角色配置</h2>
          </div>
        </header>
        <div class="content-jobs">
          <article v-for="job in contentJobs" :key="job.name">
            <strong>{{ job.value }}%</strong>
            <div>
              <h3>{{ job.name }}</h3>
              <p>{{ job.description }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
