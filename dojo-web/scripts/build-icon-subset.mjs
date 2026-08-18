/**
 * 把 assets/iconify 下的离线图标集裁成「本项目真正用到的那些」。
 *
 * 起因：ph.json 4.5MB + ri.json 1MB 全量进包，主 chunk 直接顶到 6.9MB，
 * 但全项目一共只引用了不到一百个图标。
 *
 * 图标名的来源是源码里 `ph:xxx` / `ri:xxx` 这种字面量，路由 meta 的 icon
 * 字段也是这个写法，所以一次正则就能扫全。要是哪天改成运行时拼接图标名，
 * 这里就扫不到了，得手动往 EXTRA 里补。
 *
 * 完整图标集来自 https://github.com/iconify/icon-sets（ph / ri 两个 collection），
 * 需要新图标时先把完整 json 放回 assets/iconify，加完引用再跑一遍本脚本。
 *
 * 用法：node scripts/build-icon-subset.mjs
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
const ICON_DIR = join(SRC, 'assets/iconify')
const SCAN_EXT = ['.ts', '.vue', '.js', '.mjs', '.scss', '.css', '.html']

// 兜底：动态拼出来、正则扫不到的图标写在这里
const EXTRA = []

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (full === ICON_DIR) continue
      await walk(full, out)
    } else if (SCAN_EXT.includes(extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

const used = new Map()
for (const file of await walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  const re = /\b(ph|ri):([a-z0-9][a-z0-9-]*)\b/g
  let m
  while ((m = re.exec(text))) {
    if (!used.has(m[1])) used.set(m[1], new Set())
    used.get(m[1]).add(m[2])
  }
}
for (const spec of EXTRA) {
  const [prefix, name] = spec.split(':')
  if (!used.has(prefix)) used.set(prefix, new Set())
  used.get(prefix).add(name)
}

for (const [prefix, names] of used) {
  const file = join(ICON_DIR, `${prefix}.json`)
  if (!existsSync(file)) {
    console.warn(`跳过 ${prefix}：找不到 ${file}`)
    continue
  }
  const before = statSync(file).size
  const collection = JSON.parse(readFileSync(file, 'utf8'))

  const icons = {}
  const aliases = {}
  const missing = []

  // alias 可能套 alias，顺着 parent 一路找到真身，中间每一层都得留下
  for (const name of names) {
    if (collection.icons?.[name]) {
      icons[name] = collection.icons[name]
      continue
    }
    let cursor = name
    let resolved = false
    const chain = []
    while (collection.aliases?.[cursor]) {
      chain.push(cursor)
      cursor = collection.aliases[cursor].parent
      if (collection.icons?.[cursor]) {
        icons[cursor] = collection.icons[cursor]
        for (const link of chain) aliases[link] = collection.aliases[link]
        resolved = true
        break
      }
    }
    if (!resolved) missing.push(name)
  }

  const subset = { ...collection, icons }
  if (Object.keys(aliases).length) subset.aliases = aliases
  else delete subset.aliases
  // 这些索引字段对渲染没用，只会把体积撑大
  delete subset.categories
  delete subset.chars
  delete subset.themes
  delete subset.prefixes
  delete subset.suffixes
  delete subset.info

  writeFileSync(file, JSON.stringify(subset), 'utf8')
  const after = statSync(file).size

  console.log(
    `${prefix}: 保留 ${Object.keys(icons).length} 个图标` +
      `（别名 ${Object.keys(aliases).length}）  ` +
      `${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`
  )
  if (missing.length) console.warn(`  ${prefix} 里查无此图标：${missing.join(', ')}`)
}
