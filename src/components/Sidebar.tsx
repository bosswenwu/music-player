import { useState, type ReactNode } from 'react'
import { cx } from '../lib/utils'
import { useLibrary } from '../state/LibraryContext'
import { useNav } from '../state/NavContext'
import type { View } from '../types'
import {
  IconAlbum,
  IconClock,
  IconHeart,
  IconHome,
  IconMic,
  IconMusicNote,
  IconPlaylist,
  IconPlus,
  IconSearch,
  IconTrash,
} from './Icons'

export function Sidebar() {
  const { playlists, createPlaylist, deletePlaylist } = useLibrary()
  const { view, navigate } = useNav()
  const [query, setQuery] = useState('')

  const onSearch = (q: string) => {
    setQuery(q)
    if (q.trim()) navigate({ type: 'search', query: q.trim() })
  }

  return (
    <aside className="flex w-65 shrink-0 flex-col border-r border-border bg-sidebar backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#fb5c74] to-[#fa233b] shadow-md shadow-[#fa233b]/30">
          <IconMusicNote className="h-4 w-4 text-white" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">音乐</span>
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
            className="w-full rounded-lg bg-white/8 py-1.5 pl-8.5 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none ring-accent/60 transition focus:bg-white/12 focus:ring-2"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavItem view={view} target={{ type: 'home' }} navigate={navigate} icon={<IconHome className="h-4.5 w-4.5" />}>
          听一听
        </NavItem>

        <SectionTitle>资料库</SectionTitle>
        <NavItem view={view} target={{ type: 'recent' }} navigate={navigate} icon={<IconClock className="h-4.5 w-4.5" />}>
          最近播放
        </NavItem>
        <NavItem view={view} target={{ type: 'songs' }} navigate={navigate} icon={<IconMusicNote className="h-4.5 w-4.5" />}>
          歌曲
        </NavItem>
        <NavItem view={view} target={{ type: 'artists' }} navigate={navigate} icon={<IconMic className="h-4.5 w-4.5" />}>
          艺人
        </NavItem>
        <NavItem view={view} target={{ type: 'albums' }} navigate={navigate} icon={<IconAlbum className="h-4.5 w-4.5" />}>
          专辑
        </NavItem>
        <NavItem view={view} target={{ type: 'favorites' }} navigate={navigate} icon={<IconHeart className="h-4.5 w-4.5" />}>
          已喜欢的音乐
        </NavItem>

        <SectionTitle
          action={
            <button
              className="cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
              onClick={() => {
                const name = window.prompt('新播放列表名称', '我的播放列表')
                if (name?.trim()) {
                  const p = createPlaylist(name.trim())
                  navigate({ type: 'playlist', id: p.id })
                }
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
        {playlists.map((p) => (
          <div key={p.id} className="group/pl relative">
            <NavItem
              view={view}
              target={{ type: 'playlist', id: p.id }}
              navigate={navigate}
              icon={<IconPlaylist className="h-4.5 w-4.5" />}
            >
              <span className="truncate">{p.name}</span>
            </NavItem>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover/pl:opacity-100"
              onClick={() => {
                if (window.confirm(`删除播放列表"${p.name}"？`)) deletePlaylist(p.id)
              }}
              aria-label="删除播放列表"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
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
        active ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'text-text-primary/85 hover:bg-white/7',
      )}
      onClick={() => navigate(target)}
    >
      <span className={active ? 'text-white' : 'text-accent'}>{icon}</span>
      {children}
    </button>
  )
}
