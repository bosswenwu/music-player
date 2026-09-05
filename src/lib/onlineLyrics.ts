import type { Lyrics } from '../types'
import { parseLrc } from '../../electron/meta.mjs'
import { loadLocal, saveLocal } from './utils'

/**
 * 在线歌词兜底：本地歌词文件缺失时，桌面版走主进程（LRCLIB→网易云），
 * Web 版直接请求 LRCLIB（CORS 开放）。结果按歌曲 id 缓存 7 天。
 */

const CACHE_KEY = 'mp.onlineLyrics'
const TTL = 7 * 24 * 3600 * 1000

interface CacheEntry {
  data: Lyrics
  ts: number
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\u3000\-–—_·・'"“”]/g, '')

export async function fetchOnlineLyricsFor(song: {
  id: string
  artist: string
  title: string
}): Promise<Lyrics | null> {
  const cache = loadLocal<Record<string, CacheEntry>>(CACHE_KEY, {})
  const hit = cache[song.id]
  if (hit && Date.now() - hit.ts < TTL) return hit.data

  let data: Lyrics | null = null
  try {
    data = window.musicDesktop
      ? await window.musicDesktop.lyricFetch(song.artist, song.title)
      : await lrclibWeb(song.artist, song.title)
  } catch {
    data = null
  }

  if (data) {
    cache[song.id] = { data, ts: Date.now() }
    saveLocal(CACHE_KEY, cache)
  }
  return data
}

/** Web 版直连 LRCLIB */
async function lrclibWeb(artist: string, title: string): Promise<Lyrics | null> {
  if (!artist && !title) return null
  const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
  // 8 秒超时：网络卡顿时不至于让歌词一直停在 loading
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let res: Response
  try {
    res = await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) return null
  const list = (await res.json()) as Array<{
    artistName?: string
    trackName?: string
    syncedLyrics?: string | null
  }>
  if (!Array.isArray(list)) return null
  const wantA = norm(artist)
  const wantT = norm(title)
  let best: { score: number; lrc: string } | null = null
  for (const item of list) {
    const a = norm(item.artistName ?? '')
    const t = norm(item.trackName ?? '')
    if (!t || !wantT || !(t === wantT || t.includes(wantT) || wantT.includes(t))) continue
    if (!item.syncedLyrics) continue
    const artistOk = a && wantA && (a === wantA || a.includes(wantA) || wantA.includes(a))
    const score = artistOk ? 2 : 1
    if (!best || score > best.score) best = { score, lrc: item.syncedLyrics }
  }
  return best ? parseLrc(best.lrc) : null
}
