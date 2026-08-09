// 扫描 src 下所有 @/ 别名引用，列出无法解析的目标，用于核对网盘漏下的文件
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve('dojo-web/src')
const EXT = ['', '.ts', '.tsx', '.vue', '.js', '.mjs', '.json', '.scss', '.css']

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|vue|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function resolves(spec) {
  const base = join(SRC, spec.slice(2))
  for (const e of EXT) {
    if (existsSync(base + e)) return true
    if (existsSync(join(base, 'index' + e))) return true
  }
  return false
}

const missing = new Map()
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/['"`](@\/[^'"`]+)['"`]/g)) {
    const spec = m[1]
    if (resolves(spec)) continue
    if (!missing.has(spec)) missing.set(spec, new Set())
    missing.get(spec).add(file.slice(SRC.length + 1))
  }
}

if (missing.size === 0) {
  console.log('所有 @/ 引用均可解析')
} else {
  console.log(`无法解析的引用 ${missing.size} 个：\n`)
  for (const [spec, users] of [...missing].sort()) {
    console.log(`  ${spec}`)
    for (const u of users) console.log(`      被引用于 ${u}`)
  }
}
