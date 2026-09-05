import { artistKey } from '../../electron/meta.mjs'
import { loadLocal, saveLocal } from './utils'

/**
 * 艺人照片（桌面版走主进程网易云/iTunes；Web 版无桥接时返回 null 用渐变占位）。
 * 结果按艺人 key 缓存到内存 + localStorage，请求串行避免打爆接口。
 */

const CACHE_KEY = 'mp.artistPhotos'
const memCache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()
// 串行请求队列（避免并发触发限流）
let queue: Promise<unknown> = Promise.resolve()

export function getArtistPhoto(name: string): Promise<string | null> {
  const key = artistKey(name)
  if (memCache.has(key)) return Promise.resolve(memCache.get(key) ?? null)
  const hit = pending.get(key)
  if (hit) return hit

  const p = new Promise<string | null>((resolve) => {
    const saved = loadLocal<Record<string, string>>(CACHE_KEY, {})
    if (saved[key]) {
      memCache.set(key, saved[key])
      resolve(saved[key])
      return
    }
    queue = queue.then(async () => {
      try {
        const url = window.musicDesktop ? await window.musicDesktop.artistPhoto(name) : null
        if (url) {
          saved[key] = url
          saveLocal(CACHE_KEY, saved)
        }
        memCache.set(key, url)
        resolve(url)
      } catch {
        memCache.set(key, null)
        resolve(null)
      }
    })
  })
  pending.set(key, p)
  // settle 后从 pending 移除，避免内存只增不减
  void p.finally(() => {
    pending.delete(key)
  })
  return p
}

/** 清除某个艺人的照片缓存（换图/换源时用） */
export function clearArtistPhoto(name: string): void {
  const key = artistKey(name)
  memCache.delete(key)
  pending.delete(key)
  const saved = loadLocal<Record<string, string>>(CACHE_KEY, {})
  delete saved[key]
  saveLocal(CACHE_KEY, saved)
}
