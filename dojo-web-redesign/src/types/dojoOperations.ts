export type ContentLifecycle = '起量' | '爬坡' | '长尾' | '回落'

export interface OperationsVideo {
  id: string
  projectId: string
  account: string
  platform: 'TikTok' | 'YouTube' | 'Instagram'
  title: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  engagementRate: number
  growthRate?: number
  spend: number
  revenue: number
  conversions: number
  attributionNote?: string
  lifecycle?: ContentLifecycle
  anomaly?: string
  trend?: number[]
}
