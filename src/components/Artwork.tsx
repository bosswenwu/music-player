import { memo, useState } from 'react'
import { cx, gradientFor } from '../lib/utils'
import { IconMusicNote, IconMic } from './Icons'

interface Props {
  cover: string | null
  /** 无封面时用于生成渐变配色的种子（通常是艺人或专辑名） */
  seed: string
  alt?: string
  className?: string
  rounded?: string
  /** 占位图内容：音符或人物 */
  fallbackIcon?: 'note' | 'artist'
  /** 占位图中显示的文字（如艺人首字） */
  fallbackText?: string
}

export const Artwork = memo(function Artwork({
  cover,
  seed,
  alt = '',
  className,
  rounded = 'rounded-lg',
  fallbackIcon = 'note',
  fallbackText,
}: Props) {
  // 记录加载失败的封面；封面变化后派生值自动恢复，无需 effect 重置
  const [brokenCover, setBrokenCover] = useState<string | null>(null)
  const broken = cover != null && brokenCover === cover

  if (cover && !broken) {
    return (
      <img
        src={cover}
        alt={alt}
        loading="lazy"
        draggable={false}
        onError={() => setBrokenCover(cover)}
        className={cx('object-cover shadow-md shadow-black/30', rounded, className)}
      />
    )
  }
  const [c1, c2] = gradientFor(seed)
  return (
    <div
      className={cx(
        'flex items-center justify-center overflow-hidden shadow-md shadow-black/30',
        rounded,
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
      aria-label={alt}
    >
      {fallbackText ? (
        <span className="select-none font-bold text-white/85" style={{ fontSize: '38%' }}>
          {fallbackText}
        </span>
      ) : fallbackIcon === 'artist' ? (
        <IconMic className="h-[42%] w-[42%] text-white/75" />
      ) : (
        <IconMusicNote className="h-[42%] w-[42%] text-white/75" />
      )}
    </div>
  )
})
