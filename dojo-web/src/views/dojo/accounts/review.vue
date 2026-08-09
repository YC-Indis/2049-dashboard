<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>总账号预览</h1>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
        <ElButton type="primary" plain @click="openCreate">添加账号</ElButton>
        <ElButton @click="exportRows">导出</ElButton>
        <ElButton type="primary" :loading="syncingAll" @click="syncAll">同步</ElButton>
      </div>
    </header>

    <template>
    <div class="stat-row">
      <div class="stat">
        <span class="stat__n">{{ projectRows.length }}</span>
        <span class="stat__l">矩阵账号</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ counts.pending }}</span>
        <span class="stat__l">待检阅</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ counts.passed }}</span>
        <span class="stat__l">已通过</span>
      </div>
      <div class="stat">
        <span class="stat__n danger">{{ counts.abnormal }}</span>
        <span class="stat__l">异常</span>
      </div>
    </div>

    <section class="panel">
      <div class="filters">
        <ElRadioGroup v-model="filter" size="small">
          <ElRadioButton value="all">全部</ElRadioButton>
          <ElRadioButton value="待检阅">待检阅</ElRadioButton>
          <ElRadioButton value="通过">已通过</ElRadioButton>
          <ElRadioButton value="异常">异常</ElRadioButton>
        </ElRadioGroup>
        <ElSelect v-model="sortBy" size="small" style="width: 140px">
          <ElOption label="按粉丝量" value="followers" />
          <ElOption label="按累计播放" value="totalViews" />
          <ElOption label="按互动率" value="avgEngagement" />
          <ElOption label="按最近分发" value="lastPost" />
        </ElSelect>
        <span class="muted">共 {{ sortedFiltered.length }} 个账号 · 仅同步当前项目</span>
      </div>

      <ElTable :data="sortedFiltered" stripe>
        <ElTableColumn prop="handle" label="账号" min-width="170" />
        <ElTableColumn prop="segment" label="内容细分" width="130" show-overflow-tooltip />
        <ElTableColumn label="粉丝量" width="130" align="right">
          <template #default="{ row }">
            <span v-if="row.followers">{{ row.followers.toLocaleString() }}</span>
            <span v-else class="muted">未同步</span>
            <ElTag v-if="row.syncSource" size="small" :type="row.syncSource === 'rapidapi' ? 'success' : 'info'">
              {{ row.syncSource === 'rapidapi' ? 'API' : 'mock' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="postCount" label="发布数" width="85" align="right">
          <template #default="{ row }">{{ row.postCount ?? '—' }}</template>
        </ElTableColumn>
        <ElTableColumn label="累计播放" width="110" align="right">
          <template #default="{ row }">
            {{ row.totalViews != null ? row.totalViews.toLocaleString() : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="均互动率" width="100" align="right">
          <template #default="{ row }">
            <span :class="{ warn: row.avgEngagement != null && row.avgEngagement < 0.01 }">
              {{ row.avgEngagement != null ? `${(row.avgEngagement * 100).toFixed(2)}%` : '—' }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="lastPost" label="最近分发" width="110" />
        <ElTableColumn label="检阅" width="95">
          <template #default="{ row }">
            <ElTag :type="reviewType(row.review)" size="small">{{ row.review }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" :loading="row._syncing" @click="syncOne(row)">同步</ElButton>
            <ElButton v-if="row.review !== '通过'" link type="success" @click="pass(row)">通过</ElButton>
            <ElButton v-if="row.review !== '异常'" link type="danger" @click="flag(row)">异常</ElButton>
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link type="danger" @click="removeRow(row)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '添加账号' : '编辑账号'"
      width="480px"
      align-center
      destroy-on-close
      @closed="resetForm"
    >
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <ElFormItem label="账号" prop="handle">
          <ElInput v-model="form.handle" placeholder="@handle 或 tiktok.com/@xxx" />
        </ElFormItem>
        <ElFormItem label="内容细分" prop="segment">
          <ElInput v-model="form.segment" placeholder="如 解压 / 投放批次名" />
        </ElFormItem>
        <ElFormItem label="发布数">
          <ElInputNumber v-model="form.postCount" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="累计播放">
          <ElInputNumber v-model="form.totalViews" :min="0" :controls="false" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="互动率">
          <ElInputNumber
            v-model="form.avgEngagement"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="4"
            :controls="false"
            style="width: 100%"
            placeholder="0–1 小数"
          />
        </ElFormItem>
        <ElFormItem label="最近分发">
          <ElInput v-model="form.lastPost" placeholder="如 2026-03-15" />
        </ElFormItem>
        <ElFormItem label="检阅状态">
          <ElSelect v-model="form.review" style="width: 100%">
            <ElOption label="待检阅" value="待检阅" />
            <ElOption label="通过" value="通过" />
            <ElOption label="异常" value="异常" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { syncTikTokAccount } from '@/api/tiktok'
  import { accountMonitor, accountPlans } from '@/mock/dojo/imported'
  import { adAccounts } from '@/mock/dojo/imported/ads'
  import { historyImport } from '@/mock/dojo/imported/historyImport'
  import {
    isAccountRecentlySynced,
    markAccountsSynced,
    normalizeHandle
  } from '@/store/dojoSyncStore'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { dojoProjectStore, matchesAnyProject } from '@/store/dojoProjectStore'
  import { exportCsv } from '@/utils/dojoExport'

  defineOptions({ name: 'DojoAccountReview' })

  type ReviewStatus = '待检阅' | '通过' | '异常'

  type Row = {
    id: string
    handle: string
    segment: string
    followers: number
    postCount?: number
    totalViews?: number
    avgEngagement?: number | null
    lastPost: string
    review: ReviewStatus
    syncedAt?: string
    syncSource?: 'mock' | 'rapidapi'
    _syncing?: boolean
  }

  type DialogMode = 'create' | 'edit'

  const selectedProjectIds = ref<string[]>([...dojoProjectStore.selectedIds])
  const projects = computed(() => dojoProjectStore.projects.filter((p) => p.active !== false))

  const filter = ref<'all' | ReviewStatus>('all')
  const sortBy = ref<'followers' | 'totalViews' | 'avgEngagement' | 'lastPost'>('followers')
  const syncingAll = ref(false)
  const dialogVisible = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const editingId = ref<string | null>(null)
  const formRef = ref<FormInstance>()

  function handleOf(raw: string) {
    return normalizeHandle(raw) || raw.trim()
  }

  function adHandle(a: (typeof adAccounts)[0]) {
    if (a.accountUrl) {
      const h = handleOf(a.accountUrl)
      if (h.startsWith('@')) return h
    }
    return a.device ? `@${a.device}` : ''
  }

  function mergeRow(existing: Row, patch: Partial<Row>): Row {
    return {
      ...existing,
      ...patch,
      segment: patch.segment || existing.segment,
      postCount: patch.postCount ?? existing.postCount,
      totalViews: patch.totalViews ?? existing.totalViews,
      avgEngagement: patch.avgEngagement ?? existing.avgEngagement,
      lastPost: patch.lastPost && patch.lastPost !== '—' ? patch.lastPost : existing.lastPost
    }
  }

  function build(): Row[] {
    const map = new Map<string, Row>()
    for (const p of accountPlans) {
      for (const a of p.accounts) {
        const handle = handleOf(a.link || a.name)
        if (!handle) continue
        const mon = accountMonitor.find((m) => handleOf(m.account) === handle)
        const row: Row = {
          id: handle,
          handle,
          segment: p.segment,
          followers: 0,
          postCount: mon?.postCount,
          totalViews: mon ? mon.totalPaidViews + mon.totalNaturalViews : undefined,
          avgEngagement: mon?.avgEngagementRate,
          lastPost: mon?.lastPublish || '—',
          review: mon ? '通过' : '待检阅'
        }
        map.set(handle, map.has(handle) ? mergeRow(map.get(handle)!, row) : row)
      }
    }
    for (const m of accountMonitor) {
      const handle = handleOf(m.account)
      if (!handle) continue
      const row: Row = {
        id: handle,
        handle,
        segment: '未归类',
        followers: 0,
        postCount: m.postCount,
        totalViews: m.totalPaidViews + m.totalNaturalViews,
        avgEngagement: m.avgEngagementRate,
        lastPost: m.lastPublish || '—',
        review: '通过'
      }
      map.set(handle, map.has(handle) ? mergeRow(map.get(handle)!, row) : row)
    }
    for (const a of adAccounts) {
      const handle = adHandle(a)
      if (!handle) continue
      const patch: Partial<Row> = {
        postCount: a.videoCount,
        totalViews: a.totalViews || a.totalNaturalViews || undefined,
        lastPost: a.lastDate || '—'
      }
      if (map.has(handle)) {
        const existing = map.get(handle)!
        map.set(
          handle,
          mergeRow(existing, {
            ...patch,
            segment: existing.segment === '未归类' ? a.batches.join('、') || '投放' : existing.segment
          })
        )
        continue
      }
      map.set(handle, {
        id: handle,
        handle,
        segment: a.batches.join('、') || '投放',
        followers: 0,
        postCount: a.videoCount,
        totalViews: a.totalViews || a.totalNaturalViews || undefined,
        avgEngagement: null,
        lastPost: a.lastDate || '—',
        review: '待检阅'
      })
    }
    // docs/source/history 账号粉丝量 CSV
    const postStats = new Map<string, { count: number; views: number; last: string }>()
    for (const p of historyImport.posts) {
      const handle = handleOf(p.account) || handleOf(p.videoUrl)
      if (!handle) continue
      if (/tesla|cybertruck|batterysee|#battery/i.test(`${handle} ${p.title ?? ''}`)) continue
      const cur = postStats.get(handle) || { count: 0, views: 0, last: '' }
      cur.count += 1
      cur.views += p.views || 0
      if (p.publishDate && p.publishDate > cur.last) cur.last = p.publishDate
      postStats.set(handle, cur)
    }
    for (const a of historyImport.accounts) {
      const handle = a.handle.startsWith('@') ? a.handle : handleOf(a.link)
      if (!handle) continue
      if (/tesla|cybertruck|batterysee/i.test(`${handle} ${a.device ?? ''}`)) continue
      const stats = postStats.get(handle)
      const patch: Partial<Row> = {
        followers: a.followers,
        postCount: stats?.count,
        totalViews: stats?.views,
        lastPost: stats?.last || a.snapshotDate || '—',
        segment: a.device || '历史导入'
      }
      if (map.has(handle)) {
        map.set(handle, mergeRow(map.get(handle)!, patch))
        continue
      }
      map.set(handle, {
        id: handle,
        handle,
        segment: a.device || '历史导入',
        followers: a.followers,
        postCount: stats?.count,
        totalViews: stats?.views,
        avgEngagement: null,
        lastPost: stats?.last || a.snapshotDate || '—',
        review: '待检阅'
      })
    }
    return [...map.values()]
  }

  const rows = ref<Row[]>(build())

  const emptyForm = () => ({
    handle: '',
    segment: '',
    postCount: null as number | null,
    totalViews: null as number | null,
    avgEngagement: null as number | null,
    lastPost: '',
    review: '待检阅' as ReviewStatus
  })

  const form = reactive(emptyForm())

  const formRules: FormRules = {
    handle: [{ required: true, message: '请填写账号', trigger: 'blur' }],
    segment: [{ required: true, message: '请填写内容细分', trigger: 'blur' }]
  }

  const projectRows = computed(() =>
    rows.value.filter((r) => matchesAnyProject(`${r.segment} ${r.handle}`, selectedProjectIds.value))
  )

  const counts = computed(() => ({
    pending: projectRows.value.filter((r) => r.review === '待检阅').length,
    passed: projectRows.value.filter((r) => r.review === '通过').length,
    abnormal: projectRows.value.filter((r) => r.review === '异常').length
  }))

  const filtered = computed(() =>
    filter.value === 'all'
      ? projectRows.value
      : projectRows.value.filter((r) => r.review === filter.value)
  )

  function lastPostSortKey(v: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const n = Number(v)
    if (!Number.isNaN(n) && n > 40000) {
      const d = new Date(Date.UTC(1899, 11, 30 + n))
      return d.toISOString().slice(0, 10)
    }
    return v
  }

  const sortedFiltered = computed(() => {
    const list = [...filtered.value]
    list.sort((a, b) => {
      if (sortBy.value === 'followers') return (b.followers ?? -1) - (a.followers ?? -1)
      if (sortBy.value === 'totalViews') return (b.totalViews ?? -1) - (a.totalViews ?? -1)
      if (sortBy.value === 'avgEngagement') {
        return (b.avgEngagement ?? -1) - (a.avgEngagement ?? -1)
      }
      return lastPostSortKey(b.lastPost).localeCompare(lastPostSortKey(a.lastPost))
    })
    return list
  })

  function reviewType(review: Row['review']) {
    if (review === '通过') return 'success'
    if (review === '异常') return 'danger'
    return 'info'
  }

  async function syncOne(row: Row) {
    row._syncing = true
    try {
      const snap = await syncTikTokAccount(row.handle)
      row.followers = snap.followers
      row.syncedAt = snap.syncedAt
      row.syncSource = snap.source
      markAccountsSynced([row.handle])
      return snap
    } finally {
      row._syncing = false
    }
  }

  async function syncAll() {
    if (!projectRows.value.length) {
      ElMessage.warning('当前项目没有可同步的账号')
      return
    }
    syncingAll.value = true
    let skipped = 0
    let synced = 0
    try {
      for (const row of projectRows.value) {
        if (isAccountRecentlySynced(row.handle)) {
          skipped++
          continue
        }
        await syncOne(row)
        synced++
      }
      ElMessage.success(
        `已选 ${selectedProjectIds.value.length || '全部'} 个项目：跳过 ${skipped} 个近期已同步，实际刷新 ${synced} 个`
      )
    } finally {
      syncingAll.value = false
    }
  }

  function pass(row: Row) {
    row.review = '通过'
    ElMessage.success(`${row.handle} 检阅通过`)
  }

  function flag(row: Row) {
    row.review = '异常'
    ElMessage.error(`${row.handle} 标异常，关联发布任务将阻塞`)
  }

  function openCreate() {
    dialogMode.value = 'create'
    editingId.value = null
    Object.assign(form, emptyForm())
    dialogVisible.value = true
  }

  function openEdit(row: Row) {
    dialogMode.value = 'edit'
    editingId.value = row.id
    form.handle = row.handle
    form.segment = row.segment
    form.postCount = row.postCount ?? null
    form.totalViews = row.totalViews ?? null
    form.avgEngagement = row.avgEngagement ?? null
    form.lastPost = row.lastPost === '—' ? '' : row.lastPost
    form.review = row.review
    dialogVisible.value = true
  }

  function resetForm() {
    Object.assign(form, emptyForm())
    editingId.value = null
  }

  async function submitForm() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    const handle = handleOf(form.handle)
    if (!handle) {
      ElMessage.warning('账号格式无效')
      return
    }

    if (dialogMode.value === 'create' && rows.value.some((r) => r.handle === handle)) {
      ElMessage.warning('该账号已存在')
      return
    }

    const payload: Row = {
      id: dialogMode.value === 'edit' ? editingId.value! : handle,
      handle,
      segment: form.segment.trim(),
      followers: 0,
      postCount: form.postCount ?? undefined,
      totalViews: form.totalViews ?? undefined,
      avgEngagement: form.avgEngagement,
      lastPost: form.lastPost.trim() || '—',
      review: form.review
    }

    if (dialogMode.value === 'edit') {
      const idx = rows.value.findIndex((r) => r.id === editingId.value)
      if (idx >= 0) {
        const prev = rows.value[idx]
        rows.value[idx] = { ...payload, followers: prev.followers, syncedAt: prev.syncedAt, syncSource: prev.syncSource }
      }
      ElMessage.success('已更新账号')
    } else {
      rows.value.push(payload)
      ElMessage.success('已添加账号')
    }
    dialogVisible.value = false
  }

  async function removeRow(row: Row) {
    try {
      await ElMessageBox.confirm(`确定删除 ${row.handle}？`, '删除账号', { type: 'warning' })
      rows.value = rows.value.filter((r) => r.id !== row.id)
      ElMessage.success('已删除')
    } catch {
      /* cancelled */
    }
  }

  function exportRows() {
    exportCsv(
      '总账号预览',
      ['账号', '内容细分', '粉丝量', '发布数', '累计播放', '均互动率', '最近分发', '检阅状态'],
      sortedFiltered.value.map((r) => [
        r.handle,
        r.segment,
        r.followers || '',
        r.postCount ?? '',
        r.totalViews ?? '',
        r.avgEngagement != null ? `${(r.avgEngagement * 100).toFixed(2)}%` : '',
        r.lastPost,
        r.review
      ])
    )
  }
</script>

<style scoped lang="scss" src="../dojo-page.scss"></style>

<style scoped lang="scss">
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    margin-bottom: 14px;
  }

  .gate {
    padding: 48px 24px;
    border: 1px dashed var(--el-border-color);
    border-radius: 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
  }

  .muted {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .stat__n.danger {
    color: var(--el-color-danger);
  }

  .warn {
    color: var(--el-color-danger);
  }
</style>
