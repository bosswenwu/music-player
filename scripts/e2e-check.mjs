/**
 * 端到端验证：播放、进度推进、搜索、全屏歌词、队列
 * 用法：node scripts/e2e-check.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL = 'http://localhost:5173/'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--window-size=1600,1000',
  ],
  defaultViewport: { width: 1600, height: 1000 },
})

try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('aside', { timeout: 10000 })
  check('页面加载', true)

  // 1. 进入"歌曲"视图并播放第一首
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === '歌曲')
  check('歌曲视图打开', true)

  const rowCount = await page.evaluate(
    () => document.querySelectorAll('[aria-label="播放"]').length,
  )
  check('歌曲列表渲染（虚拟滚动窗口）', rowCount > 10 && rowCount < 200, `${rowCount} 行`)

  // 点击"播放"主按钮
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('main button')]
    btns.find((b) => b.textContent.trim() === '播放')?.click()
  })
  await new Promise((r) => setTimeout(r, 3500))

  const t1 = await page.evaluate(() => document.title)
  check('开始播放（标题栏显示曲目）', t1.includes('—'), t1)

  const timeText = await page.evaluate(
    () => document.querySelector('footer span.tabular-nums')?.textContent,
  )
  check('播放进度推进', timeText !== '0:00', `当前 ${timeText}`)

  // 2. 拖动进度（seek 到 60s）
  await page.evaluate(() => {
    const slider = document.querySelector('footer input[aria-label="播放进度"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(slider, 60)
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    slider.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 1200))
  const timeAfterSeek = await page.evaluate(
    () => document.querySelector('footer span.tabular-nums')?.textContent,
  )
  check('拖动进度条 seek', /^1:0/.test(timeAfterSeek ?? ''), `seek 后 ${timeAfterSeek}`)

  // 3. 下一首
  await page.click('footer button[aria-label="下一首"]')
  await new Promise((r) => setTimeout(r, 1500))
  const t2 = await page.evaluate(() => document.title)
  check('切换下一首', t2 !== t1 && t2.includes('—'), t2)

  // 4. 搜索
  await page.type('aside input[placeholder="搜索"]', '王菲', { delay: 30 })
  await page.waitForFunction(
    () => document.querySelector('main h1')?.textContent === '搜索',
    { timeout: 5000 },
  )
  await new Promise((r) => setTimeout(r, 600))
  const searchCount = await page.evaluate(
    () => document.querySelectorAll('main [aria-label="播放"]').length,
  )
  check('搜索"王菲"', searchCount > 0, `${searchCount} 条歌曲结果`)
  await page.screenshot({ path: 'shot-search.png' })

  // 5. 播放一首有歌词的歌，打开全屏播放页
  await page.evaluate(async () => {
    const lib = await fetch('/lyrics-probe').catch(() => null)
    void lib
  })
  // 直接搜索一首已知带歌词的：Rolling In The Deep
  await page.evaluate(() => {
    const input = document.querySelector('aside input[placeholder="搜索"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'rolling in the deep')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 800))
  await page.evaluate(() => {
    document.querySelector('main [aria-label="播放"]')?.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  await page.click('footer button[aria-label="打开正在播放"]')
  await new Promise((r) => setTimeout(r, 2500))
  const lyricLines = await page.evaluate(() => document.querySelectorAll('.lyric-line').length)
  check('全屏播放页 + 歌词渲染', lyricLines > 5, `${lyricLines} 行歌词`)
  const activeLine = await page.evaluate(
    () => document.querySelector('.lyric-line[data-active]')?.textContent ?? '',
  )
  check('歌词逐行同步高亮', activeLine.length > 0, `当前行: ${activeLine.slice(0, 30)}`)
  await page.screenshot({ path: 'shot-nowplaying.png' })

  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 600))

  // 6. 队列面板
  await page.click('footer button[aria-label="播放队列"]')
  await new Promise((r) => setTimeout(r, 800))
  const queueVisible = await page.evaluate(
    () => [...document.querySelectorAll('h2')].some((h) => h.textContent === '播放队列'),
  )
  check('队列面板打开', queueVisible)
  await page.screenshot({ path: 'shot-queue.png' })

  // 7. 艺人视图
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '艺人')?.click()
  })
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: 'shot-artists.png' })

  // 8. 控制台错误
  const realErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('net::ERR_ABORTED') && !e.includes('404'),
  )
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
