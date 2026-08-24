import type { Song } from '../types'

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

export function audioUrl(song: Song): string {
  return '/audio/' + song.path.split('/').map(encodeURIComponent).join('/')
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
