import { useState, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { PageHeader, EmptyState } from './shared'
import { IconAlbum, IconChevronRight } from '../components/Icons'
import { cx } from '../lib/utils'

/** 重复歌曲：按「艺人 + 标题」分组的重复文件（方便清理曲库） */
export function DuplicatesView({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { duplicateGroups } = useLibrary()
  const { playQueue } = usePlayer()
  const [expanded, setExpanded] = useState<number | null>(null)

  const totalDup = duplicateGroups.reduce((acc, g) => acc + g.length, 0)

  if (!duplicateGroups.length) {
    return <EmptyState icon={<IconAlbum />} title="没有重复歌曲" hint="曲库里没有发现艺人+标题相同的重复文件" />
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="重复歌曲"
        subtitle={`${duplicateGroups.length} 组重复 · ${totalDup} 个文件`}
      />

      <div className="space-y-2">
        {duplicateGroups.map((group, gi) => {
          const first = group[0]
          const open = expanded === gi
          return (
            <div key={gi} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface"
                onClick={() => setExpanded(open ? null : gi)}
              >
                <IconChevronRight
                  className={cx('h-4 w-4 shrink-0 text-text-tertiary transition-transform', open && 'rotate-90')}
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{first.title}</span>
                <span className="truncate text-xs text-text-secondary">{first.artists[0]}</span>
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                  {group.length} 个
                </span>
              </button>
              {open && (
                <div className="border-t border-border px-2 py-2">
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <button
                      className="cursor-pointer rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110"
                      onClick={() => playQueue(group, 0, false)}
                    >
                      播放这组
                    </button>
                    <span className="text-[11px] text-text-tertiary">
                      以下文件可能是重复的，可在文件管理器中手动删除
                    </span>
                  </div>
                  <SongTable songs={group} showAlbum scrollRef={scrollRef} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
