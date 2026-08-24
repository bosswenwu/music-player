import { useMemo, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { PageHeader, EmptyState } from './shared'
import { IconClock, IconHeart, IconPlaylist } from '../components/Icons'
import { formatTotalDuration } from '../lib/utils'
import type { Song } from '../types'

export function RecentView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { recents, songById } = useLibrary()
  const { playQueue } = usePlayer()

  const songs = useMemo(
    () => recents.map((id) => songById.get(id)).filter((s): s is Song => Boolean(s)),
    [recents, songById],
  )

  if (!songs.length) {
    return <EmptyState icon={<IconClock />} title="还没有播放记录" hint="播放一首歌，它会出现在这里" />
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="最近播放"
        subtitle={`${songs.length} 首歌曲`}
        onPlay={() => playQueue(songs, 0, false)}
        onShuffle={() => playQueue(songs, Math.floor(Math.random() * songs.length), true)}
      />
      <SongTable songs={songs} scrollRef={scrollRef} />
    </div>
  )
}

export function FavoritesView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { favorites, songById } = useLibrary()
  const { playQueue } = usePlayer()

  const songs = useMemo(
    () => favorites.map((id) => songById.get(id)).filter((s): s is Song => Boolean(s)),
    [favorites, songById],
  )

  if (!songs.length) {
    return (
      <EmptyState
        icon={<IconHeart />}
        title="还没有喜欢的音乐"
        hint="点按歌曲旁的心形图标，收藏你喜欢的歌"
      />
    )
  }

  const totalSec = songs.reduce((acc, s) => acc + s.duration, 0)

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="已喜欢的音乐"
        subtitle={`${songs.length} 首歌曲 · ${formatTotalDuration(totalSec)}`}
        onPlay={() => playQueue(songs, 0, false)}
        onShuffle={() => playQueue(songs, Math.floor(Math.random() * songs.length), true)}
      />
      <SongTable songs={songs} scrollRef={scrollRef} />
    </div>
  )
}

export function PlaylistView({
  id,
  scrollRef,
}: {
  id: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const { playlists, songById, removeFromPlaylist, renamePlaylist } = useLibrary()
  const { playQueue } = usePlayer()
  const playlist = playlists.find((p) => p.id === id)

  const songs = useMemo(
    () =>
      (playlist?.songIds ?? [])
        .map((sid) => songById.get(sid))
        .filter((s): s is Song => Boolean(s)),
    [playlist?.songIds, songById],
  )

  if (!playlist) {
    return <EmptyState icon={<IconPlaylist />} title="播放列表不存在" />
  }

  const totalSec = songs.reduce((acc, s) => acc + s.duration, 0)

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={playlist.name}
        subtitle={`播放列表 · ${songs.length} 首歌曲 · ${formatTotalDuration(totalSec)}`}
        onPlay={songs.length ? () => playQueue(songs, 0, false) : undefined}
        onShuffle={
          songs.length
            ? () => playQueue(songs, Math.floor(Math.random() * songs.length), true)
            : undefined
        }
        extra={
          <button
            className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-white/15 hover:text-text-primary"
            onClick={() => {
              const name = window.prompt('重命名播放列表', playlist.name)
              if (name?.trim()) renamePlaylist(playlist.id, name.trim())
            }}
          >
            重命名
          </button>
        }
      />
      {songs.length ? (
        <SongTable
          songs={songs}
          scrollRef={scrollRef}
          onRemove={(song) => removeFromPlaylist(playlist.id, song.id)}
        />
      ) : (
        <EmptyState
          icon={<IconPlaylist />}
          title="播放列表为空"
          hint="在任意歌曲上右键，选择「添加到播放列表」"
        />
      )}
    </div>
  )
}
