/**
 * 在线歌词（Node 主进程专用）
 * 本地歌词文件缺失时兜底：LRCLIB（免费、CORS 开放）为主，
 * 网易云音乐公开接口为备。返回 { synced, lines } 或 null。
 */
import { parseLrc } from './meta.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s\u3000\-–—_·・'""]/g, '')

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** LRCLIB：按艺人+标题搜索，取第一个带同步歌词的结果 */
async function fromLrclib(artist, title) {
  const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
  const data = await getJson(url)
  if (!Array.isArray(data)) return null
  const wantA = norm(artist)
  const wantT = norm(title)
  let best = null
  for (const item of data) {
    const a = norm(item.artistName ?? '')
    const t = norm(item.trackName ?? '')
    // 优先艺人+标题都精确；其次艺人匹配 + 标题包含
    const artistOk = a && wantA && (a === wantA || a.includes(wantA) || wantA.includes(a))
    const titleOk = t && wantT && (t === wantT || t.includes(wantT) || wantT.includes(t))
    if (!titleOk || !item.syncedLyrics) continue
    const score = artistOk ? 2 : 1
    if (!best || score > best.score) best = { score, lrc: item.syncedLyrics }
  }
  return best ? parseLrc(best.lrc) : null
}

/** 网易云：搜索取 id → 取歌词 */
async function fromNetease(artist, title) {
  const q = `${artist} ${title}`.trim()
  const searchUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(q)}&type=1&limit=8`
  const search = await getJson(searchUrl, { Referer: 'https://music.163.com/' })
  const songs = search?.result?.songs
  if (!Array.isArray(songs) || !songs.length) return null

  const wantA = norm(artist)
  const wantT = norm(title)
  let id = null
  for (const s of songs) {
    const t = norm(s.name ?? '')
    const a = norm(s.artists?.[0]?.name ?? '')
    if (t === wantT && (!wantA || a === wantA || a.includes(wantA))) { id = s.id; break }
    if (t.includes(wantT) && t.length <= wantT.length + 8) { id = s.id; break }
  }
  if (!id) return null

  const lyricUrl = `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`
  const lyric = await getJson(lyricUrl, { Referer: 'https://music.163.com/' })
  const text = lyric?.lrc?.lyric
  if (!text || /\[00:00\.000\] 此歌曲为没有填词的纯音乐/.test(text)) return null
  const parsed = parseLrc(text)
  if (!parsed) return null

  // 逐行翻译（tlyric），按时间戳对齐到原文行
  const tlyricText = lyric?.tlyric?.lyric
  if (tlyricText) {
    const trans = parseLrc(tlyricText)
    if (trans?.lines?.length) {
      const translation = parsed.lines.map((line, i) => {
        // 取时间戳最近的翻译行（|Δt| 最小且 ≤0.6s），否则按索引对齐兜底
        let best = null
        let bestDt = Infinity
        for (const tl of trans.lines) {
          const dt = Math.abs(tl.t - line.t)
          if (dt < bestDt) {
            bestDt = dt
            best = tl.text
          }
        }
        return bestDt <= 0.6 ? best : (trans.lines[i]?.text ?? null)
      })
      if (translation.some((x) => x != null)) parsed.translation = translation
    }
  }
  return parsed
}

/**
 * 抓取在线歌词。顺序：网易云（带翻译）→ LRCLIB（稳定兜底）。
 * @returns {Promise<{synced:'line', lines:Array, translation?:Array}|null>}
 */
export async function fetchOnlineLyrics(artist, title) {
  const a = String(artist ?? '').trim()
  const t = String(title ?? '').trim()
  if (!a && !t) return null
  // 网易云优先：有逐行翻译（tlyric）
  try {
    const netease = await fromNetease(a, t)
    if (netease) return netease
  } catch {
    /* 网络失败降级 */
  }
  try {
    const fromLrclibResult = await fromLrclib(a, t)
    if (fromLrclibResult) return fromLrclibResult
  } catch {
    /* ignore */
  }
  return null
}
