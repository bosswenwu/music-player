/**
 * 本轮新功能验收：睡眠定时器、多选批量、队列拖拽、播放列表拖拽
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

  // 1. 睡眠定时器按钮 + 点击切换
  const sleepBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('footer button')].find((x) =>
      x.getAttribute('aria-label') === '睡眠定时器',
    )
    return { exists: !!b, label: b?.getAttribute('aria-label') ?? '' }
  })
  check('睡眠定时器按钮存在', sleepBtn.exists)
  await page.click('footer button[aria-label="睡眠定时器"]')
  await sleep(300)
  const sleepActive = await page.evaluate(() => {
    const b = [...document.querySelectorAll('footer button')].find(
      (x) => x.getAttribute('aria-label') === '睡眠定时器',
    )
    return b?.textContent?.includes('15') ?? false
  })
  check('睡眠定时器激活（15 分钟）', sleepActive, '按钮显示 15')
  // 清掉：循环点击 4 次回到关闭
  for (let i = 0; i < 4; i++) {
    await page.click('footer button[aria-label="睡眠定时器"]')
    await sleep(120)
  }

  // 2. 多选批量：进入歌曲视图，点击三行 → 批量条出现 → 收藏 → 清除
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await sleep(800)
  // 点击三行（跳过按钮区域：点行的标题文字区域）
  const clicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    for (const r of rows.slice(0, 3)) {
      const titleEl = r.querySelector('.truncate')
      const rect = titleEl?.getBoundingClientRect()
      if (rect) {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        // 用 element.click 触发 React onClick
        ;(titleEl)?.click()
      }
    }
    return rows.length
  })
  check('歌曲视图有行可点', clicked > 10, `${clicked} 行`)
  await sleep(400)
  const bar = await page.evaluate(
    () => document.querySelector('main .rounded-xl')?.textContent?.includes('已选') ?? false,
  )
  check('批量操作条出现', bar)

  // 收藏三首
  await page.evaluate(() => {
    const bar = [...document.querySelectorAll('main .rounded-xl')].find((d) =>
      d.textContent?.includes('已选'),
    )
    const btns = [...bar?.querySelectorAll('button') ?? []]
    btns.find((b) => b.textContent.trim() === '收藏')?.click()
  })
  await sleep(400)
  const favCount = await page.evaluate(() => {
    const bar = [...document.querySelectorAll('main .rounded-xl')].find((d) =>
      d.textContent?.includes('已选'),
    )
    return bar ? '仍在显示' : '已清除'
  })
  check('批量收藏后选择已清除', favCount === '已清除')

  // 3. 播放列表：新建 → 加入歌曲 → 拖拽重排（自定义对话框，非原生 prompt）
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '播放列表')?.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const btn = document.querySelector('aside button[aria-label="新建播放列表"]')
    btn?.click()
  })
  await sleep(400)
  // 在自定义对话框输入框里输入并点确定
  const dialogShown = await page.evaluate(() => {
    const input = document.querySelector('.fixed input')
    const ok = [...document.querySelectorAll('.fixed button')].find((b) => b.textContent.trim() === '确定')
    if (input && ok) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '验收歌单')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      ok.click()
      return true
    }
    return false
  })
  check('自定义对话框弹出', dialogShown)
  await sleep(600)
  const plCreated = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('验收歌单')),
  )
  check('新建播放列表', plCreated)

  // 加入几首歌：歌曲视图 → 全选 → 加入播放列表
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.trim() === '歌曲')?.click()
  })
  await sleep(600)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    for (const r of rows.slice(0, 5)) {
      const titleEl = r.querySelector('.truncate')
      ;(titleEl)?.click()
    }
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
    // 限定在批量操作条内查找下拉菜单，避免误点侧边栏同名按钮
    const bar = [...document.querySelectorAll('main .rounded-xl')].find((d) =>
      d.textContent?.includes('已选'),
    )
    const menu = bar
      ? [...bar.querySelectorAll('div')].find((d) =>
          [...d.querySelectorAll('button')].some((b) => b.textContent.trim() === '验收歌单'),
        )
      : null
    const btn = [...menu?.querySelectorAll('button') ?? []].find(
      (b) => b.textContent.trim() === '验收歌单',
    )
    btn?.click()
  })
  await sleep(400)
  // 打开播放列表
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.includes('验收歌单'))?.click()
  })
  await sleep(600)
  const plRows = await page.evaluate(
    () => document.querySelectorAll('main [aria-label="播放"]').length,
  )
  check('播放列表有 5 首歌', plRows === 5, `${plRows} 首`)

  // 拖拽重排：第 1 行拖到第 3 行（模拟 drag 事件）
  const reordered = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    if (rows.length < 3) return 'rows<3'
    const titles = () => rows.map((r) => r.querySelector('.truncate')?.textContent)
    const before = titles()
    const dt = new DataTransfer()
    rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    rows[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    rows[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    rows[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 500))
    const after = [...document.querySelectorAll('main .group')]
      .filter((r) => r.querySelector('[aria-label="播放"]'))
      .map((r) => r.querySelector('.truncate')?.textContent)
    return JSON.stringify({ before, after })
  })
  const reorderedOk = (() => {
    try {
      const { before, after } = JSON.parse(reordered)
      return after && after[0] === before[1] && after[1] === before[2] && after[2] === before[0]
    } catch {
      return false
    }
  })()
  check('播放列表拖拽重排', reorderedOk, reordered)

  // 4. 队列拖拽：播放几首后打开队列，拖拽第一首到第三首
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main .group')].filter((r) =>
      r.querySelector('[aria-label="播放"]'),
    )
    rows[0]?.querySelector('[aria-label="播放"]')?.click()
  })
  await sleep(1500)
  await page.click('footer button[aria-label="播放队列"]')
  await sleep(600)
  const qDrag = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('.z-40 .group, .z-40 [data-current]')].filter((r) =>
      r.querySelector('.truncate'),
    )
    if (rows.length < 3) return 'rows<3:' + rows.length
    const before = rows.map((r) => r.querySelector('.truncate')?.textContent)
    const dt = new DataTransfer()
    rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    rows[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    rows[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    rows[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 500))
    const after = [...document.querySelectorAll('.z-40 .group, .z-40 [data-current]')]
      .filter((r) => r.querySelector('.truncate'))
      .map((r) => r.querySelector('.truncate')?.textContent)
    return JSON.stringify({ before, after })
  })
  const qOk = (() => {
    try {
      const { before, after } = JSON.parse(qDrag)
      // 队列面板只显示「正在播放 + 接下来」：拖当前行(0)→(2) 后 index 变为 2，
      // 可见行减少且当前行不变，说明 moveInQueue 生效
      return (
        after &&
        before.length >= 3 &&
        after.length < before.length &&
        after[0] === before[0]
      )
    } catch {
      return false
    }
  })()
  check('队列拖拽排序', qOk, qDrag)

  // 5. 收藏视图确认批量收藏生效
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('aside button')]
    btns.find((b) => b.textContent.includes('已喜欢的音乐'))?.click()
  })
  await sleep(600)
  const favRows = await page.evaluate(
    () => document.querySelectorAll('main [aria-label="播放"]').length,
  )
  check('批量收藏已生效', favRows >= 3, `${favRows} 首`)

  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
