import { useSyncExternalStore } from 'react'
import type { ClientConfig } from '@shared/api'
import type { VibeprintState } from '@shared/types'

export interface UiState {
  vp: VibeprintState | null
  config: ClientConfig | null
  view: 'pad' | 'desk'
  /** Hide every bit of agent ink (and un-dim struck shapes). */
  collapsed: boolean
  /** Marks the canvas has drawn. New marks wait for the pen to be idle. */
  revealed: Set<string>
  /** The mark currently being drawn on. */
  animating: string | null
  /** Interpretation tags currently shown, by node id (updated when the pen is idle). */
  shownTags: Record<string, string[]>
  /** Mark whose popover is open. */
  selected: string | null
  /** Stepping through a batch one mark at a time. */
  review: { batchId: string; index: number } | null
  idle: boolean
  submitting: boolean
  toast: string | null
}

type Listener = () => void

function createStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<Listener>()
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...p }
      for (const l of listeners) l()
    },
    subscribe(l: Listener) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

const params = new URLSearchParams(location.search)
const forcedView = params.get('view')
const looksLikeTablet =
  navigator.maxTouchPoints > 1 && (/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document))

let savedCollapsed = false
try {
  savedCollapsed = localStorage.getItem('vp:collapsed') === '1'
} catch {}

export const ui = createStore<UiState>({
  vp: null,
  config: null,
  view: forcedView === 'pad' || forcedView === 'desk' ? forcedView : looksLikeTablet || window.innerWidth < 900 ? 'pad' : 'desk',
  collapsed: savedCollapsed,
  revealed: new Set(),
  animating: null,
  shownTags: {},
  selected: null,
  review: null,
  idle: true,
  submitting: false,
  toast: null,
})

export function setCollapsed(collapsed: boolean) {
  ui.set({ collapsed, selected: null, review: null })
  try {
    localStorage.setItem('vp:collapsed', collapsed ? '1' : '0')
  } catch {}
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function toast(message: string, ms = 3200) {
  ui.set({ toast: message })
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ui.set({ toast: null }), ms)
}

export function useUi<S>(select: (s: UiState) => S): S {
  return useSyncExternalStore(ui.subscribe, () => select(ui.get()))
}
