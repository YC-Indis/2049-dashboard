<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>账号接入</h1>
        <p>账号是系统的核心实体：账号在册，指标由 RapidAPI 拉取，表格由系统导出</p>
      </div>
      <div class="head-actions">
        <ElButton :loading="syncing" type="primary" @click="syncUnsynced">
          同步未同步账号
        </ElButton>
        <ElButton :disabled="syncing" @click="syncAll">全部重新同步</ElButton>
      </div>
    </header>

    <div class="stat-row stat-row--6">
      <div class="stat">
        <span class="stat__n">{{ stats.total }}</span>
        <span class="stat__l">在册账号</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.synced }}</span>
        <span class="stat__l">已同步</span>
      </div>
      <div class="stat">
        <span class="stat__n" :class="{ danger: stats.neverSynced > 0 }">
          {{ stats.neverSynced }}
        </span>
        <span class="stat__l">从未同步</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ formatNumber(stats.followers) }}</span>
        <span class="stat__l">粉丝合计</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats.videos }}</span>
        <span class="stat__l">已拉取作品</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ formatNumber(stats.views) }}</span>
        <span class="stat__l">作品播放合计</span>
      </div>
    </div>

    <ElAlert type="info" :closable="false" class="tip">
      <template #default>
        文档只用来认账号，不逐张表认字段。上传内容规划表、数据记录表、周报或直接粘贴
        账号清单都可以，系统会把 @账号 和作品链接挑出来让你确认。
        <template v-if="syncProgress">
          <strong> 同步中：{{ syncProgress }}</strong>
        </template>
      </template>
    </ElAlert>

    <section class="panel">
      <div class="panel__title">第一步 · 投递</div>
      <div class="intake-grid">
        <ElUpload
          class="dropzone"
          drag
          multiple
          :auto-upload="false"
          :show-file-list="false"
          :on-change="onFilePicked"
        >
          <div class="dropzone__inner">
            <div class="dropzone__title">把文档拖进来</div>
            <div class="dropzone__hint">支持 xlsx / xls / docx / csv / txt / json</div>
          </div>
        </ElUpload>

        <div class="paste">
          <ElInput
            v-model="pasteText"
            type="textarea"
            :rows="6"
            placeholder="或直接粘贴账号清单、作品链接、聊天记录…&#10;例：https://www.tiktok.com/@elliottlan3&#10;@sunnyjadediary"
          />
          <div class="paste__actions">
            <ElButton :disabled="!pasteText.trim()" @click="extractFromPaste">
              识别粘贴内容
            </ElButton>
            <ElButton v-if="parsedDocs.length || candidates.length" text @click="resetIntake">
              清空
            </ElButton>
          </div>
        </div>
      </div>

      <div v-if="parsedDocs.length" class="doc-list">
        <div v-for="doc in parsedDocs" :key="doc.name" class="doc-item">
          <ElTag size="small" :type="doc.error ? 'danger' : 'success'">
            {{ kindLabel(doc.kind) }}
          </ElTag>
          <span class="doc-item__name">{{ doc.name }}</span>
          <span v-if="doc.sheets?.length" class="muted">
            {{ doc.sheets.length }} 个工作表：{{ doc.sheets.join('、') }}
          </span>
          <span v-if="doc.error" class="danger">{{ doc.error }}</span>
          <span v-else class="muted">{{ doc.text.length }} 字符</span>
        </div>
      </div>
    </section>

    <section v-if="candidates.length" class="panel">
      <div class="panel__title">
        第二步 · 确认（识别到 {{ candidates.length }} 个候选，其中 {{ highCount }} 个来自作品链接）
      </div>

      <div class="confirm-bar">
        <ElSelect
          v-model="targetProject"
          filterable
          clearable
          placeholder="归入哪个项目"
          style="width: 260px"
        >
          <ElOption v-for="p in allProjects" :key="p.id" :label="p.name" :value="p.id" />
        </ElSelect>
        <ElInput v-model="targetSegment" placeholder="内容细分（可留空）" style="width: 200px" />
        <ElCheckbox v-model="autoSync">入库后立即同步</ElCheckbox>
        <span class="muted">已勾选 {{ selected.length }} 个</span>
        <ElButton :disabled="!selected.length" type="primary" @click="commit"> 确认入库 </ElButton>
      </div>

      <ElTable
        ref="candidateTable"
        :data="candidates"
        stripe
        size="small"
        row-key="handle"
        @selection-change="onSelectionChange"
      >
        <ElTableColumn type="selection" width="46" :selectable="() => true" />
        <ElTableColumn label="账号" min-width="170">
          <template #default="{ row }">
            <a v-if="row.link" :href="row.link" target="_blank" rel="noreferrer">
              {{ row.handle }}
            </a>
            <span v-else>{{ row.handle }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="来源可信度" width="130">
          <template #default="{ row }">
            <ElTag size="small" :type="row.confidence === 'high' ? 'success' : 'warning'">
              {{ row.confidence === 'high' ? '作品链接' : '正文提及' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="hits" label="出现" width="70" />
        <ElTableColumn label="已在册" width="90">
          <template #default="{ row }">
            <ElTag v-if="existing(row.handle)" size="small" type="info">已在册</ElTag>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="context" label="上下文" min-width="240" show-overflow-tooltip />
      </ElTable>
      <p class="muted note">
        正文提及默认不勾选：文案里的 @ 常是品牌方或合作方，误入库会把台账搞脏。
      </p>
    </section>

    <section class="panel">
      <div class="panel__title">账号台账（{{ ledger.length }}）</div>
      <div class="confirm-bar">
        <ElInput v-model="keyword" placeholder="搜账号 / 细分" clearable style="width: 220px" />
        <ElSelect v-model="filterProject" clearable placeholder="项目" style="width: 200px">
          <ElOption v-for="p in ledgerProjects" :key="p.id" :label="p.name" :value="p.id" />
        </ElSelect>
        <ElCheckbox v-model="onlyUnsynced">只看未同步</ElCheckbox>
      </div>

      <ElTable :data="ledger" stripe size="small">
        <ElTableColumn label="账号" min-width="170">
          <template #default="{ row }">
            <a
              :href="row.link || `https://www.tiktok.com/${row.handle}`"
              target="_blank"
              rel="noreferrer"
            >
              {{ row.handle }}
            </a>
            <div v-if="row.nickname && row.nickname !== row.handle.slice(1)" class="muted small">
              {{ row.nickname }}
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="项目" min-width="150">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="segment" label="内容细分" min-width="140" show-overflow-tooltip />
        <ElTableColumn label="粉丝" width="100" sortable :sort-method="byFollowers">
          <template #default="{ row }">
            <span v-if="row.followers != null">{{ formatNumber(row.followers) }}</span>
            <span v-else class="muted">未同步</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="作品" width="80">
          <template #default="{ row }">
            {{ videoCount(row.handle) || row.totalVideos || 0 }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="播放合计" width="110">
          <template #default="{ row }">{{ formatNumber(viewsOf(row.handle)) }}</template>
        </ElTableColumn>
        <ElTableColumn label="来源" width="90">
          <template #default="{ row }">
            <ElTag size="small" type="info">{{ sourceLabel(row.source) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="同步状态" min-width="150">
          <template #default="{ row }">
            <ElTag v-if="isSyncing(row.handle)" size="small">同步中…</ElTag>
            <span v-else-if="row.syncError" class="danger">{{ row.syncError }}</span>
            <span v-else-if="row.lastSyncedAt">
              {{ row.lastSyncedAt }}
              <ElTag v-if="row.syncSource === 'mock'" size="small" type="warning">兜底数据</ElTag>
            </span>
            <span v-else class="muted">从未同步</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" :disabled="syncing" @click="syncOne(row.handle)">
              同步
            </ElButton>
            <ElButton link type="danger" @click="drop(row.handle)">移除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { TableInstance, UploadFile } from 'element-plus'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import {
    accountStats,
    accountVideos,
    dojoAccountStore,
    findAccount,
    importAccounts,
    isSyncing,
    removeAccount,
    syncAccount,
    syncAccounts
  } from '@/store/dojoAccountStore'
  import type { AccountSource, MatrixAccount } from '@/store/dojoAccountStore'
  import { extractAccountsFromFiles, extractHandlesFromText } from '@/utils/dojoAccountExtract'
  import type { AccountCandidate, ParsedDocument } from '@/utils/dojoAccountExtract'

  defineOptions({ name: 'DojoAccountIntake' })

  const pasteText = ref('')
  const parsedDocs = ref<ParsedDocument[]>([])
  const candidates = ref<AccountCandidate[]>([])
  const selected = ref<AccountCandidate[]>([])
  const candidateTable = useTemplateRef<TableInstance>('candidateTable')
  const targetProject = ref('')
  const targetSegment = ref('')
  const autoSync = ref(true)
  const pendingFiles = ref<File[]>([])

  const keyword = ref('')
  const filterProject = ref('')
  const onlyUnsynced = ref(false)
  const syncing = ref(false)
  const syncProgress = ref('')

  const stats = computed(() => accountStats.value)
  const highCount = computed(() => candidates.value.filter((c) => c.confidence === 'high').length)

  function formatNumber(n: number) {
    return (n || 0).toLocaleString('en-US')
  }

  function kindLabel(kind: ParsedDocument['kind']) {
    return { excel: 'Excel', word: 'Word', text: '文本', unsupported: '不支持' }[kind]
  }

  function sourceLabel(source: AccountSource) {
    return { excel: '历史表格', manual: '手工', document: '文档' }[source] || source
  }

  function projectName(id: string) {
    return dojoProjectStore.projects.find((p) => p.id === id)?.name || id || '未归属'
  }

  function existing(handle: string) {
    return Boolean(findAccount(handle))
  }

  function videoCount(handle: string) {
    return accountVideos(handle).length
  }

  function viewsOf(handle: string) {
    return accountVideos(handle).reduce((s, v) => s + v.views, 0)
  }

  /** 未同步的排在最后，而不是当成 0 混进低粉账号里 */
  function byFollowers(a: MatrixAccount, b: MatrixAccount) {
    return (a.followers ?? -1) - (b.followers ?? -1)
  }

  const allProjects = computed(() => dojoProjectStore.projects.filter((p) => p.active !== false))

  /** 台账里出现过的项目，避免下拉里塞满没有账号的项目 */
  const ledgerProjects = computed(() => {
    const ids = new Set(dojoAccountStore.accounts.map((a) => a.projectId))
    return dojoProjectStore.projects.filter((p) => ids.has(p.id))
  })

  const ledger = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return dojoAccountStore.accounts.filter((a) => {
      if (filterProject.value && a.projectId !== filterProject.value) return false
      if (onlyUnsynced.value && a.lastSyncedAt) return false
      if (!kw) return true
      return (
        a.handle.toLowerCase().includes(kw) ||
        a.segment.toLowerCase().includes(kw) ||
        (a.nickname || '').toLowerCase().includes(kw)
      )
    })
  })

  function onSelectionChange(rows: AccountCandidate[]) {
    selected.value = rows
  }

  async function onFilePicked(file: UploadFile) {
    if (!file.raw) return
    pendingFiles.value.push(file.raw)
    // ElUpload 逐个回调，攒到一帧后统一解析，避免多文件时反复覆盖候选列表
    await Promise.resolve()
    const files = pendingFiles.value
    pendingFiles.value = []
    if (!files.length) return

    const result = await extractAccountsFromFiles(files)
    parsedDocs.value = [...parsedDocs.value, ...result.documents]
    mergeCandidates(result.candidates)

    const failed = result.documents.filter((d) => d.error)
    if (failed.length) ElMessage.warning(`${failed.length} 个文件未能解析`)
    if (!result.candidates.length && !failed.length) {
      ElMessage.info('文档解析成功，但没找到任何账号')
    }
  }

  function extractFromPaste() {
    const found = extractHandlesFromText(pasteText.value)
    if (!found.length) {
      ElMessage.info('没识别到账号，确认里面有 @账号 或作品链接')
      return
    }
    mergeCandidates(found)
    ElMessage.success(`识别到 ${found.length} 个候选账号`)
  }

  function mergeCandidates(incoming: AccountCandidate[]) {
    const map = new Map(candidates.value.map((c) => [c.handle.toLowerCase(), c]))
    incoming.forEach((c) => {
      const hit = map.get(c.handle.toLowerCase())
      if (!hit) {
        map.set(c.handle.toLowerCase(), c)
        return
      }
      hit.hits += c.hits
      if (c.confidence === 'high' && hit.confidence === 'low') {
        hit.confidence = 'high'
        hit.link = c.link
      }
    })
    candidates.value = [...map.values()].sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1
      return b.hits - a.hits
    })
    preselectReliable()
  }

  /** 只默认勾选作品链接来源的候选；正文 @ 提及交给人工判断 */
  async function preselectReliable() {
    await nextTick()
    candidates.value.forEach((row) => {
      candidateTable.value?.toggleRowSelection(row, row.confidence === 'high')
    })
  }

  function resetIntake() {
    pasteText.value = ''
    parsedDocs.value = []
    candidates.value = []
    selected.value = []
  }

  async function commit() {
    const projectId = targetProject.value
    const rows = selected.value.map((c) => ({
      handle: c.handle,
      projectId,
      segment: targetSegment.value.trim(),
      link: c.link,
      source: 'document' as AccountSource
    }))
    const { added, updated } = importAccounts(rows)
    ElMessage.success(`入库完成：新增 ${added} 个，更新 ${updated} 个`)

    const handles = rows.map((r) => r.handle)
    resetIntake()
    if (autoSync.value && handles.length) await runSync(handles)
  }

  async function runSync(handles: string[]) {
    if (!handles.length) return
    syncing.value = true
    syncProgress.value = `0 / ${handles.length}`
    try {
      await syncAccounts(handles, (done, total, handle) => {
        syncProgress.value = `${done} / ${total}（${handle}）`
      })
      const mocked = handles.filter((h) => findAccount(h)?.syncSource === 'mock').length
      if (mocked) {
        ElMessage.warning(`${mocked} 个账号拿不到真实数据，已用兜底值，检查 RapidAPI 配置`)
      } else {
        ElMessage.success('同步完成')
      }
    } finally {
      syncing.value = false
      syncProgress.value = ''
    }
  }

  async function syncOne(handle: string) {
    syncing.value = true
    try {
      const res = await syncAccount(handle)
      if (res) ElMessage.success(`${handle} 已同步，拉到 ${res.videos.length} 条作品`)
      else ElMessage.error(`${handle} 同步失败`)
    } finally {
      syncing.value = false
    }
  }

  function syncUnsynced() {
    const handles = dojoAccountStore.accounts.filter((a) => !a.lastSyncedAt).map((a) => a.handle)
    if (!handles.length) {
      ElMessage.info('所有账号都同步过了')
      return
    }
    return runSync(handles)
  }

  async function syncAll() {
    const handles = dojoAccountStore.accounts.map((a) => a.handle)
    try {
      await ElMessageBox.confirm(
        `将逐个同步 ${handles.length} 个账号，会消耗 RapidAPI 配额，继续？`,
        '全部重新同步',
        { type: 'warning' }
      )
    } catch {
      return
    }
    await runSync(handles)
  }

  async function drop(handle: string) {
    try {
      await ElMessageBox.confirm(`从台账移除 ${handle}？已拉取的作品数据一并删除`, '移除账号', {
        type: 'warning'
      })
    } catch {
      return
    }
    removeAccount(handle)
    ElMessage.success('已移除')
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .head-actions {
    display: flex;
    gap: 8px;
  }

  .stat-row--6 {
    grid-template-columns: repeat(6, minmax(0, 1fr));

    @media (max-width: 1400px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .tip {
    margin-bottom: 16px;
  }

  .intake-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    @media (max-width: 1100px) {
      grid-template-columns: 1fr;
    }
  }

  .dropzone :deep(.el-upload-dragger) {
    padding: 24px;
  }

  .dropzone__title {
    font-size: 15px;
    font-weight: 500;
  }

  .dropzone__hint {
    margin-top: 6px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .paste__actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .doc-list {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .doc-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .doc-item__name {
    font-weight: 500;
  }

  .confirm-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
  }

  .note {
    margin: 10px 0 0;
    font-size: 12px;
  }

  .small {
    font-size: 12px;
  }

  .danger {
    color: var(--el-color-danger);
  }
</style>
