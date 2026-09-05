/**
 * 全局对话框（替代 Electron 中不可用的 window.prompt / window.confirm）
 * - promptInput(message, default) → Promise<string | null>
 * - confirmDialog(message)     → Promise<boolean>
 * 由 <DialogHost /> 渲染 UI，挂载在 App 根节点。
 */

export type DialogReq =
  | { kind: 'prompt'; message: string; defaultValue: string }
  | { kind: 'confirm'; message: string }

let req: DialogReq | null = null
let resolveFn: ((v: string | null | boolean) => void) | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function promptInput(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    req = { kind: 'prompt', message, defaultValue }
    resolveFn = resolve as (v: string | null | boolean) => void
    emit()
  })
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    req = { kind: 'confirm', message }
    resolveFn = resolve as (v: string | null | boolean) => void
    emit()
  })
}

export function resolveDialog(value: string | null | boolean): void {
  req = null
  const r = resolveFn
  resolveFn = null
  r?.(value)
  emit()
}

export function subscribeDialog(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getDialog(): DialogReq | null {
  return req
}
