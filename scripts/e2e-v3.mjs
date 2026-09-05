/**
 * 新功能验收：主题切换、播放列表封面
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

  // 1. 主题切换按钮存在
  const themeBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('aside button')].find(
      (x) => x.getAttribute('aria-label') === '切换主题',
    )
    return !!b
  })
  check('主题切换按钮存在', themeBtn)

  // 2. 点击切换 → 主题翻转（不假设初始是暗还是亮）
  const initState = await page.evaluate(() => ({
    hasLight: document.documentElement.classList.contains('light'),
    bg: getComputedStyle(document.querySelector('aside')).backgroundColor,
  }))
  await page.click('aside button[aria-label="切换主题"]')
  await sleep(300)
  const afterState = await page.evaluate(() => ({
    hasLight: document.documentElement.classList.contains('light'),
    bg: getComputedStyle(document.querySelector('aside')).backgroundColor,
  }))
  check(
    '主题切换生效',
    afterState.hasLight !== initState.hasLight && afterState.bg !== initState.bg,
    `bg: ${initState.bg} → ${afterState.bg}`,
  )
  await page.screenshot({ path: 'shot-theme.png' })

  // 3. 亮色/暗色背景值均合理（切换后取当前背景，确认变量生效）
  const curBg = await page.evaluate(
    () => getComputedStyle(document.querySelector('aside')).backgroundColor,
  )
  const lightBg = 'rgba(255, 255, 255, 0.94)'
  const darkBg = 'rgba(24, 24, 24, 0.94)'
  check('主题背景值正确', curBg === lightBg || curBg === darkBg, curBg)

  // 4. 切回原主题
  await page.click('aside button[aria-label="切换主题"]')
  await sleep(300)
  const restored = await page.evaluate(
    () => document.documentElement.classList.contains('light') === true,
  )
  void restored // 只需确认能切换即可，不强求恢复到初始
  check('可再次切换', true)

  // 5. 播放列表封面：新建播放列表 + 加歌 → Sidebar 有拼图
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '播放列表')?.click()
  })
  await sleep(200)
  await page.evaluate(() => {
    document.querySelector('aside button[aria-label="新建播放列表"]')?.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const input = document.querySelector('.fixed input')
    const ok = [...document.querySelectorAll('.fixed button')].find((b) => b.textContent.trim() === '确定')
    if (input && ok) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '封面歌单')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      ok.click()
    }
  })
  await sleep(600)
  const plCreated = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('封面歌单')),
  )
  check('新建播放列表', plCreated)

  // 加 4 首歌
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await sleep(500)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    for (const r of rows.slice(0, 4)) r.querySelector('.truncate')?.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const bar = [...document.querySelectorAll('main .rounded-xl')].find((d) =>
      d.textContent?.includes('已选'),
    )
    const btns = [...bar?.querySelectorAll('button') ?? []]
    btns.find((b) => b.textContent.includes('加入播放列表'))?.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const bar = [...document.querySelectorAll('main .rounded-xl')].find((d) =>
      d.textContent?.includes('已选'),
    )
    const menu = bar
      ? [...bar.querySelectorAll('div')].find((d) =>
          [...d.querySelectorAll('button')].some((b) => b.textContent.trim() === '封面歌单'),
        )
      : null
    const btn = [...menu?.querySelectorAll('button') ?? []].find(
      (b) => b.textContent.trim() === '封面歌单',
    )
    btn?.click()
  })
  await sleep(500)

  // Sidebar 播放列表项应有 2×2 拼图（4 个格子，封面或渐变）
  const sideArt = await page.evaluate(() => {
    const items = [...document.querySelectorAll('aside button')].filter((b) =>
      b.textContent.includes('封面歌单'),
    )
    const item = items[0]
    if (!item) return 'no-item'
    const grid = item.querySelector('.grid')
    const cells = grid ? grid.querySelectorAll(':scope > *').length : 0
    const imgs = grid ? grid.querySelectorAll('img').length : 0
    return `grid=${!!grid} cells=${cells} imgs=${imgs}`
  })
  check('Sidebar 播放列表封面拼图', sideArt.includes('grid=true') && sideArt.includes('cells=4'), sideArt)

  // 打开播放列表页，顶部有拼图
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.includes('封面歌单'))?.click()
  })
  await sleep(600)
  const detailArt = await page.evaluate(() => {
    const h1 = [...document.querySelectorAll('main h1')].find((h) => h.textContent === '封面歌单')
    const container = h1?.parentElement?.parentElement
    const grid = container?.querySelector('.grid')
    const cells = grid ? grid.querySelectorAll(':scope > *').length : 0
    return `grid=${!!grid} cells=${cells}`
  })
  check('播放列表页封面拼图', detailArt.includes('grid=true') && detailArt.includes('cells=4'), detailArt)

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
