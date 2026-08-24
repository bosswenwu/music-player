/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { View } from '../types'

interface NavContextValue {
  view: View
  canBack: boolean
  navigate: (view: View) => void
  back: () => void
}

const NavContext = createContext<NavContextValue | null>(null)

const sameView = (a: View, b: View) => JSON.stringify(a) === JSON.stringify(b)

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<View[]>([{ type: 'home' }])
  const view = stack[stack.length - 1]

  const navigate = useCallback((next: View) => {
    setStack((prev) => {
      const cur = prev[prev.length - 1]
      if (sameView(cur, next)) return prev
      // 搜索时连续输入：替换栈顶而不是无限压栈
      if (cur.type === 'search' && next.type === 'search') {
        return [...prev.slice(0, -1), next]
      }
      return [...prev, next]
    })
  }, [])

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const value = useMemo(
    () => ({ view, canBack: stack.length > 1, navigate, back }),
    [view, stack.length, navigate, back],
  )

  return <NavContext value={value}>{children}</NavContext>
}

export function useNav(): NavContextValue {
  const ctx = use(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}
