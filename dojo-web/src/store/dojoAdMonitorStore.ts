/**
 * 投放侧视图 —— 与总账号池同源，不做二次确认。
 * 总账号 = 投放账号，全部账号视频 = 投放视频。
 */
import { computed } from 'vue'
import type { TikTokAccountVideo } from '@/api/tiktok'
import { accountVideos, dojoAccountStore, type MatrixAccount } from '@/store/dojoAccountStore'

export const adMonitoredAccounts = computed((): MatrixAccount[] => {
  void dojoAccountStore.revision
  return dojoAccountStore.accounts
})

export interface AdMonitorVideo extends TikTokAccountVideo {
  accountHandle: string
  accountNickname?: string
  projectId?: string
}

export const adMonitorVideos = computed((): AdMonitorVideo[] => {
  void dojoAccountStore.revision
  const list: AdMonitorVideo[] = []
  for (const acc of dojoAccountStore.accounts) {
    for (const v of accountVideos(acc.handle)) {
      list.push({
        ...v,
        accountHandle: acc.handle,
        accountNickname: acc.nickname,
        projectId: acc.projectId
      })
    }
  }
  return list.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''))
})

export function findAdMonitorVideo(videoId: string): AdMonitorVideo | undefined {
  const key = decodeURIComponent(videoId)
  return adMonitorVideos.value.find((v) => v.videoId === key)
}
