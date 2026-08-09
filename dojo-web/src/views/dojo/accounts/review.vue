<template>
  <div class="dojo-page">
    <header class="dojo-page__head">
      <div>
        <h1>总账号预览</h1>
        <p>矩阵账号检阅、粉丝与互动健康诊断</p>
      </div>
      <div class="head-ops">
        <DojoProjectSelect v-model="selectedProjectIds" width="260px" />
        <ElRadioGroup v-model="viewMode" size="small">
          <ElRadioButton value="list">列表</ElRadioButton>
          <ElRadioButton value="card">卡片</ElRadioButton>
        </ElRadioGroup>
        <ElButton type="primary" plain @click="openCreate">添加账号</ElButton>
        <ElButton @click="exportRows">导出</ElButton>
        <ElButton type="primary" :loading="syncingAll" @click="syncAll">同步</ElButton>
      </div>
    </header>

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
        <ElButton link type="primary" class="to-ads" @click="$router.push('/ads')"
          >买量监看</ElButton
        >
      </div>

      <ElTable v-if="viewMode === 'list'" :data="sortedFiltered" stripe @row-click="openDetail">
        <ElTableColumn prop="handle" label="账号" min-width="170" />
        <ElTableColumn label="所属项目" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.projectId">{{ projectName(row.projectId) }}</span>
            <span v-else class="muted">未归属</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="segment" label="内容细分" width="130" show-overflow-tooltip />
        <ElTableColumn label="粉丝量" width="130" align="right">
          <template #default="{ row }">
            <span v-if="row.followers">{{ row.followers.toLocaleString() }}</span>
            <span v-else class="muted">未同步</span>
            <ElTag
              v-if="row.syncSource"
              size="small"
              :type="row.syncSource === 'rapidapi' ? 'success' : 'info'"
            >
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
        <ElTableColumn label="操作" width="310" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click.stop="openDetail(row)">详情</ElButton>
            <ElButton link type="primary" :loading="row._syncing" @click.stop="syncOne(row)"
              >同步</ElButton
            >
            <ElButton v-if="row.review !== '通过'" link type="success" @click.stop="pass(row)"
              >通过</ElButton
            >
            <ElButton v-if="row.review !== '异常'" link type="danger" @click.stop="flag(row)"
              >异常</ElButton
            >
            <ElButton link type="primary" @click.stop="openEdit(row)">编辑</ElButton>
            <ElButton link type="danger" @click.stop="removeRow(row)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div v-else class="account-grid">
        <article
          v-for="row in sortedFiltered"
          :key="row.id"
          class="acc-card"
          @click="openDetail(row)"
        >
          <header class="acc-card__head">
            <strong>{{ row.handle }}</strong>
            <ElTag :type="reviewType(row.review)" size="small">{{ row.review }}</ElTag>
          </header>
          <p class="acc-card__meta">
            {{ row.projectId ? projectName(row.projectId) : '未归属项目' }} · {{ row.segment }}
          </p>
          <dl class="acc-card__kv">
            <div>
              <dt>粉丝</dt>
              <dd>{{ row.followers ? row.followers.toLocaleString() : '未同步' }}</dd>
            </div>
            <div>
              <dt>发布</dt>
              <dd>{{ row.postCount ?? '—' }}</dd>
            </div>
            <div>
              <dt>播放</dt>
              <dd>{{ row.totalViews != null ? row.totalViews.toLocaleString() : '—' }}</dd>
            </div>
            <div>
              <dt>互动率</dt>
              <dd>{{
                row.avgEngagement != null ? `${(row.avgEngagement * 100).toFixed(2)}%` : '—'
              }}</dd>
            </div>
          </dl>
          <footer class="acc-card__foot">最近分发 {{ row.lastPost }}</footer>
        </article>
        <p v-if="!sortedFiltered.length" class="empty">暂无账号</p>
      </div>
    </section>

    <ElDrawer
      v-model="detailVisible"
      :title="detailRow?.handle || '账号详情'"
      size="520px"
      destroy-on-close
    >
      <div v-if="detailRow" class="detail">
        <div class="detail__head">
          <ElTag :type="reviewType(detailRow.review)" size="small">{{ detailRow.review }}</ElTag>
          <span>{{ detailRow.projectId ? projectName(detailRow.projectId) : '未归属项目' }}</span>
          <ElButton link type="primary" :loading="detailRow._syncing" @click="syncOne(detailRow)"
            >刷新指标</ElButton
          >
        </div>

        <ElTabs v-model="detailTab">
          <ElTabPane label="基础表现" name="basic">
            <dl class="detail__kv">
              <div>
                <dt>粉丝数</dt>
                <dd>{{
                  detailRow.followers ? detailRow.followers.toLocaleString() : '尚未更新'
                }}</dd>
              </div>
              <div>
                <dt>匹配帖文</dt>
                <dd>{{ detailRow.postCount ?? '—' }}</dd>
              </div>
              <div>
                <dt>累计播放</dt>
                <dd>{{
                  detailRow.totalViews != null ? detailRow.totalViews.toLocaleString() : '—'
                }}</dd>
              </div>
              <div>
                <dt>均播放/阅读</dt>
                <dd>{{ avgViews(detailRow) }}</dd>
              </div>
            </dl>

            <h4 class="detail__title">健康诊断</h4>
            <ul class="diag">
              <li>
                <span class="diag__label">粉丝水位</span>
                <ElTag size="small" :type="followerHealth(detailRow).type">
                  {{ followerHealth(detailRow).text }}
                </ElTag>
                <span class="diag__tip">{{ followerHealth(detailRow).tip }}</span>
              </li>
              <li>
                <span class="diag__label">互动健康</span>
                <ElTag size="small" :type="engagementHealth(detailRow).type">
                  {{ engagementHealth(detailRow).text }}
                </ElTag>
                <span class="diag__tip">{{ engagementHealth(detailRow).tip }}</span>
              </li>
            </ul>

            <h4 class="detail__title">
              周环比透视
              <small>对比约 7 日前快照</small>
            </h4>
            <dl class="detail__kv">
              <div>
                <dt>本周发布</dt>
                <dd>
                  {{ weekOverWeek(detailRow).thisPosts }}
                  <em :class="deltaClass(weekOverWeek(detailRow).postDelta)">
                    {{ deltaText(weekOverWeek(detailRow).postDelta) }}
                  </em>
                </dd>
              </div>
              <div>
                <dt>本周播放</dt>
                <dd>
                  {{ weekOverWeek(detailRow).thisViews.toLocaleString() }}
                  <em :class="deltaClass(weekOverWeek(detailRow).viewDelta)">
                    {{ deltaText(weekOverWeek(detailRow).viewDelta) }}
                  </em>
                </dd>
              </div>
            </dl>
            <p class="detail__hint">粉丝口径暂无历史快照，开启自动更新后按周累计。</p>
          </ElTabPane>

          <ElTabPane :label="`已发布视频（${detailPosts.length}）`" name="posts">
            <h4 class="detail__title">
              近期发布内容
              <small>来自分发记录 · {{ detailPosts.length }} 条</small>
            </h4>
            <ElTable v-if="detailPosts.length" :data="detailPosts" size="small" stripe>
              <ElTableColumn label="发布日期" width="110">
                <template #default="{ row }">{{ row.publishDate }}</template>
              </ElTableColumn>
              <ElTableColumn label="内容" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <a v-if="row.videoUrl" :href="row.videoUrl" target="_blank" rel="noreferrer">
                    {{ row.note || row.flowType }}
                  </a>
                  <span v-else>{{ row.note || row.flowType }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="播放量" width="100" align="right">
                <template #default="{ row }">
                  {{ ((row.naturalViews || 0) + (row.paidViews || 0)).toLocaleString() }}
                </template>
              </ElTableColumn>
            </ElTable>
            <p v-else class="detail__hint">暂无分发记录</p>
          </ElTabPane>

          <ElTabPane label="数据来源" name="source">
            <dl class="detail__kv detail__kv--wide">
              <div>
                <dt>数据来源</dt>
                <dd>{{
                  detailRow.syncSource === 'rapidapi' ? 'RapidAPI 实时同步' : '本地导入 / mock'
                }}</dd>
              </div>
              <div>
                <dt>上次更新时间</dt>
                <dd>{{
                  detailRow.syncedAt ? new Date(detailRow.syncedAt).toLocaleString() : '尚未更新'
                }}</dd>
              </div>
              <div>
                <dt>内容细分</dt>
                <dd>{{ detailRow.segment }}</dd>
              </div>
              <div>
                <dt>最近分发</dt>
                <dd>{{ detailRow.lastPost }}</dd>
              </div>
            </dl>
          </ElTabPane>
        </ElTabs>
      </div>
    </ElDrawer>

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
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { syncTikTokAccount } from '@/api/tiktok'
  import { accountMonitor, accountPlans } from '@/mock/dojo/imported'
  import { historyImport } from '@/mock/dojo/imported/historyImport'
  import {
    runtimeAdAccounts,
    runtimeDistributions,
    type DistributionRow
  } from '@/store/dojoRuntimeStore'
  import {
    isAccountRecentlySynced,
    markAccountsSynced,
    normalizeHandle
  } from '@/store/dojoSyncStore'
  import DojoProjectSelect from '@/components/dojo/DojoProjectSelect.vue'
  import { dojoProjectStore, getProjectById, matchesAnyProject } from '@/store/dojoProjectStore'
  import { exportCsv } from '@/utils/dojoExport'
  import { DOJO_TODAY, daysBetween } from '@/utils/dojoDates'

  defineOptions({ name: 'DojoAccountReview' })

  type ReviewStatus = '待检阅' | '通过' | '异常'

  type Row = {
    id: string
    handle: string
    projectId?: string
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

  const viewMode = ref<'list' | 'card'>('list')
  const filter = ref<'all' | ReviewStatus>('all')
  const sortBy = ref<'followers' | 'totalViews' | 'avgEngagement' | 'lastPost'>('followers')
  const syncingAll = ref(false)
  const dialogVisible = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const editingId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const detailVisible = ref(false)
  const detailRow = ref<Row | null>(null)
  const detailTab = ref('basic')

  function handleOf(raw: string) {
    return normalizeHandle(raw) || raw.trim()
  }

  function projectName(id: string) {
    return getProjectById(id)?.name || id
  }

  function adHandle(a: (typeof runtimeAdAccounts.value)[number]) {
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
      projectId: patch.projectId || existing.projectId,
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
          projectId: p.projectId || mon?.projectId,
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
        projectId: m.projectId,
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
    for (const a of runtimeAdAccounts.value) {
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
            segment:
              existing.segment === '未归类' ? a.batches.join('、') || '投放' : existing.segment
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
    rows.value.filter((r) => {
      if (!selectedProjectIds.value.length) return true
      if (r.projectId && selectedProjectIds.value.includes(r.projectId)) return true
      return matchesAnyProject(`${r.segment} ${r.handle}`, selectedProjectIds.value)
    })
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
      if (sortBy.value === 'avgEngagement') return (b.avgEngagement ?? -1) - (a.avgEngagement ?? -1)
      return lastPostSortKey(b.lastPost).localeCompare(lastPostSortKey(a.lastPost))
    })
    return list
  })

  function reviewType(review: ReviewStatus) {
    if (review === '通过') return 'success'
    if (review === '异常') return 'danger'
    return 'info'
  }

  function openDetail(row: Row) {
    detailRow.value = row
    detailTab.value = 'basic'
    detailVisible.value = true
  }

  /** 该账号在分发记录里的帖子，按发布日期倒序 */
  const detailPosts = computed<DistributionRow[]>(() => {
    const handle = detailRow.value?.handle
    if (!handle) return []
    return runtimeDistributions.value
      .filter((d) => handleOf(d.account) === handle)
      .slice()
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
  })

  function avgViews(row: Row) {
    if (!row.totalViews || !row.postCount) return '—'
    return Math.round(row.totalViews / row.postCount).toLocaleString()
  }

  function followerHealth(row: Row) {
    if (!row.followers) return { text: '尚未更新', type: 'info' as const, tip: '同步后可诊断' }
    if (row.followers < 1000) return { text: '偏低', type: 'danger' as const, tip: '不足 1000 粉' }
    if (row.followers < 10000)
      return { text: '培育中', type: 'warning' as const, tip: '1000 – 1 万粉' }
    return { text: '健康', type: 'success' as const, tip: '1 万粉以上' }
  }

  function engagementHealth(row: Row) {
    const e = row.avgEngagement
    if (e == null) return { text: '尚未更新', type: 'info' as const, tip: '缺少互动率数据' }
    if (e < 0.01) return { text: '需关注', type: 'danger' as const, tip: '低于 1%' }
    if (e < 0.03) return { text: '正常', type: 'warning' as const, tip: '1% – 3%' }
    return { text: '达标', type: 'success' as const, tip: '高于 3%' }
  }

  /**
   * 周环比：用分发记录按发布日期切两个 7 天窗口对比。
   * 粉丝数没有历史快照，只能等自动更新按周累计后才有环比。
   */
  function weekOverWeek(row: Row) {
    const posts = runtimeDistributions.value.filter((d) => handleOf(d.account) === row.handle)
    let thisPosts = 0
    let lastPosts = 0
    let thisViews = 0
    let lastViews = 0
    for (const d of posts) {
      if (!d.publishDate || d.publishDate === '—') continue
      const ago = daysBetween(d.publishDate, DOJO_TODAY)
      const views = (d.naturalViews || 0) + (d.paidViews || 0)
      if (ago >= 0 && ago < 7) {
        thisPosts += 1
        thisViews += views
      } else if (ago >= 7 && ago < 14) {
        lastPosts += 1
        lastViews += views
      }
    }
    return {
      thisPosts,
      thisViews,
      postDelta: lastPosts ? (thisPosts - lastPosts) / lastPosts : null,
      viewDelta: lastViews ? (thisViews - lastViews) / lastViews : null
    }
  }

  function deltaText(d: number | null) {
    if (d == null) return '无上周基准'
    const pct = Math.round(d * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  function deltaClass(d: number | null) {
    if (d == null) return 'delta delta--flat'
    return d >= 0 ? 'delta delta--up' : 'delta delta--down'
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
        rows.value[idx] = {
          ...payload,
          projectId: prev.projectId,
          followers: prev.followers,
          syncedAt: prev.syncedAt,
          syncSource: prev.syncSource
        }
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
      if (detailRow.value?.id === row.id) detailVisible.value = false
      ElMessage.success('已删除')
    } catch {
      /* cancelled */
    }
  }

  function exportRows() {
    exportCsv(
      '总账号预览',
      [
        '账号',
        '所属项目',
        '内容细分',
        '粉丝量',
        '发布数',
        '累计播放',
        '均互动率',
        '最近分发',
        '检阅状态'
      ],
      sortedFiltered.value.map((r) => [
        r.handle,
        r.projectId ? projectName(r.projectId) : '未归属',
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

  .to-ads {
    margin-left: auto;
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

  .account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }

  .acc-card {
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: var(--el-color-primary);
    }

    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    &__meta {
      margin: 6px 0 10px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      margin: 0;

      dt {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 2px 0 0;
        font-size: 14px;
        font-weight: 600;
      }
    }

    &__foot {
      margin: 10px 0 0;
      padding-top: 8px;
      border-top: 1px solid var(--el-border-color-lighter);
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .empty {
    grid-column: 1 / -1;
    padding: 28px;
    text-align: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .detail {
    &__head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    &__title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 20px 0 10px;
      font-size: 14px;
      font-weight: 600;

      small {
        font-size: 12px;
        font-weight: 400;
        color: var(--el-text-color-secondary);
      }
    }

    &__kv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 0;

      &--wide {
        grid-template-columns: 1fr;
      }

      dt {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 3px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    &__hint {
      margin: 12px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .diag {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-top: 1px solid var(--el-border-color-lighter);

      &:first-child {
        border-top: 0;
      }
    }

    &__label {
      width: 72px;
      font-size: 13px;
    }

    &__tip {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .delta {
    margin-left: 6px;
    font-style: normal;
    font-size: 12px;

    &--up {
      color: #22c55e;
    }

    &--down {
      color: #ef4444;
    }

    &--flat {
      color: var(--el-text-color-secondary);
    }
  }
</style>
