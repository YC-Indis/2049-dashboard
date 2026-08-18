import { matrixBlueprints } from './matrixBlueprints'
import type {
  ExecutableInspiration,
  InspirationCandidate,
  InspirationItem,
  InspirationSource,
  ScriptAsset
} from '@/types/dojoInspiration'

const CREATED_AT = '2026-08-15T00:00:00.000Z'

export const inspirationFixtures: InspirationItem[] = matrixBlueprints.map((blueprint, index) => ({
  id: blueprint.id,
  platform: 'TikTok',
  author: 'xros6 本地规划',
  title: blueprint.motif,
  summary: blueprint.promise,
  url: blueprint.evidenceUrl || '',
  publishedAt: '2026-08-15',
  topic: blueprint.format,
  views: 0,
  saves: 0,
  comments: 0,
  growthRate: 0,
  programScore: blueprint.completeness,
  aiScore: Math.max(0, blueprint.completeness - (index % 4)),
  duplicateScore: 0,
  tags: [blueprint.format, blueprint.productRule].filter(Boolean),
  analysis: {
    hook: blueprint.variants[0]?.hook || blueprint.promise,
    structure: [...blueprint.beats],
    transferableRules: [blueprint.productRule, blueprint.visual],
    risk: '来自本地规划，需在真实视频数据回填后重新校准。',
    nextAngle: blueprint.variants[0]?.distribution || '等待补充分发角度'
  }
}))

export const inspirationSourceFixtures: InspirationSource[] = [
  {
    id: 'source-xros6-local',
    name: 'xros6 一期脚本规划',
    platform: 'TikTok',
    kind: 'local-import',
    query: '',
    defaultLimit: 20,
    enabled: true,
    createdAt: CREATED_AT
  }
]

export const inspirationCandidateFixtures: InspirationCandidate[] = matrixBlueprints
  .slice(0, 6)
  .map((blueprint, index) => ({
    id: `candidate-${blueprint.id}`,
    sourceId: 'source-xros6-local',
    platform: 'TikTok',
    author: '本地规划导入',
    title: blueprint.motif,
    summary: blueprint.promise,
    url: blueprint.evidenceUrl || '',
    publishedAt: '2026-08-15',
    views: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    growthRate: 0,
    matchScore: blueprint.completeness,
    tags: [blueprint.format, blueprint.productRule].filter(Boolean),
    status: index < 3 ? 'promoted' : 'qualified',
    rawPayload: {
      source: 'xros6-local-plan',
      blueprintId: blueprint.id
    }
  }))

export const executableInspirationFixtures: ExecutableInspiration[] = matrixBlueprints
  .slice(0, 3)
  .map((blueprint) => ({
    id: `executable-${blueprint.id}`,
    candidateId: `candidate-${blueprint.id}`,
    blueprintId: blueprint.id,
    title: blueprint.motif,
    angle: blueprint.promise,
    hook: blueprint.variants[0]?.hook || blueprint.promise,
    referenceUrl: blueprint.evidenceUrl,
    shotPlan: [...blueprint.beats],
    copyPlan: [blueprint.productRule, blueprint.variants[0]?.distribution].filter(Boolean),
    musicPlan: [blueprint.audio],
    annotations: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT
  }))

const firstInspiration = executableInspirationFixtures[0]

export const scriptAssetFixtures: ScriptAsset[] = firstInspiration
  ? [
      {
        id: `script-${firstInspiration.id}`,
        inspirationId: firstInspiration.id,
        referenceUrl: firstInspiration.referenceUrl,
        title: `${firstInspiration.title} · 初稿`,
        status: 'draft',
        hook: firstInspiration.hook,
        body: firstInspiration.copyPlan.join('\n'),
        transcript: firstInspiration.copyPlan.join('\n'),
        visualNotes: firstInspiration.shotPlan.join('\n'),
        shots: [...firstInspiration.shotPlan],
        music: firstInspiration.musicPlan.join('\n'),
        notes: '由本地规划转换，确认后再进入执行日历。',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT
      }
    ]
  : []
