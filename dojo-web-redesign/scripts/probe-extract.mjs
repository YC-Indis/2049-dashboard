/**
 * 用真实文档验证账号抽取规则的命中情况。
 * 规则与 src/utils/dojoAccountExtract.ts 保持一致，只是换成 Node 读本地文件。
 *
 * 用法：node scripts/probe-extract.mjs [docs/source 目录]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const HANDLE_CHARS = '[A-Za-z0-9._]{2,24}'
const LINK_RE = new RegExp(`tiktok\\.com/@(${HANDLE_CHARS})`, 'gi')
const MENTION_RE = new RegExp(`(^|[^A-Za-z0-9._@])@(${HANDLE_CHARS})`, 'g')

function extract(text) {
  const found = new Map()
  const record = (raw, confidence) => {
    const handle = raw.toLowerCase()
    if (/^\d+$/.test(handle)) return
    const hit = found.get(handle)
    if (hit) {
      hit.hits++
      if (confidence === 'high') hit.confidence = 'high'
      return
    }
    found.set(handle, { handle: `@${raw}`, confidence, hits: 1 })
  }
  for (const m of text.matchAll(LINK_RE)) record(m[1], 'high')
  for (const m of text.matchAll(MENTION_RE)) record(m[2], 'low')
  return [...found.values()]
}

async function toText(file) {
  const ext = extname(file).toLowerCase()
  if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
    const wb = XLSX.read(readFileSync(file), { type: 'buffer' })
    return {
      kind: 'excel',
      sheets: wb.SheetNames.length,
      text: wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n')
    }
  }
  if (ext === '.docx') {
    const r = await mammoth.extractRawText({ buffer: readFileSync(file) })
    return { kind: 'word', sheets: 0, text: r.value }
  }
  if (['.csv', '.txt', '.json', '.md', '.tsv'].includes(ext)) {
    return { kind: 'text', sheets: 0, text: readFileSync(file, 'utf8') }
  }
  return null
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const root = process.argv[2] || '../docs/source'
const files = walk(root)
const overall = new Map()
let parsed = 0
let skipped = 0

for (const file of files) {
  let doc
  try {
    doc = await toText(file)
  } catch (e) {
    console.log(`ERROR ${basename(file)} -> ${e.message}`)
    continue
  }
  if (!doc) {
    skipped++
    continue
  }
  parsed++
  const found = extract(doc.text)
  found.forEach((c) => {
    const hit = overall.get(c.handle.toLowerCase())
    if (hit) {
      hit.hits += c.hits
      if (c.confidence === 'high') hit.confidence = 'high'
      hit.files.add(basename(file))
    } else {
      overall.set(c.handle.toLowerCase(), { ...c, files: new Set([basename(file)]) })
    }
  })
  const high = found.filter((c) => c.confidence === 'high').length
  console.log(
    `${doc.kind.padEnd(5)} ${String(found.length).padStart(3)} 个候选（链接 ${high}）  ${basename(file)}`
  )
}

const all = [...overall.values()]
const high = all.filter((c) => c.confidence === 'high')
console.log(`\n解析 ${parsed} 个文件，跳过 ${skipped} 个不支持的格式`)
console.log(`合计候选账号 ${all.length} 个，其中来自作品链接的高可信 ${high.length} 个`)
console.log('\n高可信账号（按出现次数）:')
high
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 40)
  .forEach((c) => console.log(`  ${c.handle.padEnd(26)} 出现 ${String(c.hits).padStart(4)} 次`))
console.log('\n仅正文提及（默认不入库）示例:')
all
  .filter((c) => c.confidence === 'low')
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 15)
  .forEach((c) => console.log(`  ${c.handle.padEnd(26)} 出现 ${String(c.hits).padStart(4)} 次`))
