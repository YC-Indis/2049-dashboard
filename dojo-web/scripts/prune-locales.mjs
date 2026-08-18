/**
 * 裁掉语言包里已经没人引用的文案。
 *
 * 删掉 Art Design Pro 的演示页之后，zh/en 里还留着 dashboard、widgets、
 * template、article、system 这些菜单名，以及 art-table / art-work-tab 等
 * 已删组件的文案，全是死条目。
 *
 * 判定方式：把源码里所有 t('a.b.c') / $t("a.b.c") 的 key 收集起来，
 * 一个叶子 key 只要没被点名（也没有任何被点名的 key 以它为前缀），就删掉。
 * 路由 meta.title 写的是 'menus.dojo.today' 这种字符串，同样会被扫到。
 *
 * 加 --write 才真写文件，不加只打印将要删什么。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'

const ROOT = process.cwd()
const SRC = resolve(ROOT, 'src')
const LANG_DIR = join(SRC, 'locales/langs')
const WRITE = process.argv.includes('--write')
const SCAN_EXT = ['.ts', '.vue', '.js', '.mjs']

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (full === LANG_DIR) continue
    if (entry.isDirectory()) await walk(full, out)
    else if (SCAN_EXT.includes(extname(entry.name))) out.push(full)
  }
  return out
}

const referenced = new Set()
for (const file of await walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  // t('a.b')、$t("a.b")、title: 'menus.x.y' 都是同一种形态：带点的裸字符串
  const re = /['"`]([a-zA-Z][\w]*(?:\.[\w]+)+)['"`]/g
  let m
  while ((m = re.exec(text))) referenced.add(m[1])
}

function isUsed(path) {
  if (referenced.has(path)) return true
  // 有些地方按前缀拼后缀，比如 t(`setting.transition.list.${name}`)
  for (const ref of referenced) {
    if (ref.startsWith(path + '.') || path.startsWith(ref + '.')) return true
  }
  return false
}

function prune(node, prefix, dropped) {
  if (Array.isArray(node)) return node
  if (typeof node !== 'object' || node === null) return node

  const next = {}
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const child = prune(value, path, dropped)
      if (Object.keys(child).length) next[key] = child
      else dropped.push(path)
    } else if (isUsed(path)) {
      next[key] = value
    } else {
      dropped.push(path)
    }
  }
  return next
}

for (const lang of ['zh', 'en']) {
  const file = join(LANG_DIR, `${lang}.json`)
  const raw = readFileSync(file, 'utf8')
  const before = JSON.parse(raw)
  const dropped = []
  const after = prune(before, '', dropped)

  console.log(`\n${lang}.json 删掉 ${dropped.length} 条：`)
  const byTop = new Map()
  for (const p of dropped) {
    const top = p.split('.').slice(0, 2).join('.')
    byTop.set(top, (byTop.get(top) || 0) + 1)
  }
  for (const [top, count] of [...byTop].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${top}  ×${count}`)
  }

  if (WRITE) {
    writeFileSync(file, JSON.stringify(after, null, 2) + '\n', 'utf8')
    console.log(`  已写回 ${file}`)
  }
}

if (!WRITE) console.log('\n（这只是预览，加 --write 才会真改）')
