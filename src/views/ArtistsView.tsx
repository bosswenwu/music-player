import { useEffect, useMemo, useState, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useNav } from '../state/NavContext'
import { ArtistCard } from '../components/Cards'
import { Artwork } from '../components/Artwork'
import { SongTable } from '../components/SongTable'
import { PageHeader, EmptyState } from './shared'
import { IconMic, IconChevronLeft } from '../components/Icons'
import { formatTotalDuration, qualitySummary } from '../lib/utils'
import { getArtistPhoto } from '../lib/artistPhoto'

export function ArtistsView() {
  const { artists } = useLibrary()

  const sorted = useMemo(
    () => [...artists].sort((a, b) => b.songs.length - a.songs.length),
    [artists],
  )

  if (!artists.length) {
    return <EmptyState icon={<IconMic />} title="没有艺人" />
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="艺人" subtitle={`${artists.length} 位艺人`} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-6">
        {sorted.map((a) => (
          <ArtistCard key={a.name} artist={a} />
        ))}
      </div>
    </div>
  )
}

export function ArtistDetail({
  name,
  scrollRef,
}: {
  name: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const { artistByName } = useLibrary()
  const { playQueue } = usePlayer()
  const { back } = useNav()
  const artist = artistByName.get(name)
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setPhoto(null)
    void getArtistPhoto(name).then((u) => alive && setPhoto(u))
    return () => {
      alive = false
    }
  }, [name])

  if (!artist) {
    return <EmptyState icon={<IconMic />} title="未找到该艺人" />
  }

  const totalSec = artist.songs.reduce((acc, s) => acc + s.duration, 0)

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
          cover={photo ?? artist.cover}
          seed={artist.name}
          className="h-44 w-44 shrink-0"
          rounded="rounded-full"
          fallbackIcon="artist"
        />
        <div className="min-w-0 pb-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">艺人</div>
          <h1 className="mt-1 truncate text-[40px] font-bold leading-tight tracking-tight">
            {artist.name}
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            {artist.songs.length} 首歌曲 · {formatTotalDuration(totalSec)}
          </p>
          {qualitySummary(artist.songs) && (
            <p className="mt-0.5 text-[12px] text-text-tertiary">{qualitySummary(artist.songs)}</p>
          )}
        </div>
      </div>

      <PageHeader
        title=""
        onPlay={() => playQueue(artist.songs, 0, false)}
        onShuffle={() => playQueue(artist.songs, Math.floor(Math.random() * artist.songs.length), true)}
      />

      <SongTable songs={artist.songs} scrollRef={scrollRef} />
    </div>
  )
}
