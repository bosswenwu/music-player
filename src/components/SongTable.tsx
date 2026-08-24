import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Song } from '../types'
import { cx, formatTime } from '../lib/utils'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useNav } from '../state/NavContext'
import { Artwork } from './Artwork'
import {
  IconEllipsis,
  IconHeart,
  IconHeartFilled,
  IconPause,
  IconPlay,
  PlayingBars,
} from './Icons'

const ROW_H = 56
const OVERSCAN = 10

interface Props {
  songs: Song[]
  showAlbum?: boolean
  /** 虚拟滚动所依附的滚动容器 */
  scrollRef?: RefObject<HTMLElement | null>
  /** 提供时显示"从此列表移除"菜单项 */
  onRemove?: (song: Song, index: number) => void
}

interface MenuState {
  song: Song
  index: number
  x: number
  y: number
}

export function SongTable({ songs, showAlbum = true, scrollRef, onRemove }: Props) {
  const { current, isPlaying, playQueue, toggle } = usePlayer()
  const [menu, setMenu] = useState<MenuState | null>(null)

  const virtual = Boolean(scrollRef) && songs.length > 80
  const containerRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<[number, number]>([0, virtual ? 40 : songs.length])

  const updateRange = useCallback(() => {
    const scroller = scrollRef?.current
    const container = containerRef.current
    if (!scroller || !container) return
    const offsetTop =
      container.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const start = Math.max(0, Math.floor((scroller.scrollTop - offsetTop) / ROW_H) - OVERSCAN)
    const visible = Math.ceil(scroller.clientHeight / ROW_H) + OVERSCAN * 2
    setRange((prev) => {
      const next: [number, number] = [start, Math.min(songs.length, start + visible)]
      return prev[0] === next[0] && prev[1] === next[1] ? prev : next
    })
  }, [scrollRef, songs.length])

  useLayoutEffect(() => {
    if (!virtual) {
      setRange([0, songs.length])
      return
    }
    updateRange()
    const scroller = scrollRef?.current
    if (!scroller) return
    scroller.addEventListener('scroll', updateRange, { passive: true })
    window.addEventListener('resize', updateRange)
    return () => {
      scroller.removeEventListener('scroll', updateRange)
      window.removeEventListener('resize', updateRange)
    }
  }, [virtual, updateRange, scrollRef, songs.length])

  const play = useCallback(
    (index: number) => {
      if (current?.id === songs[index]?.id) {
        toggle()
      } else {
        playQueue(songs, index)
      }
    },
    [songs, current?.id, playQueue, toggle],
  )

  const [start, end] = virtual ? range : [0, songs.length]
  const slice = songs.slice(start, end)

  return (
    <div ref={containerRef} className="relative">
      {virtual && <div style={{ height: start * ROW_H }} />}
      {slice.map((song, i) => {
        const index = start + i
        const isCurrent = current?.id === song.id
        return (
          <Row
            key={`${song.id}-${index}`}
            song={song}
            index={index}
            isCurrent={isCurrent}
            isPlaying={isCurrent && isPlaying}
            showAlbum={showAlbum}
            onPlay={play}
            onMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const vw = window.innerWidth
              const vh = window.innerHeight
              setMenu({
                song,
                index,
                x: Math.min(e.clientX, vw - 240),
                y: Math.min(e.clientY, vh - 320),
              })
            }}
          />
        )
      })}
      {virtual && <div style={{ height: Math.max(0, (songs.length - end) * ROW_H) }} />}
      {menu && (
        <RowMenu
          state={menu}
          onClose={() => setMenu(null)}
          onRemove={onRemove ? () => onRemove(menu.song, menu.index) : undefined}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 行

interface RowProps {
  song: Song
  index: number
  isCurrent: boolean
  isPlaying: boolean
  showAlbum: boolean
  onPlay: (index: number) => void
  onMenu: (e: React.MouseEvent) => void
}

function Row({ song, index, isCurrent, isPlaying, showAlbum, onPlay, onMenu }: RowProps) {
  const { isFavorite, toggleFavorite } = useLibrary()
  const { navigate } = useNav()
  const fav = isFavorite(song.id)

  return (
    <div
      className={cx(
        'group flex items-center gap-3 rounded-lg px-3',
        'hover:bg-white/6',
        isCurrent && 'bg-white/8',
      )}
      style={{ height: ROW_H }}
      onDoubleClick={() => onPlay(index)}
      onContextMenu={onMenu}
    >
      {/* 封面 + 播放按钮 */}
      <button
        className="relative h-10 w-10 shrink-0 cursor-pointer"
        onClick={() => onPlay(index)}
        aria-label="播放"
      >
        <Artwork cover={song.cover} seed={song.artists[0]} className="h-10 w-10" rounded="rounded-md" />
        <span
          className={cx(
            'absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-white',
            'opacity-0 transition-opacity group-hover:opacity-100',
            isCurrent && 'opacity-100',
          )}
        >
          {isCurrent && isPlaying ? (
            <span className="group-hover:hidden">
              <PlayingBars />
            </span>
          ) : null}
          <span className={cx(isCurrent && isPlaying ? 'hidden group-hover:block' : 'block')}>
            {isCurrent && isPlaying ? (
              <IconPause className="h-4.5 w-4.5" />
            ) : (
              <IconPlay className="h-4.5 w-4.5" />
            )}
          </span>
        </span>
      </button>

      {/* 标题 / 艺人 */}
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            'truncate text-[13.5px] font-medium leading-tight',
            isCurrent ? 'text-accent-soft' : 'text-text-primary',
          )}
        >
          {song.title}
        </div>
        <button
          className="block max-w-full cursor-pointer truncate text-xs text-text-secondary hover:text-text-primary hover:underline"
          onClick={() => navigate({ type: 'artist', name: song.artists[0] })}
        >
          {song.artist}
        </button>
      </div>

      {/* 专辑 */}
      {showAlbum && (
        <div className="hidden w-[26%] min-w-0 md:block">
          {song.album ? (
            <button
              className="max-w-full cursor-pointer truncate text-[13px] text-text-secondary hover:text-text-primary hover:underline"
              onClick={() => navigate({ type: 'album', key: `${song.artists[0]}|||${song.album}` })}
            >
              {song.album}
            </button>
          ) : (
            <span className="text-[13px] text-text-tertiary">—</span>
          )}
        </div>
      )}

      {/* 喜欢 */}
      <button
        className={cx(
          'cursor-pointer p-1 transition-opacity',
          fav ? 'text-accent opacity-100' : 'text-text-secondary opacity-0 group-hover:opacity-100',
        )}
        onClick={() => toggleFavorite(song.id)}
        aria-label={fav ? '取消喜欢' : '喜欢'}
      >
        {fav ? <IconHeartFilled className="h-4 w-4" /> : <IconHeart className="h-4 w-4" />}
      </button>

      {/* 时长 */}
      <div className="w-11 text-right text-[13px] tabular-nums text-text-tertiary">
        {formatTime(song.duration)}
      </div>

      {/* 更多 */}
      <button
        className="cursor-pointer p-1 text-text-secondary opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
        onClick={onMenu}
        aria-label="更多操作"
      >
        <IconEllipsis className="h-4.5 w-4.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- 右键 / 更多菜单

function RowMenu({
  state,
  onClose,
  onRemove,
}: {
  state: MenuState
  onClose: () => void
  onRemove?: () => void
}) {
  const { song } = state
  const { playNext, addToQueue } = usePlayer()
  const { isFavorite, toggleFavorite, playlists, addToPlaylist, createPlaylist } = useLibrary()
  const [showPlaylists, setShowPlaylists] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const item =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] hover:bg-white/10'

  return (
    <div
      ref={ref}
      className="fixed z-100 w-56 rounded-xl border border-border bg-[#2a2a2ae6] p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-fade-in-up"
      style={{ left: state.x, top: state.y, animationDuration: '0.15s' }}
    >
      <div className="truncate px-3 py-1.5 text-xs font-semibold text-text-tertiary">
        {song.title}
      </div>
      <button className={item} onClick={() => { playNext(song); onClose() }}>
        下一首播放
      </button>
      <button className={item} onClick={() => { addToQueue(song); onClose() }}>
        添加到队列末尾
      </button>
      <button className={item} onClick={() => { toggleFavorite(song.id); onClose() }}>
        {isFavorite(song.id) ? '取消喜欢' : '喜欢'}
      </button>
      <div className="my-1 h-px bg-border" />
      <button className={item} onClick={() => setShowPlaylists((v) => !v)}>
        添加到播放列表…
      </button>
      {showPlaylists && (
        <div className="max-h-44 overflow-y-auto pl-2">
          {playlists.map((p) => (
            <button
              key={p.id}
              className={item}
              onClick={() => { addToPlaylist(p.id, song.id); onClose() }}
            >
              {p.name}
            </button>
          ))}
          <button
            className={cx(item, 'text-accent-soft')}
            onClick={() => {
              const name = window.prompt('新播放列表名称', '我的播放列表')
              if (name?.trim()) createPlaylist(name.trim(), [song.id])
              onClose()
            }}
          >
            新建播放列表…
          </button>
        </div>
      )}
      {onRemove && (
        <>
          <div className="my-1 h-px bg-border" />
          <button className={cx(item, 'text-red-400')} onClick={() => { onRemove(); onClose() }}>
            从此列表移除
          </button>
        </>
      )}
    </div>
  )
}
