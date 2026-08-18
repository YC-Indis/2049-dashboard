import { chromium } from 'file:///C:/Users/Flour/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = 'http://127.0.0.1:5191'
const context = await chromium.launchPersistentContext('D:/2049 Dashboard/.browser-profile-style-unify', {
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  viewport: { width: 1440, height: 960 }
})

async function inspect(route, heading, screenshot) {
  const page = await context.newPage()
  await page.goto(`${base}/#${route}`, { waitUntil: 'networkidle' })
  if (page.url().includes('/auth/login')) {
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL((url) => !url.hash.includes('/auth/login'), { timeout: 20000 })
  }
  const h1 = page.locator('h1').filter({ hasText: heading })
  await h1.waitFor({ timeout: 20000 })
  const metrics = await page.evaluate(() => {
    const heading = document.querySelector('h1')
    return {
      fontSize: heading ? getComputedStyle(heading).fontSize : '',
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      text: document.body.innerText
    }
  })
  await page.screenshot({ path: screenshot, fullPage: true })
  await page.close()
  return metrics
}

const project = await inspect('/project', '项目管理', '.impeccable/review/unify-project.png')
const accounts = await inspect('/accounts/review', '总账号预览', '.impeccable/review/unify-accounts.png')
const worklog = await inspect('/worklog', '工作复盘', '.impeccable/review/unify-worklog.png')
const calendar = await inspect('/calendar', '把内容节奏', '.impeccable/review/unify-calendar.png')
const inspiration = await inspect('/inspiration-collection', '持续发现', '.impeccable/review/unify-inspiration.png')

console.log(JSON.stringify({
  headings: [project.fontSize, accounts.fontSize, worklog.fontSize],
  calendarHasBatchReview: calendar.text.includes('批量复盘'),
  calendarHasLive: calendar.text.includes('直播安排'),
  widths: [project, accounts, worklog, calendar, inspiration].map((item) => [item.bodyWidth, item.viewportWidth])
}, null, 2))

await context.close()
