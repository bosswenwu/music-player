/** 从封面图提取两个主色，用于播放页动态背景与着色 */

export interface CoverColors {
  primary: string
  secondary: string
  /** 适合当文字/进度条 accent 的亮色 */
  accent: string
}

const cache = new Map<string, Promise<CoverColors>>()

const FALLBACK: CoverColors = {
  primary: '#3a3a3c',
  secondary: '#1c1c1e',
  accent: '#fa2d48',
}

export function extractColors(src: string | null): Promise<CoverColors> {
  if (!src) return Promise.resolve(FALLBACK)
  let p = cache.get(src)
  if (!p) {
    p = doExtract(src).catch(() => FALLBACK)
    cache.set(src, p)
  }
  return p
}

async function doExtract(src: string): Promise<CoverColors> {
  const img = await loadImage(src)
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return FALLBACK
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // 按色相桶统计，选出饱和度加权最高的两个桶
  const buckets = new Map<number, { r: number; g: number; b: number; w: number; n: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const [h, s, l] = rgbToHsl(r, g, b)
    if (l < 0.08 || l > 0.95) continue
    const bucket = Math.floor(h * 12)
    const w = s * (1 - Math.abs(l - 0.5))
    const cur = buckets.get(bucket) ?? { r: 0, g: 0, b: 0, w: 0, n: 0 }
    cur.r += r; cur.g += g; cur.b += b; cur.w += w; cur.n++
    buckets.set(bucket, cur)
  }
  const ranked = [...buckets.values()].sort((a, b) => b.w * b.n - a.w * a.n)
  if (!ranked.length) return FALLBACK

  const toRgb = (v: { r: number; g: number; b: number; n: number }) =>
    [Math.round(v.r / v.n), Math.round(v.g / v.n), Math.round(v.b / v.n)] as const

  const [r1, g1, b1] = toRgb(ranked[0])
  const [r2, g2, b2] = ranked[1] ? toRgb(ranked[1]) : ([r1, g1, b1] as const)

  return {
    primary: darken(r1, g1, b1, 0.55),
    secondary: darken(r2, g2, b2, 0.35),
    accent: lighten(r1, g1, b1),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function darken(r: number, g: number, b: number, factor: number): string {
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`
}

function lighten(r: number, g: number, b: number): string {
  const [h, s] = rgbToHsl(r, g, b)
  const [nr, ng, nb] = hslToRgb(h, Math.max(0.55, s), 0.68)
  return `rgb(${nr}, ${ng}, ${nb})`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}
