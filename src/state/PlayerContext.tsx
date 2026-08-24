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
import type { RepeatMode, Song } from '../types'
import { audioUrl, loadLocal, saveLocal, shuffleArray } from '../lib/utils'
import { useLibrary } from './LibraryContext'

interface PlayerContextValue {
  queue: Song[]
  index: number
  current: Song | null
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  volume: number

  playQueue: (songs: Song[], startIndex?: number, forceShuffle?: boolean) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playNext: (song: Song) => void
  addToQueue: (song: Song) => void
  removeFromQueue: (i: number) => void
  jumpTo: (i: number) => void
  /** 读取精确播放位置（歌词逐字高亮用，不触发渲染） */
  getTime: () => number
}

interface PlayerTimeValue {
  currentTime: number
  duration: number
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
const PlayerTimeContext = createContext<PlayerTimeValue>({ currentTime: 0, duration: 0 })

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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

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
          notePlayed(current.id)
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
    const onPlay = () => setIsPlaying(true)
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
  useEffect(() => {
    audio.volume = volume
  }, [audio, volume])

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
  }, [])

  const removeFromQueue = useCallback((i: number) => {
    const { queue, index } = stateRef.current
    if (i === index) return
    setQueue(queue.filter((_, j) => j !== i))
    if (i < index) setIndex(index - 1)
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

  // 歌曲切换时记录播放历史（自动播放场景）
  useEffect(() => {
    if (current && isPlaying) notePlayed(current.id)
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
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      playNext,
      addToQueue,
      removeFromQueue,
      jumpTo,
      getTime,
    }),
    [
      queue, index, current, isPlaying, shuffle, repeat, volume,
      playQueue, toggle, next, prev, seek, setVolume, toggleShuffle,
      cycleRepeat, playNext, addToQueue, removeFromQueue, jumpTo, getTime,
    ],
  )

  const timeValue = useMemo(() => ({ currentTime, duration }), [currentTime, duration])

  return (
    <PlayerContext value={value}>
      <PlayerTimeContext value={timeValue}>{children}</PlayerTimeContext>
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
