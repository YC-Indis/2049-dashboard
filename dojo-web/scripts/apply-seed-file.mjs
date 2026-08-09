/**
 * 把浏览器导出的备份 JSON 写入 public/dojo-seed.json（便于 commit 到 GitHub）。
 * 用法: node scripts/apply-seed-file.mjs path/to/dojo-backup.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const outPath = path.join(webRoot, 'public', 'dojo-seed.json')
const backupCopy = path.join(webRoot, '..', 'docs', 'backups', 'dojo-seed-latest.json')

const src = process.argv[2]
if (!src) {
  console.error('用法: node scripts/apply-seed-file.mjs <备份.json>')
  process.exit(1)
}

const abs = path.resolve(src)
if (!fs.existsSync(abs)) {
  console.error('文件不存在:', abs)
  process.exit(1)
}

const text = fs.readFileSync(abs, 'utf8')
const dump = JSON.parse(text)
if (!dump || typeof dump !== 'object' || Array.isArray(dump)) {
  console.error('需要 JSON 对象')
  process.exit(1)
}

const keys = Object.keys(dump).filter((k) => k.startsWith('dojo:v1:') || k === 'dojo-agent-panel')
if (!keys.length) {
  console.error('未找到 dojo:v1:* 键')
  process.exit(1)
}

const slim = {}
keys.forEach((k) => {
  slim[k] = dump[k]
})

const body = JSON.stringify(slim, null, 2)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, body)
console.log('wrote', outPath, 'keys', keys.length, 'bytes', body.length)

fs.mkdirSync(path.dirname(backupCopy), { recursive: true })
fs.writeFileSync(backupCopy, body)
console.log('wrote', backupCopy)

if (slim['dojo:v1:projects']) {
  const projects = JSON.parse(slim['dojo:v1:projects']).data
  console.log(
    'projects',
    projects.map((p) => p.name)
  )
}
