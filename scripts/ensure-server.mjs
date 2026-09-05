import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PORT = 5173
export const APP_URL = `http://127.0.0.1:${PORT}/`

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end()
      resolve(true)
    })
    socket.setTimeout(800)
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => resolve(false))
  })
}

export async function isServerUp() {
  return (await canConnect('127.0.0.1', PORT)) || (await canConnect('localhost', PORT))
}

export async function waitForServer(timeoutMs = 60000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await isServerUp()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

export function startDevServer() {
  const logDir = path.join(ROOT, 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  const logPath = path.join(logDir, 'launcher.log')
  const logFd = fs.openSync(logPath, 'a')
  fs.writeSync(logFd, `\n[${new Date().toISOString()}] start npm run dev\n`)
  const npmCmd = path.join(path.dirname(process.execPath), 'npm.cmd')
  const npm = fs.existsSync(npmCmd) ? npmCmd : 'npm'
  const child = spawn(npm, ['run', 'dev'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
    shell: !fs.existsSync(npmCmd),
    env: { ...process.env, BROWSER: 'none' },
  })
  child.unref()
}

export async function ensureServer() {
  if (await isServerUp()) return true
  startDevServer()
  return waitForServer()
}

export function findBrowser() {
  const homes = [
    process.env['PROGRAMFILES(X86)'],
    process.env.PROGRAMFILES,
    process.env.LOCALAPPDATA,
  ].filter(Boolean)
  const rels = [
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
  ]
  for (const home of homes) {
    for (const rel of rels) {
      const candidate = path.join(home, ...rel)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

export function openUrl(url) {
  spawn('cmd', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref()
}

export function fail(message) {
  spawn(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '音乐')`,
    ],
    { detached: true, stdio: 'ignore', windowsHide: true },
  ).unref()
  process.exit(1)
}
