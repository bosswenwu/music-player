import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { resolveMusicRoot } from './scripts/music-root.mjs'

/** 本地曲库根目录，通过 /audio/** 挂载给浏览器（不复制文件）；可用环境变量 MUSIC_ROOT 覆盖 */
const MUSIC_ROOT = resolveMusicRoot()

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
}

function serveLocalAudio(): Plugin {
  const root = path.resolve(MUSIC_ROOT)

  const handler = (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '').split('?')[0])
      const filePath = path.resolve(root, urlPath.replace(/^\/+/, ''))
      // 防目录穿越
      if (!filePath.startsWith(root)) {
        res.statusCode = 403
        return res.end('Forbidden')
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.statusCode = 404
        return res.end('Not Found')
      }

      const stat = fs.statSync(filePath)
      const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const range = req.headers.range

      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', 'public, max-age=3600')

      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range)
        let start = match?.[1] ? parseInt(match[1], 10) : 0
        let end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1
        if (Number.isNaN(start) || start > end || end >= stat.size) {
          start = 0
          end = stat.size - 1
        }
        res.statusCode = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
        res.setHeader('Content-Length', end - start + 1)
        fs.createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.setHeader('Content-Length', stat.size)
        fs.createReadStream(filePath).pipe(res)
      }
    } catch {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }

  return {
    name: 'serve-local-audio',
    configureServer(server) {
      server.middlewares.use('/audio', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/audio', handler)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serveLocalAudio()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/.edge-app-profile/**', '**/node_modules/**', '**/logs/**', '**/release/**'],
    },
  },
})
