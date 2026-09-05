import { app, BrowserWindow, dialog, ipcMain, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { scanFolder } from './scan.mjs'
import { fetchOnlineLyrics } from './onlineLyrics.mjs'
import { fetchArtistPhoto } from './artistPhoto.mjs'
import { resolveMusicRoot as detectMusicRoot } from './music-root.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.opus': 'audio/ogg',
}

let musicRoot = ''
let mainWindow = null
let tray = null
let lyricWindow = null
let serverPort = 0

/** 迷你歌词悬浮窗 HTML（内联，可拖拽，毛玻璃） */
const LYRIC_FLOAT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
:root{--opacity:.72;--fs:19px}
body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;-webkit-app-region:drag;user-select:none;overflow:hidden;color:#fff}
#wrap{padding:16px 22px;border-radius:16px;background:rgba(18,18,20,var(--opacity));backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);box-shadow:0 10px 40px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.09)}
#title{font-size:11.5px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px;text-align:center}
.line{font-size:13.5px;color:rgba(255,255,255,.36);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:22px;line-height:22px;transition:all .28s ease}
.line.active{font-size:var(--fs);font-weight:700;color:#fff;height:28px;line-height:28px}
#trans{font-size:12px;color:rgba(255,255,255,.5);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:17px;line-height:17px;margin-top:3px}
</style></head><body><div id="wrap">
<div id="title">未在播放</div>
<div class="line" id="prev"></div>
<div class="line active" id="cur"></div>
<div class="line" id="next"></div>
<div id="trans"></div>
</div>
<script>
const p=document.getElementById('prev'),c=document.getElementById('cur'),n=document.getElementById('next'),t=document.getElementById('title'),tr=document.getElementById('trans')
window.musicDesktop&&window.musicDesktop.onLyricFloat(function(d){
  if(!d||!d.lines||!d.lines.length){t.textContent='暂无歌词';p.textContent='';c.textContent='';n.textContent='';tr.textContent='';return}
  t.textContent=d.artist?(d.title+' — '+d.artist):d.title
  p.textContent=d.active>0?d.lines[d.active-1]:''
  c.textContent=d.lines[d.active]||''
  n.textContent=d.active<d.lines.length-1?d.lines[d.active+1]:''
  tr.textContent=(d.translation&&d.translation[d.active])||''
})
window.musicDesktop&&window.musicDesktop.onLyricFloatConfig&&window.musicDesktop.onLyricFloatConfig(function(cfg){
  if(!cfg)return
  if(cfg.opacity!=null)document.documentElement.style.setProperty('--opacity',cfg.opacity)
  if(cfg.fontSize!=null)document.documentElement.style.setProperty('--fs',cfg.fontSize+'px')
})
</script></body></html>`

/** 创建迷你歌词悬浮窗（无边框、置顶、透明、不占任务栏） */
function createLyricFloat() {
  lyricWindow = new BrowserWindow({
    width: 440,
    height: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  lyricWindow.setAlwaysOnTop(true, 'screen-saver')
  void lyricWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LYRIC_FLOAT_HTML))
  lyricWindow.on('closed', () => {
    lyricWindow = null
  })
}

function toggleLyricFloat() {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.close()
    return false
  }
  createLyricFloat()
  return true
}

/** 向渲染进程发送媒体控制命令（托盘 / 全局媒体键触发） */
function sendMediaCommand(cmd) {
  mainWindow?.webContents.send('media:command', cmd)
}

/** 系统托盘：播放控制 + 显示/退出 */
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.ico')
    const image = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty()
    tray = new Tray(image)
    tray.setToolTip('音乐')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '播放 / 暂停', click: () => sendMediaCommand('toggle') },
        { label: '上一首', click: () => sendMediaCommand('prev') },
        { label: '下一首', click: () => sendMediaCommand('next') },
        { type: 'separator' },
        {
          label: '迷你歌词',
          type: 'checkbox',
          checked: Boolean(lyricWindow),
          click: () => toggleLyricFloat(),
        },
        { type: 'separator' },
        { label: '显示音乐', click: () => showMainWindow() },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
      ]),
    )
    tray.on('click', () => showMainWindow())
  } catch {
    /* 托盘创建失败不影响播放 */
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (!serverPort) return
    createWindow(serverPort)
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** 全局媒体键（MediaPlayPause 等），被其他应用占用时静默跳过 */
function registerMediaKeys() {
  const bindings = [
    ['MediaPlayPause', 'toggle'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'prev'],
  ]
  for (const [accel, cmd] of bindings) {
    try {
      const ok = globalShortcut.register(accel, () => sendMediaCommand(cmd))
      if (!ok) console.log(`全局快捷键 ${accel} 被其他应用占用，跳过`)
    } catch {
      /* ignore */
    }
  }
}

function configPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

/** 扫描生成的歌词缓存目录（userData/lyrics），供渲染进程 /lyrics/<id>.json 读取 */
function lyricsCacheDir() {
  return path.join(app.getPath('userData'), 'lyrics')
}

function writeLyricsCache(lyrics) {
  const dir = lyricsCacheDir()
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    for (const [id, data] of lyrics) {
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data))
    }
  } catch {
    /* 缓存失败不影响播放 */
  }
}

/** 扫描提取的专辑封面缓存（userData/covers），供渲染进程 /covers/<name> 读取 */
function coversCacheDir() {
  return path.join(app.getPath('userData'), 'covers')
}

function writeCoversCache(covers) {
  const dir = coversCacheDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
    for (const { name, data } of covers.values()) {
      fs.writeFileSync(path.join(dir, name), data)
    }
  } catch {
    /* 缓存失败不影响播放 */
  }
}

/** 在线歌词磁盘缓存（userData/online-lyrics） */
const ONLINE_TTL = 30 * 24 * 3600 * 1000
const ONLINE_TTL_NO_TRANS = 60 * 60 * 1000 // 无翻译的结果（网易云限流降级）短缓存，便于稍后重试
function onlineLyricsDir() {
  return path.join(app.getPath('userData'), 'online-lyrics')
}
async function lyricFetchHandler(_e, { artist, title }) {
  const key = crypto.createHash('md5').update(`${artist}\u0000${title}`).digest('hex')
  const dir = onlineLyricsDir()
  const file = path.join(dir, `${key}.json`)
  try {
    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8'))
      const ttl = cached.data?.translation?.some((x) => x != null) ? ONLINE_TTL : ONLINE_TTL_NO_TRANS
      if (Date.now() - cached.ts < ttl) return cached.data
    }
  } catch {
    /* 缓存损坏则重取 */
  }
  const data = await fetchOnlineLyrics(artist, title)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* 缓存失败不影响 */
  }
  return data
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
  } catch {
    return {}
  }
}

function saveConfig(next) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(next))
}

function resolveMusicRoot() {
  const saved = loadConfig().musicRoot
  if (saved && fs.existsSync(saved)) return saved
  return detectMusicRoot()
}

function sendFile(req, res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    res.end('Not Found')
    return
  }
  const stat = fs.statSync(filePath)
  const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const range = req.headers.range
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mime)
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
    return
  }
  res.setHeader('Content-Length', stat.size)
  fs.createReadStream(filePath).pipe(res)
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        if (urlPath.startsWith('/audio/')) {
          if (!musicRoot) {
            res.statusCode = 404
            return res.end('No library')
          }
          const rel = urlPath.slice('/audio/'.length)
          const filePath = path.resolve(musicRoot, rel)
          if (!filePath.startsWith(path.resolve(musicRoot))) {
            res.statusCode = 403
            return res.end('Forbidden')
          }
          return sendFile(req, res, filePath)
        }
        // 歌词：优先读取扫描生成的缓存（userData/lyrics），再回退到随应用打包的 public/lyrics
        if (urlPath.startsWith('/lyrics/')) {
          const name = path.basename(urlPath.slice('/lyrics/'.length))
          if (name) {
            const cached = path.join(lyricsCacheDir(), name)
            if (fs.existsSync(cached) && fs.statSync(cached).isFile()) {
              return sendFile(req, res, cached)
            }
          }
        }
        // 专辑封面：扫描生成的缓存（userData/covers）
        if (urlPath.startsWith('/covers/')) {
          const name = path.basename(urlPath.slice('/covers/'.length))
          if (name) {
            const cached = path.join(coversCacheDir(), name)
            if (fs.existsSync(cached) && fs.statSync(cached).isFile()) {
              return sendFile(req, res, cached)
            }
          }
        }
        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
        let filePath = path.join(DIST, safe)
        if (urlPath === '/' || !path.extname(filePath)) {
          filePath = path.join(DIST, 'index.html')
        }
        sendFile(req, res, filePath)
      } catch {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(address.port)
    })
    server.on('error', reject)
  })
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: '音乐',
    backgroundColor: '#161616',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  void mainWindow.loadURL(`http://127.0.0.1:${port}/`)
  mainWindow.on('closed', () => {
    mainWindow = null
    // 主窗口关闭时若迷你歌词悬浮窗还开着，一并关闭，避免进程无法退出
    if (lyricWindow && !lyricWindow.isDestroyed()) lyricWindow.close()
  })
}

app.whenReady().then(async () => {
  musicRoot = resolveMusicRoot()
  if (musicRoot) saveConfig({ musicRoot })
  const port = await startServer()
  serverPort = port
  ipcMain.handle('library:get', async () => {
    const { songs, lyrics, covers } = await scanFolder(musicRoot)
    writeLyricsCache(lyrics)
    writeCoversCache(covers)
    return songs
  })
  ipcMain.handle('lyric:fetch', lyricFetchHandler)
  ipcMain.handle('artist:photo', async (_e, name) => {
    try {
      return await fetchArtistPhoto(name)
    } catch {
      return null
    }
  })
  // 迷你歌词悬浮窗
  ipcMain.on('lyricfloat:update', (_e, data) => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.webContents.send('lyricfloat:data', data)
    }
  })
  ipcMain.handle('lyricfloat:toggle', () => toggleLyricFloat())
  ipcMain.handle('lyricfloat:state', () => Boolean(lyricWindow && !lyricWindow.isDestroyed()))
  ipcMain.on('lyricfloat:config', (_e, config) => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.webContents.send('lyricfloat:config', config)
    }
  })
  ipcMain.handle('library:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: '选择音乐文件夹',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      const { songs, lyrics, covers } = await scanFolder(musicRoot)
      writeLyricsCache(lyrics)
      writeCoversCache(covers)
      return songs
    }
    musicRoot = result.filePaths[0]
    saveConfig({ musicRoot })
    const { songs, lyrics, covers } = await scanFolder(musicRoot)
    writeLyricsCache(lyrics)
    writeCoversCache(covers)
    return songs
  })
  createWindow(port)
  createTray()
  registerMediaKeys()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  if (lyricWindow && !lyricWindow.isDestroyed()) lyricWindow.destroy()
})

app.on('window-all-closed', () => {
  app.quit()
})
