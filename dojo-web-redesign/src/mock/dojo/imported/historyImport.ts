/** AUTO-GENERATED from docs/source/history CSV — 2026-08-08 */
/* eslint-disable */
import historyData from './historyImport.json'

export const historyImport = historyData as {
  importedAt: string
  sources: { fans: string | null; posts: string | null; battery: string | null }
  counts: { accounts: number; posts: number }
  issues: string[]
  accounts: Array<{
    handle: string
    device: string
    link: string
    followers: number
    snapshotDate: string | null
  }>
  posts: Array<{
    account: string
    platform: string
    publishDate: string | null
    title: string
    videoUrl: string
    views: number
    likes: number
    comments: number
    shares: number
  }>
}
