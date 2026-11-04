import { useEffect, useState } from 'react'
import { extractSketch, shapeBounds } from '@shared/canvas'
import { unionRects } from '@shared/geometry'
import { batchIsPending, marksOfBatch, summarizeMarks } from '@shared/marks'
import { api } from '../api'
import { useEditor, useEditorValue } from '../canvas/Board'
import type { ToolId } from '../canvas/editor'
import { exportSketchPng } from '../canvas/png'
import { setCollapsed, toast, ui, useUi } from '../store'
import { computeLayout } from '../agent/layout'
import { useFocusMark } from './MarkPopover'

const I = {
  draw: <path d="M4 20c2.5-.4 4-1.6 5.6-3.4L19 7.2a2 2 0 0 0-2.8-2.8l-9.4 9.4C5 15.6 4.4 17.2 4 20z M14.5 6l3 3" />,
  arrow: <path d="M5 19 19 5M10 5h9v9" />,
  text: <path d="M6 6h12M12 6v13M9 19h6" />,
  eraser: <path d="M8.5 19.5h11M4.8 14.8l9-9a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8l-7.6 7.6a3 3 0 0 1-4.2 0l-2.4-1a2 2 0 0 1 0-2.8zM9.5 9l6 6" />,
  select: <path d="M6 4l12 7.5-5.4 1.2L10 18.5z" />,
  hand: <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5V5a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7-2.6 0-4.2-1.3-5.6-3.5L4 13.3a1.5 1.5 0 0 1 2.5-1.6L8 13.5" />,
  undo: <path d="M9 7 5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2" />,
  redo: <path d="m15 7 4 4-4 4M19 11h-9a5 5 0 0 0 0 10h2" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  eyeOff: <path d="M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  panel: <path d="M4 5h16v14H4zM15 5v14" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5" />,
  branch: (
    <>
      <path d="M7 7v10M17 9v.5a4 4 0 0 1-4 4h-2a4 4 0 0 0-4 3.5" />
      <circle cx="7" cy="5" r="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="7" r="2" />
    </>
  ),
  map: <path d="M9 3.5h6v4.5H9zM3.5 16h6v4.5h-6zM14.5 16h6v4.5h-6zM12 8v4M6.5 16v-1.5a2.5 2.5 0 0 1 2.5-2.5h6a2.5 2.5 0 0 1 2.5 2.5V16" />,
}

function Icon({ name }: { name: keyof typeof I }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  )
}

const TOOLS: Array<{ id: ToolId; icon: keyof typeof I; label: string; key: string }> = [
  { id: 'draw', icon: 'draw', label: 'Pen', key: 'd' },
  { id: 'arrow', icon: 'arrow', label: 'Arrow', key: 'a' },
  { id: 'text', icon: 'text', label: 'Text', key: 't' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', key: 'e' },
  { id: 'select', icon: 'select', label: 'Select', key: 'v' },
  { id: 'hand', icon: 'hand', label: 'Pan', key: 'h' },
]

export function Toolbar() {
  const editor = useEditor()
  const current = useEditorValue((e) => e.tool)
  const canUndo = useEditorValue((e) => e.canUndo())
  const canRedo = useEditorValue((e) => e.canRedo())
  const selected = useEditorValue((e) => e.selection.size)
  return (
    <nav className="vp-tools" aria-label="Drawing tools" onPointerDown={(e) => e.stopPropagation()}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`vp-tool${current === t.id ? ' is-on' : ''}`}
          onClick={() => editor.setTool(t.id)}
          aria-pressed={current === t.id}
          title={`${t.label} (${t.key})`}
          aria-label={t.label}
        >
          <Icon name={t.icon} />
        </button>
      ))}
      {selected > 0 && (
        <button className="vp-tool" onClick={() => editor.deleteSelection()} title="Delete (⌫)" aria-label="Delete selection">
          <Icon name="trash" />
        </button>
      )}
      <span className="vp-tools-gap" />
      <button className="vp-tool" onClick={() => editor.undo()} disabled={!canUndo} title="Undo" aria-label="Undo">
        <Icon name="undo" />
      </button>
      <button className="vp-tool" onClick={() => editor.redo()} disabled={!canRedo} title="Redo" aria-label="Redo">
        <Icon name="redo" />
      </button>
    </nav>
  )
}

export function SubmitButton() {
  const editor = useEditor()
  const submitting = useUi((s) => s.submitting)
  const reading = useUi((s) => !!s.vp?.interpreter.active)
  const empty = useEditorValue((e) => e.isEmpty())
  const seq = useUi((s) => s.vp?.sketch.seq ?? 0)
  const interpretedSeq = useUi((s) => s.vp?.graph.sketchSeq ?? 0)

  const submit = async () => {
    if (ui.get().submitting) return
    ui.set({ submitting: true })
    try {
      editor.complete()
      const shapes = extractSketch(editor.doc)
      if (!shapes.length) {
        toast('Draw something first, then submit.')
        return
      }
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--vp-ink').trim() || '#1d1d1f'
      const image = await exportSketchPng(editor.doc, ink)
      const res = await api.submit({ shapes, image })
      toast(`Sent sketch #${res.seq} to your agent.`)
    } catch (err) {
      toast(`Couldn't submit: ${(err as Error).message}`)
    } finally {
      ui.set({ submitting: false })
    }
  }

  const label = submitting ? 'Sending…' : reading ? 'Reading sketch…' : 'Submit'
  return (
    <div className="vp-submit-wrap" onPointerDown={(e) => e.stopPropagation()}>
      {seq > 0 && !reading && !submitting && (
        <span className="vp-submit-meta">{interpretedSeq >= seq ? `Sketch #${seq} read` : `Sketch #${seq} sent`}</span>
      )}
      <button className={`vp-submit${reading ? ' is-reading' : ''}`} onClick={submit} disabled={submitting || empty}>
        {label}
      </button>
    </div>
  )
}

/**
 * Draw the repo's existing architecture onto the canvas, then bring it into view. The shapes
 * arrive over the canvas socket, usually just before the HTTP reply.
 */
export function useMapRepo() {
  const editor = useEditor()
  const mapping = useUi((s) => s.mapping)
  const run = async () => {
    if (ui.get().mapping) return
    ui.set({ mapping: true })
    try {
      editor.complete()
      const res = await api.mapRepo()
      const ids = new Set(res.shapeIds)
      const fit = () => {
        const rects = [...ids].map((id) => editor.getShape(id)).filter((s) => !!s).map((s) => shapeBounds(s!, editor.doc))
        const b = rects.length === ids.size ? unionRects(rects) : null
        if (b) editor.zoomToBounds(b, { animate: true })
        return !!b
      }
      if (!fit()) {
        const stop = editor.subscribe(() => {
          if (fit()) stop()
        })
        setTimeout(stop, 4000)
      }
      const things = `${res.nodes} component${res.nodes === 1 ? '' : 's'} and ${res.edges} connection${res.edges === 1 ? '' : 's'}`
      if (res.reading && !res.nodes) toast(`${res.reading} is reading the code to map it…`)
      else if (res.reading) toast(`Drew a quick map: ${things}. ${res.reading} is reading the code to redraw it properly…`)
      else toast(res.replaced ? `Redrew the map: ${things}.` : `Mapped ${things} from the code. Move, erase or sketch over them.`)
    } catch (err) {
      toast(`Couldn't map the repo: ${(err as Error).message}`)
    } finally {
      ui.set({ mapping: false })
    }
  }
  return { mapping, run }
}

/** An empty canvas offers the two ways to start. */
export function EmptyStart() {
  const empty = useEditorValue((e) => e.loaded && e.isEmpty())
  const hasGraph = useUi((s) => !!s.vp?.graph.nodes.length)
  const live = useUi((s) => !!s.vp)
  const { mapping, run } = useMapRepo()
  const reading = useUi((s) => !!s.vp?.mapper?.active)
  // Gone the moment the first stroke starts, not when it ends.
  const drawing = useEditorValue((e) => !!e.liveId)
  if (!empty || hasGraph || !live || reading || drawing) return null
  return (
    <div className="vp-start">
      <div className="vp-start-card">
        <p className="vp-start-title">Sketch the system you want to build.</p>
        <p className="vp-start-body">Already have code? Map it first, then draw your changes on top.</p>
        <button className="vp-btn vp-btn-ink" onClick={run} disabled={mapping} onPointerDown={(e) => e.stopPropagation()}>
          <Icon name="map" />
          <span>{mapping ? 'Mapping the code…' : 'Map this repo'}</span>
        </button>
      </div>
    </div>
  )
}

export function TopBar() {
  const vp = useUi((s) => s.vp)
  const collapsed = useUi((s) => s.collapsed)
  const view = useUi((s) => s.view)
  const live = useUi((s) => !!s.vp)
  const canvasStatus = useEditorValue((e) => e.status)
  const connection = live && canvasStatus === 'live' ? 'live' : 'connecting'
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const agents = Object.entries(vp?.agents ?? {}).filter(([name, at]) => name !== 'vibeprint' && now - Date.parse(at) < 15 * 60_000)
  const { mapping, run: mapRepo } = useMapRepo()
  const reader = vp?.mapper
  const reading = !!reader?.active
  // Say how the reading ended, once.
  const [wasReading, setWasReading] = useState(false)
  useEffect(() => {
    if (reading) return setWasReading(true)
    if (!wasReading || !reader) return
    setWasReading(false)
    if (reader.task === 'schema') {
      if (reader.outcome === 'tables') toast(`${reader.label} drew ${reader.count === 1 ? 'a table' : `${reader.count} tables`} from the code. The rows are examples.`, 5000)
      else if (reader.outcome === 'none') toast(`${reader.label} found no tables in the code. Its note is in the chat.`)
      else if (reader.outcome === 'failed') toast(`Couldn't read the schema with ${reader.label}: ${reader.lastError ?? 'it failed'}.`)
      return
    }
    if (reader.outcome === 'redrawn') toast(`${reader.label} read the code and redrew the map.`)
    else if (reader.outcome === 'kept') toast(`${reader.label} finished reading the code. You'd edited the map, so it stays; tap Map this repo to redraw it.`)
    else if (reader.outcome === 'failed') toast(`Couldn't read the code with ${reader.label}: ${reader.lastError ?? 'it failed'}. The quick map stays.`)
  }, [reading, wasReading, reader])

  return (
    <header className="vp-top" onPointerDown={(e) => e.stopPropagation()}>
      <div className="vp-top-left">
        <span className={`vp-conn vp-conn-${connection}`} title={connection === 'live' ? 'Connected' : 'Connecting'} />
        <span className="vp-project" title={vp ? `Running in ${vp.project.root}` : undefined}>
          {vp?.project.name ?? 'vibeprint'}
        </span>
        {vp?.project.branch && (
          <span className="vp-branch" title={`${vp.project.worktree ? 'Worktree' : 'Branch'} ${vp.project.branch} in ${vp.project.root}`}>
            <Icon name="branch" />
            <span>{vp.project.branch}</span>
          </span>
        )}
        {vp?.update && <UpdateChip {...vp.update} />}
      </div>
      <div className="vp-top-right">
        {agents.map(([name]) => (
          <span key={name} className="vp-agent-chip" title={`${name} is connected through MCP`}>
            <span className="vp-dot" />
            {name}
          </span>
        ))}
        <button
          className={`vp-pill${reading ? ' is-reading' : ''}`}
          onClick={mapRepo}
          disabled={mapping || reading}
          title={reading ? `${reader?.label} is reading the code${reader?.task === 'schema' ? ' for the tables' : ' to redraw the map'}` : `Draw the components of the code in ${vp?.project.root ?? 'this repo'} and how they connect`}
        >
          <Icon name="map" />
          <span className="vp-pill-label">{mapping ? 'Mapping…' : reading ? 'Reading the code…' : 'Map this repo'}</span>
        </button>
        <button className={`vp-pill${collapsed ? '' : ' is-on'}`} onClick={() => setCollapsed(!collapsed)} aria-pressed={!collapsed} title="Show or hide everything the agent drew">
          <Icon name={collapsed ? 'eyeOff' : 'eye'} />
          <span>{collapsed ? 'Agent ink hidden' : 'Agent ink'}</span>
        </button>
        <button className="vp-pill vp-icon-only" onClick={() => ui.set({ view: view === 'desk' ? 'pad' : 'desk' })} title={view === 'desk' ? 'Hide chat' : 'Show chat'} aria-label="Toggle chat panel">
          <Icon name="panel" />
        </button>
      </div>
    </header>
  )
}

/** A newer release is out: one tap copies the command that restarts on it. */
function UpdateChip({ latest, current, command: cmd }: { latest: string; current: string; command: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      toast(`Copied "${cmd}". Stop vibeprint in the terminal and run it to update to ${latest}.`, 6000)
    } catch {
      toast(`To update to ${latest}, stop vibeprint in the terminal and run: ${cmd}`, 8000)
    }
  }
  return (
    <button className="vp-update" onClick={copy} title={`This is ${current}. Restart with ${cmd} to get ${latest}.`}>
      Update to {latest}
    </button>
  )
}

/** One line per pending batch: what the agent wants, and one tap to take it. */
export function BatchStrip() {
  const editor = useEditor()
  const vp = useUi((s) => s.vp)
  const revealed = useUi((s) => s.revealed)
  const collapsed = useUi((s) => s.collapsed)
  const focus = useFocusMark()
  const [busy, setBusy] = useState(false)
  if (!vp || collapsed) return null
  const batches = vp.batches.filter(
    (b) => b.kind === 'proposal' && batchIsPending(b, vp.marks) && b.markIds.some((id) => revealed.has(id)),
  )
  if (!batches.length) return null
  const b = batches[0]
  const pendingMarks = marksOfBatch(b, vp.marks).filter((m) => m.status === 'pending')
  const allRevealed = b.markIds.every((id) => revealed.has(id) || vp.marks.find((m) => m.id === id)?.status !== 'pending')

  const decideAll = async (decision: 'accept' | 'reject') => {
    setBusy(true)
    try {
      await api.decideBatch(b.id, decision)
      ui.set({ selected: null, review: null })
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const review = () => {
    const first = pendingMarks[0]
    if (!first) return
    ui.set({ review: { batchId: b.id, index: 0 }, selected: first.id })
    const layout = computeLayout(vp, (id) => editor.getShapePageBounds(id))
    focus(layout.marks.find((m) => m.mark.id === first.id))
  }

  return (
    <section className="vp-strip" aria-label="Agent proposals" onPointerDown={(e) => e.stopPropagation()}>
      <div className="vp-strip-text">
        <span className="vp-strip-who">
          <span className="vp-dot" />
          {b.author}
          {batches.length > 1 && <span className="vp-strip-more"> · {batches.length - 1} more waiting</span>}
        </span>
        <span className="vp-strip-summary">{summarizeMarks(pendingMarks)}</span>
        {b.message && <span className="vp-strip-msg">{b.message}</span>}
      </div>
      <div className="vp-strip-actions">
        <button className="vp-btn" onClick={review} disabled={busy}>
          Review
        </button>
        <button className="vp-btn" onClick={() => decideAll('reject')} disabled={busy}>
          Reject all
        </button>
        <button className="vp-btn vp-btn-agent" onClick={() => decideAll('accept')} disabled={busy || !allRevealed}>
          Accept all
        </button>
      </div>
    </section>
  )
}

export function Toast() {
  const message = useUi((s) => s.toast)
  if (!message) return null
  return (
    <div className="vp-toast" role="status">
      {message}
    </div>
  )
}
