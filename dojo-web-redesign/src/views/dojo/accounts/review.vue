<template>
  <div class="dojo-page account-pool">
    <header class="dojo-page__head">
      <div>
        <h1>总账号预览</h1>
        <p>上传与管理矩阵账号 · 列表 / 卡片切换，点进详情监看视频</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="240px" />
        <ElRadioGroup v-model="viewMode" size="default">
          <ElRadioButton value="list">列表</ElRadioButton>
          <ElRadioButton value="card">卡片</ElRadioButton>
        </ElRadioGroup>
        <ElButton @click="exportAccountInfo">导出账号信息</ElButton>
        <ElButton @click="exportVideoContent">导出发布视频</ElButton>
        <ElButton @click="importVisible = true">批量导入</ElButton>
        <ElButton type="primary" @click="openCreate">添加账号</ElButton>
      </div>
    </header>

    <div class="pool-bar">
      <div class="pool-bar__title">
        矩阵账号池
        <ElTag size="small" type="info" effect="plain">{{ filteredAccounts.length }}</ElTag>
      </div>
      <div class="pool-bar__ops">
        <span class="auto-refresh">
          自动刷新
          <ElSelect
            v-model="autoRefreshMs"
            size="small"
            style="width: 110px"
            @change="onAutoRefreshChange"
          >
            <ElOption
              v-for="opt in autoRefreshOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </span>
        <ElButton size="small" :loading="syncingAll" type="primary" plain @click="syncAll">
          立即刷新全部
        </ElButton>
        <span class="muted">{{ syncHint }}</span>
      </div>
    </div>

    <div class="stat-row stat-row--2">
      <div class="stat">
        <span class="stat__n accent">{{ filteredAccounts.length }}</span>
        <span class="stat__l">账号总数</span>
      </div>
      <div class="stat">
        <span class="stat__n accent">{{ formatCompact(totalFans) }}</span>
        <span class="stat__l">粉丝总量</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索账号 / 昵称 / 所属项目"
          style="width: 240px"
        />
        <ElSelect v-model="sortKey" clearable placeholder="排序字段" style="width: 140px">
          <ElOption label="粉丝数" value="followers" />
          <ElOption label="已发布视频" value="videos" />
        </ElSelect>
        <ElRadioGroup v-model="sortOrder" size="default" :disabled="!sortKey">
          <ElRadioButton value="desc">降序</ElRadioButton>
          <ElRadioButton value="asc">升序</ElRadioButton>
        </ElRadioGroup>
        <span class="muted">共 {{ filteredAccounts.length }} 个账号</span>
      </div>

      <div v-if="selectedAccounts.length" class="batch-bar">
        <span>
          已选 <strong>{{ selectedAccounts.length }}</strong> 个账号
        </span>
        <ElButton size="small" :loading="syncingSelected" @click="syncSelected">
          刷新选中
        </ElButton>
        <ElSelect
          v-model="batchProjectId"
          clearable
          filterable
          placeholder="改归属项目"
          size="small"
          style="width: 200px"
          @change="assignSelectedProject"
        >
          <ElOption label="未归属" value="__none__" />
          <ElOption
            v-for="p in dojoProjectStore.projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </ElSelect>
        <ElButton size="small" @click="exportSelectedAccounts">导出选中</ElButton>
        <ElButton size="small" type="danger" plain @click="removeSelected">删除选中</ElButton>
        <ElButton size="small" @click="clearSelection">取消选择</ElButton>
      </div>

      <ElTable
        v-if="viewMode === 'list'"
        ref="tableRef"
        :key="`tbl-${sortKey}-${sortOrder}`"
        :data="displayAccounts"
        row-key="handle"
        stripe
        empty-text="暂无账号，请批量导入或添加"
        :default-sort="tableDefaultSort"
        @selection-change="onTableSelectionChange"
        @sort-change="onTableSort"
      >
        <ElTableColumn type="selection" width="48" reserve-selection />
        <ElTableColumn label="账号名称" min-width="200">
          <template #default="{ row }">
            <div class="name-cell">
              <strong>{{ row.nickname || row.handle }}</strong>
              <span class="muted">{{ row.handle }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="所属项目" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="project-cell" :class="{ 'is-empty': !row.projectId }">
              {{ row.projectId ? projectName(row.projectId) : '未归属' }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="平台" width="100">
          <template #default>
            <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="videos" label="已发布视频" width="120" align="right" sortable="custom">
          <template #default="{ row }">{{ videoCount(row) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="followers" label="粉丝" width="110" align="right" sortable="custom">
          <template #default="{ row }">
            {{ row.followers != null ? row.followers.toLocaleString() : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="主页链接" width="120">
          <template #default="{ row }">
            <a
              v-if="homeLink(row)"
              :href="homeLink(row)"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              打开主页
            </a>
            <span v-else class="muted">—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click.stop="goDetail(row)">查看详情 →</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-else class="account-grid">
        <article
          v-for="row in displayAccounts"
          :key="row.handle"
          class="acc-card"
          :class="{ 'is-selected': isSelected(row) }"
          @click="goDetail(row)"
        >
          <div class="acc-card__top">
            <ElCheckbox
              :model-value="isSelected(row)"
              @click.stop
              @update:model-value="(v) => toggleCardSelect(row, Boolean(v))"
            />
            <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          </div>
          <h3>{{ row.nickname || row.handle }}</h3>
          <p class="acc-card__handle">{{ row.handle }}</p>
          <p class="acc-card__project" :class="{ 'is-empty': !row.projectId }">
            {{ row.projectId ? projectName(row.projectId) : '未归属项目' }}
          </p>
          <dl class="acc-card__kv">
            <div>
              <dt>粉丝数</dt>
              <dd>{{ row.followers != null ? row.followers.toLocaleString() : '—' }}</dd>
            </div>
            <div>
              <dt>已发布视频</dt>
              <dd>{{ videoCount(row) }}</dd>
            </div>
          </dl>
          <footer class="acc-card__foot">
            <a
              v-if="homeLink(row)"
              :href="homeLink(row)"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              打开主页
            </a>
            <span v-else class="muted">无主页</span>
            <ElButton link type="primary" @click.stop="goDetail(row)">查看详情 →</ElButton>
          </footer>
        </article>
        <p v-if="!displayAccounts.length" class="empty">暂无账号，请批量导入或添加</p>
      </div>
    </section>

    <ElDialog v-model="createVisible" title="添加账号" width="480px" align-center destroy-on-close>
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <ElFormItem label="账号" prop="handle">
          <ElInput v-model="form.handle" placeholder="@handle 或 tiktok.com/@xxx" />
        </ElFormItem>
        <ElFormItem label="所属项目">
          <ElSelect
            v-model="form.projectId"
            clearable
            filterable
            placeholder="选择所属项目"
            style="width: 100%"
          >
            <ElOption
              v-for="p in dojoProjectStore.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="主页链接">
          <ElInput v-model="form.link" placeholder="可留空，自动生成" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="createVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitCreate">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="importVisible"
      title="批量导入账号"
      width="720px"
      align-center
      destroy-on-close
      @closed="resetImport"
    >
      <p class="import-tip">
        拖入文档或粘贴账号，识别后归入指定项目。入库后可同步拉取作品与指标。
      </p>
      <div class="import-project">
        <span class="import-project__label">所属项目</span>
        <ElSelect
          v-model="importProjectId"
          filterable
          placeholder="必选：导入到哪个项目"
          style="width: 100%"
        >
          <ElOption
            v-for="p in dojoProjectStore.projects"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </ElSelect>
      </div>
      <div class="import-grid">
        <ElUpload
          class="dropzone"
          drag
          multiple
          :auto-upload="false"
          :show-file-list="false"
          :on-change="onFilePicked"
        >
          <div class="dropzone__inner">
            <div>把文档拖进来</div>
            <div class="muted">xlsx / xls / csv / txt / json / docx</div>
          </div>
        </ElUpload>
        <div>
          <ElInput
            v-model="pasteText"
            type="textarea"
            :rows="6"
            placeholder="粘贴账号，例如：&#10;@sunnyjadediary&#10;https://www.tiktok.com/@elliottlan3"
          />
          <div class="import-actions">
            <ElButton :disabled="!pasteText.trim()" @click="extractFromPaste">识别粘贴</ElButton>
          </div>
        </div>
      </div>

      <div v-if="candidates.length" class="import-confirm">
        <div class="filters">
          <ElCheckbox v-model="importAutoSync">入库后同步账号（拉作品）</ElCheckbox>
          <ElButton
            type="primary"
            :disabled="!canCommitImport"
            :loading="importing"
            @click="commitImport"
          >
            确认入库（{{ selectedCandidates.length }}）
          </ElButton>
        </div>
        <p class="subhead">账号候选（{{ selectedCandidates.length }}/{{ candidates.length }}）</p>
        <ElTable
          ref="candidateTableRef"
          :data="candidates"
          size="small"
          stripe
          max-height="280"
          @selection-change="onCandidateSelect"
        >
          <ElTableColumn type="selection" width="46" />
          <ElTableColumn prop="handle" label="账号" min-width="160" />
          <ElTableColumn label="可信度" width="100">
            <template #default="{ row }">
              <ElTag size="small" :type="row.confidence === 'high' ? 'success' : 'warning'">
                {{ row.confidence === 'high' ? '链接' : '提及' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="hits" label="出现" width="70" />
        </ElTable>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    ElMessage,
    ElMessageBox,
    type FormInstance,
    type FormRules,
    type TableInstance,
    type UploadFile
  } from 'element-plus'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import {
    accountVideos,
    dojoAccountStore,
    importAccounts,
    removeAccount,
    syncAccounts,
    upsertAccount,
    type MatrixAccount
  } from '@/store/dojoAccountStore'
  import { dojoProjectStore, getProjectById } from '@/store/dojoProjectStore'
  import {
    extractBareHandlesFromText,
    extractAccountsFromFiles,
    extractHandlesFromText,
    type AccountCandidate
  } from '@/utils/dojoAccountExtract'
  import { exportCsv } from '@/utils/dojoExport'
  import { stripHandle } from '@/api/tiktok'
  import {
    dojoAccountAutoSyncStore,
    recordFullAccountSyncCompleted,
    setAccountAutoSyncInterval
  } from '@/store/dojoAccountAutoSync'

  defineOptions({ name: 'DojoAccountReview' })

  const HOUR = 3600 * 1000
  const DAY = 24 * HOUR
  const autoRefreshOptions = [
    { label: '关闭', value: 0 },
    { label: '1 小时', value: HOUR },
    { label: '6 小时', value: 6 * HOUR },
    { label: '12 小时', value: 12 * HOUR },
    { label: '1 天', value: DAY },
    { label: '3 天', value: 3 * DAY },
    { label: '1 周', value: 7 * DAY }
  ] as const

  const router = useRouter()
  const viewMode = ref<'list' | 'card'>('list')
  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const keyword = ref('')
  const sortKey = ref<'' | 'followers' | 'videos'>('')
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const syncingAll = ref(false)
  const syncingSelected = ref(false)
  const autoRefreshMs = computed({
    get: () => dojoAccountAutoSyncStore.intervalMs,
    set: (value: number) => setAccountAutoSyncInterval(value)
  })
  const autoLastRunAt = computed(() => dojoAccountAutoSyncStore.lastRunAt)
  let autoTickTimer: ReturnType<typeof setInterval> | null = null
  const nowTick = ref(Date.now())
  const tableRef = ref<TableInstance>()
  const selectedAccounts = ref<MatrixAccount[]>([])
  const batchProjectId = ref('')

  const createVisible = ref(false)
  const formRef = ref<FormInstance>()
  const form = ref({
    handle: '',
    projectId: '',
    link: ''
  })
  const formRules: FormRules = {
    handle: [{ required: true, message: '请填写账号', trigger: 'blur' }]
  }

  const importVisible = ref(false)
  const pasteText = ref('')
  const candidates = ref<AccountCandidate[]>([])
  const selectedCandidates = ref<AccountCandidate[]>([])
  const candidateTableRef = ref<TableInstance>()
  const importProjectId = ref('')
  const importAutoSync = ref(true)
  const importing = ref(false)

  const canCommitImport = computed(
    () => Boolean(importProjectId.value) && selectedCandidates.value.length > 0
  )

  watch(selectedProjectIds, (ids) => {
    dojoProjectStore.selectedIds = [...ids]
  })

  watch(importVisible, (open) => {
    if (open && !importProjectId.value) {
      importProjectId.value =
        selectedProjectIds.value[0] ||
        dojoProjectStore.projects.find((project) => project.active !== false)?.id ||
        ''
    }
  })

  const projectAccounts = computed(() => {
    void dojoAccountStore.revision
    const ids = selectedProjectIds.value
    const activeProjectIds = new Set(
      dojoProjectStore.projects
        .filter((project) => project.active !== false)
        .map((project) => project.id)
    )
    return dojoAccountStore.accounts.filter((a) => {
      if (a.projectId && !activeProjectIds.has(a.projectId)) return false
      if (!ids.length) return true
      return a.projectId ? ids.includes(a.projectId) : false
    })
  })

  const filteredAccounts = computed(() => {
    const q = keyword.value.trim().toLowerCase()
    return projectAccounts.value.filter((a) => {
      if (!q) return true
      const project = a.projectId ? projectName(a.projectId).toLowerCase() : ''
      return (
        a.handle.toLowerCase().includes(q) ||
        (a.nickname || '').toLowerCase().includes(q) ||
        project.includes(q)
      )
    })
  })

  const displayAccounts = computed(() => {
    const list = [...filteredAccounts.value]
    if (!sortKey.value) return list
    const dir = sortOrder.value === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va =
        sortKey.value === 'followers' ? (a.followers == null ? -1 : a.followers) : videoCount(a)
      const vb =
        sortKey.value === 'followers' ? (b.followers == null ? -1 : b.followers) : videoCount(b)
      if (va === vb) return a.handle.localeCompare(b.handle)
      return (va - vb) * dir
    })
    return list
  })

  const tableDefaultSort = computed(() => {
    if (!sortKey.value) return undefined
    return {
      prop: sortKey.value,
      order: (sortOrder.value === 'asc' ? 'ascending' : 'descending') as 'ascending' | 'descending'
    }
  })

  function onTableSort(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
    if (!payload.order || (payload.prop !== 'followers' && payload.prop !== 'videos')) {
      sortKey.value = ''
      return
    }
    sortKey.value = payload.prop
    sortOrder.value = payload.order === 'ascending' ? 'asc' : 'desc'
  }

  const totalFans = computed(() =>
    filteredAccounts.value.reduce((s, a) => s + (a.followers || 0), 0)
  )

  const syncHint = computed(() => {
    void nowTick.value
    const synced = filteredAccounts.value.filter((a) => a.lastSyncedAt)
    const latest = synced
      .map((a) => a.lastSyncedAt!)
      .sort()
      .at(-1)
    const parts: string[] = []
    if (latest) parts.push(`上次更新：${new Date(latest).toLocaleString()}`)
    else parts.push('尚未同步过账号')
    if (autoRefreshMs.value > 0) {
      const base = autoLastRunAt.value ? new Date(autoLastRunAt.value).getTime() : 0
      const nextAt = base ? base + autoRefreshMs.value : Date.now()
      if (nextAt > Date.now()) {
        parts.push(`下次自动：${new Date(nextAt).toLocaleString()}`)
      } else {
        parts.push('下次自动：即将执行')
      }
    }
    if (dojoAccountAutoSyncStore.running) parts.push('后台正在检查新发布视频')
    if (dojoAccountAutoSyncStore.lastNewVideoCount > 0) {
      parts.push(`最近新增视频：${dojoAccountAutoSyncStore.lastNewVideoCount} 条`)
    }
    return parts.join(' · ')
  })

  function onAutoRefreshChange() {
    if (autoRefreshMs.value > 0) {
      const label =
        autoRefreshOptions.find((o) => o.value === autoRefreshMs.value)?.label || '已开启'
      ElMessage.success(`已开启自动刷新：每 ${label}`)
    } else {
      ElMessage.info('已关闭自动刷新')
    }
  }

  onMounted(() => {
    autoTickTimer = setInterval(() => {
      nowTick.value = Date.now()
    }, 30_000)
  })

  onUnmounted(() => {
    if (autoTickTimer) {
      clearInterval(autoTickTimer)
      autoTickTimer = null
    }
  })

  function projectName(id: string) {
    return getProjectById(id)?.name || id
  }

  function videoCount(row: MatrixAccount) {
    const cached = accountVideos(row.handle).length
    return cached || row.totalVideos || 0
  }

  function homeLink(row: MatrixAccount) {
    if (row.link) return row.link
    if (row.handle) return `https://www.tiktok.com/@${stripHandle(row.handle)}`
    return ''
  }

  function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  function detailPath(row: MatrixAccount) {
    return `/account-detail/${encodeURIComponent(stripHandle(row.handle))}`
  }

  function goDetail(row: MatrixAccount) {
    router.push(detailPath(row))
  }

  function onTableSelectionChange(rows: MatrixAccount[]) {
    selectedAccounts.value = rows
  }

  function isSelected(row: MatrixAccount) {
    const key = row.handle.toLowerCase()
    return selectedAccounts.value.some((a) => a.handle.toLowerCase() === key)
  }

  function toggleCardSelect(row: MatrixAccount, on: boolean) {
    const key = row.handle.toLowerCase()
    if (on) {
      if (!isSelected(row)) selectedAccounts.value = [...selectedAccounts.value, row]
      return
    }
    selectedAccounts.value = selectedAccounts.value.filter((a) => a.handle.toLowerCase() !== key)
  }

  function clearSelection() {
    selectedAccounts.value = []
    batchProjectId.value = ''
    tableRef.value?.clearSelection()
  }

  watch(displayAccounts, () => {
    const alive = new Set(displayAccounts.value.map((a) => a.handle.toLowerCase()))
    const next = selectedAccounts.value.filter((a) => alive.has(a.handle.toLowerCase()))
    if (next.length !== selectedAccounts.value.length) selectedAccounts.value = next
  })

  watch(viewMode, () => {
    clearSelection()
  })

  function exportRows(list: MatrixAccount[], label: string) {
    const rows = list.map((a) => [
      a.nickname || '',
      a.handle,
      'TikTok',
      a.projectId ? projectName(a.projectId) : '',
      a.followers ?? '',
      videoCount(a),
      homeLink(a),
      a.lastSyncedAt || ''
    ])
    exportCsv(
      `${label}_${new Date().toISOString().slice(0, 10)}`,
      ['昵称', '账号', '平台', '所属项目', '粉丝', '已发布视频', '主页链接', '上次同步'],
      rows
    )
    ElMessage.success(`已导出 ${rows.length} 条账号信息`)
  }

  function exportAccountInfo() {
    exportRows(filteredAccounts.value, '账号信息')
  }

  function exportSelectedAccounts() {
    if (!selectedAccounts.value.length) {
      ElMessage.info('请先勾选账号')
      return
    }
    exportRows(selectedAccounts.value, '账号信息_选中')
  }

  function exportVideoContent() {
    const source = selectedAccounts.value.length ? selectedAccounts.value : filteredAccounts.value
    const rows: Array<Array<string | number>> = []
    source.forEach((a) => {
      accountVideos(a.handle).forEach((v) => {
        rows.push([
          a.handle,
          a.nickname || '',
          a.projectId ? projectName(a.projectId) : '',
          v.publishDate,
          v.description,
          v.views,
          v.likes,
          v.comments,
          v.shares,
          v.videoUrl
        ])
      })
    })
    if (!rows.length) {
      ElMessage.warning(
        selectedAccounts.value.length
          ? '选中账号暂无已同步视频，请先刷新'
          : '当前筛选下暂无已同步视频，请先刷新账号'
      )
      return
    }
    exportCsv(
      `账号发布视频_${new Date().toISOString().slice(0, 10)}`,
      ['账号', '昵称', '所属项目', '发布日期', '内容', '播放量', '点赞', '评论', '转发', '链接'],
      rows
    )
    ElMessage.success(`已导出 ${rows.length} 条视频`)
  }

  async function syncSelected() {
    const handles = selectedAccounts.value.map((a) => a.handle)
    if (!handles.length) {
      ElMessage.info('请先勾选账号')
      return
    }
    syncingSelected.value = true
    try {
      await syncAccounts(handles)
      ElMessage.success(`已刷新 ${handles.length} 个选中账号`)
    } finally {
      syncingSelected.value = false
    }
  }

  function assignSelectedProject(projectId: string | null) {
    if (!projectId || !selectedAccounts.value.length) return
    const nextId = projectId === '__none__' ? '' : projectId
    selectedAccounts.value.forEach((a) => {
      upsertAccount({ handle: a.handle, projectId: nextId })
    })
    const label = nextId ? projectName(nextId) : '未归属'
    ElMessage.success(`已将 ${selectedAccounts.value.length} 个账号归属到「${label}」`)
    batchProjectId.value = ''
  }

  async function removeSelected() {
    const list = [...selectedAccounts.value]
    if (!list.length) {
      ElMessage.info('请先勾选账号')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确认删除选中的 ${list.length} 个账号？相关视频与周环比快照也会一并清除。`,
        '批量删除',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        }
      )
    } catch {
      return
    }
    list.forEach((a) => removeAccount(a.handle))
    clearSelection()
    ElMessage.success(`已删除 ${list.length} 个账号`)
  }

  async function syncAll() {
    const handles = dojoAccountStore.accounts
      .filter((account) => account.status === 'active')
      .map((account) => account.handle)
    if (!handles.length) {
      ElMessage.info('没有可同步的账号')
      return
    }
    syncingAll.value = true
    try {
      await syncAccounts(handles)
      recordFullAccountSyncCompleted()
      const mockCount = dojoAccountStore.accounts.filter(
        (account) => handles.includes(account.handle) && account.syncSource === 'mock'
      ).length
      if (mockCount) {
        ElMessage.warning(
          `已刷新 ${handles.length} 个账号，其中 ${mockCount} 个未拿到真实粉丝（请检查 RapidAPI）`
        )
      } else {
        ElMessage.success(`已刷新 ${handles.length} 个账号的真实粉丝数据`)
      }
    } finally {
      syncingAll.value = false
    }
  }

  function openCreate() {
    form.value = {
      handle: '',
      projectId: selectedProjectIds.value[0] || '',
      link: ''
    }
    createVisible.value = true
  }

  async function submitCreate() {
    await formRef.value?.validate().catch(() => Promise.reject())
    const handle = form.value.handle.trim()
    const link = form.value.link.trim() || `https://www.tiktok.com/@${stripHandle(handle)}`
    upsertAccount({
      handle,
      projectId: form.value.projectId,
      link,
      source: 'manual',
      status: 'active'
    })
    createVisible.value = false
    await nextTick()
    ElMessage.success('已添加账号，正在后台同步资料与发布视频')
    syncNewAccountsInBackground([handle])
  }

  function syncNewAccountsInBackground(handles: string[]) {
    if (!handles.length) return
    syncingAll.value = true
    void syncAccounts(handles)
      .then(() => {
        const videoTotal = handles.reduce(
          (total, handle) => total + accountVideos(handle).length,
          0
        )
        ElMessage.success(
          `同步完成：${handles.length} 个账号 · ${videoTotal} 条发布视频已进入视频监控`
        )
      })
      .finally(() => {
        syncingAll.value = false
      })
  }

  function resetImport() {
    pasteText.value = ''
    candidates.value = []
    selectedCandidates.value = []
    importAutoSync.value = true
    importing.value = false
  }

  async function onFilePicked(file: UploadFile) {
    if (!file.raw) return
    const result = await extractAccountsFromFiles([file.raw])
    mergeCandidates(result.candidates)
    if (!result.candidates.length) ElMessage.warning('未识别到账号')
    else ElMessage.success(`识别到 ${result.candidates.length} 个账号`)
  }

  function extractFromPaste() {
    const list = [
      ...extractHandlesFromText(pasteText.value),
      ...extractBareHandlesFromText(pasteText.value)
    ]
    mergeCandidates(list)
    if (!list.length) ElMessage.warning('未识别到账号')
    else ElMessage.success(`识别到 ${list.length} 个账号`)
  }

  function mergeCandidates(list: AccountCandidate[]) {
    const map = new Map<string, AccountCandidate>()
    candidates.value.forEach((candidate) => {
      const clean = stripHandle(candidate.handle || candidate.link)
      if (!/^[A-Za-z0-9._]{2,24}$/.test(clean)) return
      map.set(`@${clean.toLowerCase()}`, {
        ...candidate,
        handle: `@${clean}`,
        link: `https://www.tiktok.com/@${clean}`
      })
    })
    list.forEach((c) => {
      const clean = stripHandle(c.handle || c.link)
      if (!/^[A-Za-z0-9._]{2,24}$/.test(clean)) return
      const key = `@${clean.toLowerCase()}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          ...c,
          handle: `@${clean}`,
          link: `https://www.tiktok.com/@${clean}`
        })
      }
      else {
        existing.hits += c.hits
        if (c.confidence === 'high' && existing.confidence === 'low') {
          existing.confidence = 'high'
          existing.link = c.link
        }
      }
    })
    candidates.value = [...map.values()]
    selectedCandidates.value = [...candidates.value]
    nextTick(() => {
      candidates.value.forEach((row) => {
        candidateTableRef.value?.toggleRowSelection(row, true)
      })
    })
  }

  function onCandidateSelect(rows: AccountCandidate[]) {
    selectedCandidates.value = rows
  }

  async function commitImport() {
    if (!importProjectId.value) {
      ElMessage.warning('请先选择所属项目')
      return
    }
    if (!selectedCandidates.value.length) {
      ElMessage.warning('请先勾选要入库的账号')
      return
    }
    importing.value = true
    try {
      const projectId = importProjectId.value
      const payload = selectedCandidates.value.map((c) => ({
        handle: c.handle,
        link: c.link || `https://www.tiktok.com/${c.handle}`,
        projectId,
        source: 'excel' as const,
        status: 'active' as const
      }))
      const { added, updated } = importAccounts(payload)
      const handles = selectedCandidates.value.map((c) => c.handle)
      selectedProjectIds.value = []
      keyword.value = ''
      importVisible.value = false
      await nextTick()
      ElMessage.success(
        `已归入「${projectName(projectId)}」：新增 ${added} · 更新 ${updated} · 账号池共 ${dojoAccountStore.accounts.length}`
      )

      if (importAutoSync.value && handles.length) {
        syncNewAccountsInBackground(handles)
      }
    } finally {
      importing.value = false
    }
  }
</script>

<style scoped lang="scss">
  @use '../dojo-page.scss';

  .stat-row--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 480px;
  }

  .accent {
    color: var(--el-color-primary);
  }

  .pool-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    padding: 10px 14px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 10px;
    background: var(--el-color-primary-light-9);

    &__title {
      display: flex;
      gap: 8px;
      align-items: center;
      font-weight: 600;
    }

    &__ops {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
  }

  .auto-refresh {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }

  .batch-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin: -4px 0 14px;
    padding: 10px 12px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 10px;
    background: var(--el-color-primary-light-9);
    font-size: 13px;

    strong {
      font-variant-numeric: tabular-nums;
      color: var(--el-color-primary);
    }
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .name-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.3;

    strong {
      font-weight: 600;
    }
  }

  .project-cell {
    font-weight: 600;

    &.is-empty {
      font-weight: 400;
      color: var(--el-text-color-placeholder);
    }
  }

  .account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .acc-card {
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 4px 16px rgb(0 0 0 / 4%);
    }

    &.is-selected {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
    }

    &__top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
    }

    &__handle {
      margin: 4px 0 6px;
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }

    &__project {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-color-primary);

      &.is-empty {
        font-weight: 400;
        color: var(--el-text-color-placeholder);
      }
    }

    &__kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 0 0 12px;

      dt {
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }

      dd {
        margin: 2px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    &__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid var(--el-border-color-extra-light);
      font-size: 13px;
    }
  }

  .empty {
    grid-column: 1 / -1;
    margin: 24px 0;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  .import-tip {
    margin: 0 0 12px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .import-project {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;

    &__label {
      flex: none;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-regular);
    }
  }

  .subhead {
    margin: 12px 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-regular);
  }

  .import-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  }

  .dropzone {
    width: 100%;

    :deep(.el-upload-dragger) {
      width: 100%;
      padding: 28px 16px;
    }
  }

  .dropzone__inner {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .import-actions {
    margin-top: 8px;
  }

  .import-confirm {
    margin-top: 8px;
  }
</style>
