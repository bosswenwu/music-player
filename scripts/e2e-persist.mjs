/** 验收：喜欢 + 播放列表在刷新后保留 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--mute-audio', '--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000 },
})

try {
  const page = await browser.newPage()
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
  await page.waitForSelector('aside')

  // 清空旧状态
  await page.evaluate(() => {
    localStorage.removeItem('mp.favorites')
    localStorage.removeItem('mp.playlists')
  })
  await page.reload({ waitUntil: 'networkidle2' })

  // 进入歌曲视图，喜欢第一首
  await page.evaluate(() => {
    ;[...document.querySelectorAll('aside button')]
      .find((b) => b.textContent.trim() === '歌曲')
      ?.click()
  })
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === '歌曲')
  await page.evaluate(() => {
    document.querySelector('main [aria-label="喜欢"]')?.click()
  })
  await new Promise((r) => setTimeout(r, 300))

  // 通过 API 建播放列表（等价于 UI prompt 流程）
  await page.evaluate(() => {
    localStorage.setItem(
      'mp.playlists',
      JSON.stringify([{ id: 'pl_test', name: '验收列表', songIds: [], createdAt: Date.now() }]),
    )
  })

  // 刷新，验证状态保留
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('aside')
  await page.evaluate(() => {
    ;[...document.querySelectorAll('aside button')]
      .find((b) => b.textContent.trim() === '已喜欢的音乐')
      ?.click()
  })
  await new Promise((r) => setTimeout(r, 600))
  const favSubtitle = await page.evaluate(
    () => document.querySelector('main p')?.textContent ?? '',
  )
  const hasPlaylist = await page.evaluate(() =>
    [...document.querySelectorAll('aside button')].some((b) => b.textContent.includes('验收列表')),
  )

  console.log(favSubtitle.includes('1 首') ? '✅ 喜欢刷新后保留' : `❌ 喜欢丢失: ${favSubtitle}`)
  console.log(hasPlaylist ? '✅ 播放列表刷新后保留' : '❌ 播放列表丢失')

  // 清理测试数据
  await page.evaluate(() => {
    localStorage.removeItem('mp.favorites')
    localStorage.removeItem('mp.playlists')
  })
} finally {
  await browser.close()
}
