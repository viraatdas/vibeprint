import { useEffect, useRef, useState } from 'react'
import { shapeBounds } from '@shared/canvas'
import { unionRects } from '@shared/geometry'
import { api } from '../api'
import { useEditor, useEditorValue } from '../canvas/Board'
import { exportSketchPng } from '../canvas/png'
import { toast, useUi } from '../store'

export function CleanupActions() {
  const editor = useEditor()
  const cleanup = useUi(s => s.vp?.cleanup)
  const busy = useUi(s => s.mapping || !!s.vp?.mapper.active || !!s.vp?.interpreter.active)
  const empty = useEditorValue(e => e.isEmpty())
  const status = useEditorValue(e => e.status)
  const [starting, setStarting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const observed = useRef(false)
  const lastFinished = useRef<string | undefined>(undefined)
  const active = starting || !!cleanup?.active

  useEffect(() => {
    if (cleanup?.active) { observed.current = true; return }
    if (!cleanup?.finishedAt || cleanup.finishedAt === lastFinished.current) return
    lastFinished.current = cleanup.finishedAt
    if (!observed.current && !undoing) return
    observed.current = false
    if (cleanup.outcome === 'cleaned' || cleanup.outcome === 'restored') {
      editor.clearHistory()
      const ids = new Set(cleanup.shapeIds)
      const bounds = () => {
        const shapes = [...ids].map(id => editor.getShape(id))
        if (shapes.some(s => !s)) return undefined
        return unionRects(shapes.map(s => shapeBounds(s!, editor.doc)))
      }
      const b = bounds()
      if (b) editor.zoomToBounds(b, { animate: true })
      else {
        const stop = editor.subscribe(() => {
          const next = bounds()
          if (next) { stop(); editor.zoomToBounds(next, { animate: true }) }
        })
        setTimeout(stop, 5000)
      }
      toast(cleanup.outcome === 'restored' ? 'Restored the original canvas.' : 'Cleaned up the map and reconciled your notes. Undo cleanup restores the original.', 6000)
    } else toast(cleanup.lastError ?? 'Cleanup could not finish. Your canvas is unchanged.', 7000)
  }, [cleanup, editor, undoing])

  const run = async () => {
    if (active || busy) return
    setStarting(true)
    try {
      editor.complete()
      const source = editor.shapes()
      const doc = new Map(source.map(s => [s.id, s]))
      const css = getComputedStyle(document.documentElement)
      const image = await exportSketchPng(doc, css.getPropertyValue('--vp-ink').trim(), css.getPropertyValue('--vp-agent').trim() || undefined)
      if (!image) throw new Error('Draw or map something first.')
      await api.cleanUp(source, image)
      observed.current = true
      toast('AI is reading your canvas, notes, conversation and code…', 5000)
    } catch (err) { toast(`Couldn't clean up: ${(err as Error).message}`, 6000) }
    finally { setStarting(false) }
  }
  const undo = async () => {
    if (!cleanup?.undoId || undoing) return
    setUndoing(true)
    observed.current = true
    try { await api.undoCleanup(cleanup.undoId) }
    catch (err) { toast(`Couldn't undo cleanup: ${(err as Error).message}`, 7000) }
    finally { setUndoing(false) }
  }

  return <>
    <button className="vp-pill vp-map-action vp-cleanup" onClick={run} disabled={active || busy || empty || status !== 'live'} aria-label="Clean up" aria-busy={active} title="Use AI to reconcile this map, your handwritten notes, recent chat and code into a clearer diagram. The original is backed up.">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 3-5 10m-3-1 7 3-3 6H3l4-9Zm-1 9 2-5m4-12 1 3m4 0-3 1m4 4-2-1" /></svg>
      <span>{active ? 'Reconciling…' : 'Clean up'}</span>
    </button>
    {cleanup?.undoId && <button className="vp-pill vp-cleanup-undo" onClick={undo} disabled={active || busy || undoing || status !== 'live'} title="Restore the canvas and architecture from before cleanup, if no newer edits were made.">{undoing ? 'Restoring…' : 'Undo cleanup'}</button>}
  </>
}
