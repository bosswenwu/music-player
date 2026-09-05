/**
 * 曲库扫描脚本
 * 扫描 MUSIC_ROOT 下的音频文件，提取 ID3 元数据与内嵌封面，
 * 用共享解析模块（electron/meta.mjs）做艺人/标题/专辑清洗（别名合并、
 * feat 分离、噪音过滤），并用 KRC/LRC 歌词索引模糊配对，输出：
 *   - src/data/library.json    歌曲清单
 *   - public/covers/*.jpg      专辑封面（按内容哈希去重）
 *   - public/lyrics/<id>.json  逐字/逐行歌词时间轴
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseFile } from 'music-metadata'
import { resolveMusicRoot } from './music-root.mjs'
import { parseFilenameMeta } from '../electron/meta.mjs'
import { chooseMeta } from '../electron/tag.mjs'
import { buildLyricIndex, matchLyricFile, parseLyricFile } from '../electron/lyrics.mjs'

const MUSIC_ROOT = resolveMusicRoot()
const OUT_DATA = fileURLToPath(new URL('../src/data/library.json', import.meta.url))
const OUT_COVERS = fileURLToPath(new URL('../public/covers/', import.meta.url))
const OUT_LYRICS = fileURLToPath(new URL('../public/lyrics/', import.meta.url))

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.flac', '.wav'])
const SKIP_DIRS = new Set(['Cache', 'Listen', 'Lyric'])
const MIN_SIZE = 100 * 1024 // 跳过损坏的 4KB 假文件

// ---------------------------------------------------------------- utils

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex')

// 乱码修复 / 标签 vs 文件名取舍 见 electron/tag.mjs（与桌面扫描共用）

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

  const lyricIndex = buildLyricIndex(MUSIC_ROOT)
  const coverSeen = new Map() // 封面内容 md5 → 文件名
  const songs = []
  let skipped = 0
  let withCover = 0
  let withLyrics = 0

  const files = [...walk(MUSIC_ROOT)]
  console.log(`发现 ${files.length} 个音频文件，歌词索引就绪，开始解析…`)

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

    const fromName = parseFilenameMeta(basename)

    // 标题 / 艺人 / feat / 专辑：文件名优先，标签干净时兜底（见 electron/tag.mjs）
    const chosen = chooseMeta(fromName, meta?.common)
    const { title, artists, feat, album } = chosen

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

    // 歌词：候选 = 文件名解析 + 标签解析（rawTitle 保留原始文本便于配对）
    let hasLyrics = false
    let lyricsType = null
    const lyricsHit = matchLyricFile(
      [
        fromName,
        {
          artist: artists[0],
          artists,
          title,
          feat,
        },
      ],
      lyricIndex,
    )
    if (lyricsHit) {
      const lyrics = parseLyricFile(lyricsHit.file)
      if (lyrics) {
        fs.writeFileSync(path.join(OUT_LYRICS, `${id}.json`), JSON.stringify(lyrics))
        hasLyrics = true
        lyricsType = lyrics.synced
        withLyrics++
      }
    }

    songs.push({
      id,
      path: relPath.replace(/\\/g, '/'),
      title,
      artist: artists.join('、'),
      artists,
      feat: feat.length ? feat : undefined,
      album,
      duration: Math.round(duration * 100) / 100,
      quality: meta?.format
        ? {
            codec: meta.format.codec ?? '',
            bitrate: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : 0,
            sampleRate: meta.format.sampleRate ?? 0,
            bitsPerSample: meta.format.bitsPerSample ?? 0,
            lossless: meta.format.lossless ?? false,
          }
        : undefined,
      cover,
      hasLyrics,
      lyricsType,
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
