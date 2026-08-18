import type { InspirationHotBoard } from '@/types/dojoInspirationExplore'

/** 与算法榜一样默认常驻；queries[0] 是主词，后面是备用（主词不够才依次试）。 */
export const inspirationHotBoardFixtures: InspirationHotBoard[] = [
  {
    id: 'board-unboxing',
    name: '开箱测评',
    category: '开箱',
    platform: 'TikTok',
    queries: ['unboxing', 'first look', 'review'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-vlog',
    name: '日常 vlog',
    category: '日常',
    platform: 'TikTok',
    queries: ['vlog', 'day in the life'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-pov',
    name: 'POV 日常',
    category: '日常',
    platform: 'TikTok',
    queries: ['pov', 'grwm'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-gameplay',
    name: '转场剪辑',
    category: '剪辑',
    platform: 'TikTok',
    queries: ['transition', 'jump cut', 'edit'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-flavor',
    name: '口味测评',
    category: '口味',
    platform: 'TikTok',
    queries: ['flavor', 'taste test'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-hook',
    name: '钩子开场',
    category: '钩子',
    platform: 'TikTok',
    queries: ['hook', 'plot twist', 'wait for it'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  },
  {
    id: 'board-viral',
    name: '海外热点',
    category: '热点',
    platform: 'TikTok',
    queries: ['viral', 'trending'],
    timeWindowDays: 7,
    limit: 10,
    preset: true
  }
]

/** 旧版默认榜 id → 新 id，合并本地缓存时迁过去 */
export const LEGACY_HOT_BOARD_IDS: Record<string, string> = {
  'board-vape-product': 'board-unboxing',
  'board-unbox': 'board-vlog'
}
