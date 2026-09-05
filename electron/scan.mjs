import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseFile } from 'music-metadata'
import { parseFilenameMeta } from './meta.mjs'
import { chooseMeta } from './tag.mjs'
import { buildLyricIndex, matchLyricFile, parseLyricFile } from './lyrics.mjs'

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus'])
const SKIP_DIR = new Set(['lyric', 'lyrics', 'cache', 'listen', 'node_modules', '.git', '$recycle.bin'])
const CONCURRENCY = 12 // ID3 读取并发数（限制 IO，避免拖慢启动）

/** 并发限流 map（保持顺序） */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function collectFiles(root) {
  const out = []
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
        if (SKIP_DIR.has(entry.name.toLowerCase())) continue
        walk(full)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!AUDIO_EXT.has(ext)) continue
      const rel = path.relative(root, full).split(path.sep).join('/')
      let addedAt = Date.now()
      try {
        addedAt = fs.statSync(full).mtimeMs
      } catch {
        /* ignore */
      }
      out.push({
        full,
        rel,
        basename: path.basename(entry.name, ext),
        id: `local_${crypto.createHash('sha1').update(rel).digest('hex').slice(0, 12)}`,
        addedAt,
      })
    }
  }
  walk(root)
  return out
}

/**
 * 扫描曲库：ID3 标签（时长/专辑/封面）+ 文件名解析 + KRC/LRC 歌词模糊配对。
 * 返回 { songs, lyrics, covers }
 *  - lyrics: id → { synced, lines }（写入 userData/lyrics 缓存）
 *  - covers: 封面内容 hash → { name, data }（写入 userData/covers）
 */
export async function scanFolder(root) {
  if (!root || !fs.existsSync(root)) return { songs: [], lyrics: new Map(), covers: new Map() }
  const lyricIndex = buildLyricIndex(root)
  const files = collectFiles(root)
  const lyrics = new Map()
  const coverSeen = new Map() // 封面内容 md5 → 文件名
  const covers = new Map() // hash → { name, data }

  const songs = await mapLimit(files, CONCURRENCY, async (item) => {
    let tag = null
    try {
      tag = await parseFile(item.full)
    } catch {
      /* 元数据损坏时退回文件名解析 */
    }

    const fromName = parseFilenameMeta(item.basename)
    const chosen = chooseMeta(fromName, tag?.common)

    // 封面（按内容去重）
    let cover = null
    const pic = tag?.common?.picture?.[0]
    if (pic?.data?.length) {
      const hash = crypto.createHash('md5').update(pic.data).digest('hex')
      let name = coverSeen.get(hash)
      if (!name) {
        name = `${hash.slice(0, 16)}.${pic.format?.includes('png') ? 'png' : 'jpg'}`
        coverSeen.set(hash, name)
        covers.set(hash, { name, data: pic.data })
      }
      cover = `/covers/${name}`
    }

    const song = {
      id: item.id,
      path: item.rel,
      title: chosen.title,
      artist: chosen.artist,
      artists: chosen.artists,
      feat: chosen.feat.length ? chosen.feat : undefined,
      album: chosen.album,
      duration: Math.round((tag?.format?.duration ?? 0) * 100) / 100,
      quality: tag?.format
        ? {
            codec: tag.format.codec ?? '',
            bitrate: tag.format.bitrate ? Math.round(tag.format.bitrate / 1000) : 0,
            sampleRate: tag.format.sampleRate ?? 0,
            bitsPerSample: tag.format.bitsPerSample ?? 0,
            lossless: tag.format.lossless ?? false,
          }
        : undefined,
      cover,
      hasLyrics: false,
      lyricsType: null,
      addedAt: item.addedAt,
    }

    // 歌词：文件名解析 + 最终元数据双候选
    const hit = matchLyricFile(
      [
        fromName,
        { artist: chosen.artists[0], artists: chosen.artists, title: chosen.title, feat: chosen.feat },
      ],
      lyricIndex,
    )
    if (hit) {
      const data = parseLyricFile(hit.file)
      if (data) {
        song.hasLyrics = true
        song.lyricsType = data.synced
        lyrics.set(item.id, data)
      }
    }
    return song
  })

  songs.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  return { songs, lyrics, covers }
}
