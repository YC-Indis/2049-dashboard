/**
 * 从 main.ts 出发做一次可达性遍历，列出 src 下没人引用的文件。
 *
 * 光看 import 语句是不够的：unplugin-vue-components 会把 components/ 下的
 * Art* 组件自动注册成全局组件，模板里直接写标签就能用，源码里根本没有 import。
 * 所以这里额外解析 components.d.ts 拿到「组件名 -> 文件」的映射，再去扫模板标签。
 *
 * 用法：node scripts/find-orphans.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve, relative, dirname, extname } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
// el-light / mixin 不是被谁 import 的，是 vite.config 的 scss additionalData
// 往每个样式文件头上注的，单看源码找不到引用方。
const ENTRIES = ['main.ts', 'assets/styles/core/el-light.scss', 'assets/styles/core/mixin.scss']

const ALIASES = {
  '@views': 'views',
  '@imgs': 'assets/images',
  '@icons': 'assets/icons',
  '@utils': 'utils',
  '@stores': 'store',
  '@styles': 'assets/styles',
  '@': ''
}

const TRY_EXT = ['', '.ts', '.tsx', '.vue', '.json', '.mjs', '.js', '.scss', '.css']
const TRY_INDEX = ['index.ts', 'index.vue', 'index.js', 'index.json']

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

function toAbs(spec, fromFile) {
  if (!spec || spec.startsWith('\0')) return null
  // 裸模块名走 node_modules，不在本次统计范围
  if (!spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('@views') &&
      !spec.startsWith('@imgs') && !spec.startsWith('@icons') && !spec.startsWith('@utils') &&
      !spec.startsWith('@stores') && !spec.startsWith('@styles')) {
    return null
  }
  let base
  if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec)
  } else {
    const key = Object.keys(ALIASES)
      .filter((a) => spec === a || spec.startsWith(a + '/'))
      .sort((a, b) => b.length - a.length)[0]
    if (!key) return null
    base = join(SRC, ALIASES[key], spec.slice(key.length).replace(/^\//, ''))
  }
  for (const ext of TRY_EXT) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  for (const idx of TRY_INDEX) {
    const candidate = join(base, idx)
    if (existsSync(candidate)) return candidate
  }
  return null
}

// 静态 import / export from / 动态 import() / scss @use / 模板里的图片
// 最后两条是给 <img src="@imgs/xxx"> 和 css url(@imgs/xxx) 用的，
// 少了它们会把还在用的图片误判成孤儿。
const SPEC_PATTERNS = [
  /(?:^|\s)import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|\s)import\s*['"]([^'"]+)['"]/g,
  /export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /@use\s+['"]([^'"]+)['"]/g,
  /@import\s+['"]([^'"]+)['"]/g,
  /(?:src|href)\s*=\s*['"]([^'"]+)['"]/g,
  /url\(\s*['"]?([^'")]+)['"]?\s*\)/g
]

function extractSpecs(code) {
  const found = new Set()
  for (const re of SPEC_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(code))) found.add(m[1])
  }
  return [...found]
}

function extractTags(code) {
  const template = code.match(/<template[^>]*>([\s\S]*)<\/template>/)
  const scope = template ? template[1] : code
  const tags = new Set()
  const re = /<([A-Za-z][\w.-]*)/g
  let m
  while ((m = re.exec(scope))) tags.add(m[1])
  return tags
}

function normalizeTag(tag) {
  return tag.replace(/-/g, '').toLowerCase()
}

function loadGlobalComponents() {
  const dts = join(SRC, 'types/import/components.d.ts')
  const map = new Map()
  if (!existsSync(dts)) return map
  const re = /^\s{4}(\w+):\s*typeof import\('([^']+)'\)/gm
  const text = readFileSync(dts, 'utf8')
  let m
  while ((m = re.exec(text))) {
    const target = resolve(dirname(dts), m[2])
    if (existsSync(target)) map.set(normalizeTag(m[1]), target)
  }
  return map
}

const globalComponents = loadGlobalComponents()
const reached = new Set()
const queue = ENTRIES.map((e) => join(SRC, e)).filter(existsSync)

// 路由表里的 component 是 '/dojo/creator/timeline' 这种字符串，
// 运行时由 ComponentLoader 的 import.meta.glob 兜住，静态分析追不进去。
// 这里手动把字符串翻成 views 下的真实文件，当作根一起入队。
const routerModules = join(SRC, 'router/modules')
if (existsSync(routerModules)) {
  for (const f of await walk(routerModules)) {
    queue.push(f)
    const text = readFileSync(f, 'utf8')
    const re = /component:\s*'(\/[^']+)'/g
    let m
    while ((m = re.exec(text))) {
      const base = join(SRC, 'views', m[1])
      for (const candidate of [base + '.vue', join(base, 'index.vue')]) {
        if (existsSync(candidate)) queue.push(candidate)
      }
    }
  }
}

while (queue.length) {
  const file = queue.pop()
  if (!file || reached.has(file) || !file.startsWith(SRC)) continue
  reached.add(file)
  if (!['.ts', '.vue', '.js', '.mjs', '.scss', '.css'].includes(extname(file))) continue

  let code
  try {
    code = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  for (const spec of extractSpecs(code)) {
    const abs = toAbs(spec, file)
    if (abs) queue.push(abs)
  }

  if (extname(file) === '.vue') {
    for (const tag of extractTags(code)) {
      const hit = globalComponents.get(normalizeTag(tag))
      if (hit) queue.push(hit)
    }
  }
}

const all = await walk(SRC)
const orphans = all.filter((f) => !reached.has(f))

const grouped = new Map()
for (const f of orphans) {
  const rel = relative(SRC, f).replace(/\\/g, '/')
  const bucket = rel.split('/').slice(0, 2).join('/')
  if (!grouped.has(bucket)) grouped.set(bucket, [])
  grouped.get(bucket).push({ rel, size: statSync(f).size })
}

let total = 0
console.log(`可达 ${reached.size} 个 / 共 ${all.length} 个，孤儿 ${orphans.length} 个\n`)
for (const [bucket, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const bytes = items.reduce((s, i) => s + i.size, 0)
  total += bytes
  console.log(`[${bucket}]  ${items.length} 个  ${(bytes / 1024).toFixed(0)} KB`)
  for (const i of items.sort((a, b) => b.size - a.size)) {
    console.log(`    ${i.rel}  (${(i.size / 1024).toFixed(1)} KB)`)
  }
}
console.log(`\n合计可回收 ${(total / 1024 / 1024).toFixed(2)} MB`)
