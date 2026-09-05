import type { Song, SongQuality } from '../types'
import { artistKey, normKeyForLyrics } from '../../electron/meta.mjs'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec % 60)
  const m = Math.floor(sec / 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTotalDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

/** 艺人展示行：主艺人 + 客串（feat.），Spotify / Apple Music 风格 */
export function artistLine(song: { artist: string; feat?: string[] }): string {
  const feat = song.feat?.filter(Boolean)
  return feat?.length ? `${song.artist} — feat. ${feat.join('、')}` : song.artist
}

export function audioUrl(song: Song): string {
  if (song.sourceUrl) return song.sourceUrl
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}audio/` + song.path.split('/').map(encodeURIComponent).join('/')
}

/** 稳定字符串哈希（用于渐变占位封面配色） */
export function stringHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

const GRADIENTS: Array<[string, string]> = [
  ['#fa5c74', '#d31027'],
  ['#f9748f', '#a166ab'],
  ['#5b86e5', '#36d1dc'],
  ['#7f7fd5', '#91eae4'],
  ['#f2994a', '#f2c94c'],
  ['#e35d5b', '#e53935'],
  ['#11998e', '#38ef7d'],
  ['#fc466b', '#3f5efb'],
  ['#c94b4b', '#4b134f'],
  ['#67b26f', '#4ca2cd'],
  ['#ee9ca7', '#b06ab3'],
  ['#f7971e', '#dd2476'],
]

export function gradientFor(seed: string): [string, string] {
  return GRADIENTS[stringHash(seed) % GRADIENTS.length]
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 搜索归一化 */
export function normSearch(s: string): string {
  return s.toLowerCase().replace(/[\s\u3000]+/g, '')
}

/** 歌曲指纹（艺人 + 标题），用于重复检测和跨文件夹迁移收藏 */
export function songFingerprint(song: Song): string {
  const artist = song.artists?.[0] || song.artist || '未知艺人'
  return `${artistKey(artist)}||${normKeyForLyrics(song.title)}`
}

// ---------------------------------------------------------------- 音质

export type QualityTier = 'lossless' | 'high' | 'mid' | 'low'

/** 音质分档：无损 / 高码率(≥256k) / 中码率(128-256k) / 低码率(<128k) */
export function qualityTier(q?: SongQuality | null): QualityTier | null {
  if (!q || (!q.lossless && !q.bitrate)) return null
  if (q.lossless) return 'lossless'
  if (q.bitrate >= 256) return 'high'
  if (q.bitrate >= 128) return 'mid'
  return 'low'
}

/** 编码格式友好标签 */
export function codecLabel(codec: string): string {
  if (!codec) return ''
  if (/MPEG.*Layer.*3/i.test(codec)) return 'MP3'
  if (/AAC/i.test(codec)) return 'AAC'
  if (/FLAC/i.test(codec)) return 'FLAC'
  if (/ALAC/i.test(codec)) return 'ALAC'
  if (/PCM|WAVE/i.test(codec)) return 'WAV'
  if (/Vorbis/i.test(codec)) return 'OGG'
  if (/Opus/i.test(codec)) return 'Opus'
  return codec
}

/** 音质展示标签：无损 → "FLAC 24bit/96kHz"，有损 → "320kbps" */
export function qualityLabel(q?: SongQuality | null): string | null {
  if (!q) return null
  const codec = codecLabel(q.codec)
  if (q.lossless) {
    const parts = [codec || '无损']
    if (q.bitsPerSample >= 16) parts.push(`${q.bitsPerSample}bit`)
    if (q.sampleRate >= 1000) parts.push(`${Math.round(q.sampleRate / 1000)}kHz`)
    return parts.join(' ')
  }
  if (q.bitrate > 0) return `${q.bitrate}kbps`
  return codec || null
}

/** 一组歌曲的音质汇总文案，如 "3 首无损 · 5 首高码率 · 2 首低码率" */
export function qualitySummary(songs: Song[]): string | null {
  let lossless = 0
  let high = 0
  let mid = 0
  let low = 0
  for (const s of songs) {
    const tier = qualityTier(s.quality)
    if (tier === 'lossless') lossless++
    else if (tier === 'high') high++
    else if (tier === 'mid') mid++
    else if (tier === 'low') low++
  }
  const parts: string[] = []
  if (lossless) parts.push(`${lossless} 首无损`)
  if (high) parts.push(`${high} 首高码率`)
  if (mid) parts.push(`${mid} 首中码率`)
  if (low) parts.push(`${low} 首低码率`)
  return parts.length ? parts.join(' · ') : null
}

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}
