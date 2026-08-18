import type { InspirationCandidate, InspirationPlatform } from '@/types/dojoInspiration'

export type HotBoardWindow = 7 | 30

export interface InspirationHotBoard {
  id: string
  name: string
  category: string
  platform: InspirationPlatform
  queries: string[]
  timeWindowDays: HotBoardWindow
  limit: number
  preset?: boolean
  /** 跑一轮 / 更新过期时是否参与搜索，默认 true */
  collectEnabled?: boolean
  lastRefreshedAt?: string
  message?: string
}

export type BenchmarkTier = 'core' | 'watch' | 'competitor'

export interface InspirationBenchmarkAccount {
  id: string
  handle: string
  nickname?: string
  tier: BenchmarkTier
  market?: string
  note?: string
  followers?: number
  lastSyncedAt?: string
  videoCount?: number
  message?: string
}

export interface BenchmarkSavedVideo {
  id: string
  accountId: string
  handle: string
  candidateId: string
  title: string
  url: string
  cover?: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  category: string
  scriptDirection: string
  tags: string[]
  note?: string
  savedAt: string
}

export interface HotBoardDayRecord {
  dayKey: string
  capturedAt: string
  items: InspirationCandidate[]
}

export interface InspirationExploreState {
  boards: InspirationHotBoard[]
  accounts: InspirationBenchmarkAccount[]
  boardItems: Record<string, InspirationCandidate[]>
  accountVideos: Record<string, InspirationCandidate[]>
  savedVideos: BenchmarkSavedVideo[]
  boardHistory: Record<string, HotBoardDayRecord[]>
}

export const BENCHMARK_TIER_META: Record<
  BenchmarkTier,
  { label: string; hint: string }
> = {
  core: { label: '核心对标', hint: '每周都要看完的主力账号' },
  watch: { label: '潜力观察', hint: '先盯更新节奏，再决定是否升核' },
  competitor: { label: '竞品矩阵', hint: '对手在发什么、怎么带货' }
}
