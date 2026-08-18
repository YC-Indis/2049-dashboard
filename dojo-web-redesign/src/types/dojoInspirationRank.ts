export type RankBoardKind = 'outlier' | 'velocity' | 'trend' | 'breakout'

export type RankQueryOrigin = 'seed' | 'board' | 'result'

export type RankQueryStatus = 'active' | 'paused' | 'exploring'

export type VelocityWindowHours = 24 | 72 | 168

export interface RankSnapshot {
  views: number
  likes: number
  comments: number
  fetchedAt: string
}

export interface RankPost {
  postId: string
  creatorId: string
  creatorHandle: string
  followers: number
  caption: string
  title: string
  hashtags: string[]
  publishTime: string
  views: number
  likes: number
  comments: number
  url: string
  cover?: string
  querySource: string
  fetchedAt: string
  snapshots: RankSnapshot[]
}

export interface RankQuery {
  id: string
  text: string
  origin: RankQueryOrigin
  status: RankQueryStatus
  createdAt: string
  lastRunAt?: string
  runCount: number
  resultCount: number
  boardHits: number
  yield: number
  score: number
  novelty: number
  lowYieldStreak: number
}

export interface RankedPostRow {
  post: RankPost
  baseline: number
  outlierRatio: number
  outlierScore: number
  velocity: number
  accelerationScore: number
  followerRatio: number
  breakoutScore: number
  freshness: number
}

export interface RankTopic {
  id: string
  label: string
  terms: string[]
  postIds: string[]
  videoCount: number
  prevVideoCount: number
  creatorCount: number
  outlierCount: number
  growth: number
  trendScore: number
}

export interface RankCycleSummary {
  ranAt: string
  queriesRun: number
  postsIngested: number
  newQueries: number
}

export interface RankBoardPref {
  kind: RankBoardKind
  name: string
  hint: string
  enabled: boolean
  hidden: boolean
}

export interface InspirationRankState {
  posts: RankPost[]
  queries: RankQuery[]
  velocityWindowHours: VelocityWindowHours
  lastCycle?: RankCycleSummary
  boardPrefs: RankBoardPref[]
}
