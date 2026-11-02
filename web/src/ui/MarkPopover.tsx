import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useContainer, useEditor } from 'tldraw'
import { describeMark, marksOfBatch } from '@shared/marks'
import type { Decision, Mark } from '@shared/types'
import { api } from '../api'
import { toast, ui, useUi } from '../store'
import type { MarkGeom } from '../agent/layout'

type Cam = { x: number; y: number; z: number }
const toScreen = (p: { x: number; y: number }, cam: Cam) => ({ x: (p.x + cam.x) * cam.z, y: (p.y + cam.y) * cam.z })

/** Small numbered tap targets on pending marks, and the accept/reject card. */
export function MarkBadges({ marks, cam }: { marks: MarkGeom[]; cam: Cam }) {
  const vp = useUi((s) => s.vp)
  const selected = useUi((s) => s.selected)
  // The card renders above the toolbar and submit button, not inside the canvas layer.
  const container = useContainer()
  if (!vp) return null
  const pending = marks.filter((m) => m.mark.status === 'pending')
  const sel = marks.find((m) => m.mark.id === selected)

  return (
    <div className="vp-badges">
      {pending.map((g) => {
        const batch = vp.batches.find((b) => b.id === g.mark.batchId)
        const n = batch ? batch.markIds.indexOf(g.mark.id) + 1 : 0
        const p = toScreen(g.badge, cam)
        return (
          <button
            key={g.mark.id}
            className={`vp-badge${selected === g.mark.id ? ' is-on' : ''}`}
            style={{ left: p.x, top: p.y }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => ui.set({ selected: selected === g.mark.id ? null : g.mark.id })}
            aria-label={`Review mark ${n}: ${describeMark(g.mark, vp.graph)}`}
          >
            {g.mark.type === 'note' && g.mark.data.question ? '?' : n || '•'}
          </button>
        )
      })}
      {sel && createPortal(<MarkCard geom={sel} cam={cam} />, container)}
    </div>
  )
}

export async function decide(mark: Mark, decision: Decision) {
  try {
    await api.decideMark(mark.id, decision)
  } catch (err) {
    toast((err as Error).message)
  }
}

function MarkCard({ geom, cam }: { geom: MarkGeom; cam: Cam }) {
  const vp = useUi((s) => s.vp)!
  const review = useUi((s) => s.review)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 300, h: 140 })
  const mark = geom.mark
  const anchor = toScreen(geom.badge, cam)

  useEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight })
  }, [mark.id])

  const parent = ref.current?.parentElement
  const vw = parent?.clientWidth ?? window.innerWidth
  const vh = parent?.clientHeight ?? window.innerHeight
  const left = Math.max(72, Math.min(anchor.x + 20, vw - size.w - 12))
  const top = Math.max(60, Math.min(anchor.y - 12, vh - size.h - 16))

  const isNote = mark.type === 'note'
  const batch = vp.batches.find((b) => b.id === mark.batchId)
  const inBatch = batch ? marksOfBatch(batch, vp.marks).filter((m) => m.status === 'pending') : []
  const reviewing = review && review.batchId === mark.batchId

  const after = () => {
    if (!reviewing) return ui.set({ selected: null })
    const rest = inBatch.filter((m) => m.id !== mark.id)
    if (!rest.length) return ui.set({ selected: null, review: null })
    ui.set({ selected: rest[0].id, review: { batchId: mark.batchId, index: 0 } })
  }

  return (
    <div ref={ref} className="vp-card" style={{ left, top }} role="dialog" aria-label="Agent mark" onPointerDown={(e) => e.stopPropagation()}>
      <div className="vp-card-who">
        <span className="vp-dot" /> {mark.author}
        {reviewing && inBatch.length > 1 && <span className="vp-card-count">{inBatch.findIndex((m) => m.id === mark.id) + 1} of {inBatch.length}</span>}
        <button className="vp-x" onClick={() => ui.set({ selected: null, review: null })} aria-label="Close">
          ×
        </button>
      </div>
      <p className="vp-card-what">{describeMark(mark, vp.graph)}</p>
      {mark.reason && <p className="vp-card-why">{mark.reason}</p>}
      {isNote && mark.data.question && <p className="vp-card-hint">Answer by writing next to the note, then submit.</p>}
      <div className="vp-card-actions">
        <button
          className="vp-btn"
          onClick={async () => {
            await decide(mark, 'reject')
            after()
          }}
        >
          {isNote ? 'Dismiss' : 'Reject'}
        </button>
        <button
          className="vp-btn vp-btn-agent"
          onClick={async () => {
            await decide(mark, 'accept')
            after()
          }}
        >
          {isNote ? 'Resolve' : 'Accept'}
        </button>
      </div>
    </div>
  )
}

/** Pan so a mark is on screen (used when stepping through a batch). */
export function useFocusMark() {
  const editor = useEditor()
  return (geom: MarkGeom | undefined) => {
    if (!geom) return
    const vb = editor.getViewportPageBounds()
    const b = geom.bounds
    const inside = b.x >= vb.x && b.y >= vb.y && b.x + b.w <= vb.x + vb.w && b.y + b.h <= vb.y + vb.h
    if (!inside) editor.centerOnPoint({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { animation: { duration: 320 } })
  }
}
