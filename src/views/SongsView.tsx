import { useMemo, useState, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { PageHeader } from './shared'
import { cx, formatTotalDuration } from '../lib/utils'
import type { Song } from '../types'

type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'added'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'title', label: '标题' },
  { key: 'artist', label: '艺人' },
  { key: 'album', label: '专辑' },
  { key: 'added', label: '最近添加' },
  { key: 'duration', label: '时长' },
]

export function SongsView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { songs } = useLibrary()
  const { playQueue } = usePlayer()
  const [sort, setSort] = useState<SortKey>('title')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const arr = [...songs]
    const cmp: Record<SortKey, (a: Song, b: Song) => number> = {
      title: (a, b) => a.title.localeCompare(b.title, 'zh-CN'),
      artist: (a, b) => a.artist.localeCompare(b.artist, 'zh-CN') || a.title.localeCompare(b.title, 'zh-CN'),
      album: (a, b) => (a.album || '～').localeCompare(b.album || '～', 'zh-CN'),
      duration: (a, b) => a.duration - b.duration,
      added: (a, b) => b.addedAt - a.addedAt,
    }
    arr.sort(cmp[sort])
    if (!asc) arr.reverse()
    return arr
  }, [songs, sort, asc])

  const totalSec = useMemo(() => songs.reduce((acc, s) => acc + s.duration, 0), [songs])

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="歌曲"
        subtitle={`${songs.length} 首歌曲 · ${formatTotalDuration(totalSec)}`}
        onPlay={() => playQueue(sorted, 0, false)}
        onShuffle={() => playQueue(sorted, Math.floor(Math.random() * sorted.length), true)}
      />

      <div className="mb-3 flex items-center gap-1.5">
        {SORTS.map(({ key, label }) => (
          <button
            key={key}
            className={cx(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              sort === key
                ? 'bg-accent text-white'
                : 'bg-white/8 text-text-secondary hover:bg-white/14 hover:text-text-primary',
            )}
            onClick={() => {
              if (sort === key) setAsc((v) => !v)
              else {
                setSort(key)
                setAsc(key !== 'added')
              }
            }}
          >
            {label}
            {sort === key && <span className="ml-1">{asc ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      <SongTable songs={sorted} scrollRef={scrollRef} />
    </div>
  )
}
