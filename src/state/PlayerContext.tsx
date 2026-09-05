/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Lyrics, RepeatMode, Song } from '../types'
import { audioUrl, loadLocal, saveLocal, shuffleArray } from '../lib/utils'
import { fetchOnlineLyricsFor } from '../lib/onlineLyrics'
import { useLibrary } from './LibraryContext'

interface PlayerContextValue {
  queue: Song[]
  index: number
  current: Song | null
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  /** 播放速度倍率 */
  rate: number
  /** 均衡器预设名（'off' 为关闭） */
  eq: string

  playQueue: (songs: Song[], startIndex?: number, forceShuffle?: boolean) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  setRate: (r: number) => void
  setEq: (preset: string) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playNext: (song: Song) => void
  addToQueue: (song: Song) => void
  removeFromQueue: (i: number) => void
  moveInQueue: (from: number, to: number) => void
  clearQueue: () => void
  jumpTo: (i: number) => void
  /** 读取精确播放位置（歌词逐字高亮用，不触发渲染） */
  getTime: () => number
}

/** 均衡器预设（7 段：60/150/400/1k/2.4k/6k/15k Hz，单位 dB） */
export const EQ_PRESETS: Array<{ name: string; gains: number[] }> = [
  { name: '平直', gains: [0, 0, 0, 0, 0, 0, 0] },
  { name: '流行', gains: [-1, 2, 3, 1, -1, -1, 0] },
  { name: '摇滚', gains: [4, 2, -1, -1, 1, 3, 4] },
  { name: '古典', gains: [3, 1, 0, 1, 2, 1, 3] },
  { name: '爵士', gains: [3, 1, -1, -2, 1, 2, 3] },
  { name: '人声', gains: [-2, -1, 1, 4, 3, 2, 1] },
  { name: '低音增强', gains: [5, 4, 2, 0, 0, 0, 0] },
  { name: '高音增强', gains: [0, 0, 0, 1, 3, 5, 6] },
]
const EQ_BANDS = [60, 150, 400, 1000, 2400, 6000, 15000]

interface PlayerTimeValue {
  currentTime: number
  duration: number
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
const PlayerTimeContext = createContext<PlayerTimeValue>({ currentTime: 0, duration: 0 })

/** 歌词同步状态（迷你悬浮窗 + NowPlaying 共用，常驻于 PlayerProvider） */
export interface LyricSyncValue {
  lyrics: Lyrics | null
  source: 'local' | 'online' | null
  loading: boolean
  activeLine: number
}
const LyricSyncContext = createContext<LyricSyncValue>({
  lyrics: null,
  source: null,
  loading: false,
  activeLine: -1,
})

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { songById, notePlayed } = useLibrary()

  const [audio] = useState(() => {
    const a = new Audio()
    a.preload = 'metadata'
    return a
  })

  const [queue, setQueue] = useState<Song[]>([])
  const originalQueueRef = useRef<Song[]>([])
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffle, setShuffle] = useState<boolean>(() => loadLocal('mp.shuffle', false))
  const [repeat, setRepeat] = useState<RepeatMode>(() => loadLocal('mp.repeat', 'off' as RepeatMode))
  const [volume, setVolumeState] = useState<number>(() => loadLocal('mp.volume', 0.8))
  const [rate, setRateState] = useState<number>(() => loadLocal('mp.rate', 1))
  const [eq, setEqState] = useState<string>(() => loadLocal('mp.eq', '平直'))
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // 歌词同步（常驻：不依赖 NowPlaying 是否打开）
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [lyricSource, setLyricSource] = useState<'local' | 'online' | null>(null)
  const [lyricLoading, setLyricLoading] = useState(false)
  const [activeLine, setActiveLine] = useState(-1)

  // 均衡器 Web Audio 图（懒创建）
  const eqGraphRef = useRef<{
    ctx: AudioContext
    filters: BiquadFilterNode[]
    gain: GainNode
  } | null>(null)

  const current = queue[index] ?? null

  // refs 供事件回调读取最新状态
  const stateRef = useRef({ queue, index, repeat, isPlaying })
  stateRef.current = { queue, index, repeat, isPlaying }
  const autoplayRef = useRef(false)
  const errorCountRef = useRef(0)
  const restoredRef = useRef(false)

  // ---------- 装载与播放当前歌曲 ----------
  const currentId = current?.id ?? null
  useEffect(() => {
    if (!current) {
      audio.removeAttribute('src')
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }
    audio.src = audioUrl(current)
    setCurrentTime(0)
    setDuration(current.duration || 0)
    if (autoplayRef.current) {
      audio.play().then(
        () => {
          errorCountRef.current = 0
        },
        () => setIsPlaying(false),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // ---------- 音频事件 ----------
  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => {
      setIsPlaying(true)
      // 浏览器可能在无交互时自动挂起 AudioContext，恢复播放时一并唤醒，避免 EQ 路由后静音
      const g = eqGraphRef.current
      if (g && g.ctx.state === 'suspended') void g.ctx.resume()
    }
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      const { queue, index, repeat } = stateRef.current
      if (repeat === 'one') {
        audio.currentTime = 0
        void audio.play()
        return
      }
      if (index + 1 < queue.length) {
        autoplayRef.current = true
        setIndex(index + 1)
      } else if (repeat === 'all' && queue.length > 0) {
        autoplayRef.current = true
        setIndex(0)
      } else {
        setIsPlaying(false)
      }
    }
    const onError = () => {
      // 文件损坏时自动跳下一首，连续失败 5 次则停止
      if (!stateRef.current.isPlaying && !autoplayRef.current) return
      errorCountRef.current++
      if (errorCountRef.current > 5) {
        setIsPlaying(false)
        return
      }
      const { queue, index } = stateRef.current
      if (index + 1 < queue.length) {
        autoplayRef.current = true
        setIndex(index + 1)
      } else {
        setIsPlaying(false)
      }
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [audio])

  // ---------- 音量 ----------
  // 有 EQ 图时音量统一由 gain 节点控制；否则直接设 audio.volume（避免双重衰减）
  useEffect(() => {
    if (eqGraphRef.current) {
      eqGraphRef.current.gain.gain.value = volume
    } else {
      audio.volume = volume
    }
  }, [audio, volume])

  // ---------- 均衡器 ----------
  const ensureEqGraph = useCallback(() => {
    if (eqGraphRef.current) return eqGraphRef.current
    const ctx = new AudioContext()
    const source = ctx.createMediaElementSource(audio)
    const filters = EQ_BANDS.map((freq) => {
      const f = ctx.createBiquadFilter()
      f.type = 'peaking'
      f.frequency.value = freq
      f.Q.value = 1
      f.gain.value = 0
      return f
    })
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(filters[0])
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1])
    filters[filters.length - 1].connect(gain)
    gain.connect(ctx.destination)
    eqGraphRef.current = { ctx, filters, gain }
    // 路由到 Web Audio 图后，音量统一由 gain 节点控制，audio.volume 固定为 1 避免双重衰减
    audio.volume = 1
    return eqGraphRef.current
  }, [audio, volume])

  const setEq = useCallback(
    (preset: string) => {
      setEqState(preset)
      saveLocal('mp.eq', preset)
      const g = ensureEqGraph()
      const gains = EQ_PRESETS.find((p) => p.name === preset)?.gains ?? EQ_PRESETS[0].gains
      g.filters.forEach((f, i) => {
        f.gain.setTargetAtTime(gains[i] ?? 0, g.ctx.currentTime, 0.05)
      })
      if (g.ctx.state === 'suspended') void g.ctx.resume()
    },
    [ensureEqGraph],
  )

  // ---------- 播放速度 ----------
  useEffect(() => {
    audio.playbackRate = rate
  }, [audio, rate])

  const setRate = useCallback((r: number) => {
    const clamped = Math.min(2, Math.max(0.5, r))
    setRateState(clamped)
    saveLocal('mp.rate', clamped)
  }, [])

  // ---------- 恢复上次会话 ----------
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const saved = loadLocal<{ ids: string[]; index: number } | null>('mp.session', null)
    if (saved?.ids?.length) {
      const restored = saved.ids
        .map((id) => songById.get(id))
        .filter((s): s is Song => Boolean(s))
      if (restored.length) {
        autoplayRef.current = false
        originalQueueRef.current = restored
        setQueue(restored)
        setIndex(Math.min(Math.max(saved.index, 0), restored.length - 1))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 会话持久化 ----------
  useEffect(() => {
    if (queue.length) saveLocal('mp.session', { ids: queue.map((s) => s.id), index })
  }, [queue, index])

  // ---------- 操作 ----------
  const playQueue = useCallback(
    (songs: Song[], startIndex = 0, forceShuffle?: boolean) => {
      if (!songs.length) return
      const useShuffle = forceShuffle ?? shuffle
      if (forceShuffle !== undefined) {
        setShuffle(forceShuffle)
        saveLocal('mp.shuffle', forceShuffle)
      }
      originalQueueRef.current = songs
      autoplayRef.current = true
      errorCountRef.current = 0
      if (useShuffle) {
        const start = songs[startIndex]
        const rest = shuffleArray(songs.filter((_, i) => i !== startIndex))
        setQueue([start, ...rest])
        setIndex(0)
      } else {
        setQueue(songs)
        setIndex(startIndex)
      }
    },
    [shuffle],
  )

  const toggle = useCallback(() => {
    if (!stateRef.current.queue.length) return
    if (audio.paused) {
      autoplayRef.current = true
      void audio.play()
    } else {
      audio.pause()
    }
  }, [audio])

  const next = useCallback(() => {
    const { queue, index, repeat } = stateRef.current
    if (!queue.length) return
    autoplayRef.current = true
    if (index + 1 < queue.length) setIndex(index + 1)
    else if (repeat !== 'off') setIndex(0)
    else {
      audio.currentTime = 0
      audio.pause()
    }
  }, [audio])

  const prev = useCallback(() => {
    const { queue, index } = stateRef.current
    if (!queue.length) return
    // Apple Music 行为：超过 3 秒时回到歌曲开头
    if (audio.currentTime > 3 || index === 0) {
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }
    autoplayRef.current = true
    setIndex(index - 1)
  }, [audio])

  const seek = useCallback(
    (t: number) => {
      audio.currentTime = t
      setCurrentTime(t)
    },
    [audio],
  )

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    setVolumeState(clamped)
    saveLocal('mp.volume', clamped)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev
      saveLocal('mp.shuffle', next)
      const { queue, index } = stateRef.current
      const cur = queue[index]
      if (cur) {
        if (next) {
          const rest = shuffleArray(queue.filter((_, i) => i !== index))
          setQueue([cur, ...rest])
          setIndex(0)
        } else {
          const original = originalQueueRef.current
          const pos = original.findIndex((s) => s.id === cur.id)
          if (pos >= 0) {
            setQueue(original)
            setIndex(pos)
          }
        }
      }
      return next
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
      saveLocal('mp.repeat', next)
      return next
    })
  }, [])

  const playNext = useCallback((song: Song) => {
    const { queue, index } = stateRef.current
    if (!queue.length) {
      originalQueueRef.current = [song]
      autoplayRef.current = true
      setQueue([song])
      setIndex(0)
      return
    }
    setQueue([...queue.slice(0, index + 1), song, ...queue.slice(index + 1)])
    // 同步原始队列：把 song 插到当前歌曲之后
    const orig = originalQueueRef.current
    const cur = queue[index]
    const pos = cur ? orig.findIndex((s) => s.id === cur.id) : -1
    if (pos >= 0) {
      originalQueueRef.current = [...orig.slice(0, pos + 1), song, ...orig.slice(pos + 1)]
    } else {
      originalQueueRef.current = [...orig, song]
    }
  }, [])

  const addToQueue = useCallback((song: Song) => {
    const { queue } = stateRef.current
    if (!queue.length) {
      originalQueueRef.current = [song]
      autoplayRef.current = true
      setQueue([song])
      setIndex(0)
      return
    }
    setQueue([...queue, song])
    originalQueueRef.current = [...originalQueueRef.current, song]
  }, [])

  const removeFromQueue = useCallback((i: number) => {
    const { queue, index } = stateRef.current
    if (i === index) return
    const removed = queue[i]
    setQueue(queue.filter((_, j) => j !== i))
    if (removed) {
      originalQueueRef.current = originalQueueRef.current.filter((s) => s.id !== removed.id)
    }
    if (i < index) setIndex(index - 1)
  }, [])

  /** 拖拽重排队列，同时保持当前播放索引指向同一首歌 */
  const moveInQueue = useCallback((from: number, to: number) => {
    const { queue, index } = stateRef.current
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    const next = [...queue]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setQueue(next)
    // 同步原始队列：按歌曲 id 重排（shuffle 关闭时 index 即原始序）
    const orig = originalQueueRef.current
    const fromIdx = orig.findIndex((s) => s.id === item.id)
    if (fromIdx >= 0) {
      const reordered = [...orig]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(to, 0, moved)
      originalQueueRef.current = reordered
    }
    let newIndex = index
    if (from === index) newIndex = to
    else if (from < index && to >= index) newIndex = index - 1
    else if (from > index && to <= index) newIndex = index + 1
    setIndex(newIndex)
  }, [])

  /** 清空队列（保留正在播放的一首） */
  const clearQueue = useCallback(() => {
    const { queue, index } = stateRef.current
    if (index < 0 || index >= queue.length) {
      setQueue([])
      setIndex(-1)
      originalQueueRef.current = []
      return
    }
    setQueue([queue[index]])
    setIndex(0)
    // 同步原始队列，避免之后切换 shuffle 时恢复已清空的歌
    originalQueueRef.current = [queue[index]]
  }, [])

  const jumpTo = useCallback((i: number) => {
    const { queue } = stateRef.current
    if (i < 0 || i >= queue.length) return
    autoplayRef.current = true
    setIndex(i)
  }, [])

  const getTime = useCallback(() => audio.currentTime, [audio])

  // ---------- Media Session ----------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album || '本地曲库',
        artwork: current.cover
          ? [{ src: current.cover, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      })
    }
  }, [current])

  // ---------- 托盘 / 全局媒体键 ----------
  useEffect(() => {
    const desktop = window.musicDesktop
    if (!desktop?.onMediaCommand) return
    return desktop.onMediaCommand((cmd) => {
      if (cmd === 'toggle') toggle()
      else if (cmd === 'next') next()
      else if (cmd === 'prev') prev()
    })
  }, [toggle, next, prev])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.setActionHandler('play', toggle)
    ms.setActionHandler('pause', toggle)
    ms.setActionHandler('nexttrack', next)
    ms.setActionHandler('previoustrack', prev)
    ms.setActionHandler('seekto', (e) => {
      if (e.seekTime != null) seek(e.seekTime)
    })
    return () => {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
      ms.setActionHandler('nexttrack', null)
      ms.setActionHandler('previoustrack', null)
      ms.setActionHandler('seekto', null)
    }
  }, [toggle, next, prev, seek])

  // ---------- 歌词同步（迷你悬浮窗 + NowPlaying 共用，常驻） ----------
  useEffect(() => {
    let alive = true
    setLyrics(null)
    setLyricSource(null)
    setLyricLoading(false)
    setActiveLine(-1)
    if (!current) return
    const load = async () => {
      // 1. 本地（随应用打包 / 扫描生成）
      if (current.hasLyrics) {
        try {
          const r = await fetch(`/lyrics/${current.id}.json`)
          if (r.ok) {
            const data = (await r.json()) as Lyrics
            if (alive && data?.lines?.length) {
              setLyrics(data)
              setLyricSource('local')
              return
            }
          }
        } catch {
          /* 走在线兜底 */
        }
      }
      // 2. 在线兜底
      setLyricLoading(true)
      try {
        const data = await fetchOnlineLyricsFor(current)
        if (alive && data?.lines?.length) {
          setLyrics(data)
          setLyricSource('online')
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setLyricLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // rAF 驱动的当前行索引（行变化才触发渲染，不扩散高频渲染）
  useEffect(() => {
    if (!lyrics) return
    let raf = 0
    const tick = () => {
      const t = audio.currentTime
      const lines = lyrics.lines
      let idx = -1
      for (let i = 0; i < lines.length; i++) {
        if (t >= lines[i].t - 0.15) idx = i
        else break
      }
      setActiveLine((prev) => (prev === idx ? prev : idx))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lyrics, audio])

  // 推送到迷你歌词悬浮窗（不依赖 NowPlaying 是否打开）
  useEffect(() => {
    if (!current || !lyrics || activeLine < 0) return
    window.musicDesktop?.lyricFloatUpdate({
      title: current.title,
      artist: current.artist,
      lines: lyrics.lines.map((l) => l.text),
      active: activeLine,
      translation: lyrics.translation ?? [],
    })
  }, [current, lyrics, activeLine])

  // 歌曲切换进入播放态时记录一次播放（暂停/恢复不重复计数）
  const lastCountedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (current && isPlaying && current.id !== lastCountedIdRef.current) {
      lastCountedIdRef.current = current.id
      notePlayed(current.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, isPlaying])

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      shuffle,
      repeat,
      volume,
      rate,
      eq,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setRate,
      setEq,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      removeFromQueue,
      moveInQueue,
      clearQueue,
      jumpTo,
      getTime,
    }),
    [
      queue, index, current, isPlaying, shuffle, repeat, volume, rate, eq,
      playQueue, toggle, next, prev, seek, setVolume, setRate, setEq, toggleShuffle,
      cycleRepeat, playNext, addToQueue, removeFromQueue, moveInQueue, clearQueue, jumpTo, getTime,
    ],
  )

  const timeValue = useMemo(() => ({ currentTime, duration }), [currentTime, duration])

  const lyricSyncValue = useMemo<LyricSyncValue>(
    () => ({ lyrics, source: lyricSource, loading: lyricLoading, activeLine }),
    [lyrics, lyricSource, lyricLoading, activeLine],
  )

  return (
    <PlayerContext value={value}>
      <PlayerTimeContext value={timeValue}>
        <LyricSyncContext value={lyricSyncValue}>{children}</LyricSyncContext>
      </PlayerTimeContext>
    </PlayerContext>
  )
}

export function usePlayer(): PlayerContextValue {
  const ctx = use(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}

/** 单独订阅播放进度，避免高频重渲染扩散到列表视图 */
export function usePlayerTime(): PlayerTimeValue {
  return use(PlayerTimeContext)
}

/** 订阅歌词同步状态（迷你悬浮窗 + NowPlaying） */
export function useLyricSync(): LyricSyncValue {
  return use(LyricSyncContext)
}
