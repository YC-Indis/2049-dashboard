/**
 * 生成软著源代码附件。
 *
 * 规则来自登记要求：前 30 页加后 30 页共 60 页，每页不少于 50 行，页眉带软件名称
 * 和版本号，末页要收在完整的函数或模块上、不能断在半截。
 *
 * 收录范围只到自研部分。项目底子是 Art Design Pro，那一层的文件头都留着原作者
 * 署名，交上去等于把别人的代码当自己的申报，所以这里按署名自动剔除，而不是靠
 * 人工挑——挑一次准漏。
 *
 * 输出 HTML 而不是直接出 PDF：中文字体在浏览器打印里最省事，用 Chrome 打开另存
 * 为 PDF 即可，也不用给项目多加一个 PDF 依赖。
 *
 * 用法：
 *   node scripts/build-copyright-listing.mjs
 *   node scripts/build-copyright-listing.mjs --full   # 连中间部分一起出，自查用
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SOFTWARE_NAME = '海外短视频矩阵内容运营协同系统'
const SOFTWARE_VERSION = 'V1.0'

const LINES_PER_PAGE = 50
const PAGES_PER_SIDE = 30

/** 第三方模板层的标记。命中任意一条就整个文件排除 */
const THIRD_PARTY_MARKS = [/@author\s+Art Design Pro/i, /Art Design Pro Team/i]

/**
 * 收录目录。顺序即成文顺序，前 30 页会落在最前面这几项上，所以把最能说明
 * 设计思路的放前面：智能体编排、执行域规则，然后才是接口和界面。
 */
const SOURCE_GROUPS = [
  { label: '智能体编排与工具执行', dir: 'server/app/services/agent' },
  { label: '执行域业务规则', dir: 'server/app/services', depth: 0 },
  { label: '数据模型', dir: 'server/app/models' },
  { label: '接口层', dir: 'server/app/routers' },
  { label: '数据结构定义', dir: 'server/app/schemas' },
  { label: '服务端基础设施', dir: 'server/app', depth: 0 },
  { label: '前端状态管理', dir: 'dojo-web/src/store', filter: (n) => n.startsWith('dojo') },
  { label: '前端智能体对话', dir: 'dojo-web/src/composables' },
  { label: '前端业务工具', dir: 'dojo-web/src/utils', filter: (n) => n.startsWith('dojo') },
  { label: '前端接口封装', dir: 'dojo-web/src/api' },
  { label: '业务路由', dir: 'dojo-web/src/router/modules', filter: (n) => n === 'dojo.ts' },
  { label: '业务组件', dir: 'dojo-web/src/components/dojo' },
  { label: '业务页面', dir: 'dojo-web/src/views/dojo' }
]

const CODE_EXT = /\.(ts|tsx|vue|py|mjs)$/

/** 脱敏。附件是要提交出去的，密钥、服务器地址、口令一律不能带 */
const REDACTIONS = [
  [/sk-[A-Za-z0-9]{16,}/g, '<APIKEY>'],
  [/[a-f0-9]{10}msh[A-Za-z0-9]{20,}/g, '<APIKEY>'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (m) => (m.startsWith('127.') || m === '0.0.0.0' ? m : '<HOST>')],
  [/(DOJO_AUTH_PASSWORD\s*=\s*)\S+/g, '$1<PASSWORD>'],
  [/(DOJO_AUTH_SECRET\s*=\s*)\S+/g, '$1<SECRET>']
]

function walk(dir, { depth = Infinity, filter } = {}) {
  const abs = join(ROOT, dir)
  let entries
  try {
    entries = readdirSync(abs)
  } catch {
    return []
  }

  const found = []
  for (const name of entries.sort()) {
    const full = join(abs, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (depth > 0) found.push(...walk(relative(ROOT, full), { depth: depth - 1, filter }))
      continue
    }
    if (!CODE_EXT.test(name)) continue
    if (name.startsWith('_')) continue
    if (filter && !filter(name)) continue
    found.push(full)
  }
  return found
}

function collect() {
  const seen = new Set()
  const picked = []
  const skipped = []

  for (const group of SOURCE_GROUPS) {
    for (const file of walk(group.dir, group)) {
      if (seen.has(file)) continue
      seen.add(file)

      const raw = readFileSync(file, 'utf8')
      const rel = relative(ROOT, file).split(sep).join('/')

      if (THIRD_PARTY_MARKS.some((re) => re.test(raw))) {
        skipped.push(rel)
        continue
      }
      picked.push({ rel, group: group.label, raw })
    }
  }
  return { picked, skipped }
}

function redact(text) {
  return REDACTIONS.reduce((acc, [re, to]) => acc.replace(re, to), text)
}

/** 一行在 A4 上排得下的字符数，超了要折，否则实际占两行、页数就对不上了 */
const WRAP_AT = 108

function wrap(line) {
  if (line.length <= WRAP_AT) return [line]
  const out = []
  // 折行缩进两格，看得出是同一条语句的延续
  const indent = (line.match(/^\s*/) || [''])[0] + '  '
  let rest = line
  while (rest.length > WRAP_AT) {
    out.push(rest.slice(0, WRAP_AT))
    rest = indent + rest.slice(WRAP_AT)
  }
  out.push(rest)
  return out
}

/** 空行不计入行数要求，但保留在正文里，删掉反而不像正常代码 */
function toLines(file) {
  const body = redact(file.raw).replace(/\r\n/g, '\n').replace(/\s+$/, '')
  const raw = [`/* ===== ${file.rel} ===== */`, ...body.split('\n')]
  return raw.flatMap(wrap)
}

function buildDocument() {
  const { picked, skipped } = collect()

  const units = picked.map((file) => {
    const lines = toLines(file)
    return { ...file, lines, effective: lines.filter((l) => l.trim()).length }
  })

  const total = units.reduce((sum, u) => sum + u.lines.length, 0)
  return { units, skipped, total }
}

/**
 * 按文件边界切前后两段。
 *
 * 不在行号上硬切：登记要求末尾是完整的函数或模块，从文件中间断开会被判成代码
 * 不完整。所以以文件为最小单位累加，宁可多出几十行。
 */
function splitSides(units, needLines) {
  // 够页数就停，但下一个文件如果会让这一段超出目标一半以上就不要了——
  // 业务页面动辄一两千行，硬加进来会把 30 页撑成 50 页
  const overflowCap = needLines * 1.5

  const head = []
  let headLines = 0
  for (const unit of units) {
    if (headLines >= needLines) break
    if (headLines > 0 && headLines + unit.lines.length > overflowCap) continue
    head.push(unit)
    headLines += unit.lines.length
  }

  const taken = new Set(head)
  const tail = []
  let tailLines = 0
  for (let i = units.length - 1; i >= 0; i--) {
    if (tailLines >= needLines) break
    if (taken.has(units[i])) break
    if (tailLines > 0 && tailLines + units[i].lines.length > overflowCap) continue
    tail.unshift(units[i])
    tailLines += units[i].lines.length
  }

  return { head, tail, headLines, tailLines }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function paginate(lines) {
  const pages = []
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE))
  }
  return pages
}

/**
 * 自己分页而不是交给浏览器。
 *
 * 登记要求每页不少于 50 行，交给 CSS 断页的话每页落多少行取决于字号和纸张，
 * 数不准也说不清。这里一页固定 50 行，页数就是确定的。
 */
function renderHtml(pages) {
  const body = pages
    .map(
      (page, idx) => `<div class="page">
  <div class="hd">${SOFTWARE_NAME}　${SOFTWARE_VERSION}</div>
  <pre>${escapeHtml(page.join('\n'))}</pre>
  <div class="ft">第 ${idx + 1} 页 / 共 ${pages.length} 页</div>
</div>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${SOFTWARE_NAME} ${SOFTWARE_VERSION} 源程序</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  body { margin: 0; background: #f2f2f2; }

  .page {
    box-sizing: border-box;
    width: 210mm;
    height: 297mm;
    padding: 14mm 12mm 10mm;
    margin: 0 auto 6mm;
    background: #fff;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  .hd {
    font-family: SimSun, serif;
    font-size: 9pt;
    text-align: center;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
    border-bottom: 0.4pt solid #000;
  }
  .ft {
    font-family: SimSun, serif;
    font-size: 8pt;
    text-align: center;
    margin-top: 3mm;
  }

  pre {
    margin: 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.2pt;
    /* 50 行 × 4.9mm 正好填满正文区，页眉页脚各留一条 */
    line-height: 4.9mm;
    white-space: pre;
  }

  @media print {
    body { background: #fff; }
    .page { margin: 0; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`
}

function main() {
  const full = process.argv.includes('--full')
  const { units, skipped, total } = buildDocument()
  const need = LINES_PER_PAGE * PAGES_PER_SIDE

  const outDir = join(ROOT, 'release', 'copyright')
  mkdirSync(outDir, { recursive: true })

  let pages
  let summary

  if (full) {
    pages = paginate(units.flatMap((u) => u.lines))
    summary = `全文 ${pages.length} 页`
  } else if (total <= need * 2) {
    // 不足六十页的按规定全部提交
    pages = paginate(units.flatMap((u) => u.lines))
    summary = `不足六十页，全文提交，共 ${pages.length} 页`
  } else {
    const { head, tail } = splitSides(units, need)
    // 前段取头部整 need 行、后段取尾部整 need 行，这样每页都是满 50 行，
    // 而且最后一页正好收在源文件的结尾上，不会断在语句中间
    const headPages = paginate(head.flatMap((u) => u.lines).slice(0, need))
    const tailPages = paginate(tail.flatMap((u) => u.lines).slice(-need))
    pages = [...headPages, ...tailPages]
    summary = `前 ${headPages.length} 页 + 后 ${tailPages.length} 页 = ${pages.length} 页`

    console.log('\n前三十页收录：')
    for (const u of head) console.log(`  ${String(u.lines.length).padStart(5)} 行  ${u.rel}`)
    console.log('\n后三十页收录：')
    for (const u of tail) console.log(`  ${String(u.lines.length).padStart(5)} 行  ${u.rel}`)
    console.log('')
  }

  const target = join(outDir, full ? 'source-full.html' : 'source-listing.html')
  writeFileSync(target, renderHtml(pages), 'utf8')

  const lastLine = [...pages[pages.length - 1]].reverse().find((l) => l.trim()) || ''

  console.log(`软件名称  ${SOFTWARE_NAME} ${SOFTWARE_VERSION}`)
  console.log(`收录文件  ${units.length} 个，合计 ${total} 行`)
  console.log(`排除模板  ${skipped.length} 个（文件头带第三方署名）`)
  console.log(`本次输出  ${summary}`)
  console.log(`末页收尾  ${lastLine.trim().slice(0, 60)}`)
  console.log(`已写入    ${relative(ROOT, target)}`)
  console.log('\n用 Chrome 打开，Ctrl+P，纸张 A4、边距选「无」、勾选「背景图形」，另存为 PDF。')
}

main()
