import { ensureServer, APP_URL, fail, openUrl } from './ensure-server.mjs'

if (!(await ensureServer())) {
  fail('没能启动本地音乐服务，请先在 music-player 目录运行 npm run dev。')
}

openUrl(APP_URL)
