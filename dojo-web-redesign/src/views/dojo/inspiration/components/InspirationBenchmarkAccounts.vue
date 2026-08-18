<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { Icon } from '@iconify/vue'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import VideoPreviewPanel from '@/components/dojo/VideoPreviewPanel.vue'
  import { extractAccountHandle } from '@/api/tiktok'
  import { dojoAccountStore } from '@/store/dojoAccountStore'
  import {
    accountCandidates,
    addBenchmarkAccount,
    dojoInspirationExplore,
    patchBenchmarkAccount,
    promoteExploreCandidate,
    removeBenchmarkAccount,
    syncBenchmarkAccount
  } from '@/store/dojoInspirationExplore'
  import { dojoInspirationStore } from '@/store/dojoInspirationStore'
  import type { InspirationCandidate } from '@/types/dojoInspiration'
  import { candidateScores } from '@/utils/dojoInspirationRanking'

  const props = withDefaults(
    defineProps<{
      layout?: 'feed' | 'cards'
    }>(),
    {
      layout: 'cards'
    }
  )

  const route = useRoute()
  const selectedId = ref(
    props.layout === 'cards' ? '' : dojoInspirationExplore.accounts[0]?.id || ''
  )
  const preview = ref<InspirationCandidate | null>(null)
  const viewMode = ref<'all' | 'library'>('all')
  const editOpen = ref(false)
  const editingAccountId = ref('')
  const form = reactive({
    handle: ''
  })
  const editForm = reactive({
    nickname: '',
    note: ''
  })

  const isCardsHome = computed(() => props.layout === 'cards' && !selectedId.value)
  const selected = computed(() => {
    const hit = dojoInspirationExplore.accounts.find((item) => item.id === selectedId.value)
    if (hit) return hit
    if (props.layout === 'cards') return null
    return dojoInspirationExplore.accounts[0] || null
  })
  const videos = computed(() => (selected.value ? accountCandidates(selected.value.id) : []))
  const visibleVideos = computed(() => {
    if (viewMode.value === 'all') return videos.value
    return videos.value.filter((item) => inInspirationLibrary(item.id))
  })
  const matrixHandles = computed(() =>
    dojoAccountStore.accounts
      .map((account) => account.handle)
      .filter(
        (handle) =>
          !dojoInspirationExplore.accounts.some(
            (item) => item.handle.toLowerCase() === handle.toLowerCase()
          )
      )
      .slice(0, 12)
  )
  const savedCount = computed(
    () => videos.value.filter((item) => inInspirationLibrary(item.id)).length
  )

  watch(
    () => [route.query.account, dojoInspirationExplore.focusedAccountId],
    () => {
      const raw = String(route.query.account || '')
      const handle = extractAccountHandle(raw, raw)
      const focused = dojoInspirationExplore.accounts.find(
        (item) => item.id === dojoInspirationExplore.focusedAccountId
      )
      const matched =
        focused ||
        dojoInspirationExplore.accounts.find((item) => {
          const current = item.handle.replace(/^@/, '').toLowerCase()
          return current === handle.toLowerCase() || item.handle.toLowerCase() === raw.toLowerCase()
        })
      if (!matched) return
      selectedId.value = matched.id
      if (!accountCandidates(matched.id).length) void handleSync(matched.id)
    },
    { immediate: true }
  )

  function handleAdd() {
    const account = addBenchmarkAccount({ ...form })
    if (!account) {
      ElMessage.warning('请填写有效的 TikTok 账号或主页链接')
      return
    }
    form.handle = ''
    if (props.layout === 'feed') selectedId.value = account.id
    void handleSync(account.id)
    ElMessage.success(`已加入 ${account.handle}`)
  }

  function importMatrix(handle: string) {
    const account = addBenchmarkAccount({
      handle
    })
    if (!account) return
    if (props.layout === 'feed') selectedId.value = account.id
    void handleSync(account.id)
  }

  function openAccount(accountId: string) {
    selectedId.value = accountId
    if (!accountCandidates(accountId).length) void handleSync(accountId)
  }

  function backToCards() {
    selectedId.value = ''
    preview.value = null
  }

  function openEdit(accountId: string) {
    const account = dojoInspirationExplore.accounts.find((item) => item.id === accountId)
    if (!account) return
    editingAccountId.value = account.id
    Object.assign(editForm, {
      nickname: account.nickname || '',
      note: account.note || ''
    })
    editOpen.value = true
  }

  function saveEdit() {
    if (!editingAccountId.value) return
    patchBenchmarkAccount(editingAccountId.value, {
      nickname: editForm.nickname,
      note: editForm.note
    })
    editOpen.value = false
    ElMessage.success('账号资料已更新')
  }

  async function handleRemove(accountId: string) {
    const account = dojoInspirationExplore.accounts.find((item) => item.id === accountId)
    if (!account) return
    try {
      await ElMessageBox.confirm(`把 ${account.handle} 移出对标库？作品不会写回 TikTok。`, '移出账号', {
        confirmButtonText: '移出',
        cancelButtonText: '取消',
        type: 'warning'
      })
      removeBenchmarkAccount(accountId)
      if (selectedId.value === accountId) {
        selectedId.value =
          props.layout === 'cards' ? '' : dojoInspirationExplore.accounts[0]?.id || ''
      }
      ElMessage.success('账号已移出对标库')
    } catch {
      return
    }
  }

  async function handleSync(accountId: string) {
    try {
      await syncBenchmarkAccount(accountId)
      ElMessage.success('账号作品已同步')
    } catch (error) {
      ElMessage.warning(error instanceof Error ? error.message : '同步失败')
    }
  }

  function inInspirationLibrary(candidateId: string) {
    return dojoInspirationStore.executableInspirations.some(
      (item) => item.candidateId === candidateId
    )
  }

  function handleSave(candidate: InspirationCandidate) {
    if (inInspirationLibrary(candidate.id)) {
      ElMessage.info('这条视频已经在灵感库')
      return
    }
    const inspiration = promoteExploreCandidate(candidate)
    if (!inspiration) {
      ElMessage.warning('暂时无法加入灵感库')
      return
    }
    ElMessage.success('已把这条视频加入灵感库。账号仍留在对标库')
  }

  function coverOf(candidate: InspirationCandidate) {
    return String(candidate.rawPayload?.cover || '')
  }

  function formatMetric(value: number) {
    if (!value) return '—'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
    return value.toLocaleString('zh-CN')
  }

  function formatFollowers(value?: number) {
    if (value == null || value === 0) return '—'
    return value.toLocaleString('zh-CN')
  }

  function homeLink(handle: string) {
    const clean = handle.replace(/^@/, '').trim()
    return clean ? `https://www.tiktok.com/@${clean}` : ''
  }
</script>

<template>
  <div class="benchmark-root">
  <section v-if="isCardsHome" class="cards-surface">
    <header class="cards-surface__head">
      <div>
        <h2>对标账号</h2>
        <p>和账号库同一套卡片。点进去再看作品。看中的视频加入灵感库，账号留在这里。</p>
      </div>
      <strong>{{ dojoInspirationExplore.accounts.length }} 个账号</strong>
    </header>

    <form class="explore-form cards-form" @submit.prevent="handleAdd">
      <input v-model="form.handle" type="text" placeholder="@handle 或主页链接" />
      <button type="submit" class="line-btn is-primary">加入对标库</button>
    </form>

    <div v-if="matrixHandles.length" class="import-row">
      <span>从账号矩阵快加</span>
      <button
        v-for="handle in matrixHandles"
        :key="handle"
        type="button"
        @click="importMatrix(handle)"
      >
        {{ handle }}
      </button>
    </div>

    <div v-if="dojoInspirationExplore.accounts.length" class="account-grid">
      <article
        v-for="account in dojoInspirationExplore.accounts"
        :key="account.id"
        class="acc-card"
        @click="openAccount(account.id)"
      >
        <div class="acc-card__top">
          <ElTag size="small" type="danger" effect="plain">TikTok</ElTag>
          <button type="button" class="acc-card__edit" @click.stop="openEdit(account.id)">
            改资料
          </button>
        </div>
        <h3>{{ account.nickname || account.handle }}</h3>
        <p class="acc-card__handle">{{ account.handle }}</p>
        <p class="acc-card__note" :class="{ 'is-empty': !account.note }">
          {{ account.note || '未写备注' }}
        </p>
        <dl class="acc-card__kv">
          <div>
            <dt>粉丝数</dt>
            <dd>{{ formatFollowers(account.followers) }}</dd>
          </div>
          <div>
            <dt>已发布视频</dt>
            <dd>{{ account.videoCount ?? 0 }}</dd>
          </div>
        </dl>
        <footer class="acc-card__foot" @click.stop>
          <a
            v-if="homeLink(account.handle)"
            :href="homeLink(account.handle)"
            target="_blank"
            rel="noreferrer"
          >
            打开主页
          </a>
          <span v-else class="muted">无主页</span>
          <span class="acc-card__ops">
            <button type="button" class="is-danger" @click="handleRemove(account.id)">
              移出
            </button>
            <button type="button" class="is-link" @click="openAccount(account.id)">
              看作品 →
            </button>
          </span>
        </footer>
      </article>
    </div>
    <div v-else class="explore-empty">
      <Icon icon="ph:user-circle" width="24" />
      <strong>还没有对标账号</strong>
      <span>粘贴 @handle 或从账号矩阵快加。卡片适合账号多了以后加减改。</span>
    </div>
  </section>

  <section v-else class="explore-surface">
    <aside class="explore-rail">
      <header>
        <div>
          <h2>对标库</h2>
          <p>筛出这个号，是因为他发的内容大多能拿来用。没有别的分层。</p>
        </div>
      </header>

      <form class="explore-form" @submit.prevent="handleAdd">
        <input v-model="form.handle" type="text" placeholder="@handle 或主页链接" />
        <button type="submit" class="line-btn is-primary">加入对标库</button>
      </form>

      <div v-if="matrixHandles.length" class="import-row">
        <span>从账号矩阵快加</span>
        <button
          v-for="handle in matrixHandles"
          :key="handle"
          type="button"
          @click="importMatrix(handle)"
        >
          {{ handle }}
        </button>
      </div>

      <div class="account-list">
        <button
          v-for="account in dojoInspirationExplore.accounts"
          :key="account.id"
          type="button"
          class="account-card"
          :class="{ 'is-active': selected?.id === account.id }"
          @click="selectedId = account.id"
        >
          <strong>{{ account.handle }}</strong>
          <span>
            {{ formatFollowers(account.followers) }} ·
            {{ account.videoCount ?? 0 }} 条
          </span>
        </button>
        <em v-if="!dojoInspirationExplore.accounts.length">还没有对标账号</em>
      </div>
    </aside>

    <section v-if="selected" class="explore-main">
      <header>
        <div>
          <button
            v-if="layout === 'cards'"
            type="button"
            class="back-link"
            @click="backToCards"
          >
            返回账号卡片
          </button>
          <h2>{{ selected.handle }}</h2>
          <p>
            看中的视频加入灵感库。账号留在这里。
            <template v-if="selected.nickname"> · {{ selected.nickname }}</template>
            <template v-if="selected.message"> · {{ selected.message }}</template>
          </p>
        </div>
        <div class="explore-main__tools">
          <button
            type="button"
            class="line-btn is-primary"
            :disabled="dojoInspirationExplore.syncingAccountId === selected.id"
            @click="handleSync(selected.id)"
          >
            {{
              dojoInspirationExplore.syncingAccountId === selected.id ? '同步中' : '同步作品'
            }}
          </button>
          <button type="button" class="line-btn is-danger" @click="handleRemove(selected.id)">
            移出账号
          </button>
          <button
            v-if="layout === 'cards'"
            type="button"
            class="line-btn is-ghost"
            @click="openEdit(selected.id)"
          >
            改资料
          </button>
        </div>
      </header>

      <nav class="view-switch" aria-label="作品范围">
        <button
          type="button"
          :class="{ 'is-active': viewMode === 'all' }"
          @click="viewMode = 'all'"
        >
          全部作品 {{ videos.length }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': viewMode === 'library' }"
          @click="viewMode = 'library'"
        >
          已进灵感库 {{ savedCount }}
        </button>
      </nav>

      <div v-if="visibleVideos.length" class="video-grid">
        <article v-for="candidate in visibleVideos" :key="candidate.id" class="video-card">
          <button type="button" class="video-card__cover" @click="preview = candidate">
            <img v-if="coverOf(candidate)" :src="coverOf(candidate)" :alt="candidate.title" />
            <span v-else>{{ candidate.title.slice(0, 18) }}</span>
          </button>
          <div class="video-card__body">
            <strong>{{ candidate.title }}</strong>
            <span>
              {{ candidate.publishedAt || '日期待回填' }} ·
              播放 {{ formatMetric(candidate.views) }} ·
              热度 {{ candidateScores(candidate, 'hot').heat }}
            </span>
            <div class="video-card__actions">
              <button type="button" @click="preview = candidate">预览</button>
              <button
                type="button"
                :class="{ 'is-saved': inInspirationLibrary(candidate.id) }"
                @click="handleSave(candidate)"
              >
                {{ inInspirationLibrary(candidate.id) ? '已进灵感库' : '加入灵感库' }}
              </button>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="explore-empty">
        <Icon icon="ph:squares-four" width="24" />
        <strong>{{ viewMode === 'library' ? '这个号还没有视频进灵感库' : '还没拉这个号的作品' }}</strong>
        <span>
          {{
            viewMode === 'library'
              ? '对标库只留账号。看中的视频加入灵感库，再去改脚本。'
              : '同步后按卡片看作品。看中的视频加入灵感库，账号留在这里。'
          }}
        </span>
      </div>
    </section>

    <div v-else class="explore-empty is-page">
      <strong>先加一个对标账号</strong>
      <span>可从灵感库点主页加入，或在这里粘贴 @handle / 主页链接。</span>
    </div>
  </section>

    <ElDialog
      :model-value="Boolean(preview)"
      title="对标视频预览"
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
          { label: '热度', value: String(candidateScores(preview, 'hot').heat) }
        ]"
        eyebrow="BENCHMARK"
      />
      <template v-if="preview" #footer>
        <ElButton @click="preview = null">关闭</ElButton>
        <ElButton type="primary" @click="handleSave(preview)">
          {{ inInspirationLibrary(preview.id) ? '已进灵感库' : '加入灵感库' }}
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="editOpen" title="改账号资料" width="min(480px, calc(100vw - 32px))">
      <ElForm label-position="top">
        <ElFormItem label="备注名">
          <ElInput v-model="editForm.nickname" placeholder="方便辨认的名字，可空" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput
            v-model="editForm.note"
            type="textarea"
            :rows="3"
            placeholder="为什么对标这个号，可空"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveEdit">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped lang="scss">
  .benchmark-root {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .cards-surface,
  .explore-surface {
    display: grid;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 15px;
    box-shadow: 0 12px 32px rgb(31 35 40 / 7%);
  }

  .explore-surface {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }

  .cards-surface {
    align-content: start;
    gap: 16px;
    padding: 20px 22px 24px;
    overflow: auto;
  }

  .cards-surface__head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .cards-surface__head h2,
  .cards-surface__head p,
  .cards-surface__head strong {
    margin: 0;
  }

  .cards-surface__head h2 {
    font-size: 18px;
  }

  .cards-surface__head p {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .cards-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    margin-top: 0;
  }

  .account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .acc-card {
    padding: 14px 16px;
    cursor: pointer;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 12px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--dojo-accent-soft);
      box-shadow: 0 4px 16px rgb(31 35 40 / 6%);
    }

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
    }
  }

  .acc-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .acc-card__edit,
  .acc-card__ops button {
    height: 28px;
    padding: 0 10px;
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 7px;
  }

  .acc-card__handle {
    margin: 4px 0 6px;
    font-size: 13px;
    color: var(--dojo-muted);
  }

  .acc-card__note {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--dojo-accent);

    &.is-empty {
      font-weight: 400;
      color: var(--dojo-muted);
    }
  }

  .acc-card__kv {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 0 0 12px;

    dt {
      font-size: 12px;
      color: var(--dojo-muted);
    }

    dd {
      margin: 2px 0 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .acc-card__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }

  .acc-card__foot a {
    color: var(--dojo-accent);
    text-decoration: none;
    white-space: nowrap;
  }

  .acc-card__ops {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
  }

  .acc-card__ops .is-danger,
  .manage-card__actions .is-danger {
    color: #9b2c2c;
    background: #fdecec;
  }

  .acc-card__ops .is-link {
    color: var(--dojo-accent);
    background: #edf1f5;
  }

  .muted {
    color: var(--dojo-muted);
  }

  .back-link {
    margin-bottom: 8px;
    padding: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--dojo-accent);
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .explore-rail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 18px 14px;
    overflow: hidden;
    background: var(--dojo-paper-muted);
    border-right: 1px solid var(--dojo-line);
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

  .explore-rail > header p,
  .explore-main > header p,
  .tier-block p {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--dojo-muted);
  }

  .explore-form,
  .import-row,
  .tier-block {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }

  .cards-surface .explore-form {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    margin-top: 0;
  }

  .line-btn {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: max-content;
    height: 36px;
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

  .line-btn.is-primary {
    color: #fff;
    background: var(--dojo-accent);
  }

  .line-btn.is-ghost {
    color: var(--dojo-ink);
    background: #edf1f5;
  }

  .line-btn.is-danger {
    color: #9b2c2c;
    background: #fdecec;
  }

  .line-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .explore-main__tools > button:not(.line-btn):not(.is-primary):not(.is-danger) {
    height: 34px;
    padding: 0 10px;
    font-size: 11px;
    color: var(--dojo-ink);
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 8px;
  }

  .explore-form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .explore-form input,
  .explore-form select,
  .explore-main__tools select,
  .video-card__tags select,
  .video-card__tags input {
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
  .explore-main__tools .is-primary {
    min-height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    color: #fff;
    white-space: nowrap;
    cursor: pointer;
    background: var(--dojo-accent);
    border: 0;
    border-radius: 8px;
  }

  .import-row {
    padding: 10px;
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 10px;
  }

  .account-list {
    display: grid;
    flex: 1;
    gap: 8px;
    align-content: start;
    min-height: 0;
    margin-top: 14px;
    overflow: auto;
  }

  .account-list > em {
    font-size: 11px;
    font-style: normal;
    color: var(--dojo-muted);
  }

  .import-row span,
  .tier-block em {
    font-size: 10px;
    font-style: normal;
    color: var(--dojo-muted);
  }

  .import-row button,
  .account-card {
    padding: 7px 10px;
    font-size: 11px;
    line-height: 1;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
    background: #f4f7fa;
    border: 1px solid transparent;
    border-radius: 7px;
  }

  .tier-block header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tier-block strong {
    font-size: 12px;
  }

  .tier-block small {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .account-card {
    display: grid;
    gap: 3px;
    background: var(--dojo-paper);
    border-color: var(--dojo-line);
  }

  .account-card.is-active {
    border-color: var(--dojo-accent-soft);
    box-shadow: 0 0 0 3px rgb(47 111 237 / 8%);
  }

  .account-card span {
    font-size: 10px;
    color: var(--dojo-muted);
  }

  .explore-main {
    min-width: 0;
    min-height: 0;
    padding: 20px 22px 28px;
    overflow: auto;
  }

  .explore-main > header,
  .explore-main__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .explore-main__tools .is-danger {
    height: 34px;
    padding: 0 10px;
    font-size: 11px;
    color: #9b2c2c;
    cursor: pointer;
    background: #fdecec;
    border: 0;
    border-radius: 8px;
  }

  .view-switch {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .view-switch button {
    height: 32px;
    padding: 0 12px;
    font-size: 11px;
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 999px;
  }

  .view-switch .is-active {
    color: #fff;
    background: var(--dojo-accent);
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(148px, 168px));
    gap: 10px;
    margin-top: 16px;
  }

  .video-card {
    overflow: hidden;
    background: #fffdfc;
    border: 1px solid var(--dojo-line);
    border-radius: 12px;
  }

  .video-card__cover {
    display: block;
    width: 100%;
    aspect-ratio: 9 / 16;
    padding: 0;
    overflow: hidden;
    color: var(--dojo-muted);
    cursor: pointer;
    background: var(--dojo-canvas);
    border: 0;
  }

  .video-card__cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-card__body {
    display: grid;
    gap: 8px;
    padding: 12px;
  }

  .video-card__body strong,
  .video-card__body span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .video-card__body strong {
    font-size: 13px;
  }

  .video-card__body > span {
    font-size: 11px;
    color: var(--dojo-muted);
    -webkit-line-clamp: 1;
  }

  .video-card__actions,
  .video-card__tags {
    display: grid;
    gap: 6px;
  }

  .video-card__actions {
    grid-template-columns: 1fr 1fr;
  }

  .video-card__actions button {
    height: 32px;
    font-size: 11px;
    cursor: pointer;
    background: #edf1f5;
    border: 0;
    border-radius: 7px;
  }

  .video-card__actions .is-saved {
    color: #fff;
    background: var(--dojo-accent);
  }

  .video-card__tags label {
    display: grid;
    gap: 4px;
  }

  .video-card__tags span {
    font-size: 10px;
    color: var(--dojo-muted);
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

  .explore-empty.is-page {
    grid-column: 2;
    margin: 24px;
  }

  @container workspace (max-width: 720px) {
    .explore-surface {
      grid-template-columns: 1fr;
    }

    .explore-rail {
      border-right: 0;
      border-bottom: 1px solid var(--dojo-line);
    }

    .explore-empty.is-page {
      grid-column: 1;
    }
  }
</style>
