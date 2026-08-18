import type { ContentStage } from '../types'

export const STAGE_CONFIG: Array<{
  id: ContentStage
  label: string
  color: string
}> = [
  { id: 'idea', label: '选题', color: '#ee695d' },
  { id: 'outline', label: '大纲', color: '#d58a74' },
  { id: 'script', label: '脚本', color: '#b79b76' },
  { id: 'recording', label: '录制', color: '#78a69f' },
  { id: 'editing', label: '剪辑', color: '#7e8fcb' },
  { id: 'publishing', label: '发布', color: '#8066c8' },
]

export const STAGE_LABELS = Object.fromEntries(
  STAGE_CONFIG.map((stage) => [stage.id, stage.label]),
) as Record<ContentStage, string>
