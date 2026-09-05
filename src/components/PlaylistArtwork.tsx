import { memo } from 'react'
import { cx, gradientFor } from '../lib/utils'

/**
 * 播放列表封面：2×2 歌曲封面拼图（Apple Music 风格）。
 * covers 最多取前 4 个封面，缺失的格子用渐变占位。
 */
export const PlaylistArtwork = memo(function PlaylistArtwork({
  covers,
  seed,
  className,
  rounded = 'rounded-lg',
}: {
  covers: Array<string | null>
  seed: string
  className?: string
  rounded?: string
}) {
  // 补齐到 4 格
  const cells = [0, 1, 2, 3].map((i) => covers[i] ?? null)

  return (
    <div className={cx('grid grid-cols-2 grid-rows-2 overflow-hidden', rounded, className)}>
      {cells.map((cover, i) => {
        const [c1, c2] = gradientFor(`${seed}-${i}`)
        return cover ? (
          <img
            key={i}
            src={cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
            style={{ padding: i === 0 ? '0 0.5px 0.5px 0' : i === 1 ? '0 0 0 0.5px' : i === 2 ? '0.5px 0.5px 0 0' : '0.5px 0 0 0.5px' }}
          />
        ) : (
          <div
            key={i}
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
              padding: i === 0 ? '0 0.5px 0.5px 0' : i === 1 ? '0 0 0 0.5px' : i === 2 ? '0.5px 0.5px 0 0' : '0.5px 0 0 0.5px',
            }}
          />
        )
      })}
    </div>
  )
})
