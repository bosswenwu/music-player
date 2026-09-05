import { useMemo, useState, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { PageHeader } from './shared'
import { cx, qualityTier } from '../lib/utils'

type Filter = 'all' | 'lossless' | 'high' | 'mid' | 'low' | 'unknown'

const FILTERS: Array<{ key: Filter; label: string; hint: string }> = [
  { key: 'low', label: '低码率', hint: '<128kbps，建议换无损' },
  { key: 'mid', label: '中码率', hint: '128–256kbps' },
  { key: 'high', label: '高码率', hint: '≥256kbps' },
  { key: 'lossless', label: '无损', hint: 'FLAC/WAV/ALAC' },
  { key: 'unknown', label: '未知', hint: '未读取到音质信息' },
  { key: 'all', label: '全部', hint: '' },
]

/** 音质：按无损/码率分档浏览，重点找出低码率有损文件（换无损音源的清单） */
export function QualityView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { songs } = useLibrary()
  const { playQueue } = usePlayer()
  const [filter, setFilter] = useState<Filter>('low')

  const stats = useMemo(() => {
    const c = { lossless: 0, high: 0, mid: 0, low: 0, unknown: 0 }
    for (const s of songs) {
      const tier = qualityTier(s.quality)
      c[tier ?? 'unknown']++
    }
    return c
  }, [songs])

  const filtered = useMemo(() => {
    if (filter === 'all') return songs
    return songs.filter((s) => {
      const tier = qualityTier(s.quality)
      return filter === 'unknown' ? tier === null : tier === filter
    })
  }, [songs, filter])

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="音质"
        subtitle={`无损 ${stats.lossless} · 高码率 ${stats.high} · 中码率 ${stats.mid} · 低码率 ${stats.low} · 未知 ${stats.unknown}`}
        onPlay={filtered.length ? () => playQueue(filtered, 0, false) : undefined}
        onShuffle={
          filtered.length
            ? () => playQueue(filtered, Math.floor(Math.random() * filtered.length), true)
            : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map(({ key, label, hint }) => (
          <button
            key={key}
            className={cx(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              filter === key
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
            onClick={() => setFilter(key)}
            title={hint || label}
          >
            {label}
            {key !== 'all' && key !== 'unknown' && (
              <span className="ml-1 opacity-70">{stats[key]}</span>
            )}
          </button>
        ))}
      </div>

      <SongTable songs={filtered} scrollRef={scrollRef} />
    </div>
  )
}
