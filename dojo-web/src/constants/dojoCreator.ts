import type { CreatorPriority, CreatorRole, CreatorStage } from '@/types/dojoCreator'

export interface CreatorStageConfig {
  key: CreatorStage
  label: string
  shortLabel: string
  description: string
  color: string
}

export const CREATOR_STAGES: CreatorStageConfig[] = [
  { key: 'idea', label: '选题池', shortLabel: '选题', description: '捕捉真实问题', color: '#e8685e' },
  { key: 'outline', label: '结构', shortLabel: '结构', description: '形成内容骨架', color: '#c48166' },
  { key: 'script', label: '脚本', shortLabel: '脚本', description: '把判断写清楚', color: '#9a70bd' },
  { key: 'shooting', label: '拍摄', shortLabel: '拍摄', description: '转成可用素材', color: '#7860cc' },
  { key: 'editing', label: '剪辑', shortLabel: '剪辑', description: '完成表达节奏', color: '#5d73b9' },
  { key: 'publish', label: '发布', shortLabel: '发布', description: '上线并等待复盘', color: '#5b8d83' }
]

export const CREATOR_ROLES: Array<{ value: CreatorRole; label: string }> = [
  { value: 'acquisition', label: '获客' },
  { value: 'trust', label: '信任' },
  { value: 'conversion', label: '转化' }
]

export const CREATOR_PRIORITIES: Array<{ value: CreatorPriority; label: string }> = [
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '低' }
]

export function creatorStageLabel(stage: CreatorStage) {
  return CREATOR_STAGES.find((item) => item.key === stage)?.label || stage
}

export function creatorRoleLabel(role: CreatorRole) {
  return CREATOR_ROLES.find((item) => item.value === role)?.label || role
}
