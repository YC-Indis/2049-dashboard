import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import ElementPlus from 'unplugin-element-plus/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import tailwindcss from '@tailwindcss/vite'
// import { visualizer } from 'rollup-plugin-visualizer'

export default ({ mode }: { mode: string }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root, '')
  const {
    VITE_VERSION,
    VITE_PORT,
    VITE_BASE_URL,
    VITE_API_URL,
    VITE_API_PROXY_URL,
    VITE_DOJO_PROXY_URL,
    RAPIDAPI_KEY,
    DEEPSEEK_API_KEY
  } = env

  console.log(`🚀 API_URL = ${VITE_API_URL}`)
  console.log(`🚀 VERSION = ${VITE_VERSION}`)

  const dojoProxy = VITE_DOJO_PROXY_URL || 'http://127.0.0.1:8000'
  const artMockProxy = VITE_API_PROXY_URL || 'https://m1.apifoxmock.com/m1/6400575-6097373-default'

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(VITE_VERSION)
    },
    base: VITE_BASE_URL,
    server: {
      port: Number(VITE_PORT),
      proxy: {
        // Dojo FastAPI first (more specific)
        '/api/dojo': {
          target: dojoProxy,
          changeOrigin: true
        },
        // DeepSeek（开发代理，密钥可由前端或下方 configure 注入）
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/deepseek/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (DEEPSEEK_API_KEY && !proxyReq.getHeader('authorization')) {
                proxyReq.setHeader('Authorization', `Bearer ${DEEPSEEK_API_KEY}`)
              }
            })
          }
        },
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/openai/, '')
        },
        '/api/qwen': {
          target: 'https://dashscope.aliyuncs.com/compatible-mode',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/qwen/, '')
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/anthropic/, '')
        },
        // RapidAPI TikTok（账号粉丝 / 作品同步）— 必须在 /api 兜底之前
        '/api/rapidapi': {
          target: 'https://tiktok-api6.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/rapidapi/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-rapidapi-host', 'tiktok-api6.p.rapidapi.com')
              if (RAPIDAPI_KEY) {
                proxyReq.setHeader('x-rapidapi-key', RAPIDAPI_KEY)
              }
            })
          }
        },
        // Art Design Pro auth/menu mock
        '/api': {
          target: artMockProxy,
          changeOrigin: true
        }
      },
      host: true,
      fs: {
        allow: [fileURLToPath(new URL('.', import.meta.url))]
      }
    },
    // 路径别名
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@views': resolvePath('src/views'),
        '@imgs': resolvePath('src/assets/images'),
        '@icons': resolvePath('src/assets/icons'),
        '@utils': resolvePath('src/utils'),
        '@stores': resolvePath('src/store'),
        '@styles': resolvePath('src/assets/styles')
      }
    },
    build: {
      target: 'es2015',
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
      // The local desktop build includes many route chunks; esbuild avoids Terser worker OOMs.
      minify: 'esbuild',
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [],
        include: ['src/views/**/*.vue']
      }
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : []
    },
    plugins: [
      localProviderProxy({ rapidApiKey: RAPIDAPI_KEY, deepSeekApiKey: DEEPSEEK_API_KEY }),
      vue(),
      tailwindcss(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: 'src/types/import/auto-imports.d.ts',
        resolvers: [ElementPlusResolver()],
        eslintrc: {
          enabled: true,
          filepath: './.auto-import.json',
          globalsPropValue: true
        }
      }),
      // 自动按需导入组件
      Components({
        dts: 'src/types/import/components.d.ts',
        resolvers: [ElementPlusResolver()]
      }),
      // 按需定制主题配置
      ElementPlus({
        useSource: true
      }),
      // 压缩
      viteCompression({
        verbose: false, // 是否在控制台输出压缩结果
        disable: false, // 是否禁用
        algorithm: 'gzip', // 压缩算法
        ext: '.gz', // 压缩后的文件名后缀
        threshold: 10240, // 只有大小大于该值的资源会被处理 10240B = 10KB
        deleteOriginFile: false // 压缩后是否删除原文件
      }),
      // Vue DevTools 浮标影响操作且拖慢开发页，Dojo 默认关闭
      ...(process.env.DOJO_VUE_DEVTOOLS === '1' ? [vueDevTools()] : [])
      // 打包分析
      // visualizer({
      //   open: true,
      //   gzipSize: true,
      //   brotliSize: true,
      //   filename: 'dist/stats.html' // 分析图生成的文件名及路径
      // }),
    ],
    // 依赖预构建：避免运行时重复请求与转换，提升首次加载速度
    optimizeDeps: {
      include: [
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'xlsx',
        'xgplayer',
        'crypto-js',
        'file-saver',
        'vue-img-cutter',
        'element-plus/es',
        'element-plus/es/components/*/style/css',
        'element-plus/es/components/*/style/index'
      ]
    },
    css: {
      preprocessorOptions: {
        // sass variable and mixin
        scss: {
          additionalData: `
            @use "@styles/core/el-light.scss" as *; 
            @use "@styles/core/mixin.scss" as *;
          `
        }
      },
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  })
}

function resolvePath(paths: string) {
  return path.resolve(__dirname, paths)
}

interface LocalProviderConfig {
  rapidApiKey?: string
  deepSeekApiKey?: string
}

function localProviderProxy(config: LocalProviderConfig): Plugin {
  return {
    name: 'dojo-local-provider-proxy',
    configureServer(server) {
      server.middlewares.use('/api/local/tiktok/search', async (request, response) => {
        await proxyTikTokSearch(request, response, config.rapidApiKey, '/search/general/query')
      })

      server.middlewares.use('/api/local/tiktok/search-videos', async (request, response) => {
        await proxyTikTokSearch(request, response, config.rapidApiKey, '/search/videos/query')
      })

      server.middlewares.use('/api/llm-proxy', async (request, response) => {
        const targetBase = String(request.headers['x-llm-target'] || '').replace(/\/$/, '')
        if (!targetBase) {
          sendJson(response, 400, { error: '缺少 x-llm-target' })
          return
        }
        try {
          const suffix = (request.url || '').split('?')[0] || ''
          const body = await readRawBody(request)
          const headers: Record<string, string> = {
            'Content-Type': request.headers['content-type'] || 'application/json'
          }
          if (request.headers.authorization) {
            headers.Authorization = String(request.headers.authorization)
          }
          if (request.headers['x-api-key']) {
            headers['x-api-key'] = String(request.headers['x-api-key'])
          }
          if (request.headers['anthropic-version']) {
            headers['anthropic-version'] = String(request.headers['anthropic-version'])
          }
          const providerResponse = await fetch(`${targetBase}${suffix}`, {
            method: request.method || 'POST',
            headers,
            body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
            signal: AbortSignal.timeout(60000)
          })
          await relayProviderResponse(providerResponse, response)
        } catch (error) {
          sendJson(response, 502, { error: providerErrorMessage(error, '自定义模型请求失败') })
        }
      })

      server.middlewares.use('/api/local/deepseek/chat', async (request, response) => {
        if (!config.deepSeekApiKey) {
          sendJson(response, 503, { error: 'DeepSeek 尚未配置' })
          return
        }
        try {
          const body = await readJsonBody(request)
          const providerResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.deepSeekApiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-v4-flash',
              messages: Array.isArray(body.messages) ? body.messages : [],
              temperature: 0.35,
              stream: false
            }),
            signal: AbortSignal.timeout(45000)
          })
          await relayProviderResponse(providerResponse, response)
        } catch (error) {
          sendJson(response, 502, { error: providerErrorMessage(error, 'DeepSeek 请求失败') })
        }
      })
    }
  }
}

async function proxyTikTokSearch(
  request: IncomingMessage,
  response: ServerResponse,
  rapidApiKey: string | undefined,
  endpoint: '/search/general/query' | '/search/videos/query'
) {
  if (!rapidApiKey) {
    sendJson(response, 503, { error: 'RapidAPI 尚未配置' })
    return
  }
  try {
    const body = await readJsonBody(request)
    const providerResponse = await fetch(`https://tiktok-api6.p.rapidapi.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'tiktok-api6.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey
      },
      body: JSON.stringify({
        query: String(body.query || '').trim(),
        cursor: Number(body.cursor || 0),
        sort_type: String(body.sort_type || '0')
      }),
      signal: AbortSignal.timeout(30000)
    })
    await relayProviderResponse(providerResponse, response)
  } catch (error) {
    sendJson(response, 502, { error: providerErrorMessage(error, 'TikTok 检索失败') })
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRawBody(request)
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

async function readRawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (!chunks.length) return ''
  return Buffer.concat(chunks).toString('utf8')
}

async function relayProviderResponse(providerResponse: Response, response: ServerResponse) {
  const payload = await providerResponse.text()
  response.statusCode = providerResponse.status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(payload)
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function providerErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === 'TimeoutError') return `${fallback}：请求超时`
  return fallback
}
