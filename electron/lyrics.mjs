/**
 * 歌词模块（Node 专用）
 *  - 解密并解析酷狗 KRC（逐字时间轴）、解析 LRC（逐行时间轴）
 *  - 扫描曲库根目录下所有 *.krc / *.lrc 建立索引（文件名通常是
 *    "艺人 - 标题-<32位hash>.krc"，需要去掉 hash 后缀再配对）
 *  - 模糊配对：按规范名 + 标题做多级打分，解决
 *    "Puff Daddy - I Will Be Missing You - 吹牛老爹.mp3" 与
 *    "Puff Daddy - I'll Be Missing You-xxx.krc" 这类差异
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { parseFilenameMeta, artistKey, normKeyForLyrics, parseLrc } from './meta.mjs'

export { parseLrc }

const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
const SKIP_DIRS = new Set(['cache', 'listen'])
const HASH_SUFFIX = /-[0-9a-f]{32}$/i

const round3 = (n) => Math.round(n * 1000) / 1000

// ---------------------------------------------------------------- 解析

export function decryptKrc(buf) {
  if (buf.length < 4 || buf.toString('latin1', 0, 4) !== 'krc1') throw new Error('not krc')
  const data = Buffer.from(buf.subarray(4))
  for (let i = 0; i < data.length; i++) data[i] ^= KRC_KEY[i % 16]
  return zlib.inflateSync(data).toString('utf8').replace(/^\uFEFF/, '')
}

/** KRC 行：[开始ms,时长ms]<字偏移,字时长,0>词<...>词；支持 [offset:ms] */
export function parseKrc(text) {
  const lines = []
  let offset = 0
  const offsetRe = /^\[offset:(-?\d+)\]$/m
  const om = offsetRe.exec(text)
  if (om) offset = parseInt(om[1], 10) / 1000

  const lineRe = /^\[(\d+),(\d+)\](.*)$/
  const wordRe = /<(\d+),(\d+),\d+>([^<]*)/g
  for (const raw of text.split(/\r?\n/)) {
    const m = lineRe.exec(raw.trim())
    if (!m) continue
    const start = parseInt(m[1], 10) / 1000 + offset
    const dur = parseInt(m[2], 10) / 1000
    const words = []
    let full = ''
    let w
    while ((w = wordRe.exec(m[3])) !== null) {
      const wt = start + parseInt(w[1], 10) / 1000
      const wd = parseInt(w[2], 10) / 1000
      words.push({ t: round3(wt), d: round3(wd), text: w[3] })
      full += w[3]
    }
    if (!full.trim()) continue
    lines.push({ t: round3(start), d: round3(dur), text: full, words })
  }
  lines.sort((a, b) => a.t - b.t)
  return lines.length ? { synced: 'word', lines } : null
}

/** LRC 行：[mm:ss.xx]文本（一行可能多个时间标签）——实现见 meta.mjs 的 parseLrc（共用） */


export function decodeTextBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf)
    } catch {
      return buf.toString('utf8')
    }
  }
}

/** 按扩展名解析单个歌词文件 */
export function parseLyricFile(file) {
  try {
    const buf = fs.readFileSync(file)
    const ext = path.extname(file).toLowerCase()
    if (ext === '.krc') return parseKrc(decryptKrc(buf))
    if (ext === '.lrc') return parseLrc(decodeTextBuffer(buf))
  } catch {
    /* ignore */
  }
  return null
}

// ---------------------------------------------------------------- 索引

function lyricKeys(meta) {
  const primary = meta.artists[0] && meta.artists[0] !== '未知艺人' ? meta.artists[0] : ''
  const artistK = artistKey(primary)
  return {
    artistK,
    titleK: normKeyForLyrics(meta.title),
    fullK: normKeyForLyrics(`${primary}${meta.title}`),
  }
}

/**
 * 扫描 root 下所有 krc/lrc 文件（跳过 Cache/Listen），建立索引。
 * 返回 { byFull: Map, byArtist: Map, byTitle: Map }
 */
export function buildLyricIndex(root) {
  const byFull = new Map()
  const byArtist = new Map()
  const byTitle = new Map()

  const walk = (dir) => {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue
        walk(full)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (ext !== '.krc' && ext !== '.lrc') continue
      // "艺人 - 标题-<32位hash>.krc" → 去掉 hash 后缀
      const base = entry.name
        .slice(0, -ext.length)
        .replace(HASH_SUFFIX, '')
        .trim()
      const meta = parseFilenameMeta(base)
      const keys = lyricKeys(meta)
      const rec = {
        file: full,
        kind: ext.slice(1),
        artistK: keys.artistK,
        titleK: keys.titleK,
        fullK: keys.fullK,
      }
      if (keys.fullK) {
        // 同 key 保留第一个（按遍历顺序，krc/lrc 同名时先到先得）
        if (!byFull.has(keys.fullK)) byFull.set(keys.fullK, rec)
      }
      if (keys.artistK) {
        if (!byArtist.has(keys.artistK)) byArtist.set(keys.artistK, [])
        byArtist.get(keys.artistK).push(rec)
      }
      if (keys.titleK) {
        if (!byTitle.has(keys.titleK)) byTitle.set(keys.titleK, [])
        byTitle.get(keys.titleK).push(rec)
      }
    }
  }

  if (root && fs.existsSync(root)) walk(root)
  return { byFull, byArtist, byTitle }
}

// ---------------------------------------------------------------- 配对

/** 宽松包含：同艺人下的标题近似（中文歌名 2 字起即可，"xxx (Live)" vs "xxx"） */
const containsLoose = (a, b) => a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))
/** 严格包含：无艺人信息时的标题近似，需要更长片段防误配 */
const containsStrict = (a, b) => a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))

/**
 * 给一首歌（可传多个候选 meta，如文件名解析 + 标签解析）找最合适的歌词文件。
 * 返回 { file, kind, score } 或 null。打分：
 *  100 艺人+标题完全一致
 *   92 艺人一致 + 标题一致
 *   86 艺人一致 + 标题互相包含
 *   72 标题一致（另一方艺人未知或同名）
 *   60 标题互相包含
 */
export function matchLyricFile(metas, index) {
  if (!index || !metas?.length) return null
  let best = null

  const consider = (rec, score) => {
    if (score > 60 && (!best || score > best.score || (score === best.score && rec.kind === 'krc' && best.kind !== 'krc'))) {
      best = { file: rec.file, kind: rec.kind, score }
    }
  }

  for (const meta of metas) {
    if (!meta) continue
    const primary = meta.artists?.[0] && meta.artists[0] !== '未知艺人' ? meta.artists[0] : ''
    const artistK = artistKey(primary)
    const titleK = normKeyForLyrics(meta.title)
    const fullK = normKeyForLyrics(`${primary}${meta.title}`)

    if (fullK) {
      const exact = index.byFull.get(fullK)
      if (exact) consider(exact, 100)
    }
    if (artistK) {
      for (const rec of index.byArtist.get(artistK) ?? []) {
        if (rec.titleK === titleK) consider(rec, 92)
        else if (containsLoose(rec.titleK, titleK)) consider(rec, 86)
      }
    }
    if (titleK) {
      for (const rec of index.byTitle.get(titleK) ?? []) {
        if (rec.artistK && artistK && rec.artistK === artistK) consider(rec, 92)
        else if (!rec.artistK || !artistK) consider(rec, 72)
        else if (containsStrict(rec.titleK, titleK)) consider(rec, 60)
      }
    }
  }

  return best && best.score > 60 ? best : null
}
