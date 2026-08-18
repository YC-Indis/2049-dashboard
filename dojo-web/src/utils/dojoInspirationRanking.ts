import type { InspirationCandidate, InspirationRanking } from '@/types/dojoInspiration'

const DAY_MS = 24 * 60 * 60 * 1000

export function freshnessScore(publishedAt: string, now = Date.now()) {
  const timestamp = Date.parse(publishedAt)
  if (!Number.isFinite(timestamp)) return 0
  const ageDays = Math.max(0, (now - timestamp) / DAY_MS)
  if (ageDays <= 3) return 100
  if (ageDays <= 7) return 88
  if (ageDays <= 14) return 74
  if (ageDays <= 30) return 58
  if (ageDays <= 60) return 36
  if (ageDays <= 90) return 20
  return 5
}

export function heatScore(views: number, likes: number, comments: number, saves: number) {
  const totalInteractions = likes + comments * 2 + saves * 2
  if (!views && !totalInteractions) return 0
  const reach = Math.min(70, (Math.log10(Math.max(1, views) + 1) / 7) * 70)
  const engagementRate = views > 0 ? totalInteractions / views : 0
  const engagement = Math.min(30, (engagementRate / 0.12) * 30)
  return Math.round(reach + engagement)
}

export function trendScore(
  heat: number,
  freshness: number,
  relevance: number,
  ranking: InspirationRanking = 'balanced'
) {
  const weights = {
    balanced: { heat: 0.48, freshness: 0.42, relevance: 0.1 },
    fresh: { heat: 0.25, freshness: 0.65, relevance: 0.1 },
    hot: { heat: 0.7, freshness: 0.2, relevance: 0.1 }
  }[ranking]
  return Math.round(
    heat * weights.heat + freshness * weights.freshness + relevance * weights.relevance
  )
}

export function candidateScores(
  candidate: InspirationCandidate,
  ranking: InspirationRanking = 'balanced'
) {
  const heat =
    candidate.heatScore ??
    heatScore(candidate.views, candidate.likes, candidate.comments, candidate.saves)
  const freshness = candidate.freshnessScore ?? freshnessScore(candidate.publishedAt)
  const trend = candidate.trendScore ?? trendScore(heat, freshness, candidate.matchScore, ranking)
  return { heat, freshness, trend }
}
