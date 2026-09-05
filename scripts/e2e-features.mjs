/**
 * 新功能验收：常听视图、艺人照片、在线歌词、歌词面板开关、右键菜单
 * 依赖 vite dev server (localhost:5173) + 网络（网易云/LRCLIB）
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

  // 1. 常听导航存在
  const hasTop = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('常听')),
  )
  check('侧边栏有「常听」', hasTop)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.includes('常听'))?.click()
  })
  await page.waitForFunction(() => {
    const main = document.querySelector('main')
    return main?.textContent?.includes('常听')
  }, { timeout: 5000 })
  check('常听视图打开', true)

  // 2. 艺人视图 + 照片（等待网络加载）
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.includes('艺人'))?.click()
  })
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent === '艺人', {
    timeout: 5000,
  })
  await new Promise((r) => setTimeout(r, 6000)) // 等网易云照片串行加载
  const cardImgs = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main .rounded-full')]
    return { total: cards.length, withImg: cards.filter((c) => c.tagName === 'IMG').length }
  })
  check(
    '艺人卡片照片加载',
    cardImgs.withImg > 0,
    `${cardImgs.withImg}/${cardImgs.total} 张卡片显示照片`,
  )

  // 3. 打开一位艺人的详情页
  await page.evaluate(() => {
    ;(document.querySelector('main .rounded-full img') ?? document.querySelector('main .rounded-full'))?.closest('.group')?.click()
  })
  await new Promise((r) => setTimeout(r, 4000))
  const detailImg = await page.evaluate(() => {
    const el = document.querySelector('main h1')?.parentElement?.parentElement?.querySelector('img')
    return { hasImg: !!el, src: el?.src?.slice(0, 60) ?? '' }
  })
  check('艺人详情页有照片', detailImg.hasImg, detailImg.src)

  // 4. 在线歌词：播放一首本地无歌词的歌（Beautiful）
  await page.evaluate(() => {
    const input = document.querySelector('aside input[placeholder="搜索"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'Beautiful')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 800))
  const found = await page.evaluate(() => document.querySelectorAll('main [aria-label="播放"]').length)
  check('搜索 Beautiful', found > 0, `${found} 条`)

  await page.evaluate(() => {
    document.querySelector('main [aria-label="播放"]')?.click()
  })
  await new Promise((r) => setTimeout(r, 3500))
  await page.click('footer button[aria-label="打开正在播放"]')
  await new Promise((r) => setTimeout(r, 10000)) // 等在线歌词返回
  const onlineLyrics = await page.evaluate(() => {
    const badge = [...document.querySelectorAll('div')].find((d) => d.textContent === '网络歌词')
    const lines = document.querySelectorAll('.lyric-line').length
    return { badge: !!badge, lines }
  })
  check('在线歌词兜底显示', onlineLyrics.badge && onlineLyrics.lines > 5, `${onlineLyrics.lines} 行`)

  // 5. 歌词面板开关
  const before = await page.evaluate(() => document.querySelectorAll('.lyric-line').length)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    btns.find((b) => b.textContent.trim() === '歌词')?.click()
  })
  await new Promise((r) => setTimeout(r, 400))
  const after = await page.evaluate(() => document.querySelectorAll('.lyric-line').length)
  check('歌词面板可切换', before > 0 && after === 0, `开关后 ${after} 行`)

  // 6. 右键菜单（在搜索结果第一行上右键）
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 600))
  const rowBox = await page.evaluate(() => {
    const btn = document.querySelector('main [aria-label="播放"]')
    const row = btn?.closest('.group') ?? btn?.parentElement
    if (!row) return null
    const r = row.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (rowBox) {
    await page.mouse.click(rowBox.x, rowBox.y, { button: 'right' })
    await new Promise((r) => setTimeout(r, 600))
  }
  const menuItems = await page.evaluate(() =>
    [...document.querySelectorAll('.fixed button')].map((b) => b.textContent.trim()).filter(Boolean),
  )
  check(
    '右键菜单含查看艺人/专辑',
    menuItems.includes('查看艺人') && menuItems.includes('查看专辑'),
    menuItems.join('、'),
  )

  // 7. Ctrl+F 聚焦搜索
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 300))
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyF')
  await page.keyboard.up('Control')
  await new Promise((r) => setTimeout(r, 300))
  const focusOk = await page.evaluate(
    () => document.activeElement === document.querySelector('aside input[placeholder="搜索"]'),
  )
  check('Ctrl+F 聚焦搜索框', focusOk)

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
