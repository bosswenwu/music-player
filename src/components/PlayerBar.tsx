import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { EQ_PRESETS, usePlayer, usePlayerTime } from '../state/PlayerContext'
import { artistLine, cx, formatTime, loadLocal, saveLocal } from '../lib/utils'
import { Artwork } from './Artwork'
import {
  IconClock,
  IconEqualizer,
  IconEllipsis,
  IconExpand,
  IconHeart,
  IconHeartFilled,
  IconLyrics,
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
    current, isPlaying, shuffle, repeat, volume, rate, eq,
    toggle, next, prev, seek, setVolume, setRate, setEq, toggleShuffle, cycleRepeat,
  } = usePlayer()
  const { currentTime, duration } = usePlayerTime()
  const { isFavorite, toggleFavorite } = useLibrary()

  const dur = duration || current?.duration || 0
  const progress = dur > 0 ? (currentTime / dur) * 100 : 0

  // ----- 睡眠定时器（到点暂停播放，Spotify 风格）-----
  const SLEEP_OPTIONS = [15, 30, 45, 60] as const
  const [sleepMin, setSleepMin] = useState<number | null>(null)
  const sleepRef = useRef({ isPlaying, toggle })
  sleepRef.current = { isPlaying, toggle }
  useEffect(() => {
    if (sleepMin == null) return
    const timer = setTimeout(() => {
      const { isPlaying: playing, toggle: toggleFn } = sleepRef.current
      if (playing) toggleFn()
      setSleepMin(null)
    }, sleepMin * 60_000)
    return () => clearTimeout(timer)
  }, [sleepMin])
  const cycleSleep = () => {
    setSleepMin((prev) => {
      if (prev == null) return SLEEP_OPTIONS[0]
      const i = SLEEP_OPTIONS.indexOf(prev as (typeof SLEEP_OPTIONS)[number])
      return i >= 0 && i < SLEEP_OPTIONS.length - 1 ? SLEEP_OPTIONS[i + 1] : null
    })
  }

  // ----- 播放速度（0.75x → 2x）-----
  const RATES = [0.75, 1, 1.25, 1.5, 2]
  const cycleRate = () => {
    const i = RATES.indexOf(rate)
    setRate(RATES[(i + 1) % RATES.length])
  }

  // ----- 迷你歌词悬浮窗 -----
  const [floatOpen, setFloatOpen] = useState(false)
  const [floatCfg, setFloatCfg] = useState<{ opacity: number; fontSize: number }>(() =>
    loadLocal('mp.floatConfig', { opacity: 0.72, fontSize: 19 }),
  )
  const [showFloatCfg, setShowFloatCfg] = useState(false)
  useEffect(() => {
    window.musicDesktop?.lyricFloatState().then(setFloatOpen).catch(() => {})
  }, [])
  const toggleFloat = () => {
    window.musicDesktop?.lyricFloatToggle().then(setFloatOpen).catch(() => {})
  }
  const applyFloatCfg = (next: { opacity: number; fontSize: number }) => {
    setFloatCfg(next)
    saveLocal('mp.floatConfig', next)
    window.musicDesktop?.lyricFloatConfig(next)
  }

  // ----- 均衡器 -----
  const [showEq, setShowEq] = useState(false)

  // ----- 音量滚轮（原生非 passive 监听，才能 preventDefault 阻止误滚）-----
  const volumeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = volumeRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY !== 0) setVolume(volume + (e.deltaY > 0 ? -0.05 : 0.05))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [volume, setVolume])

  return (
    <footer className="relative z-30 flex h-21 shrink-0 items-center gap-4 border-t border-border bg-panel px-4 backdrop-blur-2xl">
      {/* 左：传输控制（Apple Music 桌面版布局：控件在左，信息面板居中） */}
      <div className="flex shrink-0 items-center gap-3.5 pl-1 sm:gap-4">
        <button
          className={cx(
            'hidden cursor-pointer p-1 transition-colors sm:block',
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
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:brightness-110 active:scale-95"
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
            'hidden cursor-pointer p-1 transition-colors sm:block',
            repeat !== 'off' ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={cycleRepeat}
          aria-label="循环模式"
          title={repeat === 'off' ? '循环：关' : repeat === 'all' ? '循环：全部' : '循环：单曲'}
        >
          {repeat === 'one' ? <IconRepeatOne className="h-4.5 w-4.5" /> : <IconRepeat className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* 中：LCD 信息面板（封面 + 标题 + 进度合为一个胶囊，Apple Music 风格） */}
      <div className="flex min-w-0 flex-1 justify-center">
        <div className="flex w-full max-w-155 items-center gap-3 rounded-xl border border-border bg-surface/50 px-2.5 py-1.5">
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
                  className="h-11 w-11"
                  rounded="rounded-md"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconExpand className="h-4.5 w-4.5 text-white" />
                </span>
              </button>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-center">
                    <div className="truncate text-[12.5px] font-semibold leading-tight">{current.title}</div>
                    <div className="truncate text-[11px] leading-tight text-text-secondary">
                      {artistLine(current)}
                    </div>
                  </div>
                  <button
                    className={cx(
                      'shrink-0 cursor-pointer p-0.5 transition-colors',
                      isFavorite(current.id) ? 'text-accent' : 'text-text-tertiary hover:text-text-primary',
                    )}
                    onClick={() => toggleFavorite(current.id)}
                    aria-label="喜欢"
                  >
                    {isFavorite(current.id) ? (
                      <IconHeartFilled className="h-4 w-4" />
                    ) : (
                      <IconHeart className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 text-right text-[10px] tabular-nums text-text-tertiary">
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
                    aria-label="播放进度"
                  />
                  <span className="w-8 text-[10px] tabular-nums text-text-tertiary">{formatTime(dur)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-center gap-2 py-2 text-text-tertiary">
              <IconPlay className="h-4 w-4" />
              <span className="text-[12.5px]">未在播放</span>
            </div>
          )}
        </div>
      </div>

      {/* 右：队列 / 音量 */}
      <div className="flex w-[22%] min-w-45 items-center justify-end gap-3">
        {/* 睡眠定时器 */}
        <button
          className={cx(
            'relative flex cursor-pointer items-center gap-1 rounded-md p-1.5 transition-colors',
            sleepMin != null
              ? 'bg-accent/20 text-accent'
              : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={cycleSleep}
          aria-label="睡眠定时器"
          title={
            sleepMin != null
              ? `将在 ${sleepMin} 分钟后停止播放（点击切换）`
              : '睡眠定时器：播放一段时间后自动暂停'
          }
        >
          <IconClock className="h-4.5 w-4.5" />
          {sleepMin != null && (
            <span className="text-[10.5px] font-semibold tabular-nums">{sleepMin}</span>
          )}
        </button>
        {/* 均衡器 */}
        <div className="relative">
          <button
            className={cx(
              'cursor-pointer rounded-md p-1.5 transition-colors',
              eq !== '平直' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary',
            )}
            onClick={() => setShowEq((v) => !v)}
            aria-label="均衡器"
            title={`均衡器：${eq}`}
          >
            <IconEqualizer className="h-4.5 w-4.5" />
          </button>
          {showEq && (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-44 rounded-xl border border-border bg-panel p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl animate-fade-in-up">
              <div className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                均衡器
              </div>
              {EQ_PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={cx(
                    'block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2',
                    eq === p.name ? 'font-semibold text-accent' : 'text-text-secondary',
                  )}
                  onClick={() => {
                    setEq(p.name)
                    setShowEq(false)
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* 播放速度 */}
        <button
          className={cx(
            'cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-semibold tabular-nums transition-colors',
            rate !== 1 ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary',
          )}
          onClick={cycleRate}
          aria-label="播放速度"
          title={`播放速度 ${rate}x（点击切换）`}
        >
          {rate}x
        </button>
        {/* 迷你歌词悬浮窗 */}
        <div className="relative">
          <button
            className={cx(
              'cursor-pointer rounded-md p-1.5 transition-colors',
              floatOpen ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary',
            )}
            onClick={toggleFloat}
            aria-label="迷你歌词"
            title={floatOpen ? '关闭迷你歌词悬浮窗' : '打开迷你歌词悬浮窗'}
          >
            <IconLyrics className="h-4.5 w-4.5" />
          </button>
          {/* 悬浮窗设置（透明度 + 字号） */}
          <button
            className="absolute -right-1 -top-1 cursor-pointer rounded-full bg-panel p-0.5 text-text-tertiary shadow transition-colors hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation()
              setShowFloatCfg((v) => !v)
            }}
            aria-label="悬浮窗设置"
            title="悬浮窗设置"
          >
            <IconEllipsis className="h-3 w-3" />
          </button>
          {showFloatCfg && (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-48 rounded-xl border border-border bg-panel p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl animate-fade-in-up">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                悬浮窗设置
              </div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-text-secondary">
                <span>透明度</span>
                <span className="tabular-nums">{Math.round(floatCfg.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider w-full"
                min={0.35}
                max={0.9}
                step={0.05}
                value={floatCfg.opacity}
                onChange={(e) => applyFloatCfg({ ...floatCfg, opacity: Number(e.target.value) })}
                aria-label="悬浮窗透明度"
              />
              <div className="mt-2 mb-1 flex items-center justify-between text-[11px] text-text-secondary">
                <span>字号</span>
                <span className="tabular-nums">{floatCfg.fontSize}px</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="flex-1 cursor-pointer rounded-md bg-surface px-2 py-1 text-[12px] font-semibold transition hover:bg-surface-2"
                  onClick={() => applyFloatCfg({ ...floatCfg, fontSize: Math.max(14, floatCfg.fontSize - 2) })}
                >
                  A-
                </button>
                <button
                  className="flex-1 cursor-pointer rounded-md bg-surface px-2 py-1 text-[12px] font-semibold transition hover:bg-surface-2"
                  onClick={() => applyFloatCfg({ ...floatCfg, fontSize: Math.min(30, floatCfg.fontSize + 2) })}
                >
                  A+
                </button>
              </div>
            </div>
          )}
        </div>
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
        <div
          ref={volumeRef}
          className="flex w-32 items-center gap-2"
        >
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
