/** 验证打包后应用的迷你歌词悬浮窗 IPC 链路（通过 remote debugging） */
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: { width: 1440, height: 900 },
})
const pages = await browser.pages()
// 找主窗口（不是 data: 悬浮窗，也不是 about:blank）
const page = pages.find((p) => p.url().includes('127.0.0.1')) ?? pages[0]
console.log('页面 URL:', page.url())

const results = []
const check = (n, ok, d = '') => {
  results.push({ n, ok })
  console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`)
}

// 1. 初始状态应为关
const init = await page.evaluate(() => window.musicDesktop.lyricFloatState())
check('悬浮窗初始关闭', init === false, String(init))

// 2. 打开
const on1 = await page.evaluate(() => window.musicDesktop.lyricFloatToggle())
check('打开悬浮窗返回 true', on1 === true)

// 3. 状态应为开
const state1 = await page.evaluate(() => window.musicDesktop.lyricFloatState())
check('打开后状态为开', state1 === true)

// 4. 发歌词更新（应不抛错）
const updated = await page.evaluate(() => {
  window.musicDesktop.lyricFloatUpdate({
    title: '测试歌曲',
    artist: '测试艺人',
    lines: ['第一行歌词', '第二行歌词', '第三行歌词'],
    active: 1,
  })
  return true
})
check('发送歌词更新', updated === true)

// 5. 关闭
const on2 = await page.evaluate(() => window.musicDesktop.lyricFloatToggle())
check('关闭悬浮窗返回 false', on2 === false)
const state2 = await page.evaluate(() => window.musicDesktop.lyricFloatState())
check('关闭后状态为关', state2 === false)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
process.exitCode = failed.length ? 1 : 0
await browser.disconnect()
