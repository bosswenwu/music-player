import fs from 'node:fs'
import path from 'node:path'

const CANDIDATES = [
  process.env.MUSIC_ROOT,
  'G:/照片/KuGou',
  'F:/照片/KuGou',
  'E:/照片/_整理后的照片库/非照片资料/KuGou音乐',
].filter(Boolean)

export function resolveMusicRoot() {
  for (const candidate of CANDIDATES) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return path.resolve(candidate)
      }
    } catch {
      /* skip */
    }
  }
  return path.resolve('G:/照片/KuGou')
}
