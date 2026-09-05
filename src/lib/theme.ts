import { loadLocal, saveLocal } from './utils'

export type Theme = 'dark' | 'light'

const KEY = 'mp.theme'

export function getInitialTheme(): Theme {
  const saved = loadLocal<Theme | null>(KEY, null)
  if (saved === 'dark' || saved === 'light') return saved
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light')
  saveLocal(KEY, theme)
}
