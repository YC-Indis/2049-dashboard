import { inspirationFixtures } from '@/mock/dojo/inspirationFixtures'
import type { InspirationItem } from '@/types/dojoInspiration'

export interface InspirationCatalog {
  source: 'local-demo'
  isLive: false
  sourceLabel: string
  items: InspirationItem[]
  pipeline: {
    collected: number
    programPassed: number
    aiPassed: number
  }
}

/**
 * Current local-first data boundary for the inspiration workspace.
 *
 * TODO: add a normalized RapidAPI adapter here after the provider, endpoints,
 * and credentials are configured. The view must continue consuming the same
 * InspirationCatalog shape so live retrieval never leaks provider details into UI code.
 */
export function getInspirationCatalog(): InspirationCatalog {
  return {
    source: 'local-demo',
    isLive: false,
    sourceLabel: '本地演示数据 · RapidAPI 待接入',
    items: inspirationFixtures.map((item) => ({ ...item })),
    pipeline: {
      collected: inspirationFixtures.length * 23,
      programPassed: inspirationFixtures.filter((item) => item.programScore >= 85).length * 7,
      aiPassed: inspirationFixtures.filter((item) => item.aiScore >= 88).length
    }
  }
}
