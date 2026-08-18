/**
 * 从 Cursor 内置浏览器 Local Storage (LevelDB) 抽出 dojo:v1:* 写入 public/dojo-seed.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ldb =
  process.argv[2] ||
  path.join(
    process.env.APPDATA || '',
    'Cursor',
    'Partitions',
    'cursor-browser',
    'Local Storage',
    'leveldb'
  )

if (!fs.existsSync(ldb)) {
  console.error('LevelDB not found:', ldb)
  process.exit(1)
}

const files = fs
  .readdirSync(ldb)
  .map((f) => path.join(ldb, f))
  .filter((p) => fs.statSync(p).isFile())
const all = Buffer.concat(files.map((p) => fs.readFileSync(p)))
const text = all.toString('utf8')
const latin = all.toString('latin1')

function extractKeys(s) {
  const keys = new Set()
  const re = /dojo:v1:[A-Za-z0-9_]+/g
  let m
  while ((m = re.exec(s))) keys.add(m[0])
  return keys
}

const keys = new Set([...extractKeys(text), ...extractKeys(latin)])
console.log('found keys', [...keys])

function tryExtractAround(s, key) {
  const out = []
  let idx = 0
  while (true) {
    const i = s.indexOf(key, idx)
    if (i < 0) break
    const slice = s.slice(i, i + 8_000_000)
    const j = slice.indexOf('{"version":')
    if (j >= 0 && j < 200) {
      let depth = 0
      let end = -1
      for (let k = j; k < slice.length; k++) {
        const c = slice[k]
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) {
            end = k
            break
          }
        }
      }
      if (end > 0) {
        const json = slice.slice(j, end + 1)
        try {
          JSON.parse(json)
          out.push(json)
        } catch {
          /* ignore */
        }
      }
    }
    idx = i + key.length
  }
  return out
}

const dump = {}
for (const key of keys) {
  let candidates = tryExtractAround(text, key)
  if (!candidates.length) candidates = tryExtractAround(latin, key)
  if (!candidates.length) {
    console.log('NO VALUE', key)
    continue
  }
  candidates.sort((a, b) => b.length - a.length)
  dump[key] = candidates[0]
  const parsed = JSON.parse(candidates[0])
  const d = parsed.data
  const summary = Array.isArray(d)
    ? `arr ${d.length}`
    : d && typeof d === 'object'
      ? `obj keys ${Object.keys(d).length}`
      : typeof d
  console.log(key, 'bytes', candidates[0].length, summary)
}

const outPath = path.join(root, 'public', 'dojo-seed.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(dump, null, 2))
console.log('wrote', outPath, fs.statSync(outPath).size)

if (dump['dojo:v1:projects']) {
  console.log(
    'projects',
    JSON.parse(dump['dojo:v1:projects']).data.map((p) => p.name)
  )
}
if (dump['dojo:v1:accounts']) {
  console.log('accounts', JSON.parse(dump['dojo:v1:accounts']).data.length)
}
