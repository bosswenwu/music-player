import { type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useNav } from '../state/NavContext'
import { AlbumCard } from '../components/Cards'
import { Artwork } from '../components/Artwork'
import { SongTable } from '../components/SongTable'
import { PageHeader, EmptyState } from './shared'
import { IconAlbum, IconChevronLeft } from '../components/Icons'
import { formatTotalDuration } from '../lib/utils'

export function AlbumsView() {
  const { albums } = useLibrary()

  if (!albums.length) {
    return <EmptyState icon={<IconAlbum />} title="没有专辑" hint="曲库中的歌曲缺少专辑标签" />
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="专辑" subtitle={`${albums.length} 张专辑`} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-4 gap-y-6">
        {albums.map((a) => (
          <AlbumCard key={a.key} album={a} />
        ))}
      </div>
    </div>
  )
}

export function AlbumDetail({
  albumKey,
  scrollRef,
}: {
  albumKey: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const { albumByKey } = useLibrary()
  const { playQueue } = usePlayer()
  const { back } = useNav()
  const album = albumByKey.get(albumKey)

  if (!album) {
    return <EmptyState icon={<IconAlbum />} title="未找到该专辑" />
  }

  const totalSec = album.songs.reduce((acc, s) => acc + s.duration, 0)

  return (
    <div className="animate-fade-in-up">
      <button
        className="mb-4 flex cursor-pointer items-center gap-1 text-[13px] font-medium text-accent hover:underline"
        onClick={back}
      >
        <IconChevronLeft className="h-4 w-4" />
        返回
      </button>

      <div className="mb-6 flex items-end gap-6">
        <Artwork
          cover={album.cover}
          seed={album.name}
          className="h-48 w-48 shrink-0"
          rounded="rounded-xl"
        />
        <div className="min-w-0 pb-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">专辑</div>
          <h1 className="mt-1 truncate text-[36px] font-bold leading-tight tracking-tight">
            {album.name}
          </h1>
          <p className="mt-1 text-[15px] font-medium text-accent-soft">{album.artist}</p>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {album.songs.length} 首歌曲 · {formatTotalDuration(totalSec)}
          </p>
        </div>
      </div>

      <PageHeader
        title=""
        onPlay={() => playQueue(album.songs, 0, false)}
        onShuffle={() => playQueue(album.songs, Math.floor(Math.random() * album.songs.length), true)}
      />

      <SongTable songs={album.songs} showAlbum={false} scrollRef={scrollRef} />
    </div>
  )
}
