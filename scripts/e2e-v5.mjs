/**
 * 新功能验收：音质视图、歌词字号、悬浮窗设置、首页混排
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

  // 1. 音质导航 + 视图
  const hasQuality = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.trim() === '音质'),
  )
  check('侧边栏有「音质」导航', hasQuality)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '音质')?.click()
  })
  await sleep(600)
  const qView = await page.evaluate(() => {
    const h1 = [...document.querySelectorAll('main h1')].find((h) => h.textContent === '音质')
    const chips = [...document.querySelectorAll('main button')].filter((b) =>
      ['低码率', '中码率', '高码率', '无损', '未知', '全部'].some((label) => b.textContent.includes(label)),
    )
    return { open: !!h1, chipCount: chips.length }
  })
  check('音质视图打开（含筛选）', qView.open && qView.chipCount >= 5, `${qView.chipCount} 个筛选`)

  // 2. 歌曲列表有音质徽标
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await sleep(600)
  const badges = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    const texts = rows.slice(0, 10).map((r) => r.textContent)
    // 音质徽标形如 "192kbps" 或 "320kbps"
    return texts.filter((t) => /kbps/.test(t)).length
  })
  check('歌曲行显示音质徽标', badges > 0, `${badges} 行有码率`)

  // 3. 歌词字号调节（播放一首有歌词的歌，进全屏）
  await page.evaluate(() => {
    const input = document.querySelector('aside input[placeholder="搜索"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'rolling in the deep')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(800)
  await page.evaluate(() => {
    document.querySelector('main [aria-label="播放"]')?.click()
  })
  await sleep(2500)
  await page.click('footer button[aria-label="打开正在播放"]')
  await sleep(2500)
  const lyricCtl = await page.evaluate(() => {
    const aMinus = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'A-')
    const aPlus = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'A+')
    return { hasCtl: !!(aMinus && aPlus) }
  })
  check('歌词字号控制按钮存在', lyricCtl.hasCtl)
  const fontSizeBefore = await page.evaluate(
    () => document.querySelector('.lyric-line')?.style?.fontSize || '',
  )
  await page.evaluate(() => {
    const aPlus = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'A+')
    aPlus?.click()
  })
  await sleep(300)
  const fontSizeAfter = await page.evaluate(
    () => document.querySelector('.lyric-line')?.style?.fontSize || '',
  )
  check('歌词字号调节生效', fontSizeBefore !== fontSizeAfter, `${fontSizeBefore} → ${fontSizeAfter}`)
  await page.screenshot({ path: 'shot-lyrics.png' })

  // 4. 悬浮窗设置按钮（dev 无桥接，仅验证按钮存在）
  await page.keyboard.press('Escape')
  await sleep(500)
  const floatCfgBtn = await page.evaluate(() =>
    [...document.querySelectorAll('footer button')].some((b) => b.getAttribute('aria-label') === '悬浮窗设置'),
  )
  check('悬浮窗设置按钮存在', floatCfgBtn)

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
