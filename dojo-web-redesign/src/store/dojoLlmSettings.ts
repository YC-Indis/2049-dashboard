import { computed, reactive } from 'vue'

export type LlmApiStyle = 'openai' | 'anthropic'

export interface LlmProviderConfig {
  id: string
  name: string
  /** openai 兼容（DeepSeek / GPT / Qwen）或 Anthropic Messages */
  style: LlmApiStyle
  /** 根地址，不含 /v1/...；自定义可填任意兼容端点 */
  baseUrl: string
  model: string
  apiKey: string
  /** 预设不可删，自定义可删 */
  builtin?: boolean
}

const STORAGE_KEY = 'dojo-agent-llm-settings'
const LEGACY_DEEPSEEK_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner'])

function normalizeProviderModel(id: string, model: string) {
  if (id === 'deepseek' && LEGACY_DEEPSEEK_MODELS.has(model)) return 'deepseek-v4-flash'
  return model
}

const BUILTIN: LlmProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    style: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKey: '',
    builtin: true
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    style: 'openai',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o-mini',
    apiKey: '',
    builtin: true
  },
  {
    id: 'qwen',
    name: '通义千问 Qwen',
    style: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-plus',
    apiKey: '',
    builtin: true
  },
  {
    id: 'claude',
    name: 'Claude',
    style: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    builtin: true
  }
]

interface PersistedSettings {
  activeId: string
  providers: LlmProviderConfig[]
  fontScale: number
}

function load(): PersistedSettings {
  const envKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim() || ''
  const defaults: PersistedSettings = {
    activeId: 'deepseek',
    providers: BUILTIN.map((item) =>
      item.id === 'deepseek' && envKey ? { ...item, apiKey: envKey } : { ...item }
    ),
    fontScale: 1
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    const saved = Array.isArray(parsed.providers) ? parsed.providers : []
    const byId = new Map(saved.map((item) => [item.id, item]))
    const providers = [
      ...BUILTIN.map((builtin) => {
        const hit = byId.get(builtin.id)
        return hit
          ? {
              ...builtin,
              apiKey: hit.apiKey || (builtin.id === 'deepseek' ? envKey : ''),
              model: normalizeProviderModel(builtin.id, hit.model || builtin.model),
              baseUrl: hit.baseUrl || builtin.baseUrl
            }
          : {
              ...builtin,
              apiKey: builtin.id === 'deepseek' ? envKey : ''
            }
      }),
      ...saved.filter((item) => !BUILTIN.some((builtin) => builtin.id === item.id))
    ]
    const rawScale =
      typeof parsed.fontScale === 'number' && parsed.fontScale >= 0.85 && parsed.fontScale <= 1.4
        ? parsed.fontScale
        : 1
    return {
      activeId:
        typeof parsed.activeId === 'string' && providers.some((p) => p.id === parsed.activeId)
          ? parsed.activeId
          : 'deepseek',
      providers,
      // 上一版默认偏大，自动收回正常字号
      fontScale: rawScale > 1.05 ? 1 : rawScale
    }
  } catch {
    return defaults
  }
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeId: dojoLlmSettings.activeId,
      providers: dojoLlmSettings.providers,
      fontScale: dojoLlmSettings.fontScale
    } satisfies PersistedSettings)
  )
}

const initial = load()

export const dojoLlmSettings = reactive({
  activeId: initial.activeId,
  providers: initial.providers as LlmProviderConfig[],
  fontScale: initial.fontScale
})

if (
  initial.providers.some((item) => item.id === 'deepseek' && item.model === 'deepseek-v4-flash')
) {
  persist()
}

export const activeLlmProvider = computed(() => {
  return (
    dojoLlmSettings.providers.find((item) => item.id === dojoLlmSettings.activeId) ||
    dojoLlmSettings.providers[0] ||
    null
  )
})

export function setActiveLlmProvider(id: string) {
  if (!dojoLlmSettings.providers.some((item) => item.id === id)) return
  dojoLlmSettings.activeId = id
  persist()
}

export function updateLlmProvider(id: string, patch: Partial<LlmProviderConfig>) {
  const target = dojoLlmSettings.providers.find((item) => item.id === id)
  if (!target) return
  if (patch.name != null) target.name = patch.name.trim() || target.name
  if (patch.baseUrl != null) target.baseUrl = patch.baseUrl.trim().replace(/\/$/, '')
  if (patch.model != null) target.model = patch.model.trim() || target.model
  if (patch.apiKey != null) target.apiKey = patch.apiKey.trim()
  if (patch.style != null) target.style = patch.style
  persist()
}

export function addCustomLlmProvider(input?: Partial<LlmProviderConfig>) {
  const id = `custom-${Date.now().toString(36)}`
  const provider: LlmProviderConfig = {
    id,
    name: input?.name?.trim() || '自定义模型',
    style: input?.style || 'openai',
    baseUrl: (input?.baseUrl || 'https://api.openai.com').replace(/\/$/, ''),
    model: input?.model?.trim() || 'gpt-4o-mini',
    apiKey: input?.apiKey?.trim() || '',
    builtin: false
  }
  dojoLlmSettings.providers.push(provider)
  dojoLlmSettings.activeId = id
  persist()
  return provider
}

export function removeLlmProvider(id: string) {
  const target = dojoLlmSettings.providers.find((item) => item.id === id)
  if (!target || target.builtin) return false
  dojoLlmSettings.providers = dojoLlmSettings.providers.filter((item) => item.id !== id)
  if (dojoLlmSettings.activeId === id) {
    dojoLlmSettings.activeId = dojoLlmSettings.providers[0]?.id || 'deepseek'
  }
  persist()
  return true
}

export function setAgentFontScale(scale: number) {
  dojoLlmSettings.fontScale = Math.min(1.35, Math.max(0.85, Number(scale.toFixed(2))))
  persist()
}

/** 开发态把官方域名改写到 Vite 代理，避免浏览器 CORS */
export function resolveLlmRequestBase(provider: LlmProviderConfig): {
  base: string
  targetHeader?: string
} {
  const base = provider.baseUrl.replace(/\/$/, '')
  if (!import.meta.env.DEV) return { base }
  if (/api\.deepseek\.com/i.test(base)) return { base: '/api/deepseek' }
  if (/api\.openai\.com/i.test(base)) return { base: '/api/openai' }
  if (/dashscope\.aliyuncs\.com/i.test(base)) return { base: '/api/qwen' }
  if (/api\.anthropic\.com/i.test(base)) return { base: '/api/anthropic' }
  return { base: '/api/llm-proxy', targetHeader: base }
}
