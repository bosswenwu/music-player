import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDialog, resolveDialog, subscribeDialog, type DialogReq } from '../lib/dialog'

/** 全局对话框 UI（prompt / confirm），挂载在 App 根 */
export function DialogHost() {
  const req = useSyncExternalStore(subscribeDialog, getDialog)
  if (!req) return null
  return <DialogInner req={req} />
}

function DialogInner({ req }: { req: DialogReq }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? req.defaultValue : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (req.kind === 'prompt') inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveDialog(req.kind === 'prompt' ? null : false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req])

  const confirm = () => {
    if (req.kind === 'prompt') resolveDialog(inputRef.current?.value ?? value)
    else resolveDialog(true)
  }

  const btn =
    'cursor-pointer rounded-lg px-4 py-1.5 text-[13px] font-semibold transition active:scale-95'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => resolveDialog(req.kind === 'prompt' ? null : false)}
    >
      <div
        className="w-80 rounded-2xl border border-border bg-panel p-5 shadow-2xl shadow-black/60 animate-fade-in-up"
        style={{ animationDuration: '0.15s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-[14px] font-semibold text-text-primary">{req.message}</div>
        {req.kind === 'prompt' ? (
          <input
            ref={inputRef}
            value={value}
            placeholder="请输入名称"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
            className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-text-primary outline-none ring-accent/60 transition focus:bg-surface-2 focus:ring-2"
          />
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className={`${btn} bg-surface text-text-secondary hover:bg-surface-2`}
            onClick={() => resolveDialog(req.kind === 'prompt' ? null : false)}
          >
            取消
          </button>
          <button
            className={`${btn} bg-accent text-white shadow-md shadow-accent/25 hover:brightness-110`}
            onClick={confirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
