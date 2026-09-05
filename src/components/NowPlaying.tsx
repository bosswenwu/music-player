import { memo, useEffect, useRef, useState } from 'react'
import type { Lyrics, Song } from '../types'
import { useLibrary } from '../state/LibraryContext'
import { useLyricSync, usePlayer, usePlayerTime } from '../state/PlayerContext'
import { extractColors, type CoverColors } from '../lib/color'
import { artistLine, cx, formatTime, gradientFor, loadLocal, saveLocal } from '../lib/utils'
import { Artwork } from './Artwork'
import {
  IconChevronDown,
  IconHeart,
  IconHeartFilled,
  IconMusicNote,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
  IconVolumeMute,
} from './Icons'

const DEFAULT_COLORS: CoverColors = {
  primary: '#3a3a3c',
  secondary: '#1c1c1e',
  accent: '#fb5c74',
}

export function NowPlaying({ onClose }: { onClose: () => void }) {
  const { current } = usePlayer()
  const { lyrics, source: lyricSource, loading: lyricLoading, activeLine } = useLyricSync()
  const [colors, setColors] = useState<CoverColors>(DEFAULT_COLORS)
  const [showLyrics, setShowLyrics] = useState(true)

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 主色提取：有封面从图取色；无封面（占位渐变）用同一套渐变色，保证氛围背景始终有色彩
  useEffect(() => {
    let alive = true
    if (current?.cover) {
      extractColors(current.cover).then((c) => alive && setColors(c))
    } else if (current) {
      const [a, b] = gradientFor(current.artists[0] ?? current.title)
      setColors({ primary: a, secondary: b, accent: DEFAULT_COLORS.accent })
    }
    return () => {
      alive = false
    }
  }, [current?.cover, current])

  if (!current) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-np-enter">
      {/* 动态背景 */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{ background: colors.secondary }}
      />
      <div
        className="ambient-blob absolute -inset-1/4 opacity-80 transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 30% 35%, ${colors.primary} 0%, transparent 70%),
            radial-gradient(ellipse 50% 55% at 72% 68%, ${colors.secondary} 0%, transparent 72%)`,
          filter: 'blur(60px)',
        }}
      />
      {current.cover && (
        <img
          src={current.cover}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25"
          style={{ filter: 'blur(90px) saturate(1.6)' }}
        />
      )}
      <div className="absolute inset-0 bg-black/35" />

      {/* 内容 */}
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <button
            className="cursor-pointer rounded-full bg-white/10 p-2 text-white/85 backdrop-blur transition hover:bg-white/20"
            onClick={onClose}
            aria-label="收起"
          >
            <IconChevronDown className="h-5 w-5" />
          </button>
          {/* 歌词面板开关（Spotify / Apple Music 风格） */}
          <button
            className={cx(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur transition',
              showLyrics
                ? 'bg-white/15 text-white'
                : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/85',
            )}
            onClick={() => setShowLyrics((v) => !v)}
            aria-label="切换歌词面板"
          >
            <IconMusicNote className="h-3.5 w-3.5" />
            歌词
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center gap-14 px-10 pb-8 xl:gap-20">
          {/* 左：封面与控制 */}
          <LeftPane song={current} accent={colors.accent} centered={!showLyrics} />

          {/* 右：歌词 */}
          {showLyrics && (
            <div className="hidden h-full max-h-[78vh] w-[44%] min-w-0 max-w-150 md:block">
              {lyrics ? (
                <LyricsPane lyrics={lyrics} accent={colors.accent} source={lyricSource} activeLine={activeLine} />
              ) : (
                <LyricsEmpty loading={lyricLoading} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 左侧

function LeftPane({ song, accent, centered }: { song: Song; accent: string; centered: boolean }) {
  const {
    isPlaying, shuffle, repeat, volume,
    toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat,
  } = usePlayer()
  const { currentTime, duration } = usePlayerTime()
  const { isFavorite, toggleFavorite } = useLibrary()

  const dur = duration || song.duration || 0
  const progress = dur > 0 ? (currentTime / dur) * 100 : 0
  const fav = isFavorite(song.id)

  return (
    <div className={cx('flex w-105 max-w-[42vw] flex-col', centered && 'items-center')}>
      <div
        className={cx(
          'relative transition-transform duration-500',
          isPlaying ? 'scale-100' : 'scale-[0.88]',
        )}
      >
        <Artwork
          cover={song.cover}
          seed={song.artists[0]}
          className="aspect-square w-full"
          rounded="rounded-2xl"
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: '0 30px 80px -12px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* 标题行 */}
      <div className="mt-7 flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[22px] font-bold text-white text-shadow-lg">{song.title}</div>
          <div className="truncate text-[15px] text-white/60">
            {artistLine(song)}
            {song.album ? ` — ${song.album}` : ''}
          </div>
        </div>
        <button
          className={cx('shrink-0 cursor-pointer p-1.5 transition', fav ? '' : 'text-white/50 hover:text-white')}
          style={fav ? { color: accent } : undefined}
          onClick={() => toggleFavorite(song.id)}
          aria-label="喜欢"
        >
          {fav ? <IconHeartFilled className="h-6 w-6" /> : <IconHeart className="h-6 w-6" />}
        </button>
      </div>

      {/* 进度 */}
      <div className="mt-4 w-full">
        <input
          type="range"
          className="slider w-full"
          style={{ ['--fill' as string]: `${progress}%`, ['--slider-color' as string]: 'rgba(255,255,255,0.9)' }}
          min={0}
          max={dur || 1}
          step={0.25}
          value={Math.min(currentTime, dur || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="播放进度"
        />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/45">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, dur - currentTime))}</span>
        </div>
      </div>

      {/* 控制 */}
      <div className="mt-3 flex w-full items-center justify-center gap-8">
        <button
          className={cx('cursor-pointer p-1 transition', shuffle ? '' : 'text-white/55 hover:text-white')}
          style={shuffle ? { color: accent } : undefined}
          onClick={toggleShuffle}
          aria-label="随机播放"
        >
          <IconShuffle className="h-5 w-5" />
        </button>
        <button className="cursor-pointer p-1 text-white transition active:scale-90" onClick={prev} aria-label="上一首">
          <IconPrev className="h-9 w-9" />
        </button>
        <button
          className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-2xl shadow-black/40 transition hover:scale-105 active:scale-95"
          onClick={toggle}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <IconPause className="h-8 w-8" /> : <IconPlay className="ml-1 h-8 w-8" />}
        </button>
        <button className="cursor-pointer p-1 text-white transition active:scale-90" onClick={next} aria-label="下一首">
          <IconNext className="h-9 w-9" />
        </button>
        <button
          className={cx('cursor-pointer p-1 transition', repeat !== 'off' ? '' : 'text-white/55 hover:text-white')}
          style={repeat !== 'off' ? { color: accent } : undefined}
          onClick={cycleRepeat}
          aria-label="循环模式"
        >
          {repeat === 'one' ? <IconRepeatOne className="h-5 w-5" /> : <IconRepeat className="h-5 w-5" />}
        </button>
      </div>

      {/* 音量 */}
      <div className="mx-auto mt-5 flex w-64 items-center gap-3">
        <button
          className="cursor-pointer text-white/55 hover:text-white"
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          aria-label="静音"
        >
          {volume === 0 ? <IconVolumeMute className="h-4.5 w-4.5" /> : <IconVolume className="h-4.5 w-4.5" />}
        </button>
        <input
          type="range"
          className="slider flex-1"
          style={{ ['--fill' as string]: `${volume * 100}%`, ['--slider-color' as string]: 'rgba(255,255,255,0.9)' }}
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="音量"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 歌词

function LyricsPane({
  lyrics,
  accent,
  source,
  activeLine,
}: {
  lyrics: Lyrics
  accent: string
  source: 'local' | 'online' | null
  activeLine: number
}) {
  const { seek, getTime } = usePlayer()
  const [wordCursor, setWordCursor] = useState(0)
  const [fontScale, setFontScale] = useState<number>(() => loadLocal('mp.lyricFont', 100))
  const [showTranslation, setShowTranslation] = useState<boolean>(() => loadLocal('mp.lyricTrans', true))
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrollUntil = useRef(0)

  const hasTranslation = (lyrics.translation ?? []).some((t) => t != null)
  const baseFont = 26
  const fontSize = Math.round((baseFont * fontScale) / 100)

  const changeScale = (delta: number) => {
    setFontScale((prev) => {
      const next = Math.min(150, Math.max(70, prev + delta))
      saveLocal('mp.lyricFont', next)
      return next
    })
  }

  // 词级逐字高亮（仅主窗口需要；行高亮由 PlayerProvider 提供）
  useEffect(() => {
    if (lyrics.synced !== 'word') return
    let raf = 0
    let lastWordUpdate = 0
    const tick = (now: number) => {
      if (now - lastWordUpdate > 80) {
        lastWordUpdate = now
        setWordCursor(getTime())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lyrics, getTime])

  // 自动滚动到当前行（用户手动滚动后暂停 3.5 秒）
  useEffect(() => {
    if (activeLine < 0) return
    if (performance.now() < userScrollUntil.current) return
    const el = containerRef.current?.querySelector(`[data-line="${activeLine}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeLine])

  return (
    <div className="relative h-full">
      {/* 歌词控制：字号 + 翻译开关 */}
      <div className="pointer-events-none absolute -top-2 left-0 z-10 flex items-center gap-1">
        <button
          className="pointer-events-auto cursor-pointer rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white"
          onClick={() => changeScale(-10)}
          aria-label="缩小歌词"
          title="缩小歌词字号"
        >
          A-
        </button>
        <button
          className="pointer-events-auto cursor-pointer rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white"
          onClick={() => changeScale(10)}
          aria-label="放大歌词"
          title="放大歌词字号"
        >
          A+
        </button>
        {hasTranslation && (
          <button
            className={cx(
              'pointer-events-auto cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur transition',
              showTranslation ? 'bg-white/20 text-white' : 'bg-white/8 text-white/45 hover:bg-white/15',
            )}
            onClick={() => {
              setShowTranslation((v) => {
                saveLocal('mp.lyricTrans', !v)
                return !v
              })
            }}
            aria-label="翻译开关"
            title="显示/隐藏歌词翻译"
          >
            译
          </button>
        )}
      </div>
      {source === 'online' && (
        <div className="pointer-events-none absolute -top-2 right-0 z-10 rounded-full bg-white/12 px-2.5 py-1 text-[10.5px] font-medium text-white/60 backdrop-blur">
          网络歌词
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto pr-4 pt-4"
        style={{ scrollbarWidth: 'none', maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 86%, transparent 100%)' }}
        onWheel={() => {
          userScrollUntil.current = performance.now() + 3500
        }}
      >
        <div className="h-[35%]" />
        {lyrics.lines.map((line, i) => (
          <LyricLineEl
            key={i}
            index={i}
            text={line.text}
            words={lyrics.synced === 'word' ? line.words : undefined}
            translation={showTranslation ? (lyrics.translation?.[i] ?? null) : null}
            fontSize={fontSize}
            active={i === activeLine}
            passed={i < activeLine}
            wordCursor={i === activeLine ? wordCursor : 0}
            accent={accent}
            onClick={() => seek(line.t + 0.01)}
          />
        ))}
        <div className="h-[40%]" />
      </div>
    </div>
  )
}

function LyricsEmpty({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-white/45">
      <IconMusicNote className="h-10 w-10 opacity-60" />
      <div className="text-sm">{loading ? '正在查找歌词…' : '暂无歌词'}</div>
      <div className="max-w-60 text-center text-xs leading-relaxed opacity-70">
        {loading ? '正在从网络获取…' : '这首歌暂时没有找到歌词，试试换一首'}
      </div>
    </div>
  )
}

const LyricLineEl = memo(function LyricLineEl({
  index,
  text,
  words,
  translation,
  fontSize,
  active,
  passed,
  wordCursor,
  accent,
  onClick,
}: {
  index: number
  text: string
  words?: Array<{ t: number; d: number; text: string }>
  translation?: string | null
  fontSize: number
  active: boolean
  passed: boolean
  wordCursor: number
  accent: string
  onClick: () => void
}) {
  return (
    <div
      data-line={index}
      data-active={active || undefined}
      data-passed={passed || undefined}
      className="lyric-line py-2.5 font-bold leading-snug tracking-tight text-white"
      style={{ fontSize }}
      onClick={onClick}
    >
      {active && words ? (
        words.map((w, wi) => (
          <span
            key={wi}
            className="lyric-word"
            style={{
              color: wordCursor >= w.t ? accent : 'rgba(255,255,255,0.92)',
            }}
          >
            {w.text}
          </span>
        ))
      ) : (
        <span>{text}</span>
      )}
      {translation ? (
        <div
          className={cx(
            'mt-0.5 font-medium leading-snug text-white/55',
            active && 'text-white/75',
          )}
          style={{ fontSize: Math.round(fontSize * 0.62) }}
        >
          {translation}
        </div>
      ) : null}
    </div>
  )
})
