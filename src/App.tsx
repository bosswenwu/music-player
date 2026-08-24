import { useEffect, useRef, useState } from 'react'
import { LibraryProvider } from './state/LibraryContext'
import { PlayerProvider, usePlayer } from './state/PlayerContext'
import { NavProvider, useNav } from './state/NavContext'
import { Sidebar } from './components/Sidebar'
import { PlayerBar } from './components/PlayerBar'
import { QueuePanel } from './components/QueuePanel'
import { NowPlaying } from './components/NowPlaying'
import { IconChevronLeft } from './components/Icons'
import { HomeView } from './views/HomeView'
import { SongsView } from './views/SongsView'
import { ArtistsView, ArtistDetail } from './views/ArtistsView'
import { AlbumsView, AlbumDetail } from './views/AlbumsView'
import { SearchView } from './views/SearchView'
import { RecentView, FavoritesView, PlaylistView } from './views/ListViews'

export default function App() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <NavProvider>
          <Shell />
        </NavProvider>
      </PlayerProvider>
    </LibraryProvider>
  )
}

function Shell() {
  const { view, canBack, back } = useNav()
  const { toggle, next, prev, setVolume, seek, getTime } = usePlayer()
  const { volume, current } = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // 切换视图时回到顶部
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [view])

  // 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          toggle()
          break
        case 'ArrowRight':
          if (e.metaKey || e.ctrlKey) next()
          else seek(getTime() + 5)
          break
        case 'ArrowLeft':
          if (e.metaKey || e.ctrlKey) prev()
          else seek(Math.max(0, getTime() - 5))
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(volume - 0.05)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, next, prev, setVolume, seek, getTime, volume])

  // 标题栏显示当前歌曲
  useEffect(() => {
    document.title = current ? `${current.title} — ${current.artist}` : '音乐'
  }, [current])

  return (
    <div className="flex h-full flex-col bg-bg text-text-primary">
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />

        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto px-8 pt-6 pb-10">
          {canBack && view.type !== 'artist' && view.type !== 'album' && (
            <button
              className="mb-4 flex cursor-pointer items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              onClick={back}
            >
              <IconChevronLeft className="h-4 w-4" />
              返回
            </button>
          )}
          <ViewSwitch mainRef={mainRef} />
        </main>

        {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
        {nowPlayingOpen && current && <NowPlaying onClose={() => setNowPlayingOpen(false)} />}
      </div>

      <PlayerBar
        onOpenNowPlaying={() => setNowPlayingOpen(true)}
        onToggleQueue={() => setQueueOpen((v) => !v)}
        queueOpen={queueOpen}
      />
    </div>
  )
}

function ViewSwitch({ mainRef }: { mainRef: React.RefObject<HTMLElement | null> }) {
  const { view } = useNav()

  switch (view.type) {
    case 'home':
      return <HomeView />
    case 'songs':
      return <SongsView scrollRef={mainRef} />
    case 'artists':
      return <ArtistsView />
    case 'albums':
      return <AlbumsView />
    case 'recent':
      return <RecentView scrollRef={mainRef} />
    case 'favorites':
      return <FavoritesView scrollRef={mainRef} />
    case 'search':
      return <SearchView query={view.query} scrollRef={mainRef} />
    case 'artist':
      return <ArtistDetail name={view.name} scrollRef={mainRef} />
    case 'album':
      return <AlbumDetail albumKey={view.key} scrollRef={mainRef} />
    case 'playlist':
      return <PlaylistView id={view.id} scrollRef={mainRef} />
  }
}
