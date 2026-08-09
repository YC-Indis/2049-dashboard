/**
 * 工作复盘：每日自动记录（指标变化 / 账号进出 / 账号自身变化）+ 人工补充。
 * 作为后续迭代优化的数据来源之一。
 */
import { reactive } from 'vue'
import { DOJO_TODAY } from '@/utils/dojoDates'
import { loadTable, saveTable } from '@/utils/dojoPersist'
import { dojoAccountStore, accountVideos, type MatrixAccount } from '@/store/dojoAccountStore'
import { dojoProjectRuntime, type ProjectCurrent } from '@/store/dojoProjectRuntime'
import { getProjectById } from '@/store/dojoProjectStore'

export type WorklogEventType =
  | 'account_add'
  | 'account_remove'
  | 'account_change'
  | 'metric'
  | 'manual'

export interface WorklogEvent {
  id: string
  date: string
  type: WorklogEventType
  source: 'auto' | 'manual'
  title: string
  detail?: string
  projectId?: string
  projectName?: string
  handle?: string
  field?: string
  before?: string | number | null
  after?: string | number | null
  createdAt: string
  /** 人工改过的标记 */
  edited?: boolean
}

interface AccountSnap {
  handle: string
  projectId: string
  followers: number | null
  videos: number
  status: string
  nickname?: string
}

interface ProjectSnap {
  projectId: string
  name: string
  accounts: number
  scripts: number
  edited: number
  approved: number
  distributed: number
  exposure: number
}

interface WorklogSnapshot {
  accounts: Record<string, AccountSnap>
  projects: Record<string, ProjectSnap>
}

const TABLE_EVENTS = 'worklogEvents'
const TABLE_NOTES = 'worklogDayNotes'
const TABLE_SNAP = 'worklogSnapshot'

export const dojoWorklogStore = reactive({
  events: (loadTable<WorklogEvent[]>(TABLE_EVENTS) || []) as WorklogEvent[],
  dayNotes: (loadTable<Record<string, string>>(TABLE_NOTES) || {}) as Record<string, string>,
  revision: 0
})

function persistEvents() {
  dojoWorklogStore.revision++
  saveTable(TABLE_EVENTS, dojoWorklogStore.events)
}

function persistNotes() {
  dojoWorklogStore.revision++
  saveTable(TABLE_NOTES, dojoWorklogStore.dayNotes)
}

function loadSnapshot(): WorklogSnapshot | null {
  return loadTable<WorklogSnapshot>(TABLE_SNAP)
}

function saveSnapshot(snap: WorklogSnapshot) {
  saveTable(TABLE_SNAP, snap)
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function today() {
  return DOJO_TODAY
}

function projectName(id?: string) {
  if (!id) return ''
  return getProjectById(id)?.name || id
}

function videoCountOf(handle: string) {
  return accountVideos(handle).length
}

function takeSnapshot(): WorklogSnapshot {
  const accounts: Record<string, AccountSnap> = {}
  dojoAccountStore.accounts.forEach((a) => {
    const h = a.handle.toLowerCase()
    accounts[h] = {
      handle: a.handle,
      projectId: a.projectId || '',
      followers: a.followers ?? null,
      videos: a.totalVideos ?? videoCountOf(a.handle),
      status: a.status,
      nickname: a.nickname
    }
  })
  const projects: Record<string, ProjectSnap> = {}
  Object.values(dojoProjectRuntime).forEach((rt) => {
    projects[rt.projectId] = {
      projectId: rt.projectId,
      name: projectName(rt.projectId) || rt.brand,
      accounts: rt.current.accounts,
      scripts: rt.current.scripts,
      edited: rt.current.edited,
      approved: rt.current.approved,
      distributed: rt.current.distributed,
      exposure: rt.current.exposure
    }
  })
  return { accounts, projects }
}

function pushEvent( partial: Omit<WorklogEvent, 'id' | 'createdAt' | 'date'> & { date?: string }) {
  const event: WorklogEvent = {
    id: uid('wl'),
    date: partial.date || today(),
    createdAt: new Date().toISOString(),
    ...partial
  }
  dojoWorklogStore.events.unshift(event)
  persistEvents()
  return event
}

/** 去重：同一天同类同对象同字段短时间不重复刷 */
function recentlyLogged(match: {
  type: WorklogEventType
  handle?: string
  projectId?: string
  field?: string
  after?: string | number | null
}): boolean {
  const day = today()
  return dojoWorklogStore.events.some(
    (e) =>
      e.date === day &&
      e.type === match.type &&
      e.handle === match.handle &&
      e.projectId === match.projectId &&
      e.field === match.field &&
      e.after === match.after &&
      Date.now() - new Date(e.createdAt).getTime() < 60_000
  )
}

export function eventsOnDate(date: string) {
  return dojoWorklogStore.events
    .filter((e) => e.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listWorklogDates(limit = 60): string[] {
  const set = new Set<string>()
  dojoWorklogStore.events.forEach((e) => set.add(e.date))
  Object.keys(dojoWorklogStore.dayNotes).forEach((d) => {
    if (dojoWorklogStore.dayNotes[d]?.trim()) set.add(d)
  })
  set.add(today())
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, limit)
}

export function getDayNote(date: string) {
  return dojoWorklogStore.dayNotes[date] || ''
}

export function setDayNote(date: string, note: string) {
  if (!note.trim()) {
    delete dojoWorklogStore.dayNotes[date]
  } else {
    dojoWorklogStore.dayNotes[date] = note
  }
  persistNotes()
}

export function addManualEvent(input: {
  date?: string
  title: string
  detail?: string
  projectId?: string
  handle?: string
}) {
  return pushEvent({
    type: 'manual',
    source: 'manual',
    date: input.date,
    title: input.title.trim(),
    detail: input.detail?.trim(),
    projectId: input.projectId,
    projectName: projectName(input.projectId),
    handle: input.handle
  })
}

export function updateWorklogEvent(
  id: string,
  patch: Partial<Pick<WorklogEvent, 'title' | 'detail' | 'projectId' | 'handle' | 'date'>>
) {
  const idx = dojoWorklogStore.events.findIndex((e) => e.id === id)
  if (idx < 0) return null
  const prev = dojoWorklogStore.events[idx]
  dojoWorklogStore.events[idx] = {
    ...prev,
    ...patch,
    projectName:
      patch.projectId !== undefined ? projectName(patch.projectId) : prev.projectName,
    edited: true
  }
  persistEvents()
  return dojoWorklogStore.events[idx]
}

export function removeWorklogEvent(id: string) {
  const n = dojoWorklogStore.events.length
  dojoWorklogStore.events = dojoWorklogStore.events.filter((e) => e.id !== id)
  if (dojoWorklogStore.events.length !== n) persistEvents()
}

/** 账号入池 */
export function logAccountAdded(account: MatrixAccount, note?: string) {
  if (
    recentlyLogged({
      type: 'account_add',
      handle: account.handle,
      after: account.handle
    })
  ) {
    return
  }
  pushEvent({
    type: 'account_add',
    source: 'auto',
    title: `账号入池 ${account.handle}`,
    detail: note || `来源 ${account.source}${account.segment ? ` · ${account.segment}` : ''}`,
    projectId: account.projectId || undefined,
    projectName: projectName(account.projectId),
    handle: account.handle,
    after: account.handle
  })
}

/** 账号移出 */
export function logAccountRemoved(account: Pick<MatrixAccount, 'handle' | 'projectId' | 'nickname'>) {
  if (
    recentlyLogged({
      type: 'account_remove',
      handle: account.handle,
      after: account.handle
    })
  ) {
    return
  }
  pushEvent({
    type: 'account_remove',
    source: 'auto',
    title: `账号移出 ${account.handle}`,
    detail: account.nickname ? `昵称 ${account.nickname}` : undefined,
    projectId: account.projectId || undefined,
    projectName: projectName(account.projectId),
    handle: account.handle,
    before: account.handle
  })
}

/** 批量导入摘要 */
export function logAccountImportSummary(added: number, updated: number, projectId?: string) {
  if (!added && !updated) return
  pushEvent({
    type: 'account_add',
    source: 'auto',
    title: `批量导入账号：新增 ${added} · 更新 ${updated}`,
    detail: projectId ? `归属 ${projectName(projectId)}` : undefined,
    projectId,
    projectName: projectName(projectId),
    field: 'import_batch',
    after: added
  })
}

/**
 * 对比快照，把差值写成当日复盘事件，并刷新快照。
 * 可在复盘页进入、或关键写操作后调用。
 */
export function reconcileWorklog(): number {
  const prev = loadSnapshot()
  const next = takeSnapshot()
  if (!prev) {
    saveSnapshot(next)
    const count = Object.keys(next.accounts).length
    // 首次接入复盘：把当前账号池落一条基线，避免「已有账号但复盘空白」
    if (count > 0 && !dojoWorklogStore.events.length) {
      pushEvent({
        type: 'account_add',
        source: 'auto',
        title: `账号池快照：共 ${count} 个账号`,
        detail: '复盘开始记录；之后导入 / 删除 / 同步产生的变化会自动写入',
        field: 'baseline_sync',
        after: count
      })
      return 1
    }
    return 0
  }

  let n = 0

  // 账号进出
  Object.keys(next.accounts).forEach((h) => {
    if (!prev.accounts[h]) {
      const a = next.accounts[h]
      if (
        !recentlyLogged({ type: 'account_add', handle: a.handle, after: a.handle })
      ) {
        pushEvent({
          type: 'account_add',
          source: 'auto',
          title: `账号入池 ${a.handle}`,
          projectId: a.projectId || undefined,
          projectName: projectName(a.projectId),
          handle: a.handle,
          after: a.handle
        })
        n++
      }
    }
  })
  Object.keys(prev.accounts).forEach((h) => {
    if (!next.accounts[h]) {
      const a = prev.accounts[h]
      if (
        !recentlyLogged({ type: 'account_remove', handle: a.handle, after: a.handle })
      ) {
        pushEvent({
          type: 'account_remove',
          source: 'auto',
          title: `账号移出 ${a.handle}`,
          projectId: a.projectId || undefined,
          projectName: projectName(a.projectId),
          handle: a.handle,
          before: a.handle
        })
        n++
      }
    }
  })

  // 账号自身变化（粉丝 / 视频 / 归属 / 状态）
  Object.keys(next.accounts).forEach((h) => {
    const a = next.accounts[h]
    const b = prev.accounts[h]
    if (!b) return
    const checks: Array<{ field: string; label: string; before: string | number | null; after: string | number | null }> =
      [
        { field: 'followers', label: '粉丝', before: b.followers, after: a.followers },
        { field: 'videos', label: '已发布视频', before: b.videos, after: a.videos },
        { field: 'projectId', label: '归属项目', before: projectName(b.projectId) || '未归属', after: projectName(a.projectId) || '未归属' },
        { field: 'status', label: '状态', before: b.status, after: a.status }
      ]
    checks.forEach((c) => {
      if (c.before === c.after) return
      if (
        recentlyLogged({
          type: 'account_change',
          handle: a.handle,
          field: c.field,
          after: c.after
        })
      ) {
        return
      }
      pushEvent({
        type: 'account_change',
        source: 'auto',
        title: `${a.handle} · ${c.label} ${formatDelta(c.before, c.after)}`,
        detail: `${c.before ?? '—'} → ${c.after ?? '—'}`,
        projectId: a.projectId || undefined,
        projectName: projectName(a.projectId),
        handle: a.handle,
        field: c.field,
        before: c.before,
        after: c.after
      })
      n++
    })
  })

  // 项目现状指标
  const metricKeys: Array<{ key: keyof ProjectCurrent; label: string }> = [
    { key: 'accounts', label: '账号数' },
    { key: 'scripts', label: '脚本产出' },
    { key: 'edited', label: '成片数' },
    { key: 'approved', label: '过审数' },
    { key: 'distributed', label: '分发量' },
    { key: 'exposure', label: '曝光量' }
  ]
  Object.keys(next.projects).forEach((pid) => {
    const a = next.projects[pid]
    const b = prev.projects[pid]
    if (!b) return
    metricKeys.forEach(({ key, label }) => {
      if (a[key] === b[key]) return
      if (
        recentlyLogged({
          type: 'metric',
          projectId: pid,
          field: key,
          after: a[key]
        })
      ) {
        return
      }
      pushEvent({
        type: 'metric',
        source: 'auto',
        title: `${a.name} · ${label} ${formatDelta(b[key], a[key])}`,
        detail: `${b[key]} → ${a[key]}`,
        projectId: pid,
        projectName: a.name,
        field: key,
        before: b[key],
        after: a[key]
      })
      n++
    })
  })

  saveSnapshot(next)

  // 快照已有、但事件表仍空（历史数据未接入）：补一条当前池基线
  if (!dojoWorklogStore.events.length && Object.keys(next.accounts).length) {
    pushEvent({
      type: 'account_add',
      source: 'auto',
      title: `账号池快照：共 ${Object.keys(next.accounts).length} 个账号`,
      detail: '复盘开始记录；之后导入 / 删除 / 同步产生的变化会自动写入',
      field: 'baseline_sync',
      after: Object.keys(next.accounts).length
    })
    return Math.max(n, 1)
  }

  return n
}

function formatDelta(before: string | number | null | undefined, after: string | number | null | undefined) {
  if (typeof before === 'number' && typeof after === 'number') {
    const d = after - before
    if (d > 0) return `+${d.toLocaleString()}`
    if (d < 0) return d.toLocaleString()
    return '0'
  }
  return '变更'
}

/** 强制刷新快照（不记事件），用于初始化基线 */
export function resetWorklogSnapshot() {
  saveSnapshot(takeSnapshot())
}

export function dayStats(date: string) {
  const list = eventsOnDate(date)
  return {
    total: list.length,
    accountAdd: list.filter((e) => e.type === 'account_add').length,
    accountRemove: list.filter((e) => e.type === 'account_remove').length,
    accountChange: list.filter((e) => e.type === 'account_change').length,
    metric: list.filter((e) => e.type === 'metric').length,
    manual: list.filter((e) => e.type === 'manual').length
  }
}
