/**
 * electron/meta.mjs 的类型声明（.d.mts 伴生文件）。
 * 浏览器侧通过 Vite 直接 import 该纯 JS 模块；实现见 electron/meta.mjs ——
 * 共享的艺人/标题/专辑解析（别名合并、feat 分离、噪音过滤）。
 */
export interface FilenameMeta {
  /** 展示用艺人字符串（规范名以"、"连接） */
  artist: string
  /** 规范艺人列表（已合并别名、过滤噪音），至少含"未知艺人" */
  artists: string[]
  /** 客串艺人（feat.） */
  feat: string[]
  /** 清洗后的标题 */
  title: string
  /** 未清洗的原始艺人部分 */
  rawArtist: string
  /** 未清洗的原始标题部分 */
  rawTitle: string
}

export interface ArtistField {
  artists: string[]
  feat: string[]
  display: string
}

export function parseFilenameMeta(basename: string): FilenameMeta
export function splitArtistField(raw: string): ArtistField
export function extractFeat(raw: string): { title: string; feat: string[] }
export function canonicalArtist(name: string): string
export function artistKey(name: string): string
export function cleanTitle(raw: string): string
export function cleanAlbumTag(raw: string): string
export function looksNoisy(s: string): boolean
export function normKeyForLyrics(s: string): string
export function parseLrc(text: string): { synced: 'line'; lines: Array<{ t: number; d: number; text: string }> } | null
export const NOISE_TOKENS: ReadonlySet<string>
export const ARTIST_ALIASES: Readonly<Record<string, string>>
