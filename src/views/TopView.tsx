import { useMemo, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { PageHeader, EmptyState } from './shared'
import { IconTrendingUp } from '../components/Icons'

/** 常听：按累计播放次数排序（Apple Music Replay / Spotify On Repeat 风格） */
export function TopView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { topSongs, playCounts } = useLibrary()
  const { playQueue } = usePlayer()

  const totalPlays = useMemo(
    () => topSongs.reduce((acc, s) => acc + (playCounts[s.id] ?? 0), 0),
    [topSongs, playCounts],
  )

  if (!topSongs.length) {
    return (
      <EmptyState
        icon={<IconTrendingUp />}
        title="还没有常听歌曲"
        hint="多播放几首歌，这里会按播放次数为你排行"
      />
    )
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="常听"
        subtitle={`${topSongs.length} 首 · 累计播放 ${totalPlays} 次`}
        onPlay={() => playQueue(topSongs, 0, false)}
        onShuffle={() => playQueue(topSongs, Math.floor(Math.random() * topSongs.length), true)}
      />
      <SongTable songs={topSongs} scrollRef={scrollRef} />
    </div>
  )
}
