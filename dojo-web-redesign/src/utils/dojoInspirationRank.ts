import type {
  RankBoardKind,
  RankPost,
  RankQuery,
  RankSnapshot,
  RankTopic,
  RankedPostRow,
  VelocityWindowHours
} from '@/types/dojoInspirationRank'
import { freshnessScore } from '@/utils/dojoInspirationRanking'
import {
  compactTag,
  isOwnedProjectTag,
  isPlatformNoiseTag,
  withoutOwnedTags
} from '@/utils/dojoInspirationTags'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_SNAPSHOTS = 12

export const RANK_BOARD_KINDS: RankBoardKind[] = [
  'outlier',
  'velocity',
  'trend',
  'breakout'
]

export const RANK_BOARD_META = {
  outlier: {
    id: 'outlier' as const,
    name: '异常榜',
    hint: '这条明显比这个号平时强'
  },
  velocity: {
    id: 'velocity' as const,
    name: '加速榜',
    hint: '还没完全爆，但正在快速涨'
  },
  trend: {
    id: 'trend' as const,
    name: '群体趋势榜',
    hint: '不同账号同时在做，而且大量在爆'
  },
  breakout: {
    id: 'breakout' as const,
    name: '小号逆袭榜',
    hint: '粉少、内容自己把播放打上去'
  }
}

export function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export function ageHours(iso: string, now = Date.now()) {
  const stamp = Date.parse(iso)
  if (!Number.isFinite(stamp)) return Number.POSITIVE_INFINITY
  return Math.max(0, (now - stamp) / HOUR_MS)
}

export function appendSnapshot(post: RankPost, snapshot: RankSnapshot): RankPost {
  const last = post.snapshots[post.snapshots.length - 1]
  const sameStamp = last && last.fetchedAt === snapshot.fetchedAt
  const sameViews = last && last.views === snapshot.views
  const snapshots = sameStamp || sameViews ? post.snapshots : [...post.snapshots, snapshot]
  return {
    ...post,
    views: snapshot.views,
    likes: snapshot.likes,
    comments: snapshot.comments,
    fetchedAt: snapshot.fetchedAt,
    snapshots: snapshots.slice(-MAX_SNAPSHOTS)
  }
}

export function creatorBaseline(posts: RankPost[], creatorId: string) {
  const views = posts
    .filter((item) => item.creatorId === creatorId)
    .map((item) => item.views)
    .filter((value) => value > 0)
    .slice(-20)
  return median(views)
}

export function scorePosts(posts: RankPost[], windowHours: VelocityWindowHours, now = Date.now()) {
  return posts.map((post) => scorePost(post, posts, windowHours, now))
}

export function scorePost(
  post: RankPost,
  corpus: RankPost[],
  windowHours: VelocityWindowHours,
  now = Date.now()
): RankedPostRow {
  const baseline = Math.max(1, creatorBaseline(corpus, post.creatorId))
  const outlierRatio = post.views / baseline
  const freshness = freshnessScore(post.publishTime, now) / 100
  const outlierScore = outlierRatio * Math.max(0.15, freshness)
  const velocity = velocityOf(post, windowHours, now)
  const accelerationScore = velocity / baseline
  const followerRatio = post.followers > 0 ? post.views / post.followers : 0
  const breakoutScore = followerRatio * outlierRatio
  return {
    post,
    baseline,
    outlierRatio,
    outlierScore,
    velocity,
    accelerationScore,
    followerRatio,
    breakoutScore,
    freshness
  }
}

export function velocityOf(post: RankPost, windowHours: VelocityWindowHours, now = Date.now()) {
  if (post.snapshots.length < 2) return 0
  const windowStart = now - windowHours * HOUR_MS
  const inWindow = post.snapshots.filter((item) => Date.parse(item.fetchedAt) >= windowStart)
  const newest = inWindow[inWindow.length - 1] || post.snapshots[post.snapshots.length - 1]
  const oldest =
    inWindow[0] && inWindow[0] !== newest ? inWindow[0] : post.snapshots[post.snapshots.length - 2]
  const hours = Math.max(0.5, (Date.parse(newest.fetchedAt) - Date.parse(oldest.fetchedAt)) / HOUR_MS)
  return (newest.views - oldest.views) / hours
}

export function outlierBoard(rows: RankedPostRow[], now = Date.now()) {
  return rows
    .filter((row) => {
      const ageDays = ageHours(row.post.publishTime, now) / 24
      return row.post.views > 10000 && row.outlierRatio > 3 && ageDays < 14
    })
    .sort((left, right) => right.outlierScore - left.outlierScore)
    .slice(0, 10)
}

export function velocityBoard(rows: RankedPostRow[], now = Date.now()) {
  return rows
    .filter((row) => {
      const ageDays = ageHours(row.post.publishTime, now) / 24
      return row.post.snapshots.length >= 2 && row.velocity > 0 && ageDays <= 7
    })
    .sort((left, right) => right.accelerationScore - left.accelerationScore)
    .slice(0, 10)
}

export function breakoutBoard(rows: RankedPostRow[]) {
  return rows
    .filter((row) => row.post.followers > 0 && row.post.followers < 100000 && row.breakoutScore > 0)
    .sort((left, right) => right.breakoutScore - left.breakoutScore)
    .slice(0, 10)
}

export function clusterTopics(
  rows: RankedPostRow[],
  ownedTokens: string[],
  now = Date.now()
): RankTopic[] {
  const buckets = new Map<string, RankedPostRow[]>()
  rows.forEach((row) => {
    const keys = topicKeys(row.post, ownedTokens)
    if (!keys.length) return
    const key = keys[0]
    const list = buckets.get(key) || []
    list.push(row)
    buckets.set(key, list)
  })

  const weekAgo = now - 7 * DAY_MS
  const twoWeeksAgo = now - 14 * DAY_MS

  return [...buckets.entries()]
    .map(([key, list]) => {
      const uniqueCreators = new Set(list.map((item) => item.post.creatorId))
      const videoCount = list.filter(
        (item) => Date.parse(item.post.publishTime) >= weekAgo
      ).length
      const prevVideoCount = list.filter((item) => {
        const stamp = Date.parse(item.post.publishTime)
        return stamp >= twoWeeksAgo && stamp < weekAgo
      }).length
      const outlierCount = list.filter((item) => item.outlierRatio > 3).length
      const growth = videoCount / Math.max(1, prevVideoCount)
      const outlierDensity = outlierCount / Math.max(1, list.length)
      const trendScore = growth * uniqueCreators.size * (1 + outlierDensity)
      const terms = [...new Set(list.flatMap((item) => topicKeys(item.post, ownedTokens)))]
      return {
        id: key,
        label: key,
        terms: terms.slice(0, 8),
        postIds: list.map((item) => item.post.postId),
        videoCount,
        prevVideoCount,
        creatorCount: uniqueCreators.size,
        outlierCount,
        growth,
        trendScore
      }
    })
    .filter((topic) => topic.creatorCount >= 2 && topic.videoCount >= 3)
    .sort((left, right) => right.trendScore - left.trendScore)
    .slice(0, 10)
}

export function extractQueryCandidates(
  rows: RankedPostRow[],
  topics: RankTopic[],
  ownedTokens: string[]
) {
  const counts = new Map<string, number>()
  const bump = (raw: string) => {
    const text = cleanQuery(raw, ownedTokens)
    if (!text) return
    counts.set(text, (counts.get(text) || 0) + 1)
  }
  rows.slice(0, 12).forEach((row) => {
    withoutOwnedTags(row.post.hashtags, ownedTokens).forEach(bump)
    phraseCandidates(row.post.caption).forEach(bump)
  })
  topics.slice(0, 8).forEach((topic) => {
    bump(topic.label)
    topic.terms.forEach(bump)
  })
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .map(([text]) => text)
    .slice(0, 12)
}

export function queryNovelty(runCount: number) {
  return 1 / (1 + runCount * 0.15)
}

export function queryScore(entry: Pick<RankQuery, 'yield' | 'novelty'> & { avgBoardScore?: number }) {
  return entry.yield * Math.max(0.2, entry.avgBoardScore || 1) * entry.novelty
}

function topicKeys(post: RankPost, ownedTokens: string[]) {
  const tags = withoutOwnedTags(post.hashtags, ownedTokens)
  if (tags.length) return tags.map((tag) => tag.replace(/^#/, ''))
  return phraseCandidates(post.caption).filter((item) => !isOwnedProjectTag(item, ownedTokens))
}

function phraseCandidates(caption: string) {
  const words = caption
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && item.length < 28)
  const phrases: string[] = []
  for (let index = 0; index < words.length - 1; index += 1) {
    const pair = `${words[index]} ${words[index + 1]}`
    if (!isPlatformNoiseTag(words[index]) && !isPlatformNoiseTag(words[index + 1])) {
      phrases.push(pair)
    }
  }
  return phrases.slice(0, 6)
}

function cleanQuery(raw: string, ownedTokens: string[]) {
  const text = raw.replace(/^#/, '').trim()
  if (text.length < 3 || text.length > 32) return ''
  if (isPlatformNoiseTag(text) || isOwnedProjectTag(text, ownedTokens)) return ''
  return text
}

export function compactQueryKey(text: string) {
  return compactTag(text)
}
