/**
 * 摸清 docs/source 下 Excel 的表结构：列出工作表、表头与前几行。
 * 用法: node scripts/inspect-source.mjs "xros6 矩阵规划"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.resolve(__dirname, '../../docs/source')

const keyword = process.argv[2]
if (!keyword) {
  console.log('docs/source 下的 xlsx：')
  for (const f of fs.readdirSync(sourceDir).filter((f) => f.endsWith('.xlsx'))) console.log('  ' + f)
  process.exit(0)
}

const hit = fs.readdirSync(sourceDir).find((f) => f.includes(keyword) && f.endsWith('.xlsx'))
if (!hit) throw new Error(`找不到 ${keyword}`)

const wb = XLSX.readFile(path.join(sourceDir, hit))
console.log(`文件: ${hit}`)
console.log(`工作表: ${wb.SheetNames.join(' | ')}\n`)

const cell = (v) => {
  const s = v == null ? '' : String(v).replace(/\s+/g, ' ').trim()
  return s.length > 34 ? s.slice(0, 34) + '…' : s
}

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false })
  const width = Math.max(...rows.slice(0, 30).map((r) => r?.length || 0), 0)
  console.log(`── 工作表「${name}」: ${rows.length} 行 × 约 ${width} 列 ──`)
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    console.log(`  [${i}] ${(rows[i] || []).map(cell).join(' ┃ ')}`)
  }
  console.log('')
}
