/**
 * 用 DeepSeek 梳理项目明细，写入 src/store/dojoProjectStore.ts
 * 运行: node scripts/import-projects.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

const RAW_PROJECTS = `
blast 10k v1.0
blast 10k v2.0
purex 60k v1.0
xros6 v1.0 (美国)
xros6 v1.0 (波兰)
xros6 v1.0 (英国)
垂类矩阵 blast 10k v3.0
垂类矩阵 purex 60k v2.0
垂类矩阵 blast X
垂类矩阵 blast 15k
垂类矩阵 Xros 6 (美国)
垂类矩阵 Xros 6 (英国)
垂类矩阵 Xros 6 (德国)
`

const PROJECT_LIB = fs.readFileSync(
  path.join(root, '../docs/_excel_digest/project_lib.txt'),
  'utf8'
)

const SCHEMA = `[
  {
    "id": "blast-10k-v1",
    "name": "blast 10k v1.0",
    "aliases": ["blast 10k", "blast10k", "dojo blast 10k Q1"],
    "region": "英国",
    "status": "已完结",
    "active": true,
    "adProjectKeys": ["dojo blast 10k Q1", "blast 10k v1"]
  }
]`

async function callDeepSeek(key, base, model) {
  const prompt = `你是 Dojo 中控台数据整理助手。根据「原始项目列表」和「项目库明细」，输出结构化 JSON 数组。

要求：
1. 每条项目有唯一 id（kebab-case）、name、aliases（用于匹配投放/分发文本）、region、status、active
2. aliases 要覆盖 Excel/投放里可能出现的写法（如 dojo blast 10k Q2、xros6 德国、purex 60k 1.0 等）
3. 保留 elfbar、vibe se、dojo 作为独立项目
4. xros6 与 Xros 6、blast 大小写变体都要在 aliases 里
5. 只输出 JSON 数组，不要 markdown

结构参考：
${SCHEMA}

原始项目列表：
${RAW_PROJECTS}

项目库明细（含国家、进度、播放量）：
${PROJECT_LIB.slice(0, 4000)}
`

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '只输出合法 JSON 数组，不要其他文字。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  })

  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const start = text.search(/\[\s*{/)
  const end = text.lastIndexOf(']')
  if (start < 0 || end < 0) throw new Error('无法解析 JSON：\n' + text)
  return JSON.parse(text.slice(start, end + 1))
}

function fallbackProjects() {
  return [
    { id: 'dojo', name: 'Dojo', aliases: ['dojo', 'Dojo'], region: '英国', status: '进行中', active: true },
    {
      id: 'blast-10k-v1',
      name: 'blast 10k v1.0',
      aliases: ['blast 10k v1', 'blast10k', 'dojo blast 10k Q1', 'blast 10k'],
      region: '英国',
      status: '已完结',
      active: true
    },
    {
      id: 'blast-10k-v2',
      name: 'blast 10k v2.0',
      aliases: ['blast 10k v2', 'dojo blast 10k Q2', 'blast10k 2.0'],
      region: '英国',
      status: '已完结',
      active: true
    },
    {
      id: 'purex-60k-v1',
      name: 'purex 60k v1.0',
      aliases: ['purex 60k v1', 'purex 60k 1.0', 'purex'],
      region: '美国',
      status: '已达标',
      active: true
    },
    {
      id: 'xros6-v1-us',
      name: 'xros6 v1.0 · 美国',
      aliases: ['xros6 v1', 'xros 6', 'xros6 美国', 'Xros6'],
      region: '美国',
      status: '已完结',
      active: true
    },
    {
      id: 'xros6-v1-pl',
      name: 'xros6 v1.0 · 波兰',
      aliases: ['xros6 波兰', 'xros6 poland', 'XROS - 波兰'],
      region: '波兰',
      status: '已完结',
      active: true
    },
    {
      id: 'xros6-v1-uk',
      name: 'xros6 v1.0 · 英国',
      aliases: ['xros6 英国', 'xros6 uk'],
      region: '英国',
      status: '进行中',
      active: true
    },
    {
      id: 'matrix-blast-10k-v3',
      name: '垂类矩阵 · blast 10k v3.0',
      aliases: ['balst 10k 3.0 垂类', 'blast10k 英国3.0', 'blast 10k v3', '垂类 blast 10k'],
      region: '英国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-purex-60k-v2',
      name: '垂类矩阵 · purex 60k v2.0',
      aliases: ['purex 60k 2.0 垂类', 'purex 德州 2.0', '垂类 purex'],
      region: '美国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-blast-x',
      name: '垂类矩阵 · blast X',
      aliases: ['blast X 垂类', 'blast X 德国'],
      region: '德国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-blast-15k',
      name: '垂类矩阵 · blast 15k',
      aliases: ['blast15k 垂类', 'blast15k 法国'],
      region: '法国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-xros6-us',
      name: '垂类矩阵 · Xros 6 · 美国',
      aliases: ['xros6 美国 2.0垂类', 'xros6 美国'],
      region: '美国',
      status: '结案中',
      active: true
    },
    {
      id: 'matrix-xros6-uk',
      name: '垂类矩阵 · Xros 6 · 英国',
      aliases: ['xros6 英国 2.0垂类', 'xros6 英国2.0'],
      region: '英国',
      status: '进行中',
      active: true
    },
    {
      id: 'matrix-xros6-de',
      name: '垂类矩阵 · Xros 6 · 德国',
      aliases: ['xros6 德国 2.0垂类', 'xros6 德国1.0'],
      region: '德国',
      status: '进行中',
      active: true
    },
    { id: 'elfbar', name: 'elfbar', aliases: ['elfbar'], region: '—', status: '进行中', active: true },
    { id: 'vibe-se', name: 'vibe se', aliases: ['vibe se', 'vibe'], region: '—', status: '进行中', active: true },
    { id: 'archive', name: '历史归档', aliases: [], region: '—', status: '归档', active: false }
  ]
}

function writeStore(projects, source) {
  const ts = new Date().toISOString()
  const body = `import { computed, reactive } from 'vue'

export interface DojoProject {
  id: string
  name: string
  /** 用于筛选投放/分发等：匹配 project / batch / name 片段 */
  aliases: string[]
  region?: string
  status?: string
  active: boolean
}

/**
 * 多项目上下文：时间规划 / 节奏日历 / 投放 / 分发都挂在项目上。
 * 项目列表由 scripts/import-projects.mjs 生成（${source}，${ts}）
 */
export const dojoProjectStore = reactive({
  projects: ${JSON.stringify(projects, null, 4).replace(/"([^"]+)":/g, '$1:')} as DojoProject[],
  /** 空 = 全部项目 */
  currentId: '' as string
})

export const currentProject = computed(() =>
  dojoProjectStore.projects.find((p) => p.id === dojoProjectStore.currentId) || null
)

export function setCurrentProject(id: string) {
  dojoProjectStore.currentId = id
}

export function matchProjectText(text: string, project: DojoProject | null) {
  if (!project) return true
  const t = text.toLowerCase()
  if (project.aliases.some((a) => a && t.includes(a.toLowerCase()))) return true
  if (t.includes(project.name.toLowerCase())) return true
  if (project.region && project.region !== '—' && t.includes(project.region.toLowerCase())) {
    const base = project.name.split('·')[0].trim().toLowerCase()
    if (base.length > 2 && t.includes(base.split(' ')[0])) return true
  }
  return false
}

export function ensureProject(name: string) {
  const id = name.trim().toLowerCase().replace(/\\s+/g, '-') || \`p-\${Date.now()}\`
  if (!dojoProjectStore.projects.some((p) => p.id === id || p.name === name)) {
    dojoProjectStore.projects.push({
      id,
      name: name.trim(),
      aliases: [name.trim()],
      active: true
    })
  }
  return id
}
`
  const out = path.join(root, 'src/store/dojoProjectStore.ts')
  fs.writeFileSync(out, body, 'utf8')
  console.log(`Wrote ${projects.length} projects → ${out}`)
}

async function main() {
  const env = loadEnv()
  const key = env.VITE_DEEPSEEK_API_KEY
  const base = env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = env.VITE_DEEPSEEK_MODEL || 'deepseek-chat'

  let projects
  let source = 'fallback'

  if (key) {
    try {
      console.log('Calling DeepSeek to parse projects…')
      projects = await callDeepSeek(key, base, model)
      source = 'DeepSeek'
      console.log(`DeepSeek returned ${projects.length} projects`)
    } catch (e) {
      console.warn('DeepSeek failed:', e.message)
      projects = fallbackProjects()
    }
  } else {
    console.warn('No VITE_DEEPSEEK_API_KEY, using fallback')
    projects = fallbackProjects()
  }

  // 规范化
  projects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: Array.isArray(p.aliases) ? p.aliases : [p.name],
    region: p.region || '—',
    status: p.status || '进行中',
    active: p.active !== false && p.id !== 'archive'
  }))

  writeStore(projects, source)

  const report = {
    at: new Date().toISOString(),
    source,
    projectCount: projects.length,
    projects: projects.map((p) => ({ id: p.id, name: p.name, region: p.region, status: p.status }))
  }
  const reportPath = path.join(root, '../docs/_excel_digest/project_import_report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log('Report →', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
