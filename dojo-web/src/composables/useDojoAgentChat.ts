import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { chatAgent } from '@/api/llm'
import {
  appendGlobalChatMessage,
  dojoChatStore,
  getGlobalChatMessages,
  savePendingWorkflow
} from '@/store/dojoChatStore'
import {
  accountVideos,
  dojoAccountStore,
  syncAccount
} from '@/store/dojoAccountStore'
import { adMonitorVideos } from '@/store/dojoAdMonitorStore'
import { dojoCreatorStore } from '@/store/dojoCreatorStore'
import {
  createInspirationSource,
  createManualExecutableInspiration,
  dojoInspirationStore,
  removeExecutableInspiration,
  removeInspirationSource,
  removeScriptAsset,
  runInspirationCollection,
  updateExecutableInspiration
} from '@/store/dojoInspirationStore'
import { dojoOperationsStore, getOperationsInvestment } from '@/store/dojoOperationsStore'
import {
  addBenchmarkAccount,
  dojoInspirationExplore,
  removeBenchmarkAccount
} from '@/store/dojoInspirationExplore'
import {
  boardRows,
  dojoInspirationRankStore
} from '@/store/dojoInspirationRankStore'
import {
  createProject,
  dojoProjectStore,
  removeProject,
  setSelectedProjects,
  updateProject
} from '@/store/dojoProjectStore'
import {
  getProjectRuntime,
  patchProjectCurrent,
  plannedScripts
} from '@/store/dojoProjectRuntime'
import {
  listProjectPhaseBlocks,
  phaseKeyFromBlockId,
  PLAN_PHASE_META
} from '@/store/dojoKpiSchedule'
import {
  dojoScheduleStore,
  patchScheduleBlock,
  removeScheduleBlock,
  upsertScheduleBlock
} from '@/store/dojoScheduleStore'
import { extractDateRange } from '@/utils/dojoDates'
import { parseCompactNumber } from '@/utils/dojoProjectImport'
import { formatAiText } from '@/utils/formatAiText'
import { looksLikeProjectTitle, resolveSearchQueries } from '@/utils/dojoInspirationQueries'
import { formatMenuTitle } from '@/utils/router'

type LocalAction = 'progress' | 'inspiration' | 'fill-progress' | 'accounts'

type ConfirmableAction =
  | { type: 'create-project'; draft: ProjectDraft }
  | { type: 'create-task'; projectId: string; projectName: string; title: string; date: string }
  | { type: 'reschedule'; draft: RescheduleDraft }
  | { type: 'collection'; draft: CollectionDraft }
  | { type: 'progress'; projectId: string; projectName: string; patch: Record<string, number> }
  | { type: 'sync-account'; handle: string }
  | { type: 'sync-all'; count: number }
  | { type: 'create-inspiration'; title: string; note?: string }
  | { type: 'update-inspiration'; id: string; title: string; patch: { title?: string; angle?: string } }
  | { type: 'create-script'; title: string }
  | { type: 'add-benchmark'; handle: string }
  | { type: 'update-project'; projectId: string; projectName: string; patch: { name?: string; region?: string } }

type PendingWorkflow =
  | { kind: 'inspiration'; draft?: Partial<CollectionDraft> }
  | { kind: 'progress' }
  | { kind: 'create-project'; draft: ProjectDraft }
  | { kind: 'create-task'; draft: TaskDraft }
  | { kind: 'reschedule'; draft: RescheduleDraft }
  | { kind: 'confirm-delete'; target: DeleteTarget }
  | { kind: 'confirm-action'; action: ConfirmableAction }
  | { kind: 'clarify-create' }

interface TaskDraft {
  title?: string
  date?: string
  projectId?: string
  projectName?: string
}

interface ProjectDraft {
  name?: string
  accounts?: number
  videos?: number
  exposure?: number
  scripts?: number
  cycleStart?: string
  cycleEnd?: string
  region?: string
}

interface CollectionDraft {
  query?: string
  name?: string
  limit?: number
  days?: 7 | 30 | 90
}

interface RescheduleDraft {
  projectId?: string
  projectName?: string
  phaseLabel?: string
  blockId?: string
  start?: string
  end?: string
}

type DeleteTarget =
  | { type: 'project'; id: string; name: string }
  | { type: 'schedule'; id: string; title: string }
  | { type: 'inspiration'; id: string; title: string }
  | { type: 'script'; id: string; title: string }
  | { type: 'source'; id: string; title: string }
  | { type: 'benchmark'; id: string; title: string }

function todayKey(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function parseNumber(message: string, labels: string[]) {
  for (const label of labels) {
    const match = message.match(
      new RegExp(`${label}\\s*[:=：是为]?\\s*([\\d,.]+\\s*[万wWkKmM]?)`)
    )
    if (!match) continue
    const value = parseCompactNumber(match[1])
    if (value != null) return value
  }
  // 口语：账号3 / 视频30 / 播放100万（标签和数字紧贴也认）
  for (const label of labels) {
    const compact = message.match(new RegExp(`${label}([\\d,.]+\\s*[万wWkKmM]?)`))
    if (!compact) continue
    const value = parseCompactNumber(compact[1])
    if (value != null) return value
  }
  return undefined
}

function listProjectNames() {
  return dojoProjectStore.projects.map((project) => project.name)
}

function findProjectByText(message: string) {
  return (
    dojoProjectStore.projects.find((project) => message.includes(project.name)) ||
    dojoProjectStore.projects.find((project) =>
      (project.aliases || []).some((alias) => alias && message.includes(alias))
    ) ||
    null
  )
}

function findPhaseInMessage(message: string) {
  return PLAN_PHASE_META.find((phase) => message.includes(phase.label)) || null
}

const PROJECT_REGIONS = [
  '美国',
  '英国',
  '日本',
  '韩国',
  '德国',
  '法国',
  '巴西',
  '墨西哥',
  '印尼',
  '泰国',
  '越南',
  '菲律宾',
  '马来西亚',
  '新加坡',
  '澳洲',
  '澳大利亚',
  '加拿大',
  '中东',
  '欧洲',
  '东南亚',
  '波兰',
  '意大利',
  '西班牙',
  '印度',
  '阿联酋'
] as const

function isCreateProjectMessage(message: string) {
  if (/(?:创建|新建|安排|加).{0,12}任务/.test(message)) return false
  return /(创建|新建|加一个|加个|新开|开一个|建个).{0,24}项目/.test(message)
}

function inferProjectNameFromLeftover(message: string) {
  const leftover = message
    .replace(/(?:帮我|请|给我|我要)?(?:新建|创建|加一个|加个|建个).{0,8}项目/g, ' ')
    .replace(/(?:叫做|叫作|名为|名字是|名称是|项目叫)/g, ' ')
    .replace(/(?:账号数|账号|视频目标|已发视频|视频|播放目标|播放量|播放|曝光|脚本目标|脚本)\s*[:=：是为]?\s*[\d,.]+\s*[万wWkKmM]?/g, ' ')
    .replace(/周期[^,，。]*/g, ' ')
    .replace(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g, ' ')
    .replace(/\d{1,2}[:.．]\d{1,2}月\s*[0-9一二三四五六七八九十廿卅两]+[日号]?/g, ' ')
    .replace(/[0-9一二三四五六七八九十两]+月\s*[0-9一二三四五六七八九十廿卅两]+[日号]?/g, ' ')
    .replace(/\d{1,2}[.．／/\-]\d{1,2}日?/g, ' ')
    .replace(/[到至截止结束~—–]/g, ' ')
    .replace(new RegExp(PROJECT_REGIONS.join('|'), 'g'), ' ')
    .replace(/[,，。;；、:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const token = leftover
    .split(' ')
    .map((item) => item.replace(/[的]?项目$/, '').trim())
    .find(
      (item) =>
        item.length >= 2 &&
        item.length <= 20 &&
        !/^(项目|KPI|目标|地区|周期|确认|取消)$/i.test(item)
    )
  if (!token) return undefined
  if (PROJECT_REGIONS.includes(token as (typeof PROJECT_REGIONS)[number])) return undefined
  return token
}

function parseProjectName(message: string, fallback?: string) {
  const explicit =
    message.match(
      /(?:叫做|叫作|名为|名字是|名称是|名称[：:\s]+|项目叫)\s*([A-Za-z0-9_\-\u4e00-\u9fff]{1,40})/
    )?.[1] ||
    message.match(/(?:新建项目|创建项目|加一个项目)[：:\s]+([^\n,，。]+)/)?.[1]
  if (explicit) {
    const cleaned = explicit.trim().replace(/[的]?项目$/, '')
    if (cleaned && !PROJECT_REGIONS.includes(cleaned as (typeof PROJECT_REGIONS)[number])) {
      return cleaned
    }
  }
  const inferred = inferProjectNameFromLeftover(message)
  if (inferred) return inferred
  const bare = message.trim()
  if (
    !fallback &&
    /^[A-Za-z0-9_\-\u4e00-\u9fff]{1,40}$/.test(bare) &&
    !PROJECT_REGIONS.includes(bare as (typeof PROJECT_REGIONS)[number])
  ) {
    return bare
  }
  return fallback
}

function parseProjectRegion(message: string, fallback?: string) {
  const labeled = message.match(/地区[：:\s]*([^\n,，。]+)/)?.[1]?.trim()
  if (labeled) return labeled
  const ofProject = message.match(/([^\s,，。的]{2,12})的项目/)?.[1]
  if (ofProject && !/(新建|创建|加一个|这个|那个|某个|现有)/.test(ofProject)) {
    return ofProject
  }
  return PROJECT_REGIONS.find((region) => message.includes(region)) || fallback
}

function isAffirmative(message: string) {
  return /^(确认|好的?|可以|执行|开始|yes|y|ok|行)$/i.test(message.trim())
}

function isNegative(message: string) {
  return /^(取消|不要|算了|不执行|先别|no)$/i.test(message.trim())
}

function isBareCreateCommand(message: string) {
  return /^(?:帮我|请|给我|我要)?(?:点)?(?:一下)?(?:新建|创建|加一个|加个|建个)(?:一个|一项)?$/.test(
    message.trim()
  )
}

function isWriteIntent(message: string) {
  return (
    isCreateProjectMessage(message) ||
    isBareCreateCommand(message) ||
    /(?:创建|新建|安排).{0,8}任务/.test(message) ||
    /(改|调整|推迟|提前|改到|改成).{0,12}(时间|日期|排期|日历|环节|投放|剪辑|拍摄|分发|脚本)/.test(
      message
    ) ||
    /(采集|检索|搜索|查询).{0,8}(灵感|内容|视频|线索)|(?:建|创建).{0,6}采集/.test(message) ||
    /(删除|删掉|去掉)/.test(message) ||
    /(同步|刷新).{0,8}账号|账号.{0,6}(同步|刷新)/.test(message) ||
    /填写进度|更新进度|改现状/.test(message) ||
    /(?:新建|添加|加一条)(?:灵感|脚本)|(?:加入|添加)对标|改名为/.test(message)
  )
}

function formatCount(value?: number) {
  if (value == null) return '未定'
  return value.toLocaleString()
}

export function useDojoAgentChat() {
  const route = useRoute()
  const messages = computed(() => getGlobalChatMessages())
  const pageLabel = computed(() => formatMenuTitle(route.meta?.title as string))
  const pendingWorkflow = {
    get value() {
      return dojoChatStore.pendingWorkflow as PendingWorkflow | null
    },
    set value(next: PendingWorkflow | null) {
      savePendingWorkflow(next)
    }
  }
  const selectedProject = computed(
    () =>
      dojoProjectStore.projects.find((project) =>
        dojoProjectStore.selectedIds.includes(project.id)
      ) || dojoProjectStore.projects.find((project) => project.active !== false)
  )

  const contextSnapshot = computed(() => {
    const projects = dojoProjectStore.projects.map((project) => {
      const runtime = getProjectRuntime(project.id)
      const phases = listProjectPhaseBlocks(project.id).map((block) => ({
        id: block.id,
        title: block.title,
        phase: phaseKeyFromBlockId(block.id, project.id),
        start: block.start,
        end: block.end,
        status: block.status,
        lane: block.lane
      }))
      return {
        id: project.id,
        name: project.name,
        active: project.active,
        priority: runtime?.priority,
        owner: runtime?.owner,
        status: runtime?.runStatus,
        cycle: runtime ? [runtime.kpi.cycleStart, runtime.kpi.cycleEnd] : null,
        progress: runtime?.current,
        kpi: runtime?.kpi,
        phases
      }
    })
    const today = todayKey()
    const todayBlocks = dojoScheduleStore.blocks.filter(
      (block) => block.start <= today && block.end >= today
    )
    const inspirations = dojoInspirationStore.executableInspirations.slice(0, 12).map((item) => ({
      id: item.id,
      title: item.title,
      sourceAuthor: item.sourceAuthor,
      angle: item.angle,
      hook: item.hook,
      hasLink: Boolean(item.referenceUrl),
      shots: item.shotPlan.length,
      updatedAt: item.updatedAt
    }))
    const scripts = dojoInspirationStore.scripts.slice(0, 8).map((script) => ({
      id: script.id,
      title: script.title,
      status: script.status,
      sourceAuthor: script.sourceAuthor,
      aiAdaptedAt: script.aiAdaptedAt,
      inspirationId: script.inspirationId
    }))
    const accounts = dojoAccountStore.accounts.slice(0, 30).map((account) => {
      const videos = accountVideos(account.handle)
      const views = videos.reduce((sum, video) => sum + (Number(video.views) || 0), 0)
      const latest = videos
        .map((video) => video.publishDate || '')
        .filter(Boolean)
        .sort()
        .at(-1)
      return {
        handle: account.handle,
        nickname: account.nickname,
        projectId: account.projectId,
        followers: account.followers,
        videos: videos.length || account.totalVideos,
        views,
        latestPublishDate: latest || null,
        lastSyncedAt: account.lastSyncedAt,
        syncSource: account.syncSource,
        status: account.status
      }
    })
    const investmentIds = Object.keys(dojoOperationsStore.investmentByVideoId).slice(0, 12)
    const investments = investmentIds.map((videoId) => {
      const record = getOperationsInvestment(videoId)
      return {
        videoId,
        spend: record?.spend || 0,
        revenue: record?.revenue || 0,
        conversions: record?.conversions || 0
      }
    })
    const hotVideos = [...adMonitorVideos.value]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map((video) => ({
        id: video.videoId,
        title: video.description,
        handle: video.accountHandle || video.handle,
        views: video.views,
        engagementRate: video.engagementRate,
        publishDate: video.publishDate
      }))

    return {
      agent: 'SixNine49',
      capabilities: [
        '写操作先复述理解并确认，用户点头后才改工作台',
        '意图不清时先追问，不猜测执行',
        '对话创建/删除项目，缺 KPI 会追问',
        '调整时间规划/日历里某个项目环节的起止日期',
        '创建灵感采集任务（关键词、条数、时间窗）',
        '跑一轮固定榜单：中文词转英文再搜 TikTok；结果多了会先滤广告再取前十。算法榜点一下就灭',
        '灵感库里对照片子写口播和画面，AI 按文字改稿，不能假装看过原片',
        '查询账号运营状态、播放最好账号、停滞账号',
        '创建任务、更新项目现状数字',
        '灵感库/对标库/采集线索的增加、修改、删除、查询',
        '中台可对接任意数量项目；写操作必须带项目名，不能默认落到当前选中项'
      ],
      projectRule:
        '项目数量不固定。selectedProject 只是界面焦点，不是唯一可操作对象。未点名且项目多于 1 个时必须先问。',
      projectCount: dojoProjectStore.projects.length,
      domains: {
        execution: '项目管理 / 时间规划 / 执行日历',
        content: '灵感采集 / 灵感库 / 对标库',
        operations: '运营驾驶舱 / 账号矩阵 / 视频监控'
      },
      page: pageLabel.value,
      route: route.path,
      today,
      selectedProject: selectedProject.value?.name || null,
      projects,
      schedule: {
        total: dojoScheduleStore.blocks.length,
        today: todayBlocks.slice(0, 8),
        overdue: dojoScheduleStore.blocks.filter(
          (block) => block.end < today && block.status !== '已完成'
        ).length,
        unassigned: dojoScheduleStore.blocks.filter((block) => !block.owner).length
      },
      creator: {
        total: dojoCreatorStore.contents.length,
        unscheduled: dojoCreatorStore.contents.filter((content) => !content.plannedDate).length,
        pendingReviews: dojoCreatorStore.reviews.filter((review) => !review.reviewedAt).length
      },
      inspiration: {
        libraryCount: dojoInspirationStore.executableInspirations.length,
        candidateCount: dojoInspirationStore.candidates.length,
        sourceCount: dojoInspirationStore.sources.length,
        sources: dojoInspirationStore.sources.slice(0, 8).map((source) => ({
          id: source.id,
          name: source.name,
          query: source.query,
          limit: source.defaultLimit,
          days: source.timeWindowDays
        })),
        items: inspirations,
        scripts,
        boards: dojoInspirationExplore.boards.slice(0, 12).map((board) => ({
          id: board.id,
          name: board.name,
          preset: Boolean(board.preset),
          queries: board.queries,
          lastRefreshedAt: board.lastRefreshedAt || null,
          topCount: (dojoInspirationExplore.boardItems[board.id] || []).length
        })),
        rankPool: {
          queryCount: dojoInspirationRankStore.queries.length,
          postCount: dojoInspirationRankStore.posts.length,
          lastCycle: dojoInspirationRankStore.lastCycle || null,
          boards: (() => {
            const rows = boardRows()
            return {
              outlier: rows.outlier.slice(0, 5).map((row) => ({
                title: row.post.title,
                handle: row.post.creatorHandle,
                views: row.post.views,
                score: Number(row.outlierScore.toFixed(2))
              })),
              velocity: rows.velocity.slice(0, 5).map((row) => ({
                title: row.post.title,
                handle: row.post.creatorHandle,
                views: row.post.views,
                score: Number(row.accelerationScore.toFixed(2))
              })),
              breakout: rows.breakout.slice(0, 5).map((row) => ({
                title: row.post.title,
                handle: row.post.creatorHandle,
                views: row.post.views,
                score: Number(row.breakoutScore.toFixed(2))
              }))
            }
          })()
        }
      },
      accounts: {
        total: dojoAccountStore.accounts.length,
        active: dojoAccountStore.accounts.filter((account) => account.status === 'active').length,
        synced: dojoAccountStore.accounts.filter((account) => account.lastSyncedAt).length,
        totalFollowers: dojoAccountStore.accounts.reduce(
          (sum, account) => sum + (Number(account.followers) || 0),
          0
        ),
        items: accounts
      },
      operations: {
        monitoredVideos: adMonitorVideos.value.length,
        investmentRecords: investmentIds.length,
        investments,
        hotVideos
      },
      videos: adMonitorVideos.value.length
    }
  })

  function assistant(content: string, memoryHint = '本地真实数据') {
    appendGlobalChatMessage({ role: 'assistant', content: formatAiText(content), memoryHint })
  }

  function resolveWriteProject(message: string, draftName?: string) {
    const named =
      findProjectByText(message) || (draftName ? findProjectByText(draftName) : null)
    if (named) return named
    if (dojoProjectStore.projects.length === 1) return dojoProjectStore.projects[0]
    return null
  }

  function askWhichProject(action: string) {
    const names = listProjectNames()
    assistant(
      names.length
        ? `${action}前要指定项目。当前共有 ${names.length} 个：${names.join('、')}。请带上项目名再说一次。`
        : '还没有项目。先说「新建项目」。'
    )
  }

  function localProjectProgress(projectId?: string) {
    if (!projectId && dojoProjectStore.projects.length !== 1) {
      const names = listProjectNames()
      return names.length
        ? `当前共有 ${names.length} 个项目：${names.join('、')}。指定项目名后我再展开进度。`
        : '当前还没有项目。'
    }
    const project =
      (projectId && dojoProjectStore.projects.find((item) => item.id === projectId)) ||
      dojoProjectStore.projects[0]
    const runtime = project ? getProjectRuntime(project.id) : null
    if (!project || !runtime) return '当前没有可读取的活动项目。'
    const scriptTarget = plannedScripts(runtime.kpi)
    return [
      `「${project.name}」项目进度`,
      `- 周期：${runtime.kpi.cycleStart} 至 ${runtime.kpi.cycleEnd}（${runtime.runStatus}）`,
      `- 账号：${runtime.current.accounts}/${runtime.kpi.accounts}`,
      `- 脚本：${runtime.current.scripts}/${scriptTarget}`,
      `- 成片：${runtime.current.edited}/${runtime.kpi.videos}`,
      `- 过审：${runtime.current.approved}/${runtime.kpi.videos}`,
      `- 已发视频：${runtime.current.distributed}/${runtime.kpi.videos}`,
      `- 播放量：${runtime.current.exposure.toLocaleString()}/${runtime.kpi.exposure.toLocaleString()}`
    ].join('\n')
  }

  function accountOpsBrief() {
    const rows = dojoAccountStore.accounts.map((account) => {
      const videos = accountVideos(account.handle)
      const views = videos.reduce((sum, video) => sum + (Number(video.views) || 0), 0)
      const latest = videos
        .map((video) => video.publishDate || '')
        .filter(Boolean)
        .sort()
        .at(-1)
      const daysSince =
        latest && Number.isFinite(Date.parse(latest))
          ? Math.floor((Date.now() - Date.parse(latest)) / 86400000)
          : null
      return {
        handle: account.handle,
        nickname: account.nickname || account.handle,
        followers: account.followers || 0,
        videos: videos.length || account.totalVideos || 0,
        views,
        latest,
        daysSince,
        lastSyncedAt: account.lastSyncedAt
      }
    })
    if (!rows.length) return '账号矩阵里还没有账号。先导入或同步账号后，我才能读运营状态。'

    const byViews = [...rows].sort((a, b) => b.views - a.views)
    const best = byViews[0]
    const stagnant = rows.filter(
      (row) => row.daysSince == null || row.daysSince >= 10 || row.videos === 0
    )
    const neverSynced = rows.filter((row) => !row.lastSyncedAt)

    return [
      `账号运营快照（共 ${rows.length} 个）`,
      `播放最好：@${best.handle}（${best.nickname}）· 累计播放 ${best.views.toLocaleString()} · 视频 ${best.videos} 条`,
      stagnant.length
        ? `可能卡住/停滞：${stagnant
            .slice(0, 5)
            .map(
              (row) =>
                `@${row.handle}${
                  row.daysSince == null
                    ? '（无发布日）'
                    : row.videos === 0
                      ? '（无视频）'
                      : `（${row.daysSince} 天未更）`
                }`
            )
            .join('、')}`
        : '暂无明显停滞账号。',
      neverSynced.length
        ? `尚未同步：${neverSynced
            .slice(0, 5)
            .map((row) => `@${row.handle}`)
            .join('、')}。可以说「同步全部账号」让我拉一次。`
        : '账号均已有同步记录。',
      '也可以问：哪个账号播放最好 / 有没有停滞 / 同步 @某账号。'
    ].join('\n')
  }

  function missingProjectFields(draft: ProjectDraft) {
    const missing: string[] = []
    if (!draft.name?.trim()) missing.push('项目名称')
    if (draft.accounts == null) missing.push('账号数目标')
    if (draft.videos == null) missing.push('视频目标')
    if (draft.exposure == null) missing.push('播放目标')
    if (!draft.cycleStart || !draft.cycleEnd) missing.push('周期起止')
    return missing
  }

  function mergeProjectDraft(message: string, draft: ProjectDraft = {}): ProjectDraft {
    const normalized = message
      .replace(/桌旗|周旗|周斯/g, '周期')
      .replace(/到号/g, '到')
    const range = extractDateRange(normalized)
    return {
      ...draft,
      name: parseProjectName(normalized, draft.name),
      accounts: parseNumber(normalized, ['账号数', '账号']) ?? draft.accounts,
      videos: parseNumber(normalized, ['视频目标', '已发视频', '分发', '视频']) ?? draft.videos,
      exposure: parseNumber(normalized, ['播放目标', '播放量', '播放', '曝光']) ?? draft.exposure,
      scripts: parseNumber(normalized, ['脚本目标', '脚本']) ?? draft.scripts,
      cycleStart: range?.start || draft.cycleStart,
      cycleEnd: range?.end || draft.cycleEnd,
      region: parseProjectRegion(normalized, draft.region)
    }
  }

  function mergeCollectionDraft(message: string, draft: CollectionDraft = {}): CollectionDraft {
    const limit =
      parseNumber(message, ['条数', '数量']) ??
      (message.match(/(\d+)\s*条/) ? Number(message.match(/(\d+)\s*条/)![1]) : draft.limit)
    const dayHit = message.match(/(?:近|最近)?\s*(7|30|90)\s*天/)
    const days: 7 | 30 | 90 | undefined = dayHit
      ? (Number(dayHit[1]) as 7 | 30 | 90)
      : draft.days
    const rawQuery =
      message
        .replace(/(?:帮我|请|给我)?(?:建|创建|开)?(?:一个)?(?:灵感)?(?:采集|检索|搜索|查询)(?:任务|线索)?/g, '')
        .replace(/(?:近|最近)?\s*(?:7|30|90)\s*天/g, '')
        .replace(/\d+\s*条/g, '')
        .replace(/条数|数量|关键词|标题|查询/g, '')
        .replace(/[：:=]/g, ' ')
        .trim() || draft.query || ''
    const resolved = resolveSearchQueries(rawQuery)
    const query = resolved.primary || (looksLikeProjectTitle(rawQuery) ? '' : rawQuery) || draft.query
    return {
      ...draft,
      query,
      name: draft.name || (query ? `采集 · ${query.slice(0, 18)}` : undefined),
      limit: limit || draft.limit,
      days: days || draft.days
    }
  }

  function missingCollectionFields(draft: CollectionDraft) {
    const missing: string[] = []
    if (!draft.query?.trim()) missing.push('查询关键词/标题')
    if (!draft.limit) missing.push('要查多少条')
    if (!draft.days) missing.push('最近多长时间（7/30/90 天）')
    return missing
  }

  async function executeCollection(draft: CollectionDraft) {
    const query = resolveSearchQueries(draft.query || '').primary
    if (!query) {
      assistant('检索词必须是独立词，不能带项目名或品牌名。直接给我要搜的那个词，例如 unboxing。')
      return
    }
    const limit = draft.limit || 20
    const days = draft.days || 30
    const source = createInspirationSource({
      name: draft.name || `SixNine49 采集 · ${query.slice(0, 18)}`,
      platform: 'TikTok',
      kind: 'keyword',
      query,
      lenses: ['topic', 'hook', 'format'],
      timeWindowDays: days,
      ranking: 'balanced',
      defaultLimit: limit
    })
    const job = await runInspirationCollection(source.id, limit)
    assistant(
      job?.status === 'completed'
        ? `采集任务已建立并执行：\n- 标题：${source.name}\n- 关键词：${query}\n- 条数：${limit}\n- 时间窗：近 ${days} 天\n- 结果：过滤出 ${job.resultCount} 条新候选，可在灵感采集里查看。`
        : `采集任务已建立：${source.name}（${query} / ${limit} 条 / 近 ${days} 天）。\n${job?.message || '采集接口暂不可用，线索已保存，可稍后重试。'}`,
      '本地动作已执行'
    )
  }

  function executeCreateProject(draft: ProjectDraft) {
    const project = createProject({
      name: draft.name!.trim(),
      region: draft.region || '—',
      cycleStart: draft.cycleStart,
      cycleEnd: draft.cycleEnd,
      kpi: {
        accounts: draft.accounts || 0,
        videos: draft.videos || 0,
        exposure: draft.exposure || 0,
        scripts: draft.scripts || 0
      }
    })
    setSelectedProjects([project.id])
    assistant(
      `已创建项目「${project.name}」${draft.region ? `（${draft.region}）` : ''}，并切到该项目。\n${localProjectProgress(project.id)}\n接下来可以直接说：给「${project.name}」加投放环节，或改某环节日期。`,
      '本地动作已执行'
    )
  }

  function describeProjectDraft(draft: ProjectDraft) {
    const rows = [
      draft.name ? `名称 ${draft.name}` : '',
      draft.region ? `地区 ${draft.region}` : '',
      draft.accounts != null ? `账号 ${formatCount(draft.accounts)}` : '',
      draft.videos != null ? `视频 ${formatCount(draft.videos)}` : '',
      draft.exposure != null ? `播放 ${formatCount(draft.exposure)}` : '',
      draft.scripts != null ? `脚本 ${formatCount(draft.scripts)}` : '',
      draft.cycleStart && draft.cycleEnd ? `周期 ${draft.cycleStart} 至 ${draft.cycleEnd}` : ''
    ].filter(Boolean)
    return rows.join('，')
  }

  function askProjectFollowup(draft: ProjectDraft) {
    const missing = missingProjectFields(draft)
    pendingWorkflow.value = { kind: 'create-project', draft }
    const known = describeProjectDraft(draft)
    assistant(
      [
        known
          ? `已经记下：${known}。先不动手。`
          : `我理解你要新建项目${draft.region ? `（${draft.region}）` : ''}，先不动手。`,
        `还缺：${missing.join('、')}。缺哪句补哪句就行，不用整段重发。`,
        '周期写成 8.20-9.1、8月20到9月1、8月二十到9月一号 都可以。'
      ].join('\n'),
      '等待项目 KPI'
    )
  }

  function describeAction(action: ConfirmableAction) {
    if (action.type === 'create-project') {
      const draft = action.draft
      return [
        `我准备新建一个独立项目，先不对工作台动手：`,
        `- 名称：${draft.name}`,
        `- 地区：${draft.region || '未定'}`,
        `- 账号目标：${formatCount(draft.accounts)}`,
        `- 视频目标：${formatCount(draft.videos)}`,
        `- 播放目标：${formatCount(draft.exposure)}`,
        draft.scripts != null ? `- 脚本目标：${formatCount(draft.scripts)}` : '',
        `- 周期：${draft.cycleStart} 至 ${draft.cycleEnd}`
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (action.type === 'create-task') {
      return [
        `我准备在「${action.projectName}」下建一条任务，先不动手：`,
        `- 任务：${action.title}`,
        `- 排到：${action.date}`,
        '如果其实是要新建独立项目，直接说「新建项目」。'
      ].join('\n')
    }
    if (action.type === 'reschedule') {
      const draft = action.draft
      return [
        `我准备改期，先不动手：`,
        `- 项目：${draft.projectName}`,
        `- 环节：${draft.phaseLabel || '未标注'}`,
        `- 新日期：${draft.start} → ${draft.end}`
      ].join('\n')
    }
    if (action.type === 'collection') {
      const draft = action.draft
      return [
        `我准备建采集任务，先不动手：`,
        `- 关键词：${resolveSearchQueries(draft.query || '').primary || draft.query}`,
        `- 条数：${draft.limit}`,
        `- 时间窗：近 ${draft.days} 天`
      ].join('\n')
    }
    if (action.type === 'progress') {
      const rows = Object.entries(action.patch)
        .map(([field, value]) => `- ${field}：${value.toLocaleString()}`)
        .join('\n')
      return `我准备更新「${action.projectName}」现状，先不动手：\n${rows}`
    }
    if (action.type === 'sync-account') {
      return `我准备同步 @${action.handle}，会请求账号接口。先不动手。`
    }
    if (action.type === 'create-inspiration') {
      return `我准备往灵感库加一条，先不动手：\n- 标题：${action.title}`
    }
    if (action.type === 'update-inspiration') {
      return `我准备改灵感「${action.title}」，先不动手。`
    }
    if (action.type === 'create-script') {
      return `我准备往灵感库加一条「${action.title}」，先不动手。`
    }
    if (action.type === 'add-benchmark') {
      return `我准备把 ${action.handle} 加入对标库，先不动手。`
    }
    if (action.type === 'update-project') {
      return `我准备改项目「${action.projectName}」的基础信息，先不动手。`
    }
    return `我准备同步前 ${action.count} 个账号，会请求账号接口。先不动手。`
  }

  function proposeAction(action: ConfirmableAction) {
    pendingWorkflow.value = { kind: 'confirm-action', action }
    assistant(
      `${describeAction(action)}\n\n回复「确认」执行，或告诉我要改哪一项；「取消」则不做。`,
      '等待确认后执行'
    )
  }

  async function executeConfirmedAction(action: ConfirmableAction) {
    if (action.type === 'create-project') {
      executeCreateProject(action.draft)
      return
    }
    if (action.type === 'create-task') {
      upsertScheduleBlock({
        projectId: action.projectId,
        projectName: action.projectName,
        title: action.title,
        type: 'task',
        start: action.date,
        end: action.date,
        source: 'manual',
        status: '已安排'
      })
      assistant(
        `已为「${action.projectName}」创建任务「${action.title}」，并排到 ${action.date}。`,
        '本地动作已执行'
      )
      return
    }
    if (action.type === 'reschedule') {
      executeReschedule(action.draft)
      return
    }
    if (action.type === 'collection') {
      await executeCollection(action.draft)
      return
    }
    if (action.type === 'progress') {
      patchProjectCurrent(action.projectId, action.patch)
      assistant(
        `已更新「${action.projectName}」现状。\n${localProjectProgress(action.projectId)}`,
        '本地动作已执行'
      )
      return
    }
    if (action.type === 'sync-account') {
      try {
        await syncAccount(action.handle)
        assistant(`已同步 @${action.handle}。\n${accountOpsBrief()}`, '账号 API 已拉取')
      } catch (error) {
        assistant(
          `同步 @${action.handle} 失败：${error instanceof Error ? error.message : '未知错误'}`,
          '同步失败'
        )
      }
      return
    }
    if (action.type !== 'sync-all') {
      finishConfirmedExtras(action)
      return
    }
    const handles = dojoAccountStore.accounts.map((account) => account.handle)
    let ok = 0
    for (const handle of handles.slice(0, action.count)) {
      try {
        await syncAccount(handle)
        ok += 1
      } catch {
        /* continue */
      }
    }
    assistant(
      `已尝试同步前 ${action.count} 个账号，成功 ${ok} 个。\n${accountOpsBrief()}`,
      '账号 API 已拉取'
    )
  }

  function finishConfirmedExtras(action: ConfirmableAction) {
    if (action.type === 'create-inspiration') {
      const item = createManualExecutableInspiration({
        title: action.title,
        notes: action.note
      })
      assistant(`已加入灵感库：「${item.title}」。`, '本地动作已执行')
      return true
    }
    if (action.type === 'update-inspiration') {
      updateExecutableInspiration(action.id, action.patch)
      assistant(`已更新灵感「${action.title}」。`, '本地动作已执行')
      return true
    }
    if (action.type === 'create-script') {
      const item = createManualExecutableInspiration({ title: action.title })
      assistant(`已加入灵感库：「${item.title}」。口播直接在灵感库里改。`, '本地动作已执行')
      return true
    }
    if (action.type === 'add-benchmark') {
      const account = addBenchmarkAccount({ handle: action.handle, tier: 'watch' })
      assistant(
        account ? `已把 ${account.handle} 加入对标库。` : '账号格式不对，需要 @handle 或主页链接。',
        '本地动作已执行'
      )
      return true
    }
    if (action.type === 'update-project') {
      updateProject(action.projectId, action.patch)
      assistant(`已更新项目「${action.patch.name || action.projectName}」。`, '本地动作已执行')
      return true
    }
    return false
  }

  function mergeConfirmAction(
    message: string,
    action: ConfirmableAction
  ): ConfirmableAction | 'missing' | null {
    if (action.type === 'create-project') {
      const draft = mergeProjectDraft(message, action.draft)
      if (missingProjectFields(draft).length) {
        askProjectFollowup(draft)
        return 'missing'
      }
      if (JSON.stringify(draft) !== JSON.stringify(action.draft)) {
        return { type: 'create-project', draft }
      }
      return null
    }
    if (action.type === 'create-task') {
      if (isCreateProjectMessage(message) || /独立项目|不是任务/.test(message)) {
        askProjectFollowup(mergeProjectDraft(message))
        return 'missing'
      }
      const next = mergeTaskDraft(message, {
        title: action.title,
        date: action.date,
        projectId: action.projectId,
        projectName: action.projectName
      })
      if (next.title && (next.title !== action.title || next.date !== action.date)) {
        return {
          type: 'create-task',
          projectId: action.projectId,
          projectName: action.projectName,
          title: next.title,
          date: next.date || action.date
        }
      }
      return null
    }
    if (action.type === 'reschedule') {
      const draft = resolveRescheduleTarget(message, action.draft)
      if (missingRescheduleFields(draft).length) {
        pendingWorkflow.value = { kind: 'reschedule', draft }
        assistant(
          `改期还缺：${missingRescheduleFields(draft).join('、')}。\n例如：英国项目的投放改到 08-18 到 08-31。`,
          '等待改期参数'
        )
        return 'missing'
      }
      if (JSON.stringify(draft) !== JSON.stringify(action.draft)) {
        return { type: 'reschedule', draft }
      }
      return null
    }
    if (action.type === 'collection') {
      const draft = mergeCollectionDraft(message, action.draft)
      if (missingCollectionFields(draft).length) {
        pendingWorkflow.value = { kind: 'inspiration', draft }
        assistant(
          `采集任务还缺：${missingCollectionFields(draft).join('、')}。\n例如：关键词 unboxing，20 条，近 7 天。`,
          '等待采集参数'
        )
        return 'missing'
      }
      if (JSON.stringify(draft) !== JSON.stringify(action.draft)) {
        return { type: 'collection', draft }
      }
      return null
    }
    if (action.type === 'progress') {
      const patch = { ...action.patch, ...parseProgress(message) }
      if (JSON.stringify(patch) !== JSON.stringify(action.patch)) {
        return { ...action, patch }
      }
    }
    return null
  }

  function mergeTaskDraft(message: string, draft: TaskDraft = {}): TaskDraft {
    const date = message.includes('明天')
      ? todayKey(1)
      : message.includes('今天')
        ? todayKey()
        : draft.date
    const title = message
      .replace(/^(?:2|任务|建任务|创建任务|新建任务)[：:\s]*/u, '')
      .replace(/(?:到|在)?(?:今天|明天)$/u, '')
      .replace(/[「」""]/g, '')
      .trim()
    return {
      ...draft,
      title: title && title.length <= 80 ? title : draft.title,
      date: date || draft.date || todayKey()
    }
  }

  function resolveRescheduleTarget(message: string, draft: RescheduleDraft = {}): RescheduleDraft {
    const project =
      findProjectByText(message) ||
      (draft.projectId &&
        dojoProjectStore.projects.find((item) => item.id === draft.projectId)) ||
      (dojoProjectStore.projects.length === 1 ? dojoProjectStore.projects[0] : null)
    const phase = findPhaseInMessage(message)
    let blockId = draft.blockId
    let phaseLabel = draft.phaseLabel || phase?.label
    if (project && phase) {
      const block = listProjectPhaseBlocks(project.id).find(
        (item) => phaseKeyFromBlockId(item.id, project.id) === phase.key
      )
      blockId = block?.id
      phaseLabel = phase.label
    } else if (project && !blockId) {
      const hit = listProjectPhaseBlocks(project.id).find((block) =>
        message.includes(block.title.slice(0, 8))
      )
      if (hit) {
        blockId = hit.id
        phaseLabel = PLAN_PHASE_META.find(
          (meta) => phaseKeyFromBlockId(hit.id, project.id) === meta.key
        )?.label
      }
    }
    const range = extractDateRange(message)
    return {
      projectId: project?.id || draft.projectId,
      projectName: project?.name || draft.projectName,
      phaseLabel,
      blockId,
      start: range?.start || draft.start,
      end: range?.end || draft.end
    }
  }

  function missingRescheduleFields(draft: RescheduleDraft) {
    const missing: string[] = []
    if (!draft.projectId) missing.push('哪个项目')
    if (!draft.blockId) missing.push('哪个环节（脚本/拍摄/剪辑/分发/投放…）')
    if (!draft.start || !draft.end) missing.push('新的起止日期')
    return missing
  }

  function executeReschedule(draft: RescheduleDraft) {
    const start = draft.start!
    const end = draft.end! >= start ? draft.end! : start
    patchScheduleBlock(draft.blockId!, { start, end })
    assistant(
      `已调整「${draft.projectName}」的「${draft.phaseLabel || '环节'}」时间：${start} → ${end}。时间规划与执行日历会共用这份日期。`,
      '本地动作已执行'
    )
  }

  function parseProgress(message: string) {
    const patterns = {
      accounts: /账号\s*(\d+)/,
      scripts: /脚本\s*(\d+)/,
      edited: /(?:成片|剪辑)\s*(\d+)/,
      approved: /过审\s*(\d+)/,
      distributed: /(?:已发视频|分发)\s*(\d+)/,
      exposure: /(?:播放量|曝光)\s*([\d,万]+)/
    } as const
    return Object.fromEntries(
      Object.entries(patterns).flatMap(([field, pattern]) => {
        const match = message.match(pattern)
        if (!match) return []
        const raw = match[1]
        const value = raw.includes('万')
          ? Math.round(Number(raw.replace('万', '')) * 10000)
          : Number(raw.replaceAll(',', ''))
        return [[field, value]]
      })
    )
  }

  async function handlePendingWorkflow(message: string) {
    const pending = pendingWorkflow.value
    if (!pending) return false

    if (isNegative(message) && pending.kind !== 'confirm-delete') {
      pendingWorkflow.value = null
      assistant('好，已取消，没有改工作台。')
      return true
    }

    if (pending.kind === 'confirm-action') {
      if (isAffirmative(message)) {
        const action = pending.action
        pendingWorkflow.value = null
        await executeConfirmedAction(action)
        return true
      }
      const merged = mergeConfirmAction(message, pending.action)
      if (merged === 'missing') return true
      if (merged) {
        proposeAction(merged)
        return true
      }
      if (isWriteIntent(message)) {
        pendingWorkflow.value = null
        return false
      }
      assistant('还没执行。回复「确认」开始，或直接改某一项；「取消」则不做。', '等待确认后执行')
      return true
    }

    if (pending.kind === 'clarify-create') {
      const trimmed = message.trim()
      if (/^1/.test(trimmed) || /独立项目|新建项目|创建项目/.test(message)) {
        const draft = mergeProjectDraft(
          message.replace(/^[1１][.、.]?\s*/, ''),
          {}
        )
        askProjectFollowup(draft)
        return true
      }
      if (/^2/.test(trimmed) || /任务/.test(message)) {
        pendingWorkflow.value = { kind: 'create-task', draft: {} }
        const project = resolveWriteProject(message)
        if (!project) {
          askWhichProject('建任务')
          return true
        }
        pendingWorkflow.value = {
          kind: 'create-task',
          draft: { projectId: project.id, projectName: project.name }
        }
        assistant(
          `好，在「${project.name}」下建任务。告诉我任务名称，以及排到今天还是明天。`,
          '等待任务名称'
        )
        return true
      }
      const draft = mergeProjectDraft(message)
      if (draft.name) {
        askProjectFollowup(draft)
        return true
      }
      assistant(
        '还是先说清楚：回 1 建独立项目，回 2 在当前项目下建任务。我先不执行。',
        '等待意图确认'
      )
      return true
    }

    if (pending.kind === 'create-task') {
      const draft = mergeTaskDraft(message, pending.draft)
      const project =
        (draft.projectId &&
          dojoProjectStore.projects.find((item) => item.id === draft.projectId)) ||
        resolveWriteProject(message, draft.projectName)
      if (!project) {
        pendingWorkflow.value = { kind: 'create-task', draft }
        askWhichProject('建任务')
        return true
      }
      if (!draft.title) {
        pendingWorkflow.value = { kind: 'create-task', draft }
        assistant(
          '任务还没齐。请告诉我任务名称，以及排到今天还是明天。',
          '等待任务名称'
        )
        return true
      }
      proposeAction({
        type: 'create-task',
        projectId: project.id,
        projectName: project.name,
        title: draft.title,
        date: draft.date || todayKey()
      })
      return true
    }

    if (pending.kind === 'confirm-delete') {
      if (/^(确认|删|删除|yes|y)$/i.test(message.trim())) {
        const target = pending.target
        pendingWorkflow.value = null
        if (target.type === 'project') {
          removeProject(target.id)
          assistant(`已删除项目「${target.name}」。`, '本地动作已执行')
        } else if (target.type === 'schedule') {
          removeScheduleBlock(target.id)
          assistant(`已删除时间条「${target.title}」。`, '本地动作已执行')
        } else if (target.type === 'inspiration') {
          removeExecutableInspiration(target.id)
          assistant(`已删除灵感「${target.title}」。`, '本地动作已执行')
        } else if (target.type === 'source') {
          removeInspirationSource(target.id)
          assistant(`已删除采集线索「${target.title}」。`, '本地动作已执行')
        } else if (target.type === 'benchmark') {
          removeBenchmarkAccount(target.id)
          assistant(`已移出对标账号「${target.title}」。`, '本地动作已执行')
        } else {
          removeScriptAsset(target.id)
          assistant(`已删除脚本「${target.title}」。`, '本地动作已执行')
        }
        return true
      }
      if (/取消|不要|算了/.test(message)) {
        pendingWorkflow.value = null
        assistant('好，已取消删除。')
        return true
      }
      assistant('删除还没执行。请回复「确认」继续，或「取消」。', '等待删除确认')
      return true
    }

    if (pending.kind === 'create-project') {
      const draft = mergeProjectDraft(message, pending.draft)
      const missing = missingProjectFields(draft)
      if (missing.length) {
        askProjectFollowup(draft)
        return true
      }
      proposeAction({ type: 'create-project', draft })
      return true
    }

    if (pending.kind === 'inspiration') {
      const draft = mergeCollectionDraft(message, pending.draft || {})
      const missing = missingCollectionFields(draft)
      if (missing.length) {
        pendingWorkflow.value = { kind: 'inspiration', draft }
        assistant(
          `采集任务还缺：${missing.join('、')}。\n例如：关键词 unboxing，20 条，近 7 天。`,
          '等待采集参数'
        )
        return true
      }
      proposeAction({ type: 'collection', draft })
      return true
    }

    if (pending.kind === 'reschedule') {
      const draft = resolveRescheduleTarget(message, pending.draft)
      const missing = missingRescheduleFields(draft)
      if (missing.length) {
        pendingWorkflow.value = { kind: 'reschedule', draft }
        assistant(
          `改期还缺：${missing.join('、')}。\n例如：英国项目的投放改到 08-18 到 08-31。`,
          '等待改期参数'
        )
        return true
      }
      proposeAction({ type: 'reschedule', draft })
      return true
    }

    if (pending.kind === 'progress') {
      const project = resolveWriteProject(message)
      const patch = parseProgress(message)
      if (!project) {
        askWhichProject('改现状')
        return true
      }
      if (!Object.keys(patch).length) {
        assistant(
          '我还没读到可写入的数字。请按“脚本 25，成片 10，过审 8，已发视频 7，播放量 37906”回复。',
          '仍在等待进度参数'
        )
        return true
      }
      proposeAction({
        type: 'progress',
        projectId: project.id,
        projectName: project.name,
        patch
      })
      return true
    }

    return false
  }

  function runAction(action: LocalAction) {
    if (action === 'progress') {
      assistant(localProjectProgress())
      return
    }
    if (action === 'accounts') {
      assistant(accountOpsBrief(), '账号矩阵 + 同步视频')
      return
    }
    if (action === 'inspiration') {
      pendingWorkflow.value = { kind: 'inspiration', draft: {} }
      assistant(
        '要建采集任务。请给我：一个独立检索词、要查多少条、最近多长时间（7/30/90 天）。\n例如：unboxing，20 条，近 7 天。不要带项目名或品牌名。',
        '等待采集参数'
      )
      return
    }
    pendingWorkflow.value = { kind: 'progress' }
    assistant(
      '请告诉我要写入的现状数字，例如“账号 3，脚本 25，成片 10，过审 8，已发视频 7，播放量 37906”。未提到的字段不会修改。',
      '等待进度参数'
    )
  }

  function tryAmbiguousWriteIntent(message: string) {
    if (!isBareCreateCommand(message)) return false
    pendingWorkflow.value = { kind: 'clarify-create' }
    const current = selectedProject.value?.name
    assistant(
      [
        '我还没完全确定你的意图，先不执行。',
        '你是要：',
        '1. 新建一个独立项目',
        current ? `2. 在「${current}」下建一条任务` : '2. 在某个项目下建一条任务',
        '回我序号，或把名称说清楚。'
      ].join('\n'),
      '等待意图确认'
    )
    return true
  }

  function tryCreateProjectIntent(message: string) {
    if (!isCreateProjectMessage(message)) return false
    const draft = mergeProjectDraft(message)
    const missing = missingProjectFields(draft)
    if (missing.length) {
      askProjectFollowup(draft)
      return true
    }
    proposeAction({ type: 'create-project', draft })
    return true
  }

  function tryRescheduleIntent(message: string) {
    if (!/(改|调整|推迟|提前|改到|改成).{0,12}(时间|日期|排期|日历|环节|投放|剪辑|拍摄|分发|脚本)/.test(message) &&
      !/(把|将).{0,20}(改到|调整到|改成)/.test(message)) {
      return false
    }
    const draft = resolveRescheduleTarget(message)
    const missing = missingRescheduleFields(draft)
    if (missing.length) {
      pendingWorkflow.value = { kind: 'reschedule', draft }
      assistant(
        `我理解你要改期。还缺：${missing.join('、')}。\n可以说：把「${
          draft.projectName || '某项目'
        }」的投放改到 08-18 到 08-31。`,
        '等待改期参数'
      )
      return true
    }
    proposeAction({ type: 'reschedule', draft })
    return true
  }

  function tryCollectionIntent(message: string) {
    if (!/(采集|检索|搜索|查询).{0,8}(灵感|内容|视频|线索)|(?:建|创建).{0,6}采集/.test(message)) {
      return false
    }
    const draft = mergeCollectionDraft(message)
    const missing = missingCollectionFields(draft)
    if (missing.length) {
      pendingWorkflow.value = { kind: 'inspiration', draft }
      assistant(
        `可以建采集。还缺：${missing.join('、')}。\n例如：关键词 游戏化转场，30 条，近 30 天。`,
        '等待采集参数'
      )
      return true
    }
    proposeAction({ type: 'collection', draft })
    return true
  }

  function tryDeleteIntent(message: string) {
    if (!/(删除|删掉|去掉)/.test(message)) return false
    const project = findProjectByText(message)
    if (project && /项目/.test(message)) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'project', id: project.id, name: project.name }
      }
      assistant(`确认删除项目「${project.name}」吗？回复「确认」执行，或「取消」。`, '等待删除确认')
      return true
    }
    const inspiration = dojoInspirationStore.executableInspirations.find((item) =>
      message.includes(item.title)
    )
    if (inspiration) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'inspiration', id: inspiration.id, title: inspiration.title }
      }
      assistant(`确认删除灵感「${inspiration.title}」吗？回复「确认」或「取消」。`, '等待删除确认')
      return true
    }
    const script = dojoInspirationStore.scripts.find((item) => message.includes(item.title))
    if (script) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'script', id: script.id, title: script.title }
      }
      assistant(`确认删除脚本「${script.title}」吗？回复「确认」或「取消」。`, '等待删除确认')
      return true
    }
    const source = dojoInspirationStore.sources.find(
      (item) => message.includes(item.name) || (item.query && message.includes(item.query))
    )
    if (source && /(线索|采集)/.test(message)) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'source', id: source.id, title: source.name }
      }
      assistant(`确认删除采集线索「${source.name}」吗？回复「确认」或「取消」。`, '等待删除确认')
      return true
    }
    const bench = dojoInspirationExplore.accounts.find((item) =>
      message.toLowerCase().includes(item.handle.replace(/^@/, '').toLowerCase())
    )
    if (bench && /(对标|账号)/.test(message)) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'benchmark', id: bench.id, title: bench.handle }
      }
      assistant(`确认移出对标账号「${bench.handle}」吗？回复「确认」或「取消」。`, '等待删除确认')
      return true
    }
    const block = dojoScheduleStore.blocks.find(
      (item) => message.includes(item.title) || message.includes(item.projectName)
    )
    if (block && /(时间条|环节|排期|任务)/.test(message)) {
      pendingWorkflow.value = {
        kind: 'confirm-delete',
        target: { type: 'schedule', id: block.id, title: block.title }
      }
      assistant(`确认删除时间条「${block.title}」吗？回复「确认」或「取消」。`, '等待删除确认')
      return true
    }
    return false
  }

  function tryLocalWrite(message: string) {
    if (isCreateProjectMessage(message)) return false
    if (!/(?:创建|新建|安排)(?:一个|一项)?任务/.test(message)) return false
    const project = resolveWriteProject(message)
    if (!project) {
      askWhichProject('建任务')
      return true
    }
    const match = message.match(
      /(?:创建|新建|安排)(?:一个|一项)?(?:任务)?[：:\s]*(.+?)(?:到|在)?(今天|明天)?$/
    )
    if (!match || !project) return false
    const rawTitle = match[1]
      ?.trim()
      .replace(/(?:到|在)?(?:今天|明天)$/, '')
      .trim()
    if (!rawTitle || rawTitle.length > 80) return false
    const date = match[2] === '明天' || message.includes('明天') ? todayKey(1) : todayKey()
    proposeAction({
      type: 'create-task',
      projectId: project.id,
      projectName: project.name,
      title: rawTitle,
      date
    })
    return true
  }

  function tryCatalogQuery(message: string) {
    if (/(灵感库|有哪些灵感|灵感有哪些)/.test(message)) {
      const items = dojoInspirationStore.executableInspirations.slice(0, 12)
      assistant(
        items.length
          ? `灵感库现有 ${dojoInspirationStore.executableInspirations.length} 条，最近：\n${items
              .map((item) => `- ${item.title}${item.category ? `（${item.category}）` : ''}`)
              .join('\n')}`
          : '灵感库还是空的。'
      )
      return true
    }
    if (/(脚本库|有哪些脚本|脚本有哪些|脚本制作)/.test(message)) {
      const items = dojoInspirationStore.executableInspirations.slice(0, 12)
      assistant(
        items.length
          ? `脚本制作已并入灵感库。现有 ${dojoInspirationStore.executableInspirations.length} 条灵感，最近：\n${items
              .map((item) => `- ${item.title}${item.category ? `（${item.category}）` : ''}`)
              .join('\n')}`
          : '脚本制作已并入灵感库，库里还是空的。'
      )
      return true
    }
    if (/(对标库|对标账号有哪些|有哪些对标)/.test(message)) {
      const items = dojoInspirationExplore.accounts
      assistant(
        items.length
          ? `对标库现有 ${items.length} 个账号：\n${items
              .map((item) => `- ${item.handle}（${item.tier}）`)
              .join('\n')}`
          : '对标库还没有账号。可从灵感库点主页加入。'
      )
      return true
    }
    if (/(采集线索|有哪些线索)/.test(message)) {
      const items = dojoInspirationStore.sources
      assistant(
        items.length
          ? `采集线索 ${items.length} 条：\n${items
              .map((item) => `- ${item.name}${item.query ? ` · 检索 ${item.query}` : ''}`)
              .join('\n')}`
          : '还没有采集线索。'
      )
      return true
    }
    return false
  }

  function tryContentWrite(message: string) {
    const inspirationTitle = message.match(/(?:新建|添加|加一条)灵感[：:\s]*([^\n,，。]+)/)?.[1]
    if (inspirationTitle) {
      proposeAction({ type: 'create-inspiration', title: inspirationTitle.trim() })
      return true
    }
    const scriptTitle = message.match(/(?:新建|添加|加一条)脚本[：:\s]*([^\n,，。]+)/)?.[1]
    if (scriptTitle) {
      proposeAction({ type: 'create-inspiration', title: scriptTitle.trim() })
      return true
    }
    const bench =
      message.match(/(?:加入|添加|加一个)对标(?:库|账号)?[：:\s]*([@\w./:-]+)/)?.[1] ||
      message.match(/(?:对标库|对标账号).{0,8}(@[\w.]+)/)?.[1]
    if (bench && /(加入|添加|加一个)/.test(message)) {
      proposeAction({ type: 'add-benchmark', handle: bench })
      return true
    }
    const rename = message.match(/把项目[「"]?([^」"]+)[」"]?改名为[「"]?([^」"]+)[」"]?/)
    if (rename) {
      const project = findProjectByText(rename[1])
      if (!project) {
        askWhichProject('改项目名')
        return true
      }
      proposeAction({
        type: 'update-project',
        projectId: project.id,
        projectName: project.name,
        patch: { name: rename[2].trim() }
      })
      return true
    }
    return false
  }

  async function trySyncAccounts(message: string) {
    if (!/(同步|刷新).{0,8}账号|账号.{0,6}(同步|刷新)/.test(message)) return false
    const handleMatch = message.match(/@([\w.]+)/)
    if (handleMatch) {
      proposeAction({ type: 'sync-account', handle: handleMatch[1] })
      return true
    }
    if (/全部|所有/.test(message)) {
      const count = Math.min(8, dojoAccountStore.accounts.length)
      if (!count) {
        assistant('账号矩阵里还没有账号，没法同步。')
        return true
      }
      proposeAction({ type: 'sync-all', count })
      return true
    }
    assistant('可以说「同步全部账号」或「同步 @handle」。', '等待同步目标')
    return true
  }

  async function send(message: string) {
    const history = messages.value
      .filter((item) => item.content)
      .slice(-24)
      .map((item) => ({ role: item.role, content: item.content }))

    appendGlobalChatMessage({ role: 'user', content: message })
    if (await handlePendingWorkflow(message)) return
    if (tryAmbiguousWriteIntent(message)) return
    if (tryCreateProjectIntent(message)) return
    if (tryRescheduleIntent(message)) return
    if (tryCollectionIntent(message)) return
    if (tryDeleteIntent(message)) return
    if (tryContentWrite(message)) return
    if (tryCatalogQuery(message)) return
    if (await trySyncAccounts(message)) return
    if (tryLocalWrite(message)) return

    if (
      /运营状态|账号.{0,6}(怎么样|状态)|播放(最好|最高)|哪个账号|停滞|卡住|没更新/.test(message)
    ) {
      runAction('accounts')
      return
    }
    if (/几个项目|项目数量|有多少项目|目前有几个项目/.test(message)) {
      const names = dojoProjectStore.projects.map((project) => project.name)
      assistant(
        names.length
          ? `当前共有 ${names.length} 个项目：${names.join('、')}。`
          : '当前还没有项目。可以说「新建项目」让我帮你建。'
      )
      return
    }
    if (message.includes('项目进度') || message.includes('进度怎么样')) {
      const project = findProjectByText(message)
      assistant(localProjectProgress(project?.id))
      return
    }
    if (message.includes('填写进度') || message.includes('更新进度') || message.includes('改现状')) {
      runAction('fill-progress')
      return
    }
    if (/(搜集|采集|检索).{0,4}灵感|灵感.{0,4}(搜集|采集|检索)/.test(message)) {
      runAction('inspiration')
      return
    }

    dojoChatStore.loading = true
    try {
      const reply = await chatAgent(message, contextSnapshot.value, history)
      appendGlobalChatMessage({
        role: 'assistant',
        content: reply.content,
        sources: reply.sources,
        memoryHint: reply.memoryHint
      })
    } catch (error) {
      assistant(error instanceof Error ? error.message : 'AI 请求失败，本地数据仍可正常执行。')
    } finally {
      dojoChatStore.loading = false
    }
  }

  return {
    messages,
    pageLabel,
    send,
    runAction,
    contextSnapshot,
    loading: computed(() => dojoChatStore.loading)
  }
}
