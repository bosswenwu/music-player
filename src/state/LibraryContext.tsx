/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { AlbumGroup, ArtistGroup, Library, Playlist, Song } from '../types'
import { loadLocal, normSearch, saveLocal } from '../lib/utils'
import libraryData from '../data/library.json'

const library = libraryData as unknown as Library

export interface SearchResults {
  songs: Song[]
  artists: ArtistGroup[]
  albums: AlbumGroup[]
}

interface LibraryContextValue {
  songs: Song[]
  songById: Map<string, Song>
  artists: ArtistGroup[]
  artistByName: Map<string, ArtistGroup>
  albums: AlbumGroup[]
  albumByKey: Map<string, AlbumGroup>
  recentlyAdded: Song[]

  favorites: string[]
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void

  playlists: Playlist[]
  createPlaylist: (name: string, songIds?: string[]) => Playlist
  deletePlaylist: (id: string) => void
  renamePlaylist: (id: string, name: string) => void
  addToPlaylist: (playlistId: string, songId: string) => void
  removeFromPlaylist: (playlistId: string, songId: string) => void

  recents: string[]
  notePlayed: (id: string) => void

  search: (query: string) => SearchResults
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const songs = library.songs as Song[]

  const { songById, artists, artistByName, albums, albumByKey, recentlyAdded, searchIndex } =
    useMemo(() => {
      const songById = new Map<string, Song>()
      const artistMap = new Map<string, ArtistGroup>()
      const albumMap = new Map<string, AlbumGroup>()

      for (const song of songs) {
        songById.set(song.id, song)

        for (const name of song.artists) {
          let g = artistMap.get(name)
          if (!g) {
            g = { name, songs: [], cover: null }
            artistMap.set(name, g)
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
        artist: normSearch(s.artist),
        album: normSearch(s.album),
      }))

      return {
        songById,
        artists,
        artistByName: artistMap,
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
  const removeFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      persistPlaylists(
        prev.map((p) =>
          p.id === playlistId ? { ...p, songIds: p.songIds.filter((s) => s !== songId) } : p,
        ),
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
  }, [])

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

  const value: LibraryContextValue = {
    songs,
    songById,
    artists,
    artistByName,
    albums,
    albumByKey,
    recentlyAdded,
    favorites,
    isFavorite,
    toggleFavorite,
    playlists,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    recents,
    notePlayed,
    search,
  }

  return <LibraryContext value={value}>{children}</LibraryContext>
}

export function useLibrary(): LibraryContextValue {
  const ctx = use(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}
