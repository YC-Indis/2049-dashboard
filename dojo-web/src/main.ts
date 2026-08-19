import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
import '@styles/dojo-warm-editorial.css'            // Warm editorial tokens
import '@styles/dojo-velix.scss'                    // Velix Agent tokens
import '@utils/sys/console.ts'                      // 控制台输出内容
import '@/utils/ui/iconify-loader'                  // 离线 Iconify（ph / ri）
import { hydrateFromServer } from '@/utils/dojoPersist'

document.addEventListener(
  'touchstart',
  function () {},
  { passive: false }
)

/**
 * 各个 store 都在模块加载时同步读 localStorage，所以服务端的数据必须赶在它们
 * 求值之前灌进去。静态 import 做不到这一点——它们会先于任何代码执行——只能把
 * 这几个模块改成动态 import，卡在 hydrate 后面。
 *
 * 样式留在上面静态导入，它们不碰数据，早点加载还能少一次白屏。
 */
async function bootstrap() {
  await hydrateFromServer()

  const [{ createApp }, { default: App }, { initStore }, { initRouter }, { default: language }] =
    await Promise.all([
      import('vue'),
      import('./App.vue'),
      import('./store'),
      import('./router'),
      import('./locales')
    ])
  const { setupGlobDirectives } = await import('./directives')
  const { setupErrorHandle } = await import('./utils/sys/error-handle')

  const app = createApp(App)
  initStore(app)
  initRouter(app)
  setupGlobDirectives(app)
  setupErrorHandle(app)

  app.use(language)
  app.mount('#app')
}

void bootstrap()
