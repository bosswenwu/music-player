import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlbumGroup, ArtistGroup, Song } from '../types'
import { artistLine, cx } from '../lib/utils'
import { getArtistPhoto } from '../lib/artistPhoto'
import { usePlayer } from '../state/PlayerContext'
import { useNav } from '../state/NavContext'
import { Artwork } from './Artwork'
import { IconChevronLeft, IconChevronRight, IconPause, IconPlay } from './Icons'

/** 悬浮显示的圆形播放按钮 */
function HoverPlay({
  onClick,
  playing,
  className,
}: {
  onClick: (e: React.MouseEvent) => void
  playing?: boolean
  className?: string
}) {
  return (
    <button
      className={cx(
        'absolute flex h-11 w-11 cursor-pointer items-center justify-center rounded-full',
        'bg-accent text-white shadow-xl shadow-black/40',
        'opacity-0 translate-y-1.5 transition-all duration-200',
        'group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95',
        playing && 'opacity-100 translate-y-0',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      aria-label="播放"
    >
      {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
    </button>
  )
}

// ---------------------------------------------------------------- 歌曲卡片（首页横排）

export function SongCard({ song, queue }: { song: Song; queue: Song[] }) {
  const { current, isPlaying, playQueue, toggle } = usePlayer()
  const isCurrent = current?.id === song.id

  const play = () => {
    if (isCurrent) toggle()
    else playQueue(queue, queue.findIndex((s) => s.id === song.id))
  }

  return (
    <div className="group w-40 shrink-0 cursor-pointer" onClick={play}>
      <div className="relative">
        <Artwork
          cover={song.cover}
          seed={`${song.artist}·${song.title}`}
          className="aspect-square w-full transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/40"
          rounded="rounded-xl"
        />
        <HoverPlay onClick={play} playing={isCurrent && isPlaying} className="bottom-2.5 right-2.5" />
      </div>
      <div className="mt-2 truncate text-[13px] font-medium">{song.title}</div>
      <div className="truncate text-xs text-text-secondary">{artistLine(song)}</div>
    </div>
  )
}

// ---------------------------------------------------------------- 艺人卡片（圆形）

export function ArtistCard({ artist }: { artist: ArtistGroup }) {
  const { navigate } = useNav()
  const { playQueue } = usePlayer()
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getArtistPhoto(artist.name).then((u) => alive && setPhoto(u))
    return () => {
      alive = false
    }
  }, [artist.name])

  return (
    <div
      className="group w-40 shrink-0 cursor-pointer"
      onClick={() => navigate({ type: 'artist', name: artist.name })}
    >
      <div className="relative">
        <Artwork
          cover={photo ?? artist.cover}
          seed={artist.name}
          className="aspect-square w-full transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/40"
          rounded="rounded-full"
          fallbackIcon="artist"
        />
        <HoverPlay
          onClick={() => playQueue(artist.songs, 0, true)}
          className="bottom-1.5 right-1.5"
        />
      </div>
      <div className="mt-2 truncate text-center text-[13px] font-medium">{artist.name}</div>
      <div className="truncate text-center text-xs text-text-secondary">
        {artist.songs.length} 首歌曲
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 专辑卡片

export function AlbumCard({ album }: { album: AlbumGroup }) {
  const { navigate } = useNav()
  const { playQueue } = usePlayer()

  return (
    <div
      className="group cursor-pointer"
      onClick={() => navigate({ type: 'album', key: album.key })}
    >
      <div className="relative">
        <Artwork
          cover={album.cover}
          seed={album.name}
          className="aspect-square w-full transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/40"
          rounded="rounded-xl"
        />
        <HoverPlay onClick={() => playQueue(album.songs, 0)} className="bottom-2.5 right-2.5" />
      </div>
      <div className="mt-2 truncate text-[13px] font-medium">{album.name}</div>
      <div className="truncate text-xs text-text-secondary">{album.artist}</div>
    </div>
  )
}

// ---------------------------------------------------------------- 横向滚动货架

export function Shelf({
  title,
  subtitle,
  onSeeAll,
  children,
}: {
  title: string
  subtitle?: string
  onSeeAll?: () => void
  children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, children])

  const scrollByPage = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="group/shelf mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <span className="text-[13px] text-text-tertiary">{subtitle}</span>}
        {onSeeAll && (
          <button
            className="ml-auto shrink-0 cursor-pointer text-[13px] font-semibold text-text-secondary transition-colors hover:text-accent"
            onClick={onSeeAll}
          >
            查看全部 ›
          </button>
        )}
      </div>
      <div className="relative">
        {/* 左右滑动箭头：鼠标悬停货架时显示，到边则隐藏（Apple Music 风格） */}
        <ShelfArrow side="left" hidden={atStart} onClick={() => scrollByPage(-1)} />
        <ShelfArrow side="right" hidden={atEnd} onClick={() => scrollByPage(1)} />
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

function ShelfArrow({
  side,
  hidden,
  onClick,
}: {
  side: 'left' | 'right'
  hidden: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cx(
        'absolute top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full',
        'border border-border bg-panel/90 text-text-primary shadow-lg shadow-black/30 backdrop-blur',
        'opacity-0 transition-opacity duration-200 group-hover/shelf:opacity-100 hover:!bg-panel md:flex',
        side === 'left' ? 'left-1' : 'right-1',
        hidden && 'pointer-events-none !opacity-0',
      )}
      onClick={onClick}
      aria-label={side === 'left' ? '向前滚动' : '向后滚动'}
    >
      {side === 'left' ? <IconChevronLeft className="h-5 w-5" /> : <IconChevronRight className="h-5 w-5" />}
    </button>
  )
}
