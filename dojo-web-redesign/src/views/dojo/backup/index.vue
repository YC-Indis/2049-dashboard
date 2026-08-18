<template>
  <div class="dojo-page backup-page">
    <header class="dojo-page__head">
      <div>
        <h1>数据备份</h1>
        <p>
          业务数据保存在本机浏览器里。网吧等公共电脑关机后会清空，离开前请先导出；下次打开同一网址再导入即可恢复。
        </p>
      </div>
    </header>

    <p class="demo-hint">
      <strong>建议：</strong>每次下机前点「导出备份」保存 JSON 到 U 盘 / 微信 / 网盘；有 GitHub 时也可把文件覆盖到
      <code>dojo-web/public/dojo-seed.json</code> 后 push，新环境首次打开会自动载入。
    </p>

    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ summary.projects }}</span>
        <span class="stat__l">项目</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ summary.accounts }}</span>
        <span class="stat__l">账号</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ summary.videoHandles }}</span>
        <span class="stat__l">账号视频组</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ summary.keyCount }}</span>
        <span class="stat__l">存储项</span>
      </div>
    </div>

    <section class="panel">
      <div class="panel__title">当前数据</div>
      <ul class="meta-list">
        <li>最近保存：{{ summary.latestSavedAt || '—' }}</li>
        <li>排期块：{{ summary.scheduleBlocks }} · 复盘事件：{{ summary.worklogEvents }}</li>
        <li>体积约：{{ sizeLabel }}</li>
      </ul>
      <div class="actions">
        <ElButton type="primary" @click="onExport">导出备份</ElButton>
        <ElButton @click="pickImport">导入恢复</ElButton>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
      </div>
    </section>

    <section class="panel">
      <div class="panel__title">使用步骤</div>
      <ol class="flow">
        <li>离开网吧前：点「导出备份」，把 JSON 存到 U 盘、微信文件助手或网盘。</li>
        <li>下次开机：打开 2049 控制台 → 本页 →「导入恢复」选刚才的文件 → 确认后页面会自动刷新。</li>
        <li>
          同步 GitHub（可选）：把导出的 JSON 复制为仓库里的
          <code>dojo-web/public/dojo-seed.json</code>，commit 并 push；空浏览器首次访问线上站也会自动灌入。
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    collectDojoSeed,
    downloadDojoBackup,
    parseDojoBackupText,
    applyDojoSeed,
    summarizeDojoSeed,
    type DojoSeedSummary
  } from '@/utils/dojoSeed'

  defineOptions({ name: 'DojoBackup' })

  const fileInput = ref<HTMLInputElement | null>(null)

  const summary = reactive<DojoSeedSummary>(summarizeDojoSeed(collectDojoSeed()))

  const sizeLabel = computed(() => {
    const kb = summary.bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(2)} MB`
  })

  function refreshSummary() {
    Object.assign(summary, summarizeDojoSeed(collectDojoSeed()))
  }

  function onExport() {
    try {
      downloadDojoBackup()
      refreshSummary()
      ElMessage.success('备份已下载，请妥善保存')
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '导出失败')
    }
  }

  function pickImport() {
    fileInput.value?.click()
  }

  async function onFile(ev: Event) {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const dump = parseDojoBackupText(text)
      const preview = summarizeDojoSeed(dump)
      await ElMessageBox.confirm(
        `将恢复 ${preview.projects} 个项目、${preview.accounts} 个账号（${preview.keyCount} 项存储）。当前浏览器里的业务数据会被覆盖，是否继续？`,
        '确认导入',
        { type: 'warning', confirmButtonText: '导入并刷新', cancelButtonText: '取消' }
      )
      applyDojoSeed(dump)
      ElMessage.success('导入成功，正在刷新…')
      window.location.reload()
    } catch (e) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '导入失败')
    }
  }
</script>

<style scoped lang="scss">
  @import '../dojo-page.scss';

  .meta-list {
    margin: 0 0 4px;
    padding-left: 1.2rem;
    color: var(--el-text-color-regular);
    line-height: 1.8;
    font-size: 14px;
  }

  code {
    padding: 1px 6px;
    font-size: 12px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
  }
</style>
