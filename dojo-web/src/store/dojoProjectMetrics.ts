/**
 * 项目现状中「账号 / 分发 / 曝光」由台账 + Rapid 派生：
 * - 账号数：导入到该项目的账号数
 * - 分发量：Rapid 同步到的已发视频条数（可选按周期裁剪）
 * - 曝光量：上述视频 views 之和
 */
import { dojoAccountStore, accountVideos } from '@/store/dojoAccountStore'
import {
  getProjectRuntime,
  patchProjectCurrent,
  type ProjectCurrent
} from '@/store/dojoProjectRuntime'

export interface LedgerMetrics {
  accounts: number
  distributed: number
  exposure: number
}

/** 按项目从台账即时计算（不写盘） */
export function computeLedgerMetrics(
  projectId: string,
  opts?: { cycleStart?: string; cycleEnd?: string }
): LedgerMetrics {
  const accounts = dojoAccountStore.accounts.filter(
    (a) => a.projectId === projectId && a.status !== 'dropped'
  )
  const start = opts?.cycleStart
  const end = opts?.cycleEnd

  let distributed = 0
  let exposure = 0
  accounts.forEach((a) => {
    accountVideos(a.handle).forEach((v) => {
      const d = v.publishDate || ''
      if (start && d && d < start) return
      if (end && d && d > end) return
      // 无发布日时仍计入（同步数据可能缺日期）
      if ((start || end) && !d) {
        /* keep */
      }
      distributed += 1
      exposure += Number(v.views) || 0
    })
  })

  return {
    accounts: accounts.length,
    distributed,
    exposure
  }
}

/** 写回 runtime.current 的账号/分发/曝光，脚本/剪辑/过审仍手填 */
export function syncProjectCurrentFromLedger(projectId: string): LedgerMetrics | null {
  const runtime = getProjectRuntime(projectId)
  if (!runtime) return null
  const metrics = computeLedgerMetrics(projectId, {
    cycleStart: runtime.kpi.cycleStart,
    cycleEnd: runtime.kpi.cycleEnd
  })
  const patch: Partial<ProjectCurrent> = {
    accounts: metrics.accounts,
    distributed: metrics.distributed,
    exposure: metrics.exposure
  }
  patchProjectCurrent(projectId, patch)
  return metrics
}

export function syncAllProjectsCurrentFromLedger(projectIds?: string[]) {
  const ids = new Set<string>(projectIds || [])
  if (!projectIds?.length) {
    dojoAccountStore.accounts.forEach((a) => {
      if (a.projectId) ids.add(a.projectId)
    })
  }
  ids.forEach((id) => syncProjectCurrentFromLedger(id))
  return ids.size
}
