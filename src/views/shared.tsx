import type { ReactNode } from 'react'
import { IconPlay, IconShuffle } from '../components/Icons'

export function PageHeader({
  title,
  subtitle,
  onPlay,
  onShuffle,
  extra,
}: {
  title: string
  subtitle?: string
  onPlay?: () => void
  onShuffle?: () => void
  extra?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        {extra}
        {onPlay && (
          <button
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-[13px] font-semibold text-white shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
            onClick={onPlay}
          >
            <IconPlay className="h-4 w-4" />
            播放
          </button>
        )}
        {onShuffle && (
          <button
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-2 px-5 py-2 text-[13px] font-semibold text-accent transition hover:bg-surface-2 active:scale-95"
            onClick={onShuffle}
          >
            <IconShuffle className="h-4 w-4" />
            随机播放
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-text-tertiary">
      <div className="[&>svg]:h-14 [&>svg]:w-14">{icon}</div>
      <div className="text-[15px] font-medium text-text-secondary">{title}</div>
      {hint && <div className="max-w-sm text-center text-[13px] leading-relaxed">{hint}</div>}
      {action}
    </div>
  )
}
