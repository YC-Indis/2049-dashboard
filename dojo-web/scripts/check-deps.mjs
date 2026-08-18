/**
 * 对照 package.json 的 dependencies，看哪些包在 src 里已经没人 import 了。
 *
 * 只看 dependencies：devDependencies 大多是 eslint/stylelint/vite 插件这类
 * 构建期工具，本来就不会出现在 src 的 import 里，扫了也是噪声。
 *
 * 用法：node scripts/check-deps.mjs
 */
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'

const ROOT = process.cwd()
const SRC = resolve(ROOT, 'src')
const SCAN_EXT = ['.ts', '.vue', '.js', '.mjs', '.scss', '.css']

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (SCAN_EXT.includes(extname(entry.name))) out.push(full)
  }
  return out
}

const files = await walk(SRC)
const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n')
// 顺带把构建配置也算进来，vite.config 里 optimizeDeps 之类会点名依赖
const configs = ['vite.config.ts', 'index.html', 'eslint.config.mjs']
  .map((f) => {
    try {
      return readFileSync(join(ROOT, f), 'utf8')
    } catch {
      return ''
    }
  })
  .join('\n')

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const unused = []

for (const name of Object.keys(pkg.dependencies || {})) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // 覆盖 `from 'pkg'`、`import 'pkg/style.css'`、`import('pkg')`
  const re = new RegExp(`['"\`]${escaped}(/[^'"\`]*)?['"\`]`)
  const inSrc = re.test(corpus)
  const inConfig = re.test(configs)
  const mark = inSrc ? '用' : inConfig ? '仅构建配置' : '没人用'
  if (!inSrc && !inConfig) unused.push(name)
  console.log(`${mark.padEnd(6, '　')} ${name}`)
}

console.log(`\n可以卸载 ${unused.length} 个：`)
console.log(unused.join(' '))
