import { reactive } from 'vue'
import { matrixBlueprints } from '@/mock/dojo/matrixBlueprints'
import {
  executableInspirationFixtures,
  inspirationCandidateFixtures,
  inspirationSourceFixtures,
  scriptAssetFixtures
} from '@/mock/dojo/inspirationFixtures'
import {
  inspirationCollectionService,
  ProviderNotConfiguredError
} from '@/services/inspirationCollectionService'
import type {
  CandidateStatus,
  CollectionJob,
  ExecutableInspiration,
  InspirationCandidate,
  InspirationLocalState,
  InspirationPlatform,
  InspirationLens,
  InspirationRanking,
  InspirationSourceKind,
  InspirationStatus,
  ScriptAsset
} from '@/types/dojoInspiration'
import {
  inferCategory,
  mapBoardCategory,
  normalizeTags,
  type InspirationCategory
} from '@/utils/dojoInspirationLayers'
import { buildCharacterScriptDraft, stripMarkdown } from '@/utils/dojoScriptFormat'
import { loadTable, saveTable } from '@/utils/dojoPersist'
import { ingestRankCandidates } from '@/store/dojoInspirationRankStore'

function classifyInspiration(input: {
  title?: string
  angle?: string
  hook?: string
  tags?: string[]
  boardCategory?: string
  sourceId?: string
}): { category: InspirationCategory; tags: string[] } {
  const tags = normalizeTags(input.tags)
  const category =
    mapBoardCategory(input.boardCategory) ||
    (input.sourceId?.startsWith('bench:') ? '对标账号' : undefined) ||
    inferCategory(`${input.title || ''} ${input.angle || ''} ${input.hook || ''}`, tags)
  return { category, tags }
}

function withLayers<T extends { category?: string; tags?: string[] }>(
  item: T,
  extra?: { title?: string; angle?: string; hook?: string; sourceId?: string; boardCategory?: string }
): T {
  const layers = classifyInspiration({
    title: extra?.title,
    angle: extra?.angle,
    hook: extra?.hook,
    tags: item.tags,
    boardCategory: extra?.boardCategory,
    sourceId: extra?.sourceId
  })
  return {
    ...item,
    category: item.category || layers.category,
    tags: item.tags?.length ? normalizeTags(item.tags) : layers.tags
  }
}

const TABLE_INSPIRATION_STATE = 'inspirationLocalState'

const persisted = loadTable<Omit<InspirationLocalState, 'revision'>>(TABLE_INSPIRATION_STATE)
const fixtureScriptIds = new Set(scriptAssetFixtures.map((script) => script.id))
const savedScripts = (persisted?.scripts || []).filter((script) => !fixtureScriptIds.has(script.id))

function copyFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const dojoInspirationStore = reactive<InspirationLocalState>({
  statusById: persisted?.statusById || {},
  notesById: persisted?.notesById || {},
  annotationsById: persisted?.annotationsById || {},
  sources: persisted?.sources?.length ? persisted.sources : copyFixture(inspirationSourceFixtures),
  jobs: persisted?.jobs || [],
  candidates: persisted?.candidates?.length
    ? persisted.candidates
    : copyFixture(inspirationCandidateFixtures),
  executableInspirations: (persisted?.executableInspirations?.length
    ? persisted.executableInspirations
    : copyFixture(executableInspirationFixtures)
  ).map((item) =>
    withLayers(item, {
      title: item.title,
      angle: item.angle,
      hook: item.hook
    })
  ),
  scripts: savedScripts.map((item) =>
    withLayers(item, {
      title: item.title,
      hook: item.hook
    })
  ),
  conversations: persisted?.conversations || [],
  revision: 0
})

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function persist() {
  dojoInspirationStore.revision++
  saveTable(TABLE_INSPIRATION_STATE, {
    statusById: dojoInspirationStore.statusById,
    notesById: dojoInspirationStore.notesById,
    annotationsById: dojoInspirationStore.annotationsById,
    sources: dojoInspirationStore.sources,
    jobs: dojoInspirationStore.jobs,
    candidates: dojoInspirationStore.candidates,
    executableInspirations: dojoInspirationStore.executableInspirations,
    scripts: dojoInspirationStore.scripts,
    conversations: dojoInspirationStore.conversations
  })
}

if (
  dojoInspirationStore.sources.some(
    (source) =>
      source.id === 'source-xros6-local' &&
      /battery test|repair proof|teardown|^xros$/i.test(source.query.trim())
  )
) {
  dojoInspirationStore.sources.forEach((source) => {
    if (
      source.id === 'source-xros6-local' &&
      /battery test|repair proof|teardown|^xros$/i.test(source.query.trim())
    ) {
      source.query = ''
      source.kind = 'local-import'
    }
  })
  persist()
}

export function inspirationStatus(id: string): InspirationStatus {
  return dojoInspirationStore.statusById[id] || 'new'
}

export function setInspirationStatus(id: string, status: InspirationStatus) {
  dojoInspirationStore.statusById[id] = status
  persist()
}

export function setInspirationNote(id: string, note: string) {
  dojoInspirationStore.notesById[id] = note
  persist()
}

export function addInspirationAnnotation(id: string, text: string) {
  const value = text.trim()
  if (!value) return null
  const annotation = {
    id: createId('inspiration-note'),
    text: value,
    createdAt: new Date().toISOString()
  }
  dojoInspirationStore.annotationsById[id] = [
    ...(dojoInspirationStore.annotationsById[id] || []),
    annotation
  ]
  const executable = dojoInspirationStore.executableInspirations.find((item) => item.id === id)
  if (executable) {
    executable.annotations = [...executable.annotations, annotation]
    executable.updatedAt = new Date().toISOString()
  }
  persist()
  return annotation
}

export function removeInspirationAnnotation(id: string, annotationId: string) {
  dojoInspirationStore.annotationsById[id] = (
    dojoInspirationStore.annotationsById[id] || []
  ).filter((annotation) => annotation.id !== annotationId)
  const executable = dojoInspirationStore.executableInspirations.find((item) => item.id === id)
  if (executable) {
    executable.annotations = executable.annotations.filter((item) => item.id !== annotationId)
    executable.updatedAt = new Date().toISOString()
  }
  persist()
}

export function createInspirationSource(input: {
  name: string
  platform: InspirationPlatform
  kind: InspirationSourceKind
  query: string
  lenses?: InspirationLens[]
  timeWindowDays: 7 | 30 | 90 | 0
  ranking: InspirationRanking
  defaultLimit: number
}) {
  const source = {
    id: createId('source'),
    name: input.name.trim(),
    platform: input.platform,
    kind: input.kind,
    query: input.query.trim(),
    lenses: input.lenses ? [...input.lenses] : [],
    timeWindowDays: input.timeWindowDays,
    ranking: input.ranking,
    defaultLimit: Math.min(100, Math.max(1, input.defaultLimit)),
    enabled: true,
    createdAt: new Date().toISOString()
  }
  dojoInspirationStore.sources.unshift(source)
  persist()
  return source
}

export function updateInspirationSource(
  sourceId: string,
  input: {
    name: string
    platform: InspirationPlatform
    kind: InspirationSourceKind
    query: string
    lenses?: InspirationLens[]
    timeWindowDays: 7 | 30 | 90 | 0
    ranking: InspirationRanking
    defaultLimit: number
  }
) {
  const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
  if (!source) return null
  Object.assign(source, {
    name: input.name.trim(),
    platform: input.platform,
    kind: input.kind,
    query: input.query.trim(),
    lenses: input.lenses ? [...input.lenses] : [],
    timeWindowDays: input.timeWindowDays,
    ranking: input.ranking,
    defaultLimit: Math.min(100, Math.max(1, input.defaultLimit))
  })
  persist()
  return source
}

export function removeInspirationSource(sourceId: string) {
  const index = dojoInspirationStore.sources.findIndex((item) => item.id === sourceId)
  if (index < 0) return false
  dojoInspirationStore.sources.splice(index, 1)
  dojoInspirationStore.jobs = dojoInspirationStore.jobs.filter((job) => job.sourceId !== sourceId)
  dojoInspirationStore.candidates = dojoInspirationStore.candidates.filter(
    (candidate) => candidate.sourceId !== sourceId || candidate.status === 'promoted'
  )
  persist()
  return true
}

export function toggleInspirationSource(sourceId: string) {
  const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
  if (!source) return
  source.enabled = !source.enabled
  persist()
}

export async function runInspirationCollection(sourceId: string, requestedCount: number) {
  const source = dojoInspirationStore.sources.find((item) => item.id === sourceId)
  if (!source) return null
  const job: CollectionJob = {
    id: createId('collection'),
    sourceId,
    requestedCount: Math.min(100, Math.max(1, requestedCount)),
    status: 'running',
    provider: 'rapidapi',
    resultCount: 0,
    startedAt: new Date().toISOString()
  }
  dojoInspirationStore.jobs.unshift(job)
  persist()

  try {
    const result = await inspirationCollectionService.collect({
      source,
      limit: job.requestedCount
    })
    const collectedAt = new Date().toISOString()
    const existingById = new Map(
      dojoInspirationStore.candidates.map((candidate) => [candidate.id, candidate])
    )
    const refreshedItems = result.items.map((item) => {
      const existing = existingById.get(item.id)
      return {
        ...item,
        sourceId,
        collectionJobId: job.id,
        collectedAt,
        status: existing?.status || ('new' as const)
      }
    })
    const refreshedIds = new Set(refreshedItems.map((item) => item.id))
    dojoInspirationStore.candidates = [
      ...refreshedItems,
      ...dojoInspirationStore.candidates.filter((item) => !refreshedIds.has(item.id))
    ]
    job.status = 'completed'
    job.resultCount = refreshedItems.length
    if (!refreshedItems.length && result.rawFetched > 0) {
      job.message = `接口返回 ${result.rawFetched} 条，时间窗内可用 ${refreshedItems.length} 条`
    } else if (!refreshedItems.length) {
      job.message = `RapidAPI 对「${result.searchQuery || '该词'}」未返回视频（TikTok 上有结果≠该接口有结果）。请只换一个主词再试，或改用灵感库 AI 导入粘贴链接。`
    }
    job.completedAt = new Date().toISOString()
    ingestRankCandidates(refreshedItems, result.searchQuery)
  } catch (error) {
    job.status = error instanceof ProviderNotConfiguredError ? 'awaiting-provider' : 'failed'
    job.message = error instanceof Error ? error.message : '采集失败，请稍后重试。'
    job.completedAt = new Date().toISOString()
  } finally {
    persist()
  }
  return job
}

export function upsertInspirationCandidates(items: InspirationCandidate[]) {
  if (!items.length) return
  const existingById = new Map(
    dojoInspirationStore.candidates.map((candidate) => [candidate.id, candidate])
  )
  const next = items.map((item) => ({
    ...item,
    status: existingById.get(item.id)?.status || item.status || ('new' as const)
  }))
  const nextIds = new Set(next.map((item) => item.id))
  dojoInspirationStore.candidates = [
    ...next,
    ...dojoInspirationStore.candidates.filter((item) => !nextIds.has(item.id))
  ]
  persist()
}

export function setCandidateStatus(candidateId: string, status: CandidateStatus) {
  const candidate = dojoInspirationStore.candidates.find((item) => item.id === candidateId)
  if (!candidate) return
  candidate.status = status
  persist()
}

export function promoteCandidate(candidateId: string) {
  const candidate = dojoInspirationStore.candidates.find((item) => item.id === candidateId)
  if (!candidate) return null
  const existing = dojoInspirationStore.executableInspirations.find(
    (item) => item.candidateId === candidateId
  )
  if (existing) return existing
  const blueprintId = String(candidate.rawPayload?.blueprintId || '')
  const blueprint = matrixBlueprints.find((item) => item.id === blueprintId)
  const now = new Date().toISOString()
  candidate.status = 'promoted'
  const executable: ExecutableInspiration = {
    id: createId('executable'),
    candidateId,
    blueprintId: blueprint?.id,
    title: candidate.title,
    angle: blueprint?.promise || candidate.summary,
    hook: blueprint?.variants[0]?.hook || candidate.summary,
    referenceUrl: candidate.url,
    sourceAuthor: candidate.author,
    sourcePlatform: candidate.platform,
    shotPlan: blueprint ? [...blueprint.beats] : ['开场证据', '过程展示', '结果收束'],
    copyPlan: blueprint
      ? [blueprint.productRule, blueprint.variants[0]?.distribution].filter(Boolean)
      : [candidate.summary],
    musicPlan: blueprint ? [blueprint.audio] : ['待确认音乐与节拍'],
    annotations: [],
    category: '未分类',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
  candidate.status = 'promoted'
  dojoInspirationStore.executableInspirations.unshift(executable)
  persist()
  return executable
}

export function removeExecutableInspiration(inspirationId: string) {
  const index = dojoInspirationStore.executableInspirations.findIndex(
    (item) => item.id === inspirationId
  )
  if (index < 0) return false
  const inspiration = dojoInspirationStore.executableInspirations[index]
  dojoInspirationStore.executableInspirations.splice(index, 1)
  delete dojoInspirationStore.annotationsById[inspirationId]
  if (inspiration.candidateId) {
    const candidate = dojoInspirationStore.candidates.find(
      (item) => item.id === inspiration.candidateId
    )
    if (candidate) candidate.status = 'qualified'
  }
  persist()
  return true
}

export function updateExecutableInspiration(
  inspirationId: string,
  patch: Pick<
    Partial<ExecutableInspiration>,
    | 'title'
    | 'angle'
    | 'hook'
    | 'referenceUrl'
    | 'sourceAuthor'
    | 'transcript'
    | 'visualNotes'
    | 'category'
    | 'tags'
  >
) {
  const inspiration = dojoInspirationStore.executableInspirations.find(
    (item) => item.id === inspirationId
  )
  if (!inspiration) return null
  if (patch.title !== undefined) inspiration.title = patch.title.trim()
  if (patch.angle !== undefined) inspiration.angle = patch.angle.trim()
  if (patch.hook !== undefined) inspiration.hook = patch.hook.trim()
  if (patch.referenceUrl !== undefined) inspiration.referenceUrl = patch.referenceUrl.trim()
  if (patch.sourceAuthor !== undefined)
    inspiration.sourceAuthor = patch.sourceAuthor.trim() || undefined
  if (patch.transcript !== undefined) inspiration.transcript = patch.transcript.trim() || undefined
  if (patch.visualNotes !== undefined)
    inspiration.visualNotes = patch.visualNotes.trim() || undefined
  if (patch.category !== undefined) inspiration.category = patch.category.trim() || '未分类'
  if (patch.tags !== undefined) inspiration.tags = normalizeTags(patch.tags)
  inspiration.updatedAt = new Date().toISOString()
  persist()
  return inspiration
}

export function createManualExecutableInspiration(input: {
  title: string
  referenceUrl?: string
  sourceAuthor?: string
  notes?: string
  hook?: string
  shotPlan?: string[]
  copyPlan?: string[]
  musicPlan?: string[]
  visualNotes?: string
  transcript?: string
  category?: string
  tags?: string[]
}) {
  const now = new Date().toISOString()
  const notes = input.notes?.trim() || ''
  const inspiration: ExecutableInspiration = {
    id: createId('executable'),
    title: input.title.trim(),
    angle: notes,
    hook: input.hook?.trim() || '',
    referenceUrl: input.referenceUrl?.trim() || undefined,
    sourceAuthor: input.sourceAuthor?.trim() || undefined,
    transcript: input.transcript?.trim() || notes || undefined,
    visualNotes: input.visualNotes?.trim() || undefined,
    shotPlan: (input.shotPlan || []).map((item) => item.trim()).filter(Boolean),
    copyPlan: (input.copyPlan || []).map((item) => item.trim()).filter(Boolean),
    musicPlan: (input.musicPlan || []).map((item) => item.trim()).filter(Boolean),
    annotations: [],
    category: input.category?.trim() || '未分类',
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now
  }
  dojoInspirationStore.executableInspirations.unshift(inspiration)
  persist()
  return inspiration
}

export function createScriptAsset(inspirationId: string) {
  const inspiration = dojoInspirationStore.executableInspirations.find(
    (item) => item.id === inspirationId
  )
  if (!inspiration) return null
  const transcript =
    inspiration.transcript?.trim() ||
    inspiration.copyPlan.filter(Boolean).join('\n').trim()
  const visualNotes =
    inspiration.visualNotes?.trim() ||
    inspiration.shotPlan.filter(Boolean).join('\n').trim()
  if (!transcript && !visualNotes && !inspiration.hook?.trim()) return null
  const existing = dojoInspirationStore.scripts.find((item) => item.inspirationId === inspirationId)
  if (existing) return existing

  let sourceAuthor = inspiration.sourceAuthor
  let sourcePlatform = inspiration.sourcePlatform
  if ((!sourceAuthor || !sourcePlatform) && inspiration.candidateId) {
    const candidate = dojoInspirationStore.candidates.find(
      (item) => item.id === inspiration.candidateId
    )
    sourceAuthor = sourceAuthor || candidate?.author
    sourcePlatform = sourcePlatform || candidate?.platform
  }

  const now = new Date().toISOString()
  const script: ScriptAsset = {
    id: createId('script'),
    inspirationId,
    referenceUrl: inspiration.referenceUrl,
    sourceAuthor,
    sourcePlatform,
    title: inspiration.title,
    status: 'draft',
    hook: inspiration.hook,
    body: buildCharacterScriptDraft({
      sourceAuthor,
      referenceUrl: inspiration.referenceUrl,
      transcript,
      visualNotes,
      hook: inspiration.hook
    }),
    transcript,
    visualNotes,
    category: inspiration.category || '未分类',
    tags: normalizeTags(inspiration.tags),
    shots: [],
    music: inspiration.musicPlan.filter((item) => !item.includes('待确认')).join('\n'),
    notes: inspiration.annotations.map((item) => item.text).join('\n'),
    createdAt: now,
    updatedAt: now
  }
  dojoInspirationStore.scripts.unshift(script)
  persist()
  return script
}

export function createManualScriptAsset(title = '未命名脚本') {
  const now = new Date().toISOString()
  const script: ScriptAsset = {
    id: createId('script'),
    title: title.trim() || '未命名脚本',
    status: 'draft',
    hook: '',
    body: '',
    transcript: '',
    visualNotes: '',
    shots: [],
    music: '',
    notes: '',
    category: '未分类',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
  dojoInspirationStore.scripts.unshift(script)
  persist()
  return script
}

export function removeScriptAsset(scriptId: string) {
  const index = dojoInspirationStore.scripts.findIndex((item) => item.id === scriptId)
  if (index < 0) return false
  dojoInspirationStore.scripts.splice(index, 1)
  dojoInspirationStore.conversations = dojoInspirationStore.conversations.filter(
    (item) => item.scriptId !== scriptId
  )
  persist()
  return true
}

export function updateScriptAsset(scriptId: string, patch: Partial<ScriptAsset>) {
  const script = dojoInspirationStore.scripts.find((item) => item.id === scriptId)
  if (!script) return null
  Object.assign(script, patch, {
    id: script.id,
    inspirationId: script.inspirationId,
    updatedAt: new Date().toISOString()
  })
  persist()
  return script
}

/** 把 AI 转化稿写入脚本正文，并标记已完成「加一层 AI」 */
export function applyAiAdaptedScript(scriptId: string, adaptedBody: string) {
  const body = stripMarkdown(adaptedBody)
  if (!body) return null
  return updateScriptAsset(scriptId, {
    body,
    transcript: body,
    aiAdaptedAt: new Date().toISOString()
  })
}

export function applyAiAdaptedInspiration(inspirationId: string, adaptedBody: string) {
  const body = stripMarkdown(adaptedBody)
  if (!body) return null
  return updateExecutableInspiration(inspirationId, { transcript: body })
}

export function syncScriptFromInspiration(scriptId: string, inspirationId: string) {
  const inspiration = dojoInspirationStore.executableInspirations.find(
    (item) => item.id === inspirationId
  )
  const script = dojoInspirationStore.scripts.find((item) => item.id === scriptId)
  if (!inspiration || !script) return null
  const transcript =
    inspiration.transcript?.trim() ||
    inspiration.copyPlan.filter(Boolean).join('\n').trim()
  const visualNotes =
    inspiration.visualNotes?.trim() ||
    inspiration.shotPlan.filter(Boolean).join('\n').trim()
  if (!transcript && !visualNotes && !inspiration.hook?.trim()) return null
  let sourceAuthor = inspiration.sourceAuthor
  let sourcePlatform = inspiration.sourcePlatform
  if ((!sourceAuthor || !sourcePlatform) && inspiration.candidateId) {
    const candidate = dojoInspirationStore.candidates.find(
      (item) => item.id === inspiration.candidateId
    )
    sourceAuthor = sourceAuthor || candidate?.author
    sourcePlatform = sourcePlatform || candidate?.platform
  }
  return updateScriptAsset(scriptId, {
    inspirationId,
    referenceUrl: inspiration.referenceUrl,
    sourceAuthor,
    sourcePlatform,
    title: script.title === '未命名脚本' ? inspiration.title : script.title,
    hook: inspiration.hook,
    body: buildCharacterScriptDraft({
      sourceAuthor,
      referenceUrl: inspiration.referenceUrl,
      transcript,
      visualNotes,
      hook: inspiration.hook
    }),
    transcript,
    visualNotes,
    category: inspiration.category || script.category || '未分类',
    tags: normalizeTags([...(script.tags || []), ...(inspiration.tags || [])])
  })
}

export function markScriptScheduled(scriptId: string, creatorContentId: string) {
  return updateScriptAsset(scriptId, {
    status: 'scheduled',
    creatorContentId
  })
}

export function addScriptConversationMessage(
  scriptId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
) {
  const value = content.trim()
  if (!value) return null
  const message = {
    id: createId('script-message'),
    scriptId,
    role,
    content: value,
    createdAt: new Date().toISOString()
  }
  dojoInspirationStore.conversations.push(message)
  persist()
  return message
}

export function queueScriptAiRequest(scriptId: string, prompt: string) {
  const userMessage = addScriptConversationMessage(scriptId, 'user', prompt)
  return Boolean(userMessage)
}
