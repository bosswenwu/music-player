import { useEffect, useState, type ReactNode } from 'react'
import { cx } from '../lib/utils'
import { confirmDialog, promptInput } from '../lib/dialog'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'
import { useLibrary, useUserData } from '../state/LibraryContext'
import { useNav } from '../state/NavContext'
import { PlaylistArtwork } from './PlaylistArtwork'
import type { View } from '../types'
import {
  IconAlbum,
  IconClock,
  IconFolder,
  IconHeart,
  IconHome,
  IconMic,
  IconMoon,
  IconMusicNote,
  IconPlus,
  IconSearch,
  IconSun,
  IconTrash,
  IconTrendingUp,
  IconWaveform,
} from './Icons'

export function Sidebar() {
  const { songById, openMusicFolder, libraryLoading, songs, duplicateGroups } = useLibrary()
  const { playlists, createPlaylist, deletePlaylist } = useUserData()
  const { view, navigate, navigateRoot, back } = useNav()
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const onSearch = (q: string) => {
    setQuery(q)
    if (q.trim()) navigate({ type: 'search', query: q.trim() })
    else if (view.type === 'search') back()
  }

  return (
    <aside className="flex w-65 shrink-0 flex-col border-r border-border bg-sidebar backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#fb5c74] to-[#fa233b] shadow-md shadow-[#fa233b]/30">
          <IconMusicNote className="h-4 w-4 text-white" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">音乐</span>
        <button
          className="ml-auto cursor-pointer rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label="切换主题"
          title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        >
          {theme === 'dark' ? <IconSun className="h-4.5 w-4.5" /> : <IconMoon className="h-4.5 w-4.5" />}
        </button>
      </div>

      <div className="px-4 pb-2">
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent/15 py-1.5 text-[13px] font-medium text-accent transition hover:bg-accent/25 disabled:opacity-60"
          disabled={libraryLoading}
          onClick={() => void openMusicFolder()}
        >
          <IconFolder className="h-4 w-4" />
          {libraryLoading ? '正在读取…' : songs.length ? '换一个文件夹' : '打开音乐文件夹'}
        </button>
      </div>

      {/* 搜索 */}
      <div className="px-4 pb-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => query.trim() && navigate({ type: 'search', query: query.trim() })}
            placeholder="搜索"
            className="w-full rounded-lg bg-surface py-1.5 pl-8.5 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none ring-accent/60 transition focus:bg-surface-2 focus:ring-2"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavItem view={view} target={{ type: 'home' }} navigate={navigateRoot} icon={<IconHome className="h-4.5 w-4.5" />}>
          听一听
        </NavItem>

        <SectionTitle>资料库</SectionTitle>
        <NavItem view={view} target={{ type: 'recent' }} navigate={navigateRoot} icon={<IconClock className="h-4.5 w-4.5" />}>
          最近播放
        </NavItem>
        <NavItem view={view} target={{ type: 'top' }} navigate={navigateRoot} icon={<IconTrendingUp className="h-4.5 w-4.5" />}>
          常听
        </NavItem>
        <NavItem view={view} target={{ type: 'songs' }} navigate={navigateRoot} icon={<IconMusicNote className="h-4.5 w-4.5" />}>
          歌曲
        </NavItem>
        <NavItem view={view} target={{ type: 'quality' }} navigate={navigateRoot} icon={<IconWaveform className="h-4.5 w-4.5" />}>
          音质
        </NavItem>
        {duplicateGroups.length > 0 && (
          <NavItem
            view={view}
            target={{ type: 'duplicates' }}
            navigate={navigateRoot}
            icon={<IconAlbum className="h-4.5 w-4.5" />}
          >
            <span className="flex-1">重复歌曲</span>
            <span className="rounded-full bg-accent/15 px-1.5 text-[10.5px] font-semibold text-accent">
              {duplicateGroups.length}
            </span>
          </NavItem>
        )}
        <NavItem view={view} target={{ type: 'artists' }} navigate={navigateRoot} icon={<IconMic className="h-4.5 w-4.5" />}>
          艺人
        </NavItem>
        <NavItem view={view} target={{ type: 'albums' }} navigate={navigateRoot} icon={<IconAlbum className="h-4.5 w-4.5" />}>
          专辑
        </NavItem>
        <NavItem view={view} target={{ type: 'favorites' }} navigate={navigateRoot} icon={<IconHeart className="h-4.5 w-4.5" />}>
          已喜欢的音乐
        </NavItem>

        <SectionTitle
          action={
            <button
              className="cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
              onClick={() => {
                void (async () => {
                  const name = await promptInput('新播放列表名称', '我的播放列表')
                  if (name?.trim()) {
                    const p = createPlaylist(name.trim())
                    navigateRoot({ type: 'playlist', id: p.id })
                  }
                })()
              }}
              aria-label="新建播放列表"
            >
              <IconPlus className="h-4 w-4" />
            </button>
          }
        >
          播放列表
        </SectionTitle>
        {playlists.length === 0 && (
          <div className="px-3 py-1 text-xs text-text-tertiary">点按 + 新建播放列表</div>
        )}
        {playlists.map((p) => {
          const covers = p.songIds.slice(0, 4).map((id) => songById.get(id)?.cover ?? null)
          return (
            <div key={p.id} className="group/pl relative">
              <NavItem
                view={view}
                target={{ type: 'playlist', id: p.id }}
                navigate={navigateRoot}
                icon={
                  <PlaylistArtwork
                    covers={covers}
                    seed={p.name}
                    className="h-4.5 w-4.5 shrink-0"
                    rounded="rounded-[4px]"
                  />
                }
              >
                <span className="truncate">{p.name}</span>
              </NavItem>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover/pl:opacity-100"
                onClick={() => {
                  void (async () => {
                    if (await confirmDialog(`删除播放列表"${p.name}"？`)) deletePlaylist(p.id)
                  })()
                }}
                aria-label="删除播放列表"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-5 mb-1 flex items-center justify-between px-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
        {children}
      </span>
      {action}
    </div>
  )
}

function NavItem({
  view,
  target,
  navigate,
  icon,
  children,
}: {
  view: View
  target: View
  navigate: (v: View) => void
  icon: ReactNode
  children: ReactNode
}) {
  const active =
    view.type === target.type &&
    (target.type !== 'playlist' || (view.type === 'playlist' && view.id === target.id))
  return (
    <button
      className={cx(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-[7px] text-left text-[13.5px] font-medium transition-colors',
        active ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'text-text-primary/85 hover:bg-surface-2',
      )}
      onClick={() => navigate(target)}
    >
      <span className={active ? 'text-white' : 'text-accent'}>{icon}</span>
      {children}
    </button>
  )
}
