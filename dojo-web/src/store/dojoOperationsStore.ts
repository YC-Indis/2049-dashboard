import { reactive } from 'vue'
import { loadTable, saveTable } from '@/utils/dojoPersist'

export interface OperationsInvestmentRecord {
  videoId: string
  spend: number
  revenue: number
  conversions: number
  attributionNote: string
  updatedAt: string
}

const TABLE_OPERATIONS_INVESTMENT = 'operationsInvestmentRecords'
const savedRecords = loadTable<Record<string, OperationsInvestmentRecord>>(
  TABLE_OPERATIONS_INVESTMENT
)

export const dojoOperationsStore = reactive({
  investmentByVideoId: savedRecords || {},
  revision: 0
})

export function getOperationsInvestment(videoId: string) {
  return dojoOperationsStore.investmentByVideoId[videoId] || null
}

export function saveOperationsInvestment(
  videoId: string,
  input: Pick<OperationsInvestmentRecord, 'spend' | 'revenue' | 'conversions' | 'attributionNote'>
) {
  dojoOperationsStore.investmentByVideoId[videoId] = {
    videoId,
    spend: Math.max(0, Number(input.spend) || 0),
    revenue: Math.max(0, Number(input.revenue) || 0),
    conversions: Math.max(0, Math.round(Number(input.conversions) || 0)),
    attributionNote: input.attributionNote.trim(),
    updatedAt: new Date().toISOString()
  }
  dojoOperationsStore.revision++
  saveTable(TABLE_OPERATIONS_INVESTMENT, dojoOperationsStore.investmentByVideoId)
  return dojoOperationsStore.investmentByVideoId[videoId]
}
