export interface SongQuality {
  /** 编码/容器格式，如 FLAC / MP3 / AAC / WAV / OGG */
  codec: string
  /** 码率 kbps */
  bitrate: number
  /** 采样率 Hz（如 44100 / 96000） */
  sampleRate: number
  /** 位深 bit（16 / 24） */
  bitsPerSample: number
  /** 是否无损 */
  lossless: boolean
}

export interface Song {
  id: string
  /** 相对曲库根目录的路径，如 "英语歌曲/Bastille - Pompeii.mp3" */
  path: string
  title: string
  artist: string
  artists: string[]
  /** 客串艺人（feat./ft.），单独展示，不占艺人列表 */
  feat?: string[]
  album: string
  duration: number
  cover: string | null
  hasLyrics: boolean
  lyricsType: 'word' | 'line' | null
  addedAt: number
  /** 音质信息（码率/采样率/位深/无损），扫描时提取 */
  quality?: SongQuality
  /** 本地选文件夹时的 blob URL；有值时优先用它播放 */
  sourceUrl?: string
}

export interface Library {
  generatedAt: number
  songs: Song[]
}

export interface LyricWord {
  t: number
  d: number
  text: string
}

export interface LyricLine {
  t: number
  d: number
  text: string
  words?: LyricWord[]
}

export interface Lyrics {
  synced: 'word' | 'line'
  lines: LyricLine[]
  /** 逐行翻译（与 lines 索引对齐，缺失为 null） */
  translation?: Array<string | null>
}

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
}

export type RepeatMode = 'off' | 'all' | 'one'

export interface ArtistGroup {
  name: string
  songs: Song[]
  cover: string | null
}

export interface AlbumGroup {
  key: string
  name: string
  artist: string
  songs: Song[]
  cover: string | null
}

export type View =
  | { type: 'home' }
  | { type: 'songs' }
  | { type: 'artists' }
  | { type: 'albums' }
  | { type: 'recent' }
  | { type: 'top' }
  | { type: 'duplicates' }
  | { type: 'quality' }
  | { type: 'favorites' }
  | { type: 'search'; query: string }
  | { type: 'artist'; name: string }
  | { type: 'album'; key: string }
  | { type: 'playlist'; id: string }
