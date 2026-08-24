/**
 * 曲库扫描脚本
 * 扫描 MUSIC_ROOT 下的音频文件，提取 ID3 元数据与内嵌封面，
 * 解密酷狗 KRC 歌词 / 解析 LRC 歌词，输出：
 *   - src/data/library.json    歌曲清单
 *   - public/covers/*.jpg      专辑封面（按内容哈希去重）
 *   - public/lyrics/<id>.json  逐字/逐行歌词时间轴
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseFile } from 'music-metadata'

const MUSIC_ROOT = process.env.MUSIC_ROOT || 'F:/照片/KuGou'
const LYRIC_DIR = path.join(MUSIC_ROOT, 'Lyric')
const OUT_DATA = fileURLToPath(new URL('../src/data/library.json', import.meta.url))
const OUT_COVERS = fileURLToPath(new URL('../public/covers/', import.meta.url))
const OUT_LYRICS = fileURLToPath(new URL('../public/lyrics/', import.meta.url))

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.flac', '.wav'])
const SKIP_DIRS = new Set(['Cache', 'Listen', 'Lyric'])
const MIN_SIZE = 100 * 1024 // 跳过损坏的 4KB 假文件

// ---------------------------------------------------------------- utils

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex')

/** 归一化用于歌词配对的 key：小写、去掉空白和标点 */
const normKey = (s) =>
  s
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[·・'''"'"`!！?？.。,，、\-–—_()（）\[\]【】&+]/g, '')

/** 从 "艺人 - 标题" 文件名中解析 */
function parseFilename(basename) {
  const idx = basename.indexOf(' - ')
  if (idx > 0) {
    return { artist: basename.slice(0, idx).trim(), title: basename.slice(idx + 3).trim() }
  }
  return { artist: '', title: basename.trim() }
}

/**
 * 修复"GBK/Big5 标签被按 Latin-1 解码"的经典乱码：
 * 把字符串按 latin1 还原成字节后分别尝试 GBK 与 Big5 解码，
 * 按"常用汉字 + ASCII 占比"评分择优，仅在明显更合理时采用。
 */
function mojibakeScore(s) {
  let good = 0
  let total = 0
  for (const c of s) {
    const cp = c.codePointAt(0)
    total++
    // ASCII、常用标点、CJK 基本区常用字
    if (cp < 0x80 || (cp >= 0x4e00 && cp <= 0x9fa5) || '，。！？：；、（）《》'.includes(c)) good++
  }
  return total ? good / total : 0
}

function fixMojibake(s) {
  if (!s || !/[\u0080-\u00ff]/.test(s)) return s
  // 字符必须全部落在 latin1 范围内才可能是被误解码的字节流
  if ([...s].some((c) => c.codePointAt(0) > 0xff)) return s
  const bytes = Buffer.from(s, 'latin1')
  let best = null
  for (const enc of ['gbk', 'big5']) {
    try {
      const decoded = new TextDecoder(enc).decode(bytes)
      if (decoded.includes('\uFFFD')) continue
      if (!/[\u4e00-\u9fff]/.test(decoded)) continue
      const score = mojibakeScore(decoded)
      if (!best || score > best.score) best = { decoded, score }
    } catch {
      /* ignore */
    }
  }
  return best && best.score >= 0.6 ? best.decoded : s
}

function decodeTextBuffer(buf) {
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

// ---------------------------------------------------------------- KRC 解密与解析

const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]

function decryptKrc(buf) {
  if (buf.length < 4 || buf.toString('latin1', 0, 4) !== 'krc1') throw new Error('not krc')
  const data = Buffer.from(buf.subarray(4))
  for (let i = 0; i < data.length; i++) data[i] ^= KRC_KEY[i % 16]
  const text = zlib.inflateSync(data).toString('utf8')
  return text.replace(/^\uFEFF/, '')
}

/** KRC 行：[开始ms,时长ms]<字偏移,字时长,0>词<...>词 */
function parseKrc(text) {
  const lines = []
  const lineRe = /^\[(\d+),(\d+)\](.*)$/
  const wordRe = /<(\d+),(\d+),\d+>([^<]*)/g
  for (const raw of text.split(/\r?\n/)) {
    const m = lineRe.exec(raw.trim())
    if (!m) continue
    const start = parseInt(m[1], 10) / 1000
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

/** LRC 行：[mm:ss.xx]文本（可能一行多个时间标签） */
function parseLrc(text) {
  const entries = []
  const tagRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
  for (const raw of text.split(/\r?\n/)) {
    const tags = [...raw.matchAll(tagRe)]
    if (!tags.length) continue
    const content = raw.replace(tagRe, '').trim()
    if (!content) continue
    for (const t of tags) {
      const min = parseInt(t[1], 10)
      const sec = parseInt(t[2], 10)
      const fracRaw = t[3] ?? '0'
      const frac = parseInt(fracRaw, 10) / 10 ** fracRaw.length
      entries.push({ t: round3(min * 60 + sec + frac), text: content })
    }
  }
  entries.sort((a, b) => a.t - b.t)
  if (!entries.length) return null
  const lines = entries.map((e, i) => ({
    t: e.t,
    d: round3(Math.max(0.5, (entries[i + 1]?.t ?? e.t + 5) - e.t)),
    text: e.text,
  }))
  return { synced: 'line', lines }
}

const round3 = (n) => Math.round(n * 1000) / 1000

// ---------------------------------------------------------------- 歌词索引

/** Lyric 目录下的 krc：`艺人 - 标题-<32位hash>.krc` → normKey(艺人 - 标题) */
function buildLyricIndex() {
  const index = new Map()
  if (!fs.existsSync(LYRIC_DIR)) return index
  for (const f of fs.readdirSync(LYRIC_DIR)) {
    if (!f.toLowerCase().endsWith('.krc')) continue
    const base = f.slice(0, -4).replace(/-[0-9a-f]{32}$/i, '')
    const key = normKey(base)
    if (key && !index.has(key)) index.set(key, path.join(LYRIC_DIR, f))
  }
  return index
}

function loadLyricsForSong(fileDir, basename, lyricIndex) {
  // 1. 同目录同名 lrc / krc
  const sib = (ext) => path.join(fileDir, basename + ext)
  for (const [ext, kind] of [['.krc', 'krc'], ['.lrc', 'lrc']]) {
    const p = sib(ext)
    if (fs.existsSync(p)) {
      const parsed = tryParseLyricFile(p, kind)
      if (parsed) return parsed
    }
  }
  // 2. Lyric 目录按名字配对
  const hit = lyricIndex.get(normKey(basename))
  if (hit) return tryParseLyricFile(hit, 'krc')
  return null
}

function tryParseLyricFile(file, kind) {
  try {
    const buf = fs.readFileSync(file)
    if (kind === 'krc') return parseKrc(decryptKrc(buf))
    return parseLrc(decodeTextBuffer(buf))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- 扫描

function* walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('._')) continue
    const full = path.join(dir, entry.name)
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      yield* walk(full, relPath)
    } else if (AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      yield { full, relPath }
    }
  }
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true })
  fs.mkdirSync(OUT_COVERS, { recursive: true })
  fs.rmSync(OUT_LYRICS, { recursive: true, force: true })
  fs.mkdirSync(OUT_LYRICS, { recursive: true })

  const lyricIndex = buildLyricIndex()
  const coverSeen = new Map() // 封面内容 md5 → 文件名
  const songs = []
  let skipped = 0
  let withCover = 0
  let withLyrics = 0

  const files = [...walk(MUSIC_ROOT)]
  console.log(`发现 ${files.length} 个音频文件，开始解析…`)

  for (const [i, { full, relPath }] of files.entries()) {
    const stat = fs.statSync(full)
    if (stat.size < MIN_SIZE) {
      skipped++
      continue
    }
    const ext = path.extname(relPath)
    const basename = path.basename(relPath, ext)
    const id = md5(relPath).slice(0, 12)

    let meta = null
    try {
      meta = await parseFile(full)
    } catch {
      /* 元数据损坏时退回文件名解析 */
    }

    const fromName = parseFilename(basename)
    const title = fixMojibake((meta?.common?.title ?? '').trim()) || fromName.title || basename
    const artistRaw =
      fixMojibake((meta?.common?.artist ?? '').trim()) || fromName.artist || '未知艺人'
    const artists = artistRaw.split(/[、/]/).map((s) => s.trim()).filter(Boolean)
    const album = fixMojibake((meta?.common?.album ?? '').trim())
    let duration = meta?.format?.duration ?? 0
    if (!duration) {
      try {
        duration = (await parseFile(full, { duration: true })).format.duration ?? 0
      } catch {
        /* ignore */
      }
    }

    // 封面
    let cover = null
    const pic = meta?.common?.picture?.[0]
    if (pic?.data?.length) {
      const hash = md5(pic.data)
      if (!coverSeen.has(hash)) {
        const extOut = pic.format?.includes('png') ? 'png' : 'jpg'
        const name = `${hash.slice(0, 16)}.${extOut}`
        fs.writeFileSync(path.join(OUT_COVERS, name), pic.data)
        coverSeen.set(hash, name)
      }
      cover = `/covers/${coverSeen.get(hash)}`
      withCover++
    }

    // 歌词
    const lyrics = loadLyricsForSong(path.dirname(full), basename, lyricIndex)
    if (lyrics) {
      fs.writeFileSync(path.join(OUT_LYRICS, `${id}.json`), JSON.stringify(lyrics))
      withLyrics++
    }

    songs.push({
      id,
      path: relPath.replace(/\\/g, '/'),
      title,
      artist: artistRaw === fromName.artist && !fromName.artist ? '未知艺人' : artistRaw,
      artists: artists.length ? artists : ['未知艺人'],
      album,
      duration: Math.round(duration * 100) / 100,
      cover,
      hasLyrics: !!lyrics,
      lyricsType: lyrics?.synced ?? null,
      addedAt: Math.floor(stat.mtimeMs),
    })

    if ((i + 1) % 100 === 0) console.log(`  已处理 ${i + 1}/${files.length}`)
  }

  songs.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  const out = { generatedAt: Date.now(), songs }
  fs.writeFileSync(OUT_DATA, JSON.stringify(out))

  console.log(`完成：${songs.length} 首（跳过 ${skipped} 个损坏文件）`)
  console.log(`封面 ${withCover} 首（去重后 ${coverSeen.size} 张），歌词 ${withLyrics} 首`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
