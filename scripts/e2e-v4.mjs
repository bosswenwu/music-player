/**
 * 新功能验收：均衡器、键盘导航、清空队列、重复歌曲检测
 * 依赖 vite dev server (localhost:5173)
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL = 'http://localhost:5173/'
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000 },
})

try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404|ERR_/.test(m.text())) errors.push(m.text())
  })
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('aside', { timeout: 10000 })
  check('页面加载', true)

  // 1. 均衡器面板
  const eqBtn = await page.evaluate(() =>
    [...document.querySelectorAll('footer button')].some((b) => b.getAttribute('aria-label') === '均衡器'),
  )
  check('均衡器按钮存在', eqBtn)
  await page.click('footer button[aria-label="均衡器"]')
  await sleep(300)
  const eqPanel = await page.evaluate(() =>
    [...document.querySelectorAll('footer button')].some((b) => b.textContent.trim() === '摇滚'),
  )
  check('均衡器面板展开（含预设）', eqPanel)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('footer button')]
    btns.find((b) => b.textContent.trim() === '摇滚')?.click()
  })
  await sleep(300)
  const eqActive = await page.evaluate(() => {
    const b = [...document.querySelectorAll('footer button')].find(
      (x) => x.getAttribute('aria-label') === '均衡器',
    )
    return b?.title?.includes('摇滚') ?? false
  })
  check('选择摇滚预设生效', eqActive, '按钮标题含"摇滚"')

  // 2. 键盘导航：进歌曲视图，聚焦列表，↓ 移动光标，回车播放
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await sleep(600)
  await page.evaluate(() => {
    const list = document.querySelector('main [aria-label="歌曲列表"]')
    ;(list)?.focus()
  })
  await page.keyboard.press('ArrowDown')
  await sleep(200)
  const cursor = await page.evaluate(() => {
    const list = document.querySelector('main [aria-label="歌曲列表"]')
    return list?.querySelector('.ring-1') ? true : false
  })
  check('键盘 ↓ 移动光标', cursor, '光标行有 ring 高亮')
  await page.keyboard.press('Enter')
  await sleep(2500)
  const title = await page.title()
  check('回车播放光标歌曲', title.includes('—'), title)

  // 3. 清空队列
  await page.click('footer button[aria-label="播放队列"]')
  await sleep(600)
  const beforeCount = await page.evaluate(
    () => document.querySelectorAll('.z-40 [data-current], .z-40 .group').length,
  )
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="清空队列"]')
    ;(btn)?.click()
  })
  await sleep(400)
  const afterCount = await page.evaluate(
    () => document.querySelectorAll('.z-40 [data-current], .z-40 .group').length,
  )
  check('清空队列（保留当前一首）', beforeCount > afterCount && afterCount <= 1, `${beforeCount} → ${afterCount}`)
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="关闭队列"]')
    ;(btn)?.click()
  })
  await sleep(300)

  // 4. 重复歌曲检测
  const dupNav = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('重复歌曲')),
  )
  check('侧边栏有「重复歌曲」导航', dupNav)
  if (dupNav) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('aside button')]
      btns.find((b) => b.textContent.includes('重复歌曲'))?.click()
    })
    await sleep(600)
    const dupView = await page.evaluate(() => {
      const h1 = [...document.querySelectorAll('main h1')].find((h) => h.textContent === '重复歌曲')
      const groups = document.querySelectorAll('main .rounded-xl.border').length
      return { open: !!h1, groups }
    })
    check('重复歌曲视图打开', dupView.open, `${dupView.groups} 组`)
  }

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
