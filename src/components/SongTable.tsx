import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Song, SongQuality } from '../types'
import { artistLine, cx, formatTime, qualityLabel, qualityTier } from '../lib/utils'
import { confirmDialog, promptInput } from '../lib/dialog'
import { useUserData } from '../state/LibraryContext'
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
  /** 启用拖拽重排（播放列表用） */
  draggable?: boolean
  onReorder?: (from: number, to: number) => void
  /** 启用单击多选 + 批量操作条（默认开启） */
  selectable?: boolean
}

interface MenuState {
  song: Song
  index: number
  x: number
  y: number
}

export function SongTable({ songs, showAlbum = true, scrollRef, onRemove, draggable = false, onReorder, selectable = true }: Props) {
  const { current, isPlaying, playQueue, toggle } = usePlayer()
  const { bulkSetFavorite } = useUserData()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  // 拖拽起点用 ref 同步读取（dragstart→drop 连续触发时 state 可能未提交）
  const dragFromRef = useRef<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastSelectedRef = useRef<string | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)

  /** 键盘导航：↑↓ 移动光标、回车播放、Ctrl+A 全选、Esc 清除 */
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setCursor((c) => (c == null ? 0 : Math.min(songs.length - 1, c + 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setCursor((c) => (c == null ? 0 : Math.max(0, c - 1)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (cursor != null && songs[cursor]) play(cursor)
    } else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      setSelectedIds(new Set(songs.map((s) => s.id)))
    } else if (e.key === 'Escape') {
      setSelectedIds(new Set())
      setCursor(null)
    }
  }

  /** 单选 / Ctrl 切换 / Shift 范围选 */
  const toggleSelect = useCallback(
    (id: string, extend: boolean) => {
      setSelectedIds((prev) => {
        if (extend && lastSelectedRef.current) {
          const from = songs.findIndex((s) => s.id === lastSelectedRef.current)
          const to = songs.findIndex((s) => s.id === id)
          if (from >= 0 && to >= 0) {
            const [lo, hi] = from < to ? [from, to] : [to, from]
            return new Set(songs.slice(lo, hi + 1).map((s) => s.id))
          }
        }
        lastSelectedRef.current = id
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [songs],
  )

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
    <>
      {selectable && selectedIds.size > 0 && (
        <SelectionBar
          ids={[...selectedIds]}
          count={selectedIds.size}
          total={songs.length}
          onClear={() => setSelectedIds(new Set())}
          onSelectAll={() => {
            lastSelectedRef.current = null
            setSelectedIds(new Set(songs.map((s) => s.id)))
          }}
          onFavorite={(fav) => {
            bulkSetFavorite([...selectedIds], fav)
            setSelectedIds(new Set())
          }}
          onRemoveAll={() => {
            const ids = new Set(selectedIds)
            songs.forEach((s, i) => {
              if (ids.has(s.id)) onRemove?.(s, i)
            })
            setSelectedIds(new Set())
          }}
          canRemove={Boolean(onRemove)}
        />
      )}
      <div
        ref={containerRef}
        className="relative outline-none"
        tabIndex={0}
        onKeyDown={onListKeyDown}
        onMouseDown={() => containerRef.current?.focus()}
        aria-label="歌曲列表"
      >
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
            selectable={selectable}
            isSelected={selectedIds.has(song.id)}
            isCursor={cursor === index}
            onToggleSelect={(e) => {
              const t = e.target as HTMLElement
              if (t.closest('button, a, input')) return
              toggleSelect(song.id, e.shiftKey)
            }}
            draggable={draggable}
            dragging={draggable && dragFrom === index}
            dragOver={draggable && dragOver === index}
            onDragStart={
              draggable
                ? (e) => {
                    dragFromRef.current = index
                    setDragFrom(index)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(index))
                  }
                : undefined
            }
            onDragOver={
              draggable
                ? (e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOver !== index) setDragOver(index)
                  }
                : undefined
            }
            onDrop={
              draggable
                ? (e) => {
                    e.preventDefault()
                    const from = dragFromRef.current
                    if (from != null) onReorder?.(from, index)
                    dragFromRef.current = null
                    setDragFrom(null)
                    setDragOver(null)
                  }
                : undefined
            }
            onDragEnd={
              draggable
                ? () => {
                    dragFromRef.current = null
                    setDragFrom(null)
                    setDragOver(null)
                  }
                : undefined
            }
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
    </>
  )
}

// ---------------------------------------------------------------- 行

interface RowProps {
  song: Song
  index: number
  isCurrent: boolean
  isPlaying: boolean
  showAlbum: boolean
  selectable?: boolean
  isSelected?: boolean
  isCursor?: boolean
  onToggleSelect?: (e: React.MouseEvent) => void
  draggable?: boolean
  dragging?: boolean
  dragOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onPlay: (index: number) => void
  onMenu: (e: React.MouseEvent) => void
}

function Row({
  song,
  index,
  isCurrent,
  isPlaying,
  showAlbum,
  selectable,
  isSelected,
  isCursor,
  onToggleSelect,
  draggable,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPlay,
  onMenu,
}: RowProps) {
  const { isFavorite, toggleFavorite } = useUserData()
  const { navigate } = useNav()
  const fav = isFavorite(song.id)

  return (
    <div
      className={cx(
        'group mx-1 flex items-center gap-3 rounded-xl px-3',
        'transition-colors hover:bg-surface',
        isCurrent && 'bg-surface',
        selectable && isSelected && 'bg-accent/15',
        isCursor && 'ring-1 ring-accent/50 ring-inset',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
        dragOver && 'ring-1 ring-accent ring-inset',
      )}
      style={{ height: ROW_H }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onToggleSelect}
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
          {artistLine(song)}
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

      {/* 音质 */}
      <QualityBadge quality={song.quality} />

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
  const { isFavorite, toggleFavorite, playlists, addToPlaylist, createPlaylist } = useUserData()
  const { navigate } = useNav()
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
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] hover:bg-surface-2'

  return (
    <div
      ref={ref}
      className="fixed z-100 w-56 rounded-xl border border-border bg-panel p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-fade-in-up"
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
      <button className={item} onClick={() => { navigate({ type: 'artist', name: song.artists[0] }); onClose() }}>
        查看艺人
      </button>
      {song.album && (
        <button
          className={item}
          onClick={() => { navigate({ type: 'album', key: `${song.artists[0]}|||${song.album}` }); onClose() }}
        >
          查看专辑
        </button>
      )}
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
              void (async () => {
                const name = await promptInput('新播放列表名称', '我的播放列表')
                if (name?.trim()) createPlaylist(name.trim(), [song.id])
                onClose()
              })()
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

// ---------------------------------------------------------------- 批量选择条

function SelectionBar({
  ids,
  count,
  total,
  onClear,
  onSelectAll,
  onFavorite,
  onRemoveAll,
  canRemove,
}: {
  ids: string[]
  count: number
  total: number
  onClear: () => void
  onSelectAll: () => void
  onFavorite: (fav: boolean) => void
  onRemoveAll: () => void
  canRemove: boolean
}) {
  const { playlists, addSongsToPlaylist, createPlaylist } = useUserData()
  const [showPlaylists, setShowPlaylists] = useState(false)
  const allSelected = count === total

  const item =
    'cursor-pointer rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:bg-surface-2'

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-accent/12 px-3 py-2">
      <span className="mr-1 text-[13px] font-semibold text-accent">{count} 首已选</span>
      <button className={item} onClick={allSelected ? onClear : onSelectAll}>
        {allSelected ? '取消全选' : '全选'}
      </button>
      <button className={item} onClick={() => onFavorite(true)}>
        收藏
      </button>
      <button className={item} onClick={() => onFavorite(false)}>
        取消收藏
      </button>
      <div className="relative">
        <button className={item} onClick={() => setShowPlaylists((v) => !v)}>
          加入播放列表…
        </button>
        {showPlaylists && (
          <div className="absolute left-0 top-full z-40 mt-1 max-h-60 w-52 overflow-y-auto rounded-lg border border-border bg-panel p-1.5 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            {playlists.length === 0 && (
              <div className="px-2 py-1 text-xs text-text-tertiary">还没有播放列表</div>
            )}
            {playlists.map((p) => (
              <button
                key={p.id}
                className="block w-full cursor-pointer truncate rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2"
                onClick={() => {
                  addSongsToPlaylist(p.id, ids)
                  setShowPlaylists(false)
                }}
              >
                {p.name}
              </button>
            ))}
            <button
              className="block w-full cursor-pointer truncate rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-accent-soft hover:bg-surface-2"
              onClick={() => {
                void (async () => {
                  const name = await promptInput('新播放列表名称', '我的播放列表')
                  if (name?.trim()) {
                    createPlaylist(name.trim(), ids)
                    setShowPlaylists(false)
                  }
                })()
              }}
            >
              新建播放列表…
            </button>
          </div>
        )}
      </div>
      {canRemove && (
        <button
          className={cx(item, 'text-red-400 hover:bg-red-500/15')}
          onClick={() => {
            void (async () => {
              if (await confirmDialog(`从当前列表移除 ${count} 首歌曲？`)) onRemoveAll()
            })()
          }}
        >
          移除
        </button>
      )}
      <button
        className={cx(item, 'ml-auto text-text-tertiary hover:text-text-primary')}
        onClick={onClear}
      >
        清除
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- 音质徽标

const QUALITY_COLOR: Record<string, string> = {
  lossless: 'text-emerald-400',
  high: 'text-text-tertiary',
  mid: 'text-amber-400',
  low: 'text-red-400',
}

function QualityBadge({ quality }: { quality?: SongQuality | null }) {
  const label = qualityLabel(quality)
  const tier = qualityTier(quality)
  if (!label || !tier) return null
  return (
    <span
      className={cx('hidden w-22 shrink-0 text-right text-[11px] font-medium tabular-nums lg:block', QUALITY_COLOR[tier])}
      title="音质"
    >
      {label}
    </span>
  )
}
