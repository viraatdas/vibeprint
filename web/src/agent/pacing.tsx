import { useEffect } from 'react'
import { useEditor } from '../canvas/Board'
import { ui } from '../store'
import type { VibeprintState } from '@shared/types'

/** How long the pen must rest before the agent's marks land. */
export const IDLE_MS = 1400
/** How long one mark takes to draw on. */
export const DRAW_MS = 900

function tagsOf(vp: VibeprintState): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const n of vp.graph.nodes) if (!n.removed && n.tags.length) out[n.id] = n.tags
  return out
}

/**
 * Lives inside the board. Watches the pen and lets agent marks (and
 * fresh interpretation tags) land one at a time, only while the user isn't
 * drawing.
 */
export function PacingDriver() {
  const editor = useEditor()

  useEffect(() => {
    let lastInput = 0
    let down = false
    const offEvent = editor.onInput((info) => {
      if (info.type === 'pointer') {
        if (info.name === 'pointer_down') down = true
        if (info.name === 'pointer_up') down = false
        if (down || info.name === 'pointer_up') lastInput = Date.now()
      } else if (info.type === 'keyboard' || info.type === 'pinch') {
        lastInput = Date.now()
      }
    })

    const known = new Set<string>()
    let initialized = false
    let queue: string[] = []
    let shownVersion = -1
    let busyUntil = 0

    const absorb = (vp: VibeprintState | null) => {
      if (!vp) return
      if (!initialized) {
        initialized = true
        for (const m of vp.marks) known.add(m.id)
        shownVersion = vp.graph.version
        ui.set({ revealed: new Set(vp.marks.map((m) => m.id)), shownTags: tagsOf(vp) })
        return
      }
      for (const m of vp.marks) {
        if (known.has(m.id)) continue
        known.add(m.id)
        if (m.status === 'rejected') continue
        queue.push(m.id)
      }
    }
    absorb(ui.get().vp)
    let lastVp = ui.get().vp
    const unsub = ui.subscribe(() => {
      const vp = ui.get().vp
      if (vp !== lastVp) {
        lastVp = vp
        absorb(vp)
      }
    })

    const tick = setInterval(() => {
      const now = Date.now()
      const idle = !down && now - lastInput >= IDLE_MS && !editor.editing
      const s = ui.get()
      if (s.idle !== idle) ui.set({ idle })
      if (!idle || !s.vp) return
      if (s.vp.graph.version !== shownVersion) {
        shownVersion = s.vp.graph.version
        ui.set({ shownTags: tagsOf(s.vp) })
      }
      if (now < busyUntil) return
      if (s.animating) ui.set({ animating: null })
      const markIds = new Set(s.vp.marks.map((m) => m.id))
      queue = queue.filter((id) => markIds.has(id))
      const next = queue.shift()
      if (!next) return
      const revealed = new Set(s.revealed)
      revealed.add(next)
      busyUntil = now + DRAW_MS + 180
      ui.set({ revealed, animating: next })
    }, 120)

    return () => {
      offEvent()
      unsub()
      clearInterval(tick)
    }
  }, [editor])

  return null
}
