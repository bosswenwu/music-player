import { useMemo } from 'react'
import { useLibrary, useUserData } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useNav } from '../state/NavContext'
import { ArtistCard, Shelf, SongCard } from '../components/Cards'
import { Artwork } from '../components/Artwork'
import { IconFolder, IconPlay } from '../components/Icons'
import { artistLine, stringHash } from '../lib/utils'
import type { Song } from '../types'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

/** 以当天日期为种子的稳定乱序（每天推荐不同，但当天内一致） */
function daySeededShuffle<T>(arr: T[], salt: string): T[] {
  const day = new Date().toISOString().slice(0, 10)
  // 预计算排序键：每个元素只哈希一次，避免比较器里重复 stringHash + JSON.stringify
  return arr
    .map((item) => ({
      item,
      key: stringHash(day + salt + JSON.stringify((item as { id?: string }).id ?? item)) % 1000,
    }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}

export function HomeView() {
  const { songs, songById, artists, recentlyAdded, libraryLoading, libraryHint, openMusicFolder } = useLibrary()
  const { recents, topSongs } = useUserData()
  const { navigate } = useNav()

  const recentSongs = useMemo(
    () => recents.map((id) => songById.get(id)).filter((s): s is Song => Boolean(s)).slice(0, 12),
    [recents, songById],
  )

  const topArtists = useMemo(
    () =>
      daySeededShuffle(
        [...artists].sort((a, b) => b.songs.length - a.songs.length).slice(0, 24),
        'artists',
      ).slice(0, 12),
    [artists],
  )

  const dailyPicks = useMemo(() => daySeededShuffle(songs, 'picks').slice(0, 12), [songs])
  const rediscover = useMemo(() => daySeededShuffle(songs, 'redis').slice(12, 24), [songs])
  const newest = useMemo(() => recentlyAdded.slice(0, 12), [recentlyAdded])

  // 快捷宫格混排：最近播放 + 常听 + 今日精选，去重
  const mixQuick = useMemo(() => {
    const seen = new Set<string>()
    const out: Song[] = []
    for (const s of [...recentSongs, ...topSongs, ...dailyPicks]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
      if (out.length >= 6) break
    }
    return out
  }, [recentSongs, topSongs, dailyPicks])

  if (libraryLoading && songs.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center text-text-secondary">
        <p className="text-[15px]">正在读取你的音乐…</p>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fb5c74] to-[#fa233b] shadow-lg shadow-[#fa233b]/30">
          <IconFolder className="h-8 w-8 text-white" />
        </span>
        <h1 className="text-[28px] font-bold tracking-tight">打开你的音乐</h1>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
          选择电脑上的歌曲文件夹，马上就能播。文件不会上传，只在你这台电脑上播放。
        </p>
        <button
          className="mt-6 cursor-pointer rounded-xl bg-accent px-6 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-60"
          disabled={libraryLoading}
          onClick={() => void openMusicFolder()}
        >
          {libraryLoading ? '正在读取…' : '选择音乐文件夹'}
        </button>
        {libraryHint ? <p className="mt-3 text-[13px] text-text-tertiary">{libraryHint}</p> : null}
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="mb-6 text-[28px] font-bold tracking-tight">{greeting()}</h1>

      {/* 快捷入口宫格（Spotify 风格，混排最近/常听/精选） */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {mixQuick.map((song) => (
          <QuickTile key={song.id} song={song} queue={mixQuick} />
        ))}
      </div>

      {recentSongs.length > 0 && (
        <Shelf title="最近播放" onSeeAll={() => navigate({ type: 'recent' })}>
          {recentSongs.map((s) => (
            <SongCard key={s.id} song={s} queue={recentSongs} />
          ))}
        </Shelf>
      )}

      {topSongs.length > 0 && (
        <Shelf title="常听" subtitle="你最常播放的歌曲" onSeeAll={() => navigate({ type: 'top' })}>
          {topSongs.slice(0, 12).map((s) => (
            <SongCard key={s.id} song={s} queue={topSongs} />
          ))}
        </Shelf>
      )}

      <Shelf title="今日精选" subtitle="根据你的曲库每日更新">
        {dailyPicks.map((s) => (
          <SongCard key={s.id} song={s} queue={dailyPicks} />
        ))}
      </Shelf>

      <Shelf title="热门艺人" onSeeAll={() => navigate({ type: 'artists' })}>
        {topArtists.map((a) => (
          <ArtistCard key={a.name} artist={a} />
        ))}
      </Shelf>

      <Shelf title="重新发现" subtitle="从你的曲库中淘出的宝藏">
        {rediscover.map((s) => (
          <SongCard key={s.id} song={s} queue={rediscover} />
        ))}
      </Shelf>

      <Shelf title="最近添加">
        {newest.map((s) => (
          <SongCard key={s.id} song={s} queue={newest} />
        ))}
      </Shelf>

      <div className="pb-6 text-center text-xs text-text-tertiary">
        共 {songs.length} 首歌曲 · 本地曲库
      </div>
    </div>
  )
}

function QuickTile({ song, queue }: { song: Song; queue: Song[] }) {
  const { playQueue } = usePlayer()
  return (
    <button
      className="group flex cursor-pointer items-center gap-3 overflow-hidden rounded-lg bg-surface pr-3 text-left transition-colors hover:bg-surface-2"
      onClick={() => playQueue(queue, queue.findIndex((s) => s.id === song.id))}
    >
      <Artwork
        cover={song.cover}
        seed={`${song.artist}·${song.title}`}
        className="h-14 w-14 shrink-0"
        rounded="rounded-l-lg rounded-r-none"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{song.title}</span>
        <span className="block truncate text-xs text-text-secondary">{artistLine(song)}</span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        <IconPlay className="ml-0.5 h-4 w-4" />
      </span>
    </button>
  )
}
