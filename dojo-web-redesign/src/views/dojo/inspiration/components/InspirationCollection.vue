<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import VideoPreviewPanel from '@/components/dojo/VideoPreviewPanel.vue'
  import InspirationBenchmarkAccounts from './InspirationBenchmarkAccounts.vue'
  import InspirationHotBoards from './InspirationHotBoards.vue'
  import { candidateScores } from '@/utils/dojoInspirationRanking'
  import {
    looksLikeProjectTitle,
    resolveSearchQueries,
    sourceSearchText
  } from '@/utils/dojoInspirationQueries'
  import {
    collectProjectOwnedTokens,
    isOwnedProjectTag,
    rankDirectionalTags
  } from '@/utils/dojoInspirationTags'
  import { dojoProjectStore } from '@/store/dojoProjectStore'
  import { dojoProjectRuntime } from '@/store/dojoProjectRuntime'
  import {
    createHotBoard,
    refreshHotBoard
  } from '@/store/dojoInspirationExplore'
  import {
    createInspirationSource,
    dojoInspirationStore,
    promoteCandidate,
    removeInspirationSource,
    runInspirationCollection,
    setCandidateStatus,
    toggleInspirationSource,
    updateInspirationSource
  } from '@/store/dojoInspirationStore'
  import type {
    InspirationCandidate,
    InspirationPlatform,
    InspirationRanking,
    InspirationSourceKind
  } from '@/types/dojoInspiration'

  const rankingLabels: Record<InspirationRanking, string> = {
    balanced: '新鲜度 × 热度',
    fresh: '优先最新',
    hot: '优先热度'
  }

  type CollectionMode = 'search' | 'boards' | 'accounts'

  const collectionMode = ref<CollectionMode>('search')
  const sourceFormOpen = ref(false)
  const editingSourceId = ref('')
  const runningSourceId = ref('')
  const previewCandidate = ref<InspirationCandidate | null>(null)
  const requestCounts = reactive<Record<string, number>>({})
  const sourceForm = reactive({
    name: '',
    platform: 'TikTok' as InspirationPlatform,
    kind: 'keyword' as InspirationSourceKind,
    query: '',
    timeWindowDays: 90 as 7 | 30 | 90 | 0,
    ranking: 'balanced' as InspirationRanking,
    defaultLimit: 20
  })

  const expandedBatchIds = ref<string[]>([])
  const batchExpandSeeded = ref(false)
  const tagFilter = ref('')
  const projectOwnedTokens = computed(() =>
    collectProjectOwnedTokens(
      dojoProjectStore.projects.map((project) => ({
        name: project.name,
        aliases: project.aliases,
        brand: dojoProjectRuntime[project.id]?.brand
      }))
    )
  )
  const activeCandidates = computed(() =>
    dojoInspirationStore.candidates.filter((item) => item.status !== 'rejected')
  )
  const directionalTags = computed(() =>
    rankDirectionalTags(
      activeCandidates.value.map((item) => item.tags),
      {
        ownedTokens: projectOwnedTokens.value,
        minCount: 2,
        limit: 16
      }
    )
  )
  const candidateGroups = computed(() => {
    const matchesTag = (candidate: InspirationCandidate) =>
      !tagFilter.value || candidate.tags.some((tag) => tag === tagFilter.value)
    const jobGroups = dojoInspirationStore.jobs
      .filter((job) => job.status === 'completed')
      .map((job) => {
        const source = dojoInspirationStore.sources.find((item) => item.id === job.sourceId)
        const candidates = activeCandidates.value
          .filter((candidate) => candidate.collectionJobId === job.id)
          .filter(matchesTag)
          .sort(
            (left, right) =>
              candidateScores(right, source?.ranking || 'balanced').trend -
              candidateScores(left, source?.ranking || 'balanced').trend
          )
        return {
          id: job.id,
          sourceId: job.sourceId,
          title: source?.name || '已删除线索',
          meta: `${formatCollectionTime(job.startedAt)} · ${candidates.length} 条待筛`,
          candidates
        }
      })
      .filter((group) => group.candidates.length)

    const legacyBySource = new Map<string, InspirationCandidate[]>()
    activeCandidates.value
      .filter((candidate) => !candidate.collectionJobId)
      .filter(matchesTag)
      .forEach((candidate) => {
        const items = legacyBySource.get(candidate.sourceId) || []
        items.push(candidate)
        legacyBySource.set(candidate.sourceId, items)
      })
    const legacyGroups = [...legacyBySource.entries()].map(([sourceId, candidates]) => ({
      id: `history-${sourceId}`,
      sourceId,
      title: `${sourceName(sourceId)} · 历史结果`,
      meta: `${candidates.length} 条待筛`,
      candidates: candidates.sort(
        (left, right) => candidateScores(right).trend - candidateScores(left).trend
      )
    }))
    return [...jobGroups, ...legacyGroups]
  })
  const newestJobs = computed(() => dojoInspirationStore.jobs.slice(0, 4))
  const queryHint = computed(() => {
    const raw = sourceForm.query.trim()
    if (!raw) return ''
    const resolved = resolveSearchQueries(raw)
    if (resolved.hint) return resolved.hint
    if (resolved.primary) return `实际检索：${resolved.primary}`
    return ''
  })

  function liveSearchQuery(source: { name: string; query: string }) {
    const resolved = resolveSearchQueries(sourceSearchText(source))
    return resolved.tiktokQuery || resolved.primary
  }

  function handleSyncToBoard(sourceId: string) {
    const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
    if (!source?.query) {
      ElMessage.warning('这条线索没有独立检索词，不能同步到固定榜单')
      return
    }
    try {
      const board = createHotBoard({
        name: source.name,
        queries: source.query,
        timeWindowDays: 7
      })
      void refreshHotBoard(board.id)
      ElMessage.success(`已加入方向榜「${board.name}」，正在出近 7 天前十`)
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '同步失败')
    }
  }

  function sourceName(sourceId: string) {
    return dojoInspirationStore.sources.find((item) => item.id === sourceId)?.name || '未知线索'
  }

  function resetSourceForm() {
    editingSourceId.value = ''
    Object.assign(sourceForm, {
      name: '',
      platform: 'TikTok',
      kind: 'keyword',
      query: '',
      timeWindowDays: 90,
      ranking: 'balanced',
      defaultLimit: 20
    })
  }

  function closeSourceForm() {
    resetSourceForm()
    sourceFormOpen.value = false
  }

  function handleSaveSource() {
    const name = sourceForm.name.trim()
    const query = sourceForm.query.trim()
    if (sourceForm.kind !== 'trend' && !query) {
      ElMessage.warning('检索词必填。只写要搜的那个独立词，不要写项目名或品牌名')
      return
    }
    if (looksLikeProjectTitle(query)) {
      ElMessage.warning('检索词不要写项目名或规划标题，只写平台上能搜到的主词')
      return
    }
    const resolvedName = name || query.split(/[\n,，]+/)[0]?.trim() || '未命名线索'
    const resolvedQuery = query
    const source = editingSourceId.value
      ? updateInspirationSource(editingSourceId.value, {
          ...sourceForm,
          name: resolvedName,
          query: resolvedQuery,
          lenses: []
        })
      : createInspirationSource({
          ...sourceForm,
          name: resolvedName,
          query: resolvedQuery,
          lenses: []
        })
    if (!source) return
    requestCounts[source.id] = source.defaultLimit
    const wasEditing = Boolean(editingSourceId.value)
    resetSourceForm()
    sourceFormOpen.value = false
    ElMessage.success(wasEditing ? '灵感线索已更新' : '灵感线索已保存')
  }

  function startEditSource(sourceId: string) {
    const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
    if (!source) return
    editingSourceId.value = source.id
    Object.assign(sourceForm, {
      name: source.name,
      platform: source.platform,
      kind: source.kind,
      query: source.query,
      timeWindowDays: source.timeWindowDays ?? 90,
      ranking: source.ranking || 'balanced',
      defaultLimit: source.defaultLimit
    })
    sourceFormOpen.value = true
  }

  async function handleRemoveSource(sourceId: string) {
    const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
    if (!source) return
    try {
      await ElMessageBox.confirm(
        `删除采集线索“${source.name}”？已进入知识库的灵感会保留。`,
        '删除线索',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeInspirationSource(sourceId)
      if (editingSourceId.value === sourceId) {
        resetSourceForm()
        sourceFormOpen.value = false
      }
      ElMessage.success('采集线索已删除')
    } catch {
      return
    }
  }

  async function handleSearchDirection(tag: string) {
    if (isOwnedProjectTag(tag, projectOwnedTokens.value)) {
      ElMessage.warning('这是项目自己的品牌/型号标签，不拿来当检索方向')
      return
    }
    const source = createInspirationSource({
      name: tag,
      platform: 'TikTok',
      kind: 'keyword',
      query: tag,
      timeWindowDays: 7,
      ranking: 'hot',
      defaultLimit: 10,
      lenses: []
    })
    requestCounts[source.id] = 10
    ElMessage.success(`已把「${tag}」做成检索方向，正在查前十`)
    await handleRunCollection(source.id, 10)
  }

  async function handleRunCollection(sourceId: string, defaultLimit: number) {
    runningSourceId.value = sourceId
    const job = await runInspirationCollection(
      sourceId,
      requestCounts[sourceId] || defaultLimit || 20
    )
    runningSourceId.value = ''
    if (job?.status === 'completed') {
      expandedBatchIds.value = [job.id, ...expandedBatchIds.value.filter((id) => id !== job.id)]
      if (job.resultCount > 0) {
        ElMessage.success(`已采集 ${job.resultCount} 条候选内容`)
      } else {
        ElMessage.warning(
          job.message ||
            '检索有结果，但本地过滤后为 0 条。可减少关键词、放宽时间窗，或只保留 1 个主词后再试。'
        )
      }
    } else {
      ElMessage.info(job?.message || '采集任务已保存，等待接口配置')
    }
  }

  function handlePromote(candidateId: string) {
    const inspiration = promoteCandidate(candidateId)
    if (!inspiration) return
    ElMessage.success('已晋升为可执行灵感，可在灵感库继续整理')
    previewCandidate.value = null
  }

  function previewMetrics(candidate: InspirationCandidate) {
    return [
      { label: '播放', value: formatMetric(candidate.views) },
      { label: '点赞', value: formatMetric(candidate.likes) },
      { label: '评论', value: formatMetric(candidate.comments) },
      { label: '收藏', value: formatMetric(candidate.saves) }
    ]
  }

  function handleRejectPreview() {
    if (!previewCandidate.value) return
    setCandidateStatus(previewCandidate.value.id, 'rejected')
    previewCandidate.value = null
  }

  function formatMetric(value: number) {
    if (!value) return '待接口回填'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
    return value.toLocaleString('zh-CN')
  }

  function keywordCount(query: string) {
    return query
      .split(/[\n,，#]+/)
      .map((item) => item.trim())
      .filter(Boolean).length
  }

  function formatCollectionTime(value: string) {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return '采集时间未知'
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp)
  }

  function isBatchExpanded(groupId: string) {
    return expandedBatchIds.value.includes(groupId)
  }

  function toggleBatch(groupId: string) {
    expandedBatchIds.value = expandedBatchIds.value.includes(groupId)
      ? expandedBatchIds.value.filter((id) => id !== groupId)
      : [...expandedBatchIds.value, groupId]
  }

  watch(
    directionalTags,
    (tags) => {
      if (tagFilter.value && !tags.some((item) => item.tag === tagFilter.value)) {
        tagFilter.value = ''
      }
    }
  )

  watch(
    candidateGroups,
    (groups) => {
      const ids = new Set(groups.map((group) => group.id))
      expandedBatchIds.value = expandedBatchIds.value.filter((id) => ids.has(id))
      if (!batchExpandSeeded.value && groups[0]) {
        expandedBatchIds.value = [groups[0].id]
        batchExpandSeeded.value = true
      }
    },
    { immediate: true }
  )

  function formatPublishedAt(value: string) {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return '发布时间待回填'
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(timestamp)
  }

  function windowLabel(days?: number) {
    if (!days) return '不限时间'
    return `近 ${days} 天`
  }
</script>

<template>
  <section class="collection-surface">
    <nav class="collection-tabs" aria-label="采集方式">
      <button
        type="button"
        :class="{ 'is-active': collectionMode === 'search' }"
        @click="collectionMode = 'search'"
      >
        自由搜索
      </button>
      <button
        type="button"
        :class="{ 'is-active': collectionMode === 'boards' }"
        @click="collectionMode = 'boards'"
      >
        固定榜单
      </button>
      <button
        type="button"
        :class="{ 'is-active': collectionMode === 'accounts' }"
        @click="collectionMode = 'accounts'"
      >
        对标库
      </button>
    </nav>

    <div class="collection-body">
      <InspirationHotBoards v-if="collectionMode === 'boards'" />
      <InspirationBenchmarkAccounts v-else-if="collectionMode === 'accounts'" layout="cards" />
      <div v-else class="collection-grid">
      <aside class="source-console">
        <header>
          <div>
            <h2>灵感线索</h2>
            <p>每次只搜你写下的独立词。项目名、品牌名、线索名称都不会自动带上。</p>
          </div>
          <button type="button" aria-label="新建灵感线索" @click="sourceFormOpen = !sourceFormOpen">
            <Icon icon="ph:plus" width="17" />
            <span>新建线索</span>
          </button>
        </header>

        <form v-if="sourceFormOpen" class="source-form" @submit.prevent="handleSaveSource">
          <header>
            <strong>{{ editingSourceId ? '编辑线索' : '新建线索' }}</strong>
            <button type="button" @click="closeSourceForm">取消</button>
          </header>
          <label>
            <span>线索名称</span>
            <input
              v-model="sourceForm.name"
              type="text"
              placeholder="例如：英国产品线索（不会带进搜索）"
            />
          </label>
          <div>
            <label>
              <span>平台</span>
              <select v-model="sourceForm.platform">
                <option>TikTok</option>
                <option>YouTube</option>
                <option>Instagram</option>
                <option>小红书</option>
              </select>
            </label>
            <label>
              <span>线索类型</span>
              <select v-model="sourceForm.kind">
                <option value="keyword">关键词</option>
                <option value="account">账号</option>
                <option value="hashtag">话题</option>
                <option value="trend">热门趋势</option>
              </select>
            </label>
          </div>
          <label>
            <span>检索内容（可选）</span>
            <textarea
              v-model="sourceForm.query"
              rows="3"
              :placeholder="
                sourceForm.kind === 'trend'
                  ? '可留空，直接抓取趋势结果'
                  : '必填。只搜第一行那个独立词，其余只加权，不会补品牌'
              "
            />
            <small v-if="queryHint">{{ queryHint }}</small>
          </label>
          <div>
            <label>
              <span>时间范围</span>
              <select v-model.number="sourceForm.timeWindowDays">
                <option :value="7">近 7 天</option>
                <option :value="30">近 30 天</option>
                <option :value="90">近 90 天</option>
                <option :value="0">不限时间</option>
              </select>
            </label>
            <label>
              <span>排序规则</span>
              <select v-model="sourceForm.ranking">
                <option value="balanced">新鲜度 × 热度</option>
                <option value="fresh">优先最新</option>
                <option value="hot">优先热度</option>
              </select>
            </label>
          </div>
          <label>
            <span>默认批量</span>
            <input v-model.number="sourceForm.defaultLimit" type="number" min="1" max="100" />
          </label>
          <button type="submit">{{ editingSourceId ? '保存修改' : '保存线索' }}</button>
        </form>

        <div class="source-list">
          <article v-for="source in dojoInspirationStore.sources" :key="source.id">
            <header>
              <span :class="{ 'is-off': !source.enabled }"><i />{{ source.platform }}</span>
              <div class="source-list__actions">
                <button type="button" @click="startEditSource(source.id)">编辑</button>
                <button type="button" @click="toggleInspirationSource(source.id)">
                  {{ source.enabled ? '暂停' : '启用' }}
                </button>
                <button type="button" class="is-danger" @click="handleRemoveSource(source.id)">
                  删除
                </button>
              </div>
            </header>
            <h3>{{ source.name }}</h3>
            <p>
              {{
                source.kind === 'local-import'
                  ? '本地规划，不拿去检索'
                  : source.query || '还没填独立检索词'
              }}
            </p>
            <div class="source-list__meta">
              <span>{{ windowLabel(source.timeWindowDays ?? 30) }}</span>
              <span>{{ rankingLabels[source.ranking || 'balanced'] }}</span>
              <span v-if="liveSearchQuery(source)">实际检索 {{ liveSearchQuery(source) }}</span>
              <span v-else-if="source.kind === 'local-import'">不检索</span>
              <span v-else-if="source.query">主词不可用，请改成独立检索词</span>
              <span v-if="source.query && keywordCount(source.query) > 1">
                + {{ keywordCount(source.query) - 1 }} 个加权词
              </span>
            </div>
            <footer>
              <label>
                <span>每次</span>
                <input
                  v-model.number="requestCounts[source.id]"
                  type="number"
                  min="1"
                  max="100"
                  :placeholder="String(source.defaultLimit)"
                />
                <span>条</span>
              </label>
              <button
                type="button"
                :disabled="
                  !source.enabled ||
                  source.kind === 'local-import' ||
                  runningSourceId === source.id ||
                  (source.kind !== 'trend' && !liveSearchQuery(source))
                "
                @click="handleRunCollection(source.id, source.defaultLimit)"
              >
                <Icon icon="ph:radar" width="15" />
                {{ runningSourceId === source.id ? '采集中' : '批量获取' }}
              </button>
            </footer>
          </article>
        </div>

        <section class="job-log">
          <header>
            <h3>最近任务</h3>
            <span>{{ dojoInspirationStore.jobs.length }}</span>
          </header>
          <ol v-if="newestJobs.length">
            <li v-for="job in newestJobs" :key="job.id">
              <i :class="`is-${job.status}`" />
              <span>
                <strong>{{ sourceName(job.sourceId) }}</strong>
                <small>{{ job.requestedCount }} 条 · {{ job.message || job.status }}</small>
              </span>
            </li>
          </ol>
          <p v-else>还没有运行记录。配置好接口后，任务会从这里开始。</p>
        </section>
      </aside>

      <section class="candidate-pool">
        <header class="candidate-pool__head">
          <div>
            <h2>候选池</h2>
            <p>反复出现的内容标签会变成方向。项目自己的品牌/型号不会进这里。</p>
          </div>
          <strong>{{ activeCandidates.length }} 条待判断</strong>
        </header>
        <div v-if="directionalTags.length" class="tag-filter" role="group" aria-label="内容方向">
          <button
            type="button"
            :class="{ 'is-active': !tagFilter }"
            @click="tagFilter = ''"
          >
            全部
          </button>
          <button
            v-for="item in directionalTags"
            :key="item.tag"
            type="button"
            :class="{ 'is-active': tagFilter === item.tag }"
            @click="tagFilter = tagFilter === item.tag ? '' : item.tag"
          >
            {{ item.tag }}
            <small>{{ item.count }}</small>
          </button>
        </div>
        <p v-if="tagFilter" class="tag-filter__hint">
          「{{ tagFilter }}」在这批结果里反复出现。
          <button type="button" @click="handleSearchDirection(tagFilter)">
            用这个词再搜前十
          </button>
        </p>

        <div class="candidate-groups">
          <section
            v-for="group in candidateGroups"
            :key="group.id"
            class="candidate-group"
          >
            <div class="candidate-group__bar">
              <button
                type="button"
                class="candidate-group__header"
                :aria-expanded="isBatchExpanded(group.id)"
                @click="toggleBatch(group.id)"
              >
                <span>
                  <strong>{{ group.title }}</strong>
                  <small>{{ group.meta }}</small>
                </span>
                <em>{{ group.candidates.length }} 条待筛</em>
                <Icon
                  :icon="isBatchExpanded(group.id) ? 'ph:caret-up' : 'ph:caret-down'"
                  width="16"
                />
              </button>
              <button
                type="button"
                class="candidate-group__sync"
                @click="handleSyncToBoard(group.sourceId)"
              >
                同步到固定榜单
              </button>
            </div>

            <div v-if="isBatchExpanded(group.id)" class="candidate-list">
              <article v-for="candidate in group.candidates" :key="candidate.id">
                <div class="candidate-rank">
                  <strong>{{ candidateScores(candidate).heat }}</strong>
                  <span>热度</span>
                </div>
                <div class="candidate-copy">
                  <header>
                    <span>
                      {{ candidate.platform }} · {{ candidate.author }} ·
                      {{ formatPublishedAt(candidate.publishedAt) }}
                    </span>
                    <em :class="`is-${candidate.status}`">{{ candidate.status }}</em>
                  </header>
                  <h3>{{ candidate.title }}</h3>
                  <p>{{ candidate.summary }}</p>
                  <footer>
                    <span v-for="tag in candidate.tags.slice(0, 4)" :key="tag">#{{ tag }}</span>
                  </footer>
                </div>
                <dl>
                  <div>
                    <dt>热度</dt>
                    <dd>{{ candidateScores(candidate).heat }}</dd>
                  </div>
                  <div>
                    <dt>新鲜度</dt>
                    <dd>{{ candidateScores(candidate).freshness }}</dd>
                  </div>
                  <div>
                    <dt>播放</dt>
                    <dd>{{ formatMetric(candidate.views) }}</dd>
                  </div>
                </dl>
                <div class="candidate-actions">
                  <button type="button" class="is-preview" @click="previewCandidate = candidate">
                    <Icon icon="ph:play-circle" width="15" />
                    预览
                  </button>
                  <button type="button" @click="setCandidateStatus(candidate.id, 'rejected')">
                    忽略
                  </button>
                  <button
                    v-if="candidate.status === 'new'"
                    type="button"
                    @click="setCandidateStatus(candidate.id, 'qualified')"
                  >
                    保留
                  </button>
                  <button
                    type="button"
                    class="is-primary"
                    :disabled="candidate.status === 'promoted'"
                    @click="handlePromote(candidate.id)"
                  >
                    {{ candidate.status === 'promoted' ? '已进入灵感库' : '晋升灵感' }}
                  </button>
                </div>
              </article>
            </div>
          </section>

          <div v-if="!candidateGroups.length" class="candidate-empty">
            <Icon icon="ph:magnifying-glass" width="24" />
            <strong>还没有可判断的采集结果</strong>
            <span>运行一个线索后，结果会按采集批次出现在这里。</span>
          </div>
        </div>
      </section>
    </div>
    </div>

    <ElDialog
      :model-value="Boolean(previewCandidate)"
      title="候选视频预览"
      width="min(1120px, calc(100vw - 32px))"
      destroy-on-close
      @close="previewCandidate = null"
    >
      <VideoPreviewPanel
        v-if="previewCandidate"
        tall
        :title="previewCandidate.title"
        :url="previewCandidate.url"
        :author="`${previewCandidate.platform} · ${previewCandidate.author}`"
        :metrics="previewMetrics(previewCandidate)"
        eyebrow="PREVIEW BEFORE SAVE"
        empty-text="当前平台不支持站内播放，可使用原始链接核对后再决定是否晋升"
      />
      <template v-if="previewCandidate" #footer>
        <ElButton @click="previewCandidate = null">关闭</ElButton>
        <ElButton @click="handleRejectPreview">忽略</ElButton>
        <ElButton
          v-if="previewCandidate.status === 'new'"
          @click="setCandidateStatus(previewCandidate.id, 'qualified')"
        >
          保留候选
        </ElButton>
        <ElButton
          type="primary"
          :disabled="previewCandidate.status === 'promoted'"
          @click="handlePromote(previewCandidate.id)"
        >
          {{ previewCandidate.status === 'promoted' ? '已进入灵感库' : '晋升灵感' }}
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped lang="scss">
  .collection-surface {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .collection-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .collection-body > * {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  .collection-tabs {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 4px;
    padding: 4px;
    margin-bottom: 18px;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 12px;
  }

  .collection-tabs button {
    min-height: 42px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--dojo-muted-strong);
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 10px;
  }

  .collection-tabs button.is-active {
    color: #fffdfc;
    background: #403666;
  }

  .collection-grid {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 24px;
    box-shadow: var(--dojo-shadow-sm);
  }

  .source-console {
    min-height: 0;
    padding: 22px 16px;
    overflow: auto;
    background: var(--dojo-paper-muted);
    border-right: 1px solid var(--dojo-line);
  }

  .source-console > header,
  .candidate-pool__head,
  .source-list article > header,
  .job-log > header,
  .candidate-copy > header {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .source-console h2,
  .source-console p,
  .candidate-pool h2,
  .candidate-pool p {
    margin: 0;
  }

  .source-console h2,
  .candidate-pool h2 {
    margin-top: 4px;
    font-size: 18px;
  }

  .source-console > header p,
  .candidate-pool__head p {
    margin-top: 5px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .source-console > header > button {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 5px;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    color: #fffdfc;
    white-space: nowrap;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 12px;
  }

  .source-form {
    display: grid;
    gap: 9px;
    padding: 14px;
    margin-top: 14px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 11px;
  }

  .source-form > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .source-form > header strong {
    font-size: 11px;
  }

  .source-form > header button {
    padding: 0;
    font-size: 11px;
    color: var(--dojo-muted);
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .source-form > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .source-lenses {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    padding: 10px;
    margin: 0;
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .source-lenses legend {
    padding: 0 4px;
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .source-lenses label {
    display: flex;
    grid-template-columns: none;
    gap: 6px;
    align-items: center;
    min-width: 0;
    cursor: pointer;
  }

  .source-lenses input {
    width: 14px;
    height: 14px;
    padding: 0;
    margin: 0;
    accent-color: var(--dojo-accent);
  }

  .source-form label {
    display: grid;
    gap: 5px;
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .source-form input,
  .source-form select,
  .source-form textarea {
    width: 100%;
    padding: 8px 9px;
    font: inherit;
    font-size: 11px;
    color: var(--dojo-ink);
    resize: vertical;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
    outline: none;
  }

  .source-form input:focus,
  .source-form select:focus,
  .source-form textarea:focus {
    border-color: var(--dojo-purple);
    box-shadow: 0 0 0 3px rgb(120 96 204 / 24%);
  }

  .source-form small {
    font-size: 10px;
    line-height: 1.5;
    color: var(--dojo-amber);
  }

  .source-form > button {
    min-height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    color: #fffdfc;
    white-space: nowrap;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 10px;
  }

  .source-list {
    display: grid;
    gap: 9px;
    margin-top: 15px;
  }

  .source-list article {
    padding: 13px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
  }

  .source-list header > span {
    display: flex;
    gap: 5px;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--dojo-green);
  }

  .source-list header > span.is-off {
    color: var(--dojo-muted);
  }

  .source-list header i {
    width: 5px;
    height: 5px;
    background: currentcolor;
    border-radius: 50%;
  }

  .source-list header button {
    padding: 0;
    font-size: 10px;
    color: var(--dojo-muted);
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .source-list__actions {
    display: flex;
    gap: 8px;
  }

  .source-list__actions button.is-danger {
    color: #a53f49;
  }

  .source-list h3 {
    margin: 9px 0 0;
    font-size: 13px;
  }

  .source-list p {
    display: -webkit-box;
    margin-top: 5px;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.5;
    color: var(--dojo-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .source-list__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }

  .source-list__meta span {
    padding: 3px 5px;
    font-size: 10px;
    color: var(--dojo-ink);
    background: var(--dojo-paper-muted);
    border-radius: 8px;
  }

  .source-list footer {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-top: 11px;
  }

  .source-list footer label {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .source-list footer input {
    width: 42px;
    padding: 5px;
    font-size: 11px;
    border: 1px solid var(--dojo-line);
    border-radius: 6px;
  }

  .source-list footer button {
    display: flex;
    gap: 5px;
    align-items: center;
    min-height: 30px;
    padding: 0 10px;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 7px;
  }

  .source-list footer button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .job-log {
    padding-top: 16px;
    margin-top: 18px;
    border-top: 1px solid var(--dojo-line);
  }

  .job-log h3 {
    margin: 0;
    font-size: 12px;
  }

  .job-log > header span {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .job-log ol {
    display: grid;
    gap: 8px;
    padding: 0;
    margin: 10px 0 0;
    list-style: none;
  }

  .job-log li {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }

  .job-log li > i {
    width: 6px;
    height: 6px;
    margin-top: 4px;
    background: #8b949e;
    border-radius: 50%;
  }

  .job-log li > i.is-completed {
    background: #28a885;
  }

  .job-log li > i.is-failed {
    background: #c95b5b;
  }

  .job-log li > i.is-awaiting-provider {
    background: #d39435;
  }

  .job-log li span {
    display: grid;
    gap: 2px;
  }

  .job-log li strong {
    font-size: 11px;
  }

  .job-log li small,
  .job-log > p {
    font-size: 10px;
    line-height: 1.5;
    color: var(--dojo-muted);
  }

  .candidate-pool {
    container-type: inline-size;
    container-name: candidates;
    min-width: 0;
    min-height: 0;
    padding: 18px 20px;
    overflow: auto;
  }

  .candidate-pool__head > strong {
    flex: 0 0 auto;
    padding: 7px 10px;
    font-size: 11px;
    color: var(--dojo-accent);
    background: color-mix(in srgb, var(--dojo-accent) 12%, var(--dojo-paper));
    border-radius: 8px;
  }

  .tag-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px;
  }

  .tag-filter button {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-muted-strong);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 999px;

    small {
      font-variant-numeric: tabular-nums;
      color: var(--dojo-muted);
    }
  }

  .tag-filter button.is-active {
    color: #fffdfc;
    background: #403666;
    border-color: #403666;

    small {
      color: rgb(255 253 252 / 78%);
    }
  }

  .tag-filter__hint {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: -6px 0 14px;
    font-size: 11px;
    color: var(--dojo-muted);

    button {
      height: 28px;
      padding: 0 10px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      background: var(--dojo-accent);
      border: 0;
      border-radius: 8px;
    }
  }

  .candidate-groups {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .candidate-group {
    border-top: 1px solid var(--dojo-line);
  }

  .candidate-group__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .candidate-group__sync {
    flex-shrink: 0;
    height: 32px;
    padding: 0 12px;
    font-size: 12px;
    line-height: 1;
    color: var(--dojo-ink);
    white-space: nowrap;
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 8px;
  }

  .candidate-group__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    min-width: 0;
    flex: 1;
    min-height: 58px;
    padding: 10px 4px;
    color: var(--dojo-ink);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    > span {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    strong {
      font-size: 12px;
    }

    small {
      font-size: 11px;
      color: var(--dojo-muted);
      font-variant-numeric: tabular-nums;
    }

    em {
      flex: 0 0 auto;
      padding: 4px 8px;
      font-size: 12px;
      font-style: normal;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--dojo-ink);
      background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
      border-radius: 999px;
    }
  }

  .candidate-list {
    display: grid;
    gap: 0;
    margin-top: 0;
  }

  .candidate-empty {
    display: grid;
    gap: 7px;
    place-items: center;
    min-height: 280px;
    color: var(--dojo-muted);
    text-align: center;

    strong {
      color: var(--dojo-ink);
    }

    span {
      font-size: 10px;
    }
  }

  .candidate-list > article {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) minmax(132px, 168px) minmax(108px, 128px);
    grid-template-areas: 'rank copy metrics actions';
    gap: 12px 14px;
    align-items: center;
    min-width: 0;
    min-height: 112px;
    padding: 14px 4px;
    border-bottom: 1px solid var(--dojo-line-soft);
    border-radius: 0;
    transition: background 140ms cubic-bezier(0.22, 1, 0.36, 1);

    &:hover {
      background: var(--dojo-paper-muted);
    }
  }

  .candidate-list > article:last-child {
    border-bottom: 0;
  }

  .candidate-rank {
    display: grid;
    grid-area: rank;
    gap: 3px;
    place-items: center;
    width: 58px;
    height: 58px;
    background: var(--dojo-paper-muted);
    border-radius: 12px;
  }

  .candidate-rank strong {
    font-family: Georgia, 'Noto Serif SC', serif;
    font-size: 18px;
    color: var(--dojo-ink);
  }

  .candidate-rank span {
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .candidate-copy {
    grid-area: copy;
    min-width: 0;
  }

  .candidate-copy header > span,
  .candidate-copy header em {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .candidate-copy header em {
    padding: 3px 6px;
    font-style: normal;
    background: var(--dojo-paper-muted);
    border-radius: 8px;
  }

  .candidate-copy header em.is-promoted {
    color: var(--dojo-accent);
    background: color-mix(in srgb, var(--dojo-accent) 14%, var(--dojo-paper));
  }

  .candidate-copy h3 {
    margin: 7px 0 0;
    font-size: 14px;
  }

  .candidate-copy p {
    display: -webkit-box;
    margin-top: 6px;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.6;
    color: var(--dojo-muted-strong);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .candidate-copy footer {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }

  .candidate-copy footer span {
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .candidate-copy footer span.is-lens {
    padding: 2px 4px;
    color: var(--dojo-green);
    background: color-mix(in srgb, var(--dojo-green) 12%, var(--dojo-paper));
    border-radius: 4px;
  }

  .candidate-list dl {
    display: grid;
    grid-area: metrics;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
    min-width: 0;
    margin: 0;
  }

  .candidate-list dl div {
    min-width: 0;
    padding: 8px;
    background: var(--dojo-paper-muted);
    border-radius: 8px;
  }

  .candidate-list dt {
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .candidate-list dd {
    margin: 4px 0 0;
    overflow: hidden;
    font-size: 10px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .candidate-actions {
    display: grid;
    grid-area: actions;
    gap: 5px;
    min-width: 0;
  }

  .candidate-actions button {
    display: flex;
    gap: 5px;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    font-size: 12px;
    color: var(--dojo-muted-strong);
    cursor: pointer;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
  }

  .candidate-actions button.is-primary {
    color: #fffdfc;
    background: var(--dojo-accent);
    border-color: var(--dojo-accent);
  }

  .candidate-actions button.is-preview {
    color: var(--dojo-ink);
    background: var(--dojo-paper-muted);
    border-color: var(--dojo-line);
  }

  .candidate-actions button:disabled {
    color: var(--dojo-muted);
    cursor: not-allowed;
    background: var(--dojo-paper-muted);
    border-color: transparent;
  }

  @container workspace (max-width: 720px) {
    .collection-grid {
      grid-template-columns: 1fr;
    }

    .source-console {
      border-right: 0;
      border-bottom: 1px solid var(--dojo-line);
    }
  }

  @container candidates (max-width: 600px) {
    .candidate-list > article {
      grid-template-columns: 58px minmax(0, 1fr) minmax(108px, 128px);
      grid-template-areas:
        'rank copy actions'
        '. metrics actions';
      align-items: start;
    }
  }

  @container candidates (max-width: 540px) {
    .candidate-list > article {
      grid-template-columns: 52px minmax(0, 1fr);
      grid-template-areas:
        'rank copy'
        'metrics metrics'
        'actions actions';
      gap: 10px;
    }

    .candidate-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container workspace (max-width: 720px) {
    .source-form > div {
      grid-template-columns: 1fr;
    }
  }

  @media (width <= 800px) {
    .collection-tabs {
      width: 100%;
      overflow-x: auto;
    }

    .candidate-pool {
      padding: 18px 14px;
    }
  }
</style>
