import { useEffect, useRef } from 'react'
import { usePlayer } from '../state/PlayerContext'
import { cx, formatTime } from '../lib/utils'
import { Artwork } from './Artwork'
import { IconClose, IconQueue, PlayingBars } from './Icons'

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { queue, index, isPlaying, jumpTo, removeFromQueue } = usePlayer()
  const listRef = useRef<HTMLDivElement>(null)

  // 打开时滚动到当前曲目
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-current]')
    el?.scrollIntoView({ block: 'center' })
  }, [])

  const upNext = queue.slice(index + 1)

  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-88 flex-col border-l border-border bg-[#1c1c1cfa] shadow-2xl shadow-black/50 backdrop-blur-2xl animate-slide-in-right">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[17px] font-bold">播放队列</h2>
        <button
          className="cursor-pointer rounded-full bg-white/8 p-1.5 text-text-secondary transition hover:bg-white/15 hover:text-text-primary"
          onClick={onClose}
          aria-label="关闭队列"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-4">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-tertiary">
            <IconQueue className="h-12 w-12" />
            <span className="text-[13px]">队列为空</span>
          </div>
        ) : (
          <>
            {queue[index] && (
              <>
                <SectionLabel>正在播放</SectionLabel>
                <QueueRow
                  key={`cur-${queue[index].id}-${index}`}
                  songIndex={index}
                  current
                  isPlaying={isPlaying}
                  onJump={jumpTo}
                  onRemove={removeFromQueue}
                />
              </>
            )}
            {upNext.length > 0 && (
              <>
                <SectionLabel>接下来 · {upNext.length} 首</SectionLabel>
                {upNext.map((song, i) => (
                  <QueueRow
                    key={`${song.id}-${index + 1 + i}`}
                    songIndex={index + 1 + i}
                    isPlaying={false}
                    onJump={jumpTo}
                    onRemove={removeFromQueue}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
      {children}
    </div>
  )
}

function QueueRow({
  songIndex,
  current = false,
  isPlaying,
  onJump,
  onRemove,
}: {
  songIndex: number
  current?: boolean
  isPlaying: boolean
  onJump: (i: number) => void
  onRemove: (i: number) => void
}) {
  const { queue } = usePlayer()
  const song = queue[songIndex]
  if (!song) return null

  return (
    <div
      data-current={current || undefined}
      className={cx(
        'group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/7',
        current && 'bg-white/9',
      )}
      onClick={() => !current && onJump(songIndex)}
    >
      <div className="relative h-10 w-10 shrink-0">
        <Artwork cover={song.cover} seed={song.artists[0]} className="h-10 w-10" rounded="rounded-md" />
        {current && isPlaying && (
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45 text-white">
            <PlayingBars />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cx('truncate text-[13px] font-medium', current && 'text-accent-soft')}>
          {song.title}
        </div>
        <div className="truncate text-xs text-text-secondary">{song.artist}</div>
      </div>
      <span className="text-[11px] tabular-nums text-text-tertiary group-hover:hidden">
        {formatTime(song.duration)}
      </span>
      {!current && (
        <button
          className="hidden cursor-pointer p-1 text-text-tertiary transition hover:text-red-400 group-hover:block"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(songIndex)
          }}
          aria-label="从队列移除"
        >
          <IconClose className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
