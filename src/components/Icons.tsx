import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  ...props,
})

export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5.9v12.2c0 .9 1 1.5 1.8 1l9.5-6.1c.7-.5.7-1.5 0-2L9.8 4.9C9 4.4 8 5 8 5.9Z" />
  </svg>
)

export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" rx="1.2" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" />
  </svg>
)

export const IconNext = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 6.4v11.2c0 .8.9 1.3 1.6.9l8.3-5.6c.6-.4.6-1.4 0-1.8L6.1 5.5c-.7-.4-1.6.1-1.6.9Z" />
    <rect x="16.5" y="5.5" width="3" height="13" rx="1" />
  </svg>
)

export const IconPrev = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.5 6.4v11.2c0 .8-.9 1.3-1.6.9l-8.3-5.6c-.6-.4-.6-1.4 0-1.8l8.3-5.6c.7-.4 1.6.1 1.6.9Z" />
    <rect x="4.5" y="5.5" width="3" height="13" rx="1" />
  </svg>
)

export const IconShuffle = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="m15 15 6 6" />
    <path d="M4 4l5 5" />
  </svg>
)

export const IconRepeat = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)

export const IconRepeatOne = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    <path d="M11 10h1v4" fill="none" />
  </svg>
)

export const IconHeart = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
)

export const IconHeartFilled = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

export const IconQueue = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h10" />
    <path d="M18 12v6.5" />
    <circle cx="16.5" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M18 12.5c.8.3 2.2.5 3 .3" />
  </svg>
)

export const IconLyrics = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
)

export const IconVolume = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
)

export const IconVolumeMute = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
    <path d="m16 9 6 6" />
    <path d="m22 9-6 6" />
  </svg>
)

export const IconChevronLeft = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m14.5 5-7 7 7 7" />
  </svg>
)

export const IconChevronRight = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9.5 5 7 7-7 7" />
  </svg>
)

export const IconChevronDown = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 9.5 7 7 7-7" />
  </svg>
)

export const IconPlus = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </svg>
)

export const IconEllipsis = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

export const IconMusicNote = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .74-.97l9.5-2.5A1 1 0 0 1 18.5 3.1v11.63a3 3 0 1 1-2-2.83V6.4l-7.5 2Z" />
  </svg>
)

export const IconHome = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 10.5 9-7.5 9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
)

export const IconMic = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 21c1.5-3.5 4.2-5.5 7.5-5.5s6 2 7.5 5.5" />
  </svg>
)

export const IconAlbum = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconExpand = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)

export const IconPlaylist = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 6h12" />
    <path d="M4 11h12" />
    <path d="M4 16h7" />
    <path d="M19 6v9.5" />
    <circle cx="17.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

/** 播放中的动态柱状指示器 */
export const PlayingBars = ({ paused = false }: { paused?: boolean }) => (
  <span className="playing-bars" data-paused={paused || undefined}>
    <i />
    <i />
    <i />
    <i />
  </span>
)
