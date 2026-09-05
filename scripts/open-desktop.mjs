import { spawn } from 'node:child_process'
import path from 'node:path'
import { ensureServer, APP_URL, ROOT, fail, findBrowser, openUrl } from './ensure-server.mjs'

if (!(await ensureServer())) {
  fail('没能启动本地音乐服务，请先在 music-player 目录运行 npm run dev。')
}

const browser = findBrowser()
if (!browser) {
  openUrl(APP_URL)
  process.exit(0)
}

const profile = path.join(
  process.env.LOCALAPPDATA || ROOT,
  'MusicPlayerApp',
)
spawn(
  browser,
  [
    `--app=${APP_URL}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
  ],
  { detached: true, stdio: 'ignore', windowsHide: true },
).unref()
