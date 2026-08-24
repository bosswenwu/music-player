import { useLibrary } from '../state/LibraryContext'
import { usePlayer, usePlayerTime } from '../state/PlayerContext'
import { cx, formatTime } from '../lib/utils'
import { Artwork } from './Artwork'
import {
  IconExpand,
  IconHeart,
  IconHeartFilled,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from './Icons'

interface Props {
  onOpenNowPlaying: () => void
  onToggleQueue: () => void
  queueOpen: boolean
}

export function PlayerBar({ onOpenNowPlaying, onToggleQueue, queueOpen }: Props) {
  const {
    current, isPlaying, shuffle, repeat, volume,
    toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat,
  } = usePlayer()
  const { currentTime, duration } = usePlayerTime()
  const { isFavorite, toggleFavorite } = useLibrary()

  const dur = duration || current?.duration || 0
  const progress = dur > 0 ? (currentTime / dur) * 100 : 0

  return (
    <footer className="relative z-30 flex h-21 shrink-0 items-center gap-4 border-t border-border bg-[#1d1d1df2] px-4 backdrop-blur-2xl">
      {/* 左：当前歌曲 */}
      <div className="flex w-[26%] min-w-55 items-center gap-3">
        {current ? (
          <>
            <button
              className="group relative shrink-0 cursor-pointer"
              onClick={onOpenNowPlaying}
              aria-label="打开正在播放"
            >
              <Artwork
                cover={current.cover}
                seed={current.artists[0]}
                className="h-13.5 w-13.5"
                rounded="rounded-lg"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <IconExpand className="h-5 w-5 text-white" />
              </span>
            </button>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold">{current.title}</div>
              <div className="truncate text-xs text-text-secondary">{current.artist}</div>
            </div>
            <button
              className={cx(
                'shrink-0 cursor-pointer p-1 transition-colors',
                isFavorite(current.id) ? 'text-accent' : 'text-text-tertiary hover:text-text-primary',
              )}
              onClick={() => toggleFavorite(current.id)}
              aria-label="喜欢"
            >
              {isFavorite(current.id) ? (
                <IconHeartFilled className="h-4.5 w-4.5" />
              ) : (
                <IconHeart className="h-4.5 w-4.5" />
              )}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 text-text-tertiary">
            <div className="flex h-13.5 w-13.5 items-center justify-center rounded-lg bg-white/5">
              <IconPlay className="h-5 w-5" />
            </div>
            <span className="text-[13px]">未在播放</span>
          </div>
        )}
      </div>

      {/* 中：控制 + 进度 */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <div className="flex items-center gap-5">
          <button
            className={cx(
              'cursor-pointer p-1 transition-colors',
              shuffle ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
            )}
            onClick={toggleShuffle}
            aria-label="随机播放"
            title="随机播放"
          >
            <IconShuffle className="h-4.5 w-4.5" />
          </button>
          <button
            className="cursor-pointer p-1 text-text-primary/90 transition hover:text-text-primary active:scale-90"
            onClick={prev}
            aria-label="上一首"
          >
            <IconPrev className="h-6 w-6" />
          </button>
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/30 transition hover:scale-105 active:scale-95"
            onClick={toggle}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <IconPause className="h-5.5 w-5.5" /> : <IconPlay className="ml-0.5 h-5.5 w-5.5" />}
          </button>
          <button
            className="cursor-pointer p-1 text-text-primary/90 transition hover:text-text-primary active:scale-90"
            onClick={next}
            aria-label="下一首"
          >
            <IconNext className="h-6 w-6" />
          </button>
          <button
            className={cx(
              'cursor-pointer p-1 transition-colors',
              repeat !== 'off' ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
            )}
            onClick={cycleRepeat}
            aria-label="循环模式"
            title={repeat === 'off' ? '循环：关' : repeat === 'all' ? '循环：全部' : '循环：单曲'}
          >
            {repeat === 'one' ? <IconRepeatOne className="h-4.5 w-4.5" /> : <IconRepeat className="h-4.5 w-4.5" />}
          </button>
        </div>

        <div className="flex w-full max-w-140 items-center gap-2.5">
          <span className="w-10 text-right text-[11px] tabular-nums text-text-tertiary">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            className="slider flex-1"
            style={{ ['--fill' as string]: `${progress}%` }}
            min={0}
            max={dur || 1}
            step={0.25}
            value={Math.min(currentTime, dur || 1)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!current}
            aria-label="播放进度"
          />
          <span className="w-10 text-[11px] tabular-nums text-text-tertiary">
            {formatTime(dur)}
          </span>
        </div>
      </div>

      {/* 右：队列 / 音量 */}
      <div className="flex w-[22%] min-w-45 items-center justify-end gap-3">
        <button
          className={cx(
            'cursor-pointer rounded-md p-1.5 transition-colors',
            queueOpen ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={onToggleQueue}
          aria-label="播放队列"
          title="播放队列"
        >
          <IconQueue className="h-5 w-5" />
        </button>
        <div className="flex w-32 items-center gap-2">
          <button
            className="cursor-pointer text-text-secondary hover:text-text-primary"
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            aria-label="静音"
          >
            {volume === 0 ? <IconVolumeMute className="h-4.5 w-4.5" /> : <IconVolume className="h-4.5 w-4.5" />}
          </button>
          <input
            type="range"
            className="slider flex-1"
            style={{ ['--fill' as string]: `${volume * 100}%` }}
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="音量"
          />
        </div>
      </div>
    </footer>
  )
}
