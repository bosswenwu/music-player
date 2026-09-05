/// <reference types="vite/client" />

import type { Lyrics, Song } from './types'

export {}

declare global {
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  }

  interface MusicDesktop {
    getLibrary: () => Promise<Song[]>
    pickFolder: () => Promise<Song[]>
    /** 在线歌词兜底（本地歌词缺失时）：返回 { synced, lines } 或 null */
    lyricFetch: (artist: string, title: string) => Promise<Lyrics | null>
    /** 艺人照片：返回可直接加载的图片 URL 或 null */
    artistPhoto: (artist: string) => Promise<string | null>
    /** 监听托盘 / 全局媒体键命令：'toggle' | 'next' | 'prev'；返回取消订阅函数 */
    onMediaCommand: (cb: (cmd: 'toggle' | 'next' | 'prev') => void) => () => void
    /** 迷你歌词悬浮窗 */
    lyricFloatUpdate: (data: {
      title: string
      artist: string
      lines: string[]
      active: number
      translation?: Array<string | null>
    }) => void
    lyricFloatToggle: () => Promise<boolean>
    lyricFloatState: () => Promise<boolean>
    lyricFloatConfig: (config: { opacity: number; fontSize: number }) => void
    onLyricFloat: (cb: (data: {
      title: string
      artist: string
      lines: string[]
      active: number
      translation?: Array<string | null>
    }) => void) => () => void
    onLyricFloatConfig: (cb: (config: { opacity: number; fontSize: number }) => void) => () => void
  }

  interface Window {
    musicDesktop?: MusicDesktop
  }
}
