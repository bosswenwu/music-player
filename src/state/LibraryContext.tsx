/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AlbumGroup, ArtistGroup, Library, Playlist, Song } from '../types'
import { pickMusicFolder, revokeSongUrls } from '../lib/localFolder'
import { loadLocal, normSearch, saveLocal, songFingerprint } from '../lib/utils'
import { artistKey } from '../../electron/meta.mjs'

const bundledModules = import.meta.glob<{ default: Library }>('../data/library.json', {
  eager: true,
})
const bundledLibrary: Library =
  import.meta.env.PROD
    ? { generatedAt: 0, songs: [] }
    : (Object.values(bundledModules)[0]?.default ?? { generatedAt: 0, songs: [] })

export interface SearchResults {
  songs: Song[]
  artists: ArtistGroup[]
  albums: AlbumGroup[]
}

/** 稳定的曲库数据：仅在换文件夹/重扫时变化 */
interface LibraryContextValue {
  songs: Song[]
  songById: Map<string, Song>
  artists: ArtistGroup[]
  artistByName: Map<string, ArtistGroup>
  albums: AlbumGroup[]
  albumByKey: Map<string, AlbumGroup>
  recentlyAdded: Song[]
  /** 重复歌曲分组（艺人+标题相同的多首） */
  duplicateGroups: Song[][]
  search: (query: string) => SearchResults
  libraryLoading: boolean
  libraryHint: string | null
  openMusicFolder: () => Promise<void>
}

/**
 * 易变的用户数据（收藏 / 播放列表 / 最近播放 / 播放次数）。
 * 与稳定库数据拆成独立 Context：收藏或播放列表变化时，只订阅 useUserData 的组件重渲染，
 * 只用曲库数据（如歌曲列表容器、搜索页）不受影响。
 */
interface UserDataContextValue {
  favorites: string[]
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  bulkSetFavorite: (ids: string[], fav: boolean) => void

  playlists: Playlist[]
  createPlaylist: (name: string, songIds?: string[]) => Playlist
  deletePlaylist: (id: string) => void
  renamePlaylist: (id: string, name: string) => void
  addToPlaylist: (playlistId: string, songId: string) => void
  addSongsToPlaylist: (playlistId: string, songIds: string[]) => void
  removeFromPlaylist: (playlistId: string, songId: string) => void
  reorderPlaylist: (playlistId: string, from: number, to: number) => void

  recents: string[]
  notePlayed: (id: string) => void

  /** 每首歌的累计播放次数（localStorage 持久化） */
  playCounts: Record<string, number>
  playCountOf: (id: string) => number
  /** 按播放次数排序的常听歌曲 */
  topSongs: Song[]
}

const LibraryContext = createContext<LibraryContextValue | null>(null)
const UserDataContext = createContext<UserDataContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [folderSongs, setFolderSongs] = useState<Song[] | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryHint, setLibraryHint] = useState<string | null>(null)
  const folderSongsRef = useRef<Song[] | null>(null)
  const songs = folderSongs ?? bundledLibrary.songs

  useEffect(() => {
    const desktop = window.musicDesktop
    if (!desktop) return
    setLibraryLoading(true)
    void desktop
      .getLibrary()
      .then((next) => {
        folderSongsRef.current = next
        setFolderSongs(next)
        if (next.length === 0) {
          setLibraryHint('还没有音乐文件夹。点下面按钮选择你电脑上的歌曲目录。')
        }
      })
      .catch(() => setLibraryHint('无法读取音乐文件夹'))
      .finally(() => setLibraryLoading(false))
  }, [])

  const openMusicFolder = useCallback(async () => {
    setLibraryHint(null)
    setLibraryLoading(true)
    try {
      const next = window.musicDesktop
        ? await window.musicDesktop.pickFolder()
        : await pickMusicFolder()
      if (folderSongsRef.current) revokeSongUrls(folderSongsRef.current)
      folderSongsRef.current = next
      setFolderSongs(next)
      if (next.length === 0) setLibraryHint('这个文件夹里没有找到 mp3 / m4a / flac 等音频文件')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name !== 'AbortError') setLibraryHint('无法读取这个文件夹，请换一个再试')
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  const { songById, artists, artistByName, albums, albumByKey, recentlyAdded, searchIndex } =
    useMemo(() => {
      const songById = new Map<string, Song>()
      // 艺人按规范名 key 分组：Puff Daddy / 吹牛老爹 / Diddy 合并为同一实体
      const artistMap = new Map<string, ArtistGroup>()
      // 供按展示名跳转（艺人详情页用 song.artists[0] 导航）
      const artistByName = new Map<string, ArtistGroup>()
      const albumMap = new Map<string, AlbumGroup>()

      for (const song of songs) {
        songById.set(song.id, song)

        for (const name of song.artists) {
          const key = artistKey(name)
          let g = artistMap.get(key)
          if (!g) {
            g = { name, songs: [], cover: null }
            artistMap.set(key, g)
            artistByName.set(name, g)
          }
          g.songs.push(song)
          if (!g.cover && song.cover) g.cover = song.cover
        }

        if (song.album) {
          const key = `${song.artists[0]}|||${song.album}`
          let a = albumMap.get(key)
          if (!a) {
            a = { key, name: song.album, artist: song.artists[0], songs: [], cover: null }
            albumMap.set(key, a)
          }
          a.songs.push(song)
          if (!a.cover && song.cover) a.cover = song.cover
        }
      }

      const artists = [...artistMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN'),
      )
      const albums = [...albumMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      const recentlyAdded = [...songs].sort((a, b) => b.addedAt - a.addedAt)

      const searchIndex = songs.map((s) => ({
        song: s,
        title: normSearch(s.title),
        artist: normSearch([...(s.artists ?? []), ...(s.feat ?? [])].join(' ')),
        album: normSearch(s.album),
      }))

      return {
        songById,
        artists,
        artistByName,
        albums,
        albumByKey: albumMap,
        recentlyAdded,
        searchIndex,
      }
    }, [songs])

  // ----- 收藏 -----
  const [favorites, setFavorites] = useState<string[]>(() => loadLocal('mp.favorites', []))
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const isFavorite = useCallback((id: string) => favoriteSet.has(id), [favoriteSet])
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      saveLocal('mp.favorites', next)
      return next
    })
  }, [])

  /** 批量设置收藏（多选操作） */
  const bulkSetFavorite = useCallback((ids: string[], fav: boolean) => {
    setFavorites((prev) => {
      const idSet = new Set(ids)
      const next = fav
        ? [...ids, ...prev.filter((x) => !idSet.has(x))]
        : prev.filter((x) => !idSet.has(x))
      saveLocal('mp.favorites', next)
      return next
    })
  }, [])

  // ----- 播放列表 -----
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadLocal('mp.playlists', []))
  const persistPlaylists = (next: Playlist[]) => {
    saveLocal('mp.playlists', next)
    return next
  }
  const createPlaylist = useCallback((name: string, songIds: string[] = []) => {
    const playlist: Playlist = {
      id: `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      songIds,
      createdAt: Date.now(),
    }
    setPlaylists((prev) => persistPlaylists([...prev, playlist]))
    return playlist
  }, [])
  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => persistPlaylists(prev.filter((p) => p.id !== id)))
  }, [])
  const renamePlaylist = useCallback((id: string, name: string) => {
    setPlaylists((prev) => persistPlaylists(prev.map((p) => (p.id === id ? { ...p, name } : p))))
  }, [])
  const addToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      persistPlaylists(
        prev.map((p) =>
          p.id === playlistId && !p.songIds.includes(songId)
            ? { ...p, songIds: [...p.songIds, songId] }
            : p,
        ),
      ),
    )
  }, [])

  /** 批量加入播放列表（多选操作，去重） */
  const addSongsToPlaylist = useCallback((playlistId: string, songIds: string[]) => {
    if (!songIds.length) return
    setPlaylists((prev) =>
      persistPlaylists(
        prev.map((p) => {
          if (p.id !== playlistId) return p
          const have = new Set(p.songIds)
          return { ...p, songIds: [...p.songIds, ...songIds.filter((s) => !have.has(s))] }
        }),
      ),
    )
  }, [])
  const removeFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      persistPlaylists(
        prev.map((p) =>
          p.id === playlistId ? { ...p, songIds: p.songIds.filter((s) => s !== songId) } : p,
        ),
      ),
    )
  }, [])

  /** 播放列表内拖拽重排 */
  const reorderPlaylist = useCallback((playlistId: string, from: number, to: number) => {
    if (from === to) return
    setPlaylists((prev) =>
      persistPlaylists(
        prev.map((p) => {
          if (p.id !== playlistId) return p
          const next = [...p.songIds]
          const [item] = next.splice(from, 1)
          next.splice(to, 0, item)
          return { ...p, songIds: next }
        }),
      ),
    )
  }, [])

  // ----- 最近播放 -----
  const [recents, setRecents] = useState<string[]>(() => loadLocal('mp.recents', []))
  const notePlayed = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 60)
      saveLocal('mp.recents', next)
      return next
    })
    // 播放次数统计（"常听"视图）
    setPlayCounts((prev) => {
      const next = { ...prev, [id]: (prev[id] ?? 0) + 1 }
      saveLocal('mp.playcounts', next)
      return next
    })
  }, [])

  // ----- 播放次数 -----
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(() =>
    loadLocal('mp.playcounts', {}),
  )
  const playCountOf = useCallback((id: string) => playCounts[id] ?? 0, [playCounts])
  const topSongs = useMemo(
    () =>
      [...songs]
        .map((s) => ({ song: s, count: playCounts[s.id] ?? 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count || b.song.addedAt - a.song.addedAt)
        .map((x) => x.song),
    [songs, playCounts],
  )

  // ----- 重复歌曲分组 -----
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Song[]>()
    for (const s of songs) {
      const key = songFingerprint(s)
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return [...map.values()].filter((g) => g.length > 1)
  }, [songs])

  // ----- 收藏 / 播放列表 / 最近播放 / 播放次数跨文件夹迁移（按艺人+标题指纹找回）-----
  useEffect(() => {
    if (!songs.length) return
    const fpIndex = loadLocal<Record<string, string>>('mp.fpIndex', {})
    const fpToId = new Map<string, string>()
    for (const s of songs) {
      const fp = songFingerprint(s)
      if (!fpToId.has(fp)) fpToId.set(fp, s.id)
    }
    const remap = (id: string) => {
      if (songById.has(id)) return id
      const fp = fpIndex[id]
      return fp && fpToId.get(fp) ? (fpToId.get(fp) as string) : id
    }
    // 迁移收藏
    const newFav = favorites.map(remap)
    if (newFav.some((id, i) => id !== favorites[i])) {
      setFavorites(newFav)
      saveLocal('mp.favorites', newFav)
    }
    // 迁移最近播放
    const newRecents = recents.map(remap)
    if (newRecents.some((id, i) => id !== recents[i])) {
      setRecents(newRecents)
      saveLocal('mp.recents', newRecents)
    }
    // 迁移播放列表
    let plChanged = false
    const newPlaylists = playlists.map((p) => {
      const ids = p.songIds.map(remap)
      if (ids.some((id, i) => id !== p.songIds[i])) plChanged = true
      return { ...p, songIds: ids }
    })
    if (plChanged) {
      setPlaylists(newPlaylists)
      saveLocal('mp.playlists', newPlaylists)
    }
    // 迁移播放次数（常听）
    let pcChanged = false
    const newPlayCounts: Record<string, number> = { ...playCounts }
    for (const id of Object.keys(playCounts)) {
      const newId = remap(id)
      if (newId !== id) {
        newPlayCounts[newId] = (newPlayCounts[newId] ?? 0) + playCounts[id]
        delete newPlayCounts[id]
        pcChanged = true
      }
    }
    if (pcChanged) {
      setPlayCounts(newPlayCounts)
      saveLocal('mp.playcounts', newPlayCounts)
    }
    // 重建指纹索引：当前曲库 + 保留仍失效 id 的旧指纹（供下次换文件夹迁移）
    const newIndex: Record<string, string> = {}
    for (const s of songs) newIndex[s.id] = songFingerprint(s)
    for (const id of Object.keys(fpIndex)) {
      if (!songById.has(id) && !newIndex[id]) newIndex[id] = fpIndex[id]
    }
    saveLocal('mp.fpIndex', newIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs])

  // ----- 搜索 -----
  const search = useCallback(
    (query: string): SearchResults => {
      const q = normSearch(query)
      if (!q) return { songs: [], artists: [], albums: [] }

      const scored: Array<{ song: Song; score: number }> = []
      for (const item of searchIndex) {
        let score = 0
        if (item.title.startsWith(q)) score = 100
        else if (item.title.includes(q)) score = 60
        if (item.artist.startsWith(q)) score = Math.max(score, 90)
        else if (item.artist.includes(q)) score = Math.max(score, 50)
        if (item.album.includes(q)) score = Math.max(score, 40)
        if (score > 0) scored.push({ song: item.song, score })
      }
      scored.sort((a, b) => b.score - a.score)

      const matchedArtists = artists.filter((a) => normSearch(a.name).includes(q))
      const matchedAlbums = albums.filter(
        (a) => normSearch(a.name).includes(q) || normSearch(a.artist).includes(q),
      )

      return {
        songs: scored.map((s) => s.song),
        artists: matchedArtists,
        albums: matchedAlbums,
      }
    },
    [searchIndex, artists, albums],
  )

  // 稳定库数据：仅换文件夹/重扫时变化
  const libraryValue = useMemo<LibraryContextValue>(
    () => ({
      songs,
      songById,
      artists,
      artistByName,
      albums,
      albumByKey,
      recentlyAdded,
      duplicateGroups,
      search,
      libraryLoading,
      libraryHint,
      openMusicFolder,
    }),
    [
      songs, songById, artists, artistByName, albums, albumByKey, recentlyAdded,
      duplicateGroups, search, libraryLoading, libraryHint, openMusicFolder,
    ],
  )

  // 易变用户数据：收藏/播放列表/最近/播放次数变化只影响订阅它的组件
  const userDataValue = useMemo<UserDataContextValue>(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      bulkSetFavorite,
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      addSongsToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      recents,
      notePlayed,
      playCounts,
      playCountOf,
      topSongs,
    }),
    [
      favorites, isFavorite, toggleFavorite, bulkSetFavorite,
      playlists, createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist,
      addSongsToPlaylist, removeFromPlaylist, reorderPlaylist,
      recents, notePlayed, playCounts, playCountOf, topSongs,
    ],
  )

  return (
    <LibraryContext value={libraryValue}>
      <UserDataContext value={userDataValue}>{children}</UserDataContext>
    </LibraryContext>
  )
}

export function useLibrary(): LibraryContextValue {
  const ctx = use(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}

export function useUserData(): UserDataContextValue {
  const ctx = use(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within LibraryProvider')
  return ctx
}
