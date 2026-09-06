import { useMemo, type RefObject } from 'react'
import { useLibrary, useUserData } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { promptInput } from '../lib/dialog'
import { SongTable } from '../components/SongTable'
import { PlaylistArtwork } from '../components/PlaylistArtwork'
import { PageHeader, EmptyState } from './shared'
import { IconClock, IconHeart, IconPlaylist } from '../components/Icons'
import { formatTotalDuration } from '../lib/utils'
import type { Song } from '../types'

export function RecentView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { songById } = useLibrary()
  const { recents } = useUserData()
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
  const { songById } = useLibrary()
  const { favorites } = useUserData()
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
  const { songById } = useLibrary()
  const { playlists, removeFromPlaylist, renamePlaylist, reorderPlaylist } = useUserData()
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
  const covers = playlist.songIds.slice(0, 4).map((sid) => songById.get(sid)?.cover ?? null)

  return (
    <div className="animate-fade-in-up">
      {/* 封面 + 标题头部（Apple Music 播放列表页风格） */}
      <div className="mb-6 flex items-end gap-6">
        <PlaylistArtwork
          covers={covers}
          seed={playlist.name}
          className="h-48 w-48 shrink-0 shadow-xl shadow-black/30"
          rounded="rounded-xl"
        />
        <div className="min-w-0 flex-1 pb-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            播放列表
          </div>
          <h1 className="mt-1 truncate text-[36px] font-bold leading-tight tracking-tight">
            {playlist.name}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {songs.length} 首歌曲 · {formatTotalDuration(totalSec)}
          </p>
        </div>
      </div>

      <PageHeader
        title=""
        onPlay={songs.length ? () => playQueue(songs, 0, false) : undefined}
        onShuffle={
          songs.length
            ? () => playQueue(songs, Math.floor(Math.random() * songs.length), true)
            : undefined
        }
        extra={
          <button
            className="cursor-pointer rounded-lg bg-surface-2 px-4 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
            onClick={() => {
              void (async () => {
                const name = await promptInput('重命名播放列表', playlist.name)
                if (name?.trim()) renamePlaylist(playlist.id, name.trim())
              })()
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
          draggable
          onReorder={(from, to) => reorderPlaylist(playlist.id, from, to)}
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
