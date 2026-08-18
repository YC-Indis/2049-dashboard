<script setup lang="ts">
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import VideoPreviewPanel from '@/components/dojo/VideoPreviewPanel.vue'
  import {
    boardCandidates,
    boardHistoryDays,
    createHotBoard,
    dojoInspirationExplore,
    isBoardStale,
    patchHotBoard,
    promoteExploreCandidate,
    refreshEnabledBoards,
    refreshHotBoard,
    refreshStaleBoards,
    removeHotBoard
  } from '@/store/dojoInspirationExplore'
  import {
    addSeedQueries,
    boardRows,
    dojoInspirationRankStore,
    hideRankBoard,
    patchRankBoardPref,
    pauseRankQuery,
    rankedCandidate,
    removeRankQuery,
    restoreRankBoard,
    runRankCycle,
    setVelocityWindow,
    toggleRankBoardEnabled
  } from '@/store/dojoInspirationRankStore'
  import { setCandidateStatus } from '@/store/dojoInspirationStore'
  import type { HotBoardWindow } from '@/types/dojoInspirationExplore'
  import type { RankBoardKind, VelocityWindowHours } from '@/types/dojoInspirationRank'
  import type { InspirationCandidate } from '@/types/dojoInspiration'
  import { candidateScores } from '@/utils/dojoInspirationRanking'
  import { RANK_BOARD_META } from '@/utils/dojoInspirationRank'
  import { ingestDayLabel } from '@/utils/dojoInspirationLayers'
  import { resolveSearchQueries } from '@/utils/dojoInspirationQueries'

  const RANK_MARKS = [
    '①',
    '②',
    '③',
    '④',
    '⑤',
    '⑥',
    '⑦',
    '⑧',
    '⑨',
    '⑩',
    '⑪',
    '⑫',
    '⑬',
    '⑭',
    '⑮',
    '⑯',
    '⑰',
    '⑱',
    '⑲',
    '⑳'
  ]
  const selectedView = ref<string>('outlier')
  const selectedBoardId = ref(dojoInspirationExplore.boards[0]?.id || '')
  const preview = ref<InspirationCandidate | null>(null)
  const refreshingAll = ref(false)
  const seedInput = ref('')
  const formOpen = ref(false)
  const editingBoardId = ref('')
  const algoFormOpen = ref(false)
  const editingAlgoKind = ref<RankBoardKind | ''>('')
  const historyDay = ref('')
  const form = reactive({
    name: '',
    queries: '',
    timeWindowDays: 7 as HotBoardWindow
  })
  const algoForm = reactive({
    name: '',
    hint: ''
  })

  const visibleAlgoPrefs = computed(() =>
    dojoInspirationRankStore.boardPrefs.filter(
      (item) => !item.hidden && item.kind !== 'trend'
    )
  )
  const hiddenAlgoPrefs = computed(() =>
    dojoInspirationRankStore.boardPrefs.filter(
      (item) => item.hidden && item.kind !== 'trend'
    )
  )
  const selectedBoard = computed(
    () =>
      dojoInspirationExplore.boards.find((board) => board.id === selectedBoardId.value) ||
      null
  )
  const boardDays = computed(() =>
    selectedBoard.value ? boardHistoryDays(selectedBoard.value.id) : []
  )
  const rankedItems = computed(() => {
    if (!selectedBoard.value) return []
    const snapshot = boardDays.value.find((item) => item.dayKey === historyDay.value)
    if (snapshot) return snapshot.items.slice(0, 10)
    return boardCandidates(selectedBoard.value.id).slice(0, 10)
  })
  const staleCount = computed(
    () =>
      dojoInspirationExplore.boards.filter(
        (board) => board.collectEnabled !== false && isBoardStale(board)
      ).length
  )
  const directionBoards = computed(() => dojoInspirationExplore.boards)
  const algo = computed(() => boardRows())
  const isAlgoView = computed(() =>
    visibleAlgoPrefs.value.some((item) => item.kind === selectedView.value)
  )
  const isQueryView = computed(() => selectedView.value === 'queries')
  const activeAlgo = computed(() =>
    isAlgoView.value ? (selectedView.value as RankBoardKind) : 'outlier'
  )
  const activeAlgoPref = computed(() =>
    dojoInspirationRankStore.boardPrefs.find((item) => item.kind === activeAlgo.value)
  )
  const algoRows = computed(() => {
    if (activeAlgo.value === 'outlier') return algo.value.outlier
    if (activeAlgo.value === 'velocity') return algo.value.velocity
    if (activeAlgo.value === 'breakout') return algo.value.breakout
    return []
  })

  watch(selectedBoard, (board) => {
    if (board && !isAlgoView.value && !isQueryView.value) selectedBoardId.value = board.id
    historyDay.value = boardHistoryDays(board?.id || '')[0]?.dayKey || ''
  })

  watch(
    () => visibleAlgoPrefs.value.map((item) => item.kind).join(','),
    () => {
      if (selectedView.value === 'trend') {
        selectedView.value = visibleAlgoPrefs.value[0]?.kind || 'outlier'
        return
      }
      const isAlgoKind = dojoInspirationRankStore.boardPrefs.some(
        (item) => item.kind === selectedView.value
      )
      if (
        isAlgoKind &&
        !visibleAlgoPrefs.value.some((item) => item.kind === selectedView.value)
      ) {
        selectedView.value = visibleAlgoPrefs.value[0]?.kind || 'queries'
      }
    },
    { immediate: true }
  )

  onMounted(() => {
    const seeds = dojoInspirationExplore.boards.flatMap((board) => board.queries)
    if (seeds.length) addSeedQueries(seeds, 'seed')
  })

  function resetForm() {
    editingBoardId.value = ''
    Object.assign(form, {
      name: '',
      queries: '',
      timeWindowDays: 7
    })
  }

  function openCreate() {
    resetForm()
    formOpen.value = true
  }

  function openEdit() {
    if (!selectedBoard.value) return
    editingBoardId.value = selectedBoard.value.id
    Object.assign(form, {
      name: selectedBoard.value.name,
      queries: selectedBoard.value.queries.join('\n'),
      timeWindowDays: selectedBoard.value.timeWindowDays
    })
    formOpen.value = true
  }

  async function handleSaveBoard() {
    try {
      const resolved = resolveSearchQueries(form.queries, { expand: true })
      if (!resolved.queries.length) {
        ElMessage.warning(resolved.hint || '请填写独立检索词，不要用项目名或品牌名凑数')
        return
      }
      if (editingBoardId.value) {
        patchHotBoard(editingBoardId.value, {
          name: form.name || resolved.queries[0],
          queries: resolved.queries,
          timeWindowDays: form.timeWindowDays
        })
        addSeedQueries(resolved.queries, 'seed')
        selectedBoardId.value = editingBoardId.value
        void handleRefresh(editingBoardId.value)
        ElMessage.success('方向已保存，正在更新前十')
      } else {
        const board = createHotBoard({
          name: form.name,
          queries: form.queries,
          timeWindowDays: form.timeWindowDays
        })
        addSeedQueries(board.queries, 'seed')
        selectedView.value = board.id
        selectedBoardId.value = board.id
        void handleRefresh(board.id)
        ElMessage.success('方向已加入方向榜，正在更新前十')
      }
      formOpen.value = false
      resetForm()
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '方向保存失败')
    }
  }

  async function handleRemoveBoard() {
    if (!selectedBoard.value) return
    if (selectedBoard.value.preset) {
      ElMessage.warning('默认榜不能删，和算法榜一样常驻；要改检索词用「编辑方向」')
      return
    }
    const board = selectedBoard.value
    try {
      await ElMessageBox.confirm(
        `删除检索方向「${board.name}」？已查出的前十也会清掉。`,
        '删除方向',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      removeHotBoard(board.id)
      selectedView.value = directionBoards.value[0]?.id || visibleAlgoPrefs.value[0]?.kind || 'queries'
      selectedBoardId.value = directionBoards.value[0]?.id || ''
      ElMessage.success('方向已删除')
    } catch {
      return
    }
  }

  async function handleRefresh(boardId: string) {
    try {
      await refreshHotBoard(boardId)
      ElMessage.success('榜单已按热度更新')
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '榜单更新失败')
    }
  }

  async function handleRefreshStale() {
    refreshingAll.value = true
    try {
      await refreshStaleBoards()
      ElMessage.success('过期榜单已更新')
    } finally {
      refreshingAll.value = false
    }
  }

  function handleSelect(boardId: string) {
    selectedView.value = boardId
    selectedBoardId.value = boardId
    const board = dojoInspirationExplore.boards.find((item) => item.id === boardId)
    if (
      board &&
      board.collectEnabled !== false &&
      isBoardStale(board) &&
      !dojoInspirationExplore.refreshingBoardId
    ) {
      void handleRefresh(boardId)
    }
  }

  function handleSelectAlgo(kind: RankBoardKind) {
    selectedView.value = kind
  }

  function handleToggleAlgoCollect(kind: RankBoardKind, event: Event) {
    event.stopPropagation()
    const pref = dojoInspirationRankStore.boardPrefs.find((item) => item.kind === kind)
    if (!pref || pref.hidden) return
    toggleRankBoardEnabled(kind)
  }

  function handleToggleDirectionCollect(boardId: string, event: Event) {
    event.stopPropagation()
    const board = dojoInspirationExplore.boards.find((item) => item.id === boardId)
    if (!board) return
    patchHotBoard(boardId, { collectEnabled: board.collectEnabled === false })
  }

  function openEditAlgo(kind: RankBoardKind) {
    const pref = dojoInspirationRankStore.boardPrefs.find((item) => item.kind === kind)
    if (!pref) return
    editingAlgoKind.value = kind
    Object.assign(algoForm, {
      name: pref.name,
      hint: pref.hint
    })
    algoFormOpen.value = true
    handleSelectAlgo(kind)
  }

  function handleSaveAlgo() {
    if (!editingAlgoKind.value) return
    patchRankBoardPref(editingAlgoKind.value, {
      name: algoForm.name,
      hint: algoForm.hint
    })
    algoFormOpen.value = false
    editingAlgoKind.value = ''
    ElMessage.success('榜单已更新')
  }

  async function handleHideAlgo(kind: RankBoardKind) {
    const pref = dojoInspirationRankStore.boardPrefs.find((item) => item.kind === kind)
    if (!pref) return
    try {
      await ElMessageBox.confirm(
        `把「${pref.name}」从列表拿掉？之后可以再加回来。本轮也不会用它抽词。`,
        '移出算法榜',
        {
          confirmButtonText: '移出',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      hideRankBoard(kind)
      ElMessage.success('榜单已移出')
    } catch {
      return
    }
  }

  function handleRestoreAlgo(kind: RankBoardKind) {
    restoreRankBoard(kind)
    selectedView.value = kind
    ElMessage.success('榜单已加回')
  }

  async function handleCycle() {
    try {
      const summary = await runRankCycle()
      await refreshEnabledBoards()
      ElMessage.success(
        `本轮搜了 ${summary?.queriesRun || 0} 个词，入库 ${summary?.postsIngested || 0} 条，新增 ${summary?.newQueries || 0} 个检索词`
      )
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '本轮抓取失败')
    }
  }

  function handleAddSeed() {
    const added = addSeedQueries([seedInput.value], 'seed')
    seedInput.value = ''
    if (!added) {
      ElMessage.warning('请填写独立检索词。项目品牌不会进入词池')
      return
    }
    ElMessage.success('已加入人工 Seed')
  }

  function handleVelocityWindow(hours: VelocityWindowHours) {
    setVelocityWindow(hours)
  }

  function previewRow(postId: string) {
    const row = algoRows.value.find((item) => item.post.postId === postId)
    if (!row) return
    preview.value = rankedCandidate(row.post)
  }

  function promoteRow(postId: string) {
    const row = algoRows.value.find((item) => item.post.postId === postId)
    if (!row) return
    handlePromote(rankedCandidate(row.post))
  }

  function originLabel(origin: string) {
    if (origin === 'seed') return '人工'
    if (origin === 'board') return '榜单'
    return '结果'
  }

  function handleWindow(days: HotBoardWindow) {
    if (!selectedBoard.value) return
    patchHotBoard(selectedBoard.value.id, { timeWindowDays: days })
    void handleRefresh(selectedBoard.value.id)
  }

  function handlePromote(candidate: InspirationCandidate) {
    const inspiration = promoteExploreCandidate(candidate)
    if (!inspiration) return
    ElMessage.success('已晋升到灵感库')
    preview.value = null
  }

  function formatMetric(value: number) {
    if (!value) return '—'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
    return value.toLocaleString('zh-CN')
  }

  function formatTime(value?: string) {
    if (!value) return '尚未更新'
    const stamp = Date.parse(value)
    if (!Number.isFinite(stamp)) return '尚未更新'
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(stamp)
  }

  function formatPublishDate(value?: string) {
    if (!value) return '—'
    const stamp = Date.parse(value)
    if (!Number.isFinite(stamp)) return '—'
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(stamp)
  }
</script>

<template>
  <section class="explore-surface">
    <aside class="explore-rail">
      <header>
        <div>
          <h2>固定榜单</h2>
          <p>勾选才采集。点名称只看结果。方向榜默认和你加的都在这里。</p>
        </div>
      </header>

      <button
        type="button"
        class="line-btn is-primary is-block"
        :disabled="dojoInspirationRankStore.cycling"
        @click="handleCycle"
      >
        {{ dojoInspirationRankStore.cycling ? '抓取中' : '跑一轮' }}
      </button>

      <p v-if="dojoInspirationRankStore.cycleMessage" class="cycle-note">
        {{ dojoInspirationRankStore.cycleMessage }}
      </p>

      <div class="rail-block">
        <header class="rail-subhead">
          <strong>算法榜</strong>
          <span class="rail-hint">勾选=本轮采集 · 点名称看结果</span>
        </header>
        <div class="board-grid">
          <div
            v-for="pref in visibleAlgoPrefs"
            :key="pref.kind"
            class="board-chip is-checkable"
            :class="{
              'is-active': selectedView === pref.kind,
              'is-off': !pref.enabled
            }"
          >
            <label class="board-check" :title="pref.enabled ? '参与本轮采集' : '本轮不采集'">
              <input
                type="checkbox"
                :checked="pref.enabled"
                @click="handleToggleAlgoCollect(pref.kind, $event)"
              />
              <span aria-hidden="true" />
            </label>
            <button
              type="button"
              class="board-chip__main"
              :title="pref.hint"
              @click="handleSelectAlgo(pref.kind)"
            >
              {{ pref.name }}
            </button>
          </div>
          <em v-if="!visibleAlgoPrefs.length" class="board-grid__empty">
            算法榜都已移出，可以从下面加回。
          </em>
        </div>
        <div v-if="hiddenAlgoPrefs.length" class="restore-row">
          <span>已移出</span>
          <button
            v-for="pref in hiddenAlgoPrefs"
            :key="pref.kind"
            type="button"
            class="line-btn is-ghost"
            @click="handleRestoreAlgo(pref.kind)"
          >
            加回 {{ pref.name }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="board-card is-pool"
        :class="{ 'is-active': isQueryView }"
        @click="selectedView = 'queries'"
      >
        <strong>检索词池</strong>
        <span>
          {{ dojoInspirationRankStore.queries.length }} 个词 · 高 Yield 续搜，低 Yield 暂停
        </span>
      </button>

      <div class="rail-block">
        <header class="rail-subhead is-stack">
          <div class="rail-subhead__row">
            <strong>方向榜</strong>
            <span class="rail-hint">勾选=搜索 · 点名称看前十</span>
          </div>
          <button type="button" class="line-btn is-ghost is-block" @click="openCreate">
            添加方向
          </button>
        </header>
        <div class="board-grid">
          <div
            v-for="board in directionBoards"
            :key="board.id"
            class="board-chip is-checkable"
            :class="{
              'is-active': !isAlgoView && !isQueryView && selectedBoard?.id === board.id,
              'is-custom': !board.preset,
              'is-off': board.collectEnabled === false
            }"
          >
            <label
              class="board-check"
              :title="board.collectEnabled === false ? '本轮不搜索' : '参与搜索'"
            >
              <input
                type="checkbox"
                :checked="board.collectEnabled !== false"
                @click="handleToggleDirectionCollect(board.id, $event)"
              />
              <span aria-hidden="true" />
            </label>
            <button
              type="button"
              class="board-chip__main"
              :title="board.queries.join(' / ')"
              @click="handleSelect(board.id)"
            >
              <span>{{ board.name }}</span>
              <small v-if="!board.preset">自定义</small>
            </button>
          </div>
        </div>
      </div>

      <form v-if="formOpen" class="explore-form" @submit.prevent="handleSaveBoard">
        <input v-model="form.name" type="text" placeholder="方向名称，例如通勤场景" />
        <textarea
          v-model="form.queries"
          rows="3"
          placeholder="主检索词写第一行。备用词另起一行；平时只搜主词，搜不够才用备用或 AI 联想。"
        />
        <select v-model.number="form.timeWindowDays">
          <option :value="7">近 7 天</option>
          <option :value="30">近 30 天</option>
        </select>
        <div class="explore-form__row">
          <button type="submit" class="line-btn is-primary">
            {{ editingBoardId ? '保存方向' : '加入方向榜' }}
          </button>
          <button type="button" class="line-btn is-ghost" @click="formOpen = false">
            取消
          </button>
        </div>
      </form>

      <form
        v-if="algoFormOpen"
        class="explore-form"
        @submit.prevent="handleSaveAlgo"
      >
        <input v-model="algoForm.name" type="text" placeholder="榜单名称" />
        <textarea v-model="algoForm.hint" rows="2" placeholder="这张榜看什么" />
        <div class="explore-form__row">
          <button type="submit" class="line-btn is-primary">保存榜单</button>
          <button type="button" class="line-btn is-ghost" @click="algoFormOpen = false">
            取消
          </button>
        </div>
      </form>

      <div v-if="staleCount" class="stale-bar">
        <span>{{ staleCount }} 个方向超过 8 小时未单独更新</span>
        <button type="button" :disabled="refreshingAll" @click="handleRefreshStale">
          {{ refreshingAll ? '更新中' : '更新过期方向' }}
        </button>
      </div>
    </aside>

    <section v-if="isAlgoView" class="explore-main">
      <header>
        <div>
          <h2>{{ activeAlgoPref?.name || RANK_BOARD_META[activeAlgo].name }}</h2>
          <p>
            {{ activeAlgoPref?.hint || RANK_BOARD_META[activeAlgo].hint }}。
            数据来自检索词池的同一轮抓取，不另开接口。
            <template v-if="activeAlgoPref && !activeAlgoPref.enabled">
              这张榜未勾选采集，本轮不跑。左侧对勾打开后会再进本轮。
            </template>
          </p>
        </div>
        <div class="explore-main__tools">
          <div v-if="activeAlgo === 'velocity'" class="window-switch" role="group" aria-label="加速窗口">
            <button
              type="button"
              :class="{ 'is-active': dojoInspirationRankStore.velocityWindowHours === 24 }"
              @click="handleVelocityWindow(24)"
            >
              24 小时
            </button>
            <button
              type="button"
              :class="{ 'is-active': dojoInspirationRankStore.velocityWindowHours === 72 }"
              @click="handleVelocityWindow(72)"
            >
              72 小时
            </button>
            <button
              type="button"
              :class="{ 'is-active': dojoInspirationRankStore.velocityWindowHours === 168 }"
              @click="handleVelocityWindow(168)"
            >
              7 天
            </button>
          </div>
          <button type="button" class="line-btn is-ghost" @click="openEditAlgo(activeAlgo)">
            改这张榜
          </button>
          <button type="button" class="line-btn is-danger" @click="handleHideAlgo(activeAlgo)">
            移出
          </button>
          <button
            type="button"
            class="line-btn is-primary"
            :disabled="dojoInspirationRankStore.cycling"
            @click="handleCycle"
          >
            {{ dojoInspirationRankStore.cycling ? '抓取中' : '跑一轮' }}
          </button>
        </div>
      </header>

      <ol v-if="algoRows.length" class="rank-list">
        <li v-for="(row, index) in algoRows" :key="row.post.postId">
          <em>{{ RANK_MARKS[index] || index + 1 }}</em>
          <div>
            <strong>{{ row.post.title }}</strong>
            <span>
              {{ row.post.creatorHandle }} · 粉 {{ formatMetric(row.post.followers) }} ·
              播放 {{ formatMetric(row.post.views) }} · 基线
              {{ formatMetric(row.baseline) }} · 异常 {{ row.outlierRatio.toFixed(1) }}x
              <template v-if="activeAlgo === 'velocity'">
                · 速度 {{ Math.round(row.velocity) }}/时
              </template>
              <template v-if="activeAlgo === 'breakout'">
                · 播/粉 {{ row.followerRatio.toFixed(1) }}
              </template>
            </span>
          </div>
          <div class="rank-list__actions">
            <button type="button" @click="previewRow(row.post.postId)">预览</button>
            <button type="button" class="is-primary" @click="promoteRow(row.post.postId)">
              晋升灵感
            </button>
          </div>
        </li>
      </ol>

      <div v-else class="explore-empty">
        <Icon icon="ph:chart-line-up" width="24" />
        <strong>这张榜还是空的</strong>
        <span>
          左侧对勾打开后点「跑一轮」。词池空着时会先用海外成品方向多搜一轮。
        </span>
      </div>
    </section>

    <section v-else-if="isQueryView" class="explore-main">
      <header>
        <div>
          <h2>检索词池</h2>
          <p>只接受人工 Seed、榜单高分内容、高质量结果里长出的新词。AI 不会凭空编词。</p>
        </div>
      </header>
      <form class="explore-form is-inline" @submit.prevent="handleAddSeed">
        <input v-model="seedInput" type="text" placeholder="人工 Seed，例如 unboxing" />
        <button type="submit" class="line-btn is-primary">加入 Seed</button>
      </form>
      <ol v-if="dojoInspirationRankStore.queries.length" class="query-list">
        <li v-for="query in dojoInspirationRankStore.queries" :key="query.id">
          <div>
            <strong>{{ query.text }}</strong>
            <span>
              {{ originLabel(query.origin) }} · Yield {{ (query.yield * 100).toFixed(0) }}% ·
              得分 {{ query.score.toFixed(2) }} · {{ query.status === 'paused' ? '已暂停' : query.status }}
            </span>
          </div>
          <div class="rank-list__actions">
            <button type="button" @click="pauseRankQuery(query.id)">
              {{ query.status === 'paused' ? '恢复' : '暂停' }}
            </button>
            <button type="button" class="is-danger" @click="removeRankQuery(query.id)">移出</button>
          </div>
        </li>
      </ol>
      <div v-else class="explore-empty">
        <strong>还没有检索词</strong>
        <span>词池空着时，跑一轮会先用 unboxing / vlog 这类成品方向多搜。</span>
      </div>
    </section>

    <section v-else-if="selectedBoard" class="explore-main">
      <header>
        <div>
          <h2>{{ selectedBoard.name }}</h2>
          <p>
            {{
              selectedBoard.message ||
              `检索 ${selectedBoard.queries.join(' / ')}，按热度排出前十。`
            }}
          </p>
        </div>
        <div class="explore-main__tools">
          <div class="window-switch" role="group" aria-label="时间窗">
            <button
              type="button"
              :class="{ 'is-active': selectedBoard.timeWindowDays === 7 }"
              @click="handleWindow(7)"
            >
              近 7 天
            </button>
            <button
              type="button"
              :class="{ 'is-active': selectedBoard.timeWindowDays === 30 }"
              @click="handleWindow(30)"
            >
              近 30 天
            </button>
          </div>
          <button type="button" class="line-btn is-ghost" @click="openEdit">编辑方向</button>
          <button
            v-if="!selectedBoard.preset"
            type="button"
            class="line-btn is-danger"
            @click="handleRemoveBoard"
          >
            删除
          </button>
          <button
            type="button"
            class="line-btn is-primary"
            :disabled="dojoInspirationExplore.refreshingBoardId === selectedBoard.id"
            @click="handleRefresh(selectedBoard.id)"
          >
            {{
              dojoInspirationExplore.refreshingBoardId === selectedBoard.id
                ? '更新中'
                : '更新榜单'
            }}
          </button>
        </div>
      </header>

      <nav v-if="boardDays.length" class="day-switch" aria-label="近 7 天排名">
        <button
          v-for="day in boardDays"
          :key="day.dayKey"
          type="button"
          :class="{ 'is-active': historyDay === day.dayKey }"
          @click="historyDay = day.dayKey"
        >
          {{ ingestDayLabel(day.dayKey) }}
        </button>
      </nav>

      <ol v-if="rankedItems.length" class="rank-list">
        <li v-for="(candidate, index) in rankedItems" :key="candidate.id">
          <em>{{ RANK_MARKS[index] || index + 1 }}</em>
          <div>
            <strong>{{ candidate.title }}</strong>
            <span>
              {{ candidate.author }} · 热度 {{ candidateScores(candidate, 'hot').heat }} ·
              播放 {{ formatMetric(candidate.views) }}
            </span>
          </div>
          <div class="rank-list__actions">
            <button type="button" @click="preview = candidate">预览</button>
            <button type="button" @click="setCandidateStatus(candidate.id, 'rejected')">
              忽略
            </button>
            <button
              type="button"
              class="is-primary"
              :disabled="candidate.status === 'promoted'"
              @click="handlePromote(candidate)"
            >
              {{ candidate.status === 'promoted' ? '已入库' : '晋升灵感' }}
            </button>
          </div>
        </li>
      </ol>
      <div v-else class="explore-empty">
        <Icon icon="ph:chart-line-up" width="24" />
        <strong>这个榜单还是空的</strong>
        <span>点右上角「更新榜单」，会按热度排出近 {{ selectedBoard.timeWindowDays }} 天的前十名。</span>
      </div>
    </section>
    <div v-else class="explore-empty is-page">
      <strong>选一张默认方向或算法榜</strong>
      <span>点左侧方向榜任意一项，或用「添加方向」加进同一张榜。</span>
    </div>

    <ElDialog
      :model-value="Boolean(preview)"
      title="榜单视频预览"
      width="min(1120px, calc(100vw - 32px))"
      destroy-on-close
      @close="preview = null"
    >
      <VideoPreviewPanel
        v-if="preview"
        tall
        :title="preview.title"
        :url="preview.url"
        :author="preview.author"
        :metrics="[
          { label: '播放', value: formatMetric(preview.views) },
          { label: '点赞', value: formatMetric(preview.likes) },
          { label: '评论量', value: formatMetric(preview.comments) },
          { label: '热度', value: String(candidateScores(preview, 'hot').heat) },
          { label: '发布时间', value: formatPublishDate(preview.publishedAt) }
        ]"
        eyebrow="HOT BOARD"
      />
      <template v-if="preview" #footer>
        <ElButton @click="preview = null">关闭</ElButton>
        <ElButton type="primary" @click="handlePromote(preview)">晋升灵感</ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped lang="scss">
  .explore-surface {
    display: grid;
    grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 15px;
    box-shadow: 0 12px 32px rgb(31 35 40 / 7%);
  }

  .explore-rail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 18px 14px;
    overflow: hidden auto;
    background: var(--dojo-paper-muted);
    border-right: 1px solid var(--dojo-line);
  }

  .explore-rail > header,
  .explore-main > header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .explore-rail h2,
  .explore-main h2,
  .explore-rail p,
  .explore-main p {
    margin: 0;
  }

  .explore-rail h2,
  .explore-main h2 {
    font-size: 18px;
  }

  .explore-rail p,
  .explore-main p {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .line-btn {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: max-content;
    height: 34px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    writing-mode: horizontal-tb;
    word-break: keep-all;
    cursor: pointer;
    border: 0;
    border-radius: 8px;
  }

  .line-btn.is-block {
    width: 100%;
    margin-top: 12px;
  }

  .line-btn.is-primary {
    color: #fff;
    background: var(--dojo-accent);
  }

  .line-btn.is-ghost {
    color: var(--dojo-ink);
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
  }

  .line-btn.is-danger {
    color: #9b2c2c;
    background: #fdecec;
  }

  .line-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .explore-form,
  .stale-bar {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }

  .explore-form.is-inline {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .explore-form__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .board-list > em {
    font-size: 11px;
    font-style: normal;
    color: var(--dojo-muted);
  }

  .explore-empty.is-page {
    display: grid;
    place-content: center;
    min-height: 0;
  }

  .explore-main__tools > button:not(.line-btn):not(.is-primary):not(.is-danger) {
    height: 32px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: #f4f7fa;
    border: 0;
    border-radius: 8px;
    white-space: nowrap;
  }

  .board-list {
    display: grid;
    flex: 1;
    gap: 8px;
    align-content: start;
    margin-top: 14px;
    overflow: auto;
  }

  .explore-form input,
  .explore-form textarea,
  .explore-form select {
    width: 100%;
    padding: 8px 9px;
    font: inherit;
    font-size: 11px;
    color: var(--dojo-ink);
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 7px;
  }

  .explore-form button:not(.line-btn),
  .stale-bar button {
    min-height: 32px;
    padding: 0 12px;
    font-size: 11px;
    color: var(--dojo-ink);
    white-space: nowrap;
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .stale-bar {
    padding: 10px;
    background: #fff6e8;
    border: 1px solid #ead7b4;
    border-radius: 10px;
  }

  .stale-bar span {
    font-size: 11px;
    color: #8a6418;
  }

  .board-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
    padding: 0 10px;
    text-align: left;
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 9px;
  }

  .board-card.is-active {
    border-color: var(--dojo-accent-soft);
    box-shadow: 0 0 0 3px rgb(47 111 237 / 8%);
  }

  .board-card span,
  .board-card small {
    overflow: hidden;
    font-size: 10px;
    color: var(--dojo-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .board-card small {
    display: none;
  }

  .board-card strong {
    flex-shrink: 0;
    font-size: 13px;
    white-space: nowrap;
  }

  .explore-main {
    min-width: 0;
    min-height: 0;
    padding: 20px 22px 28px;
    overflow: auto;
  }

  .explore-main__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .window-switch {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .window-switch button,
  .rank-list__actions button {
    height: 32px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-ink);
    white-space: nowrap;
    cursor: pointer;
    background: #f4f7fa;
    border: 0;
  }

  .window-switch button.is-active {
    color: #fff;
    background: var(--dojo-accent);
  }

  .explore-main__tools .is-danger {
    color: #9b2c2c;
    background: #fdecec;
    border-radius: 8px;
  }

  .rank-list {
    display: grid;
    gap: 8px;
    padding: 0;
    margin: 18px 0 0;
    list-style: none;
  }

  .rank-list li {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 11px;
  }

  .rank-list em {
    font-size: 22px;
    font-style: normal;
    font-weight: 650;
    line-height: 1;
    color: var(--dojo-accent);
    text-align: center;
  }

  .rank-list strong,
  .rank-list span {
    display: block;
  }

  .rank-list strong {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank-list span {
    margin-top: 4px;
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .rank-list__actions {
    display: flex;
    gap: 6px;
  }

  .rank-list__actions .is-primary {
    color: #fff;
    background: var(--dojo-accent);
    border-radius: 7px;
    white-space: nowrap;
  }

  .explore-empty {
    display: grid;
    gap: 8px;
    justify-items: center;
    padding: 72px 20px;
    margin-top: 18px;
    color: var(--dojo-muted);
    text-align: center;
    border: 1px dashed var(--dojo-line);
    border-radius: 12px;
  }

  .cycle-note {
    margin-top: 10px;
    font-size: 11px;
    color: var(--dojo-accent);
  }

  .rail-block {
    margin-top: 14px;
  }

  .rail-block > strong,
  .rail-subhead strong {
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .rail-subhead {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
  }

  .rail-subhead.is-stack {
    flex-direction: column;
    align-items: stretch;
  }

  .rail-subhead__row {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .rail-subhead p {
    margin-top: 4px;
  }

  .rail-hint {
    font-size: 10px;
    color: var(--dojo-muted);
    white-space: nowrap;
  }

  .board-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .board-grid__empty {
    grid-column: 1 / -1;
    font-size: 11px;
    font-style: normal;
    color: var(--dojo-muted);
  }

  .board-chip {
    display: grid;
    gap: 2px;
    min-height: 40px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.2;
    color: var(--dojo-ink);
    text-align: left;
    cursor: pointer;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
  }

  .board-chip.is-checkable {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 6px 8px 6px 8px;
    cursor: default;
  }

  .board-chip__main {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.2;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .board-check {
    position: relative;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .board-check input {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }

  .board-check span {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    background: #fff;
    border: 1.5px solid #b8b0ae;
    border-radius: 4px;
  }

  .board-check input:checked + span {
    background: var(--dojo-accent);
    border-color: var(--dojo-accent);
  }

  .board-check input:checked + span::after {
    content: '';
    width: 4px;
    height: 8px;
    margin-top: -1px;
    border: solid #fff;
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }

  .board-chip small {
    font-size: 10px;
    font-weight: 500;
    color: var(--dojo-muted);
  }

  .board-chip.is-active {
    color: #fff;
    background: var(--dojo-accent);
    border-color: var(--dojo-accent);
  }

  .board-chip.is-active .board-check span {
    background: #fff;
    border-color: #fff;
  }

  .board-chip.is-active .board-check input:checked + span {
    background: #fff;
    border-color: #fff;
  }

  .board-chip.is-active .board-check input:checked + span::after {
    border-color: var(--dojo-accent);
  }

  .board-chip.is-active small {
    color: rgba(255, 255, 255, 0.82);
  }

  .board-chip.is-custom {
    border-style: dashed;
  }

  .board-chip.is-off {
    opacity: 0.55;
  }

  .board-card.is-pool {
    margin-top: 14px;
  }

  .board-row {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 0 10px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 9px;
    transition: opacity 0.18s ease, border-color 0.18s ease;
  }

  .board-row.is-active {
    border-color: var(--dojo-accent);
  }

  .board-row.is-off {
    opacity: 0.32;
  }

  .board-row__main {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 36px;
    padding: 0;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .board-row__main strong {
    font-size: 13px;
    line-height: 1;
    white-space: nowrap;
  }

  .suggest-row,
  .day-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .custom-empty {
    display: block;
    margin-top: 4px;
    color: color-mix(in srgb, var(--dojo-muted) 88%, transparent);
    font-size: 12px;
    font-style: normal;
  }

  .suggest-row .line-btn,
  .day-switch button {
    height: 28px;
    padding: 0 10px;
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
  }

  .day-switch {
    margin-top: 14px;
  }

  .day-switch button {
    color: var(--dojo-ink);
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 7px;
  }

  .day-switch button.is-active {
    color: #fff;
    background: var(--dojo-accent);
  }

  .restore-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 10px;
  }

  .restore-row span {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .restore-row .line-btn {
    height: 28px;
    padding: 0 10px;
    font-size: 11px;
  }

  .is-ghost {
    height: 28px;
    padding: 0 8px;
    font-size: 10px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 8px;
  }

  .board-list.is-compact {
    flex: 0 0 auto;
    margin-top: 8px;
  }

  .query-list {
    display: grid;
    gap: 8px;
    padding: 0;
    margin: 18px 0 0;
    list-style: none;
  }

  .query-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 11px;
  }

  .query-list strong,
  .query-list span {
    display: block;
  }

  .query-list span {
    margin-top: 4px;
    font-size: 11px;
    color: var(--dojo-muted);
  }

  .query-list .is-danger {
    color: #9b2c2c;
    background: #fdecec;
    border-radius: 7px;
  }

  @container workspace (max-width: 720px) {
    .explore-surface {
      grid-template-columns: 1fr;
    }

    .explore-rail {
      border-right: 0;
      border-bottom: 1px solid var(--dojo-line);
    }

    .rank-list li {
      grid-template-columns: 28px minmax(0, 1fr);
    }

    .rank-list__actions {
      grid-column: 1 / -1;
    }
  }
</style>
