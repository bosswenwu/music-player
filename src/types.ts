export interface Song {
  id: string
  /** 相对曲库根目录的路径，如 "英语歌曲/Bastille - Pompeii.mp3" */
  path: string
  title: string
  artist: string
  artists: string[]
  album: string
  duration: number
  cover: string | null
  hasLyrics: boolean
  lyricsType: 'word' | 'line' | null
  addedAt: number
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
  | { type: 'favorites' }
  | { type: 'search'; query: string }
  | { type: 'artist'; name: string }
  | { type: 'album'; key: string }
  | { type: 'playlist'; id: string }
