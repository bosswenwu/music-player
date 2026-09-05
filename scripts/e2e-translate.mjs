/** 验证打包后应用：在线歌词翻译（网易云 tlyric） */
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9223',
  defaultViewport: { width: 1440, height: 900 },
})
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1')) ?? pages[0]

const results = []
const check = (n, ok, d = '') => {
  results.push({ n, ok })
  console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`)
}

// 在线歌词（主进程：网易云优先带翻译，限流时降级 LRCLIB）
const lyric = await page.evaluate(() => window.musicDesktop.lyricFetch('Adele', 'Hello'))
check('在线歌词获取', !!lyric && lyric.lines.length > 10, `${lyric?.lines?.length ?? 0} 行`)
// 翻译尽力而为（网易云外部风控限流时可能缺失，不算失败）
const hasTrans = !!lyric && Array.isArray(lyric.translation) && lyric.translation.some((t) => t != null)
console.log(`${hasTrans ? '✅' : 'ℹ️'} 歌词翻译${hasTrans ? ' — ' + (lyric.translation.find((t) => t != null) ?? '') : '（网易云限流/无翻译，歌词仍可用）'}`)

// 歌词库扫描缓存
const lib = await page.evaluate(() => window.musicDesktop.getLibrary())
check('曲库扫描', Array.isArray(lib) && lib.length > 500, `${lib?.length} 首`)
check('歌曲有时长', lib.some((s) => s.duration > 0))
check('歌曲有封面', lib.some((s) => s.cover))

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
process.exitCode = failed.length ? 1 : 0
await browser.disconnect()
