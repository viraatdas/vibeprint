import {
  arrowEndAt,
  arrowPoints,
  distToShape,
  INK_SIZE,
  shapeAt,
  shapeBounds,
  TEXT_LINE,
  TEXT_SIZE,
  type ArrowEnd,
  type ArrowShape,
  type DrawShape,
  type InkPoint,
  type Shape,
  type TextShape,
} from '@shared/canvas'
import type { Point, Rect } from '@shared/types'
import { strokePath } from './ink'
import { uid, type Editor, type ToolId } from './editor'

// Screen-pixel tolerances.
const TAP_SLOP = 6
const HIT = 10
const ERASE = 10
/** How often a stroke in progress is sent to the other devices. */
const SEND_MS = 80
const DOUBLE_TAP_MS = 350

type Gesture =
  | { kind: 'none' }
  | { kind: 'draw'; pid: number; shape: DrawShape; points: InkPoint[]; pen: boolean; sentAt: number; sent: boolean; ahead: InkPoint[] }
  | { kind: 'arrow'; pid: number; shape: ArrowShape; origin: Point; live: boolean }
  | { kind: 'erase'; pid: number; hits: Set<string>; last: Point }
  | { kind: 'pan'; pid: number; last: Point; byTouch: boolean }
  | { kind: 'pinch'; a: number; b: number; d0: number; z0: number; anchor: Point; mid0: Point; t0: number; moved: number }
  | { kind: 'marquee'; pid: number; origin: Point; base: Set<string> }
  | { kind: 'move'; pid: number; origin: Point; screen0: Point; originals: Map<string, Shape>; moved: boolean; narrowTo: string | null }
  | { kind: 'tap'; pid: number; screen0: Point; page: Point; moved: boolean }

interface Pointer {
  type: string
  x: number
  y: number
}

export interface InputHost {
  stage: HTMLElement
  /** Paint the local stroke in progress (page-space path data). */
  paintLive(d: string): void
  /** Upload a dropped or pasted image; resolves to its /files/ URL. */
  upload(file: File): Promise<string>
  onError(message: string): void
}

const r2 = (n: number) => Math.round(n * 100) / 100

function translateShape(s: Shape, dx: number, dy: number, moving: ReadonlySet<string>, ends?: { a: Point; b: Point }): Shape {
  switch (s.type) {
    case 'draw':
      return { ...s, points: s.points.map(([x, y, p]) => [r2(x + dx), r2(y + dy), p] as InkPoint) }
    case 'text':
    case 'image':
      return { ...s, x: r2(s.x + dx), y: r2(s.y + dy) }
    case 'arrow': {
      // An end bound to a shape that moves along stays bound; otherwise it comes loose and moves.
      const end = (e: ArrowEnd, at: Point): ArrowEnd =>
        e.id && moving.has(e.id) ? { ...e, x: r2(e.x + dx), y: r2(e.y + dy) } : { x: r2(at.x + dx), y: r2(at.y + dy) }
      const pts = ends ?? { a: s.start, b: s.end }
      return { ...s, start: end(s.start, pts.a), end: end(s.end, pts.b), ...(s.route ? { route: s.route.map(p => ({ x: r2(p.x + dx), y: r2(p.y + dy) })) } : {}), ...(s.labelAt ? { labelAt: { x: r2(s.labelAt.x + dx), y: r2(s.labelAt.y + dy) } } : {}) }
    }
  }
}

function rectFrom(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

function intersects(a: Rect, b: Rect) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 })
    img.onerror = () => resolve({ w: 400, h: 300 })
    img.src = src
  })
}

/** Wires pointer, wheel, keyboard, paste and drop input on the stage to the editor. */
export function attachInput(editor: Editor, host: InputHost): () => void {
  const { stage } = host
  const pointers = new Map<number, Pointer>()
  let gesture: Gesture = { kind: 'none' }
  let space = false
  let lastTap = { at: 0, id: '' }
  // Once a stylus has touched this device, fingers navigate and only the stylus draws.
  let penSeen = false
  try {
    penSeen = localStorage.getItem('vp:pen') === '1'
  } catch {}

  // The stage doesn't move during a gesture; reading its rect per Pencil sample forces a
  // layout each time (a Pencil sends 120-240 a second).
  let rect: DOMRect | null = null
  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = rect ?? stage.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const touches = () => [...pointers.entries()].filter(([, p]) => p.type === 'touch')
  const z = () => editor.camera.z

  // ---- draw -------------------------------------------------------------------------------

  // A light Pencil touch still makes a line you can see; pressing harder thickens it.
  const pressure = (e: PointerEvent, pen: boolean) => (pen ? (e.pressure > 0 ? 0.3 + 0.7 * Math.min(1, e.pressure) : 0.5) : 0.5)

  const addInk = (g: Extract<Gesture, { kind: 'draw' }>, e: PointerEvent) => {
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
    for (const ev of events.length ? events : [e]) {
      const p = editor.screenToPage(local(ev))
      const last = g.points[g.points.length - 1]
      if (Math.hypot(p.x - last[0], p.y - last[1]) < 0.4 / z()) continue
      g.points.push([p.x, p.y, pressure(ev, g.pen)])
    }
    // Where the browser predicts the next samples, the ink reaches a little ahead of the
    // stroke so it keeps up with the tip; the prediction is shown, never saved.
    const ahead = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents() : []
    g.ahead = ahead.slice(0, 3).map((ev) => {
      const p = editor.screenToPage(local(ev))
      return [p.x, p.y, pressure(ev, g.pen)] as InkPoint
    })
    paintSoon(g)
    const now = performance.now()
    if (now - g.sentAt > SEND_MS) {
      g.sentAt = now
      g.sent = true
      editor.change([{ ...g.shape, points: g.points.slice() }], [], { history: false, silent: true })
    }
  }

  // A Pencil sends up to 240 samples a second; the outline is rebuilt once per frame.
  let paintFrame = 0
  const paintSoon = (g: Extract<Gesture, { kind: 'draw' }>) => {
    if (paintFrame) return
    paintFrame = requestAnimationFrame(() => {
      paintFrame = 0
      if (editor.liveId !== g.shape.id) return
      host.paintLive(strokePath(g.ahead.length ? [...g.points, ...g.ahead] : g.points, g.pen, false))
    })
  }

  const finishDraw = (g: Extract<Gesture, { kind: 'draw' }>) => {
    const points = g.points.map(([x, y, p]) => [r2(x), r2(y), r2(p)] as InkPoint)
    editor.liveId = null
    cancelAnimationFrame(paintFrame)
    paintFrame = 0
    editor.change([{ ...g.shape, points }], [], { before: new Map([[g.shape.id, null]]) })
  }

  const cancelDraw = (g: Extract<Gesture, { kind: 'draw' }>) => {
    editor.liveId = null
    host.paintLive('')
    if (g.sent) editor.change([], [g.shape.id], { history: false })
    else editor.emit()
  }

  // ---- erase ------------------------------------------------------------------------------

  const eraseAlong = (g: Extract<Gesture, { kind: 'erase' }>, to: Point) => {
    const from = g.last
    const r = ERASE / z()
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (r / 2)))
    let added = false
    const shapes = editor.shapes()
    for (let i = 1; i <= steps; i++) {
      const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }
      for (const s of shapes) {
        if (g.hits.has(s.id)) continue
        const pad = r + INK_SIZE
        const b = shapeBounds(s, editor.doc)
        if (p.x < b.x - pad || p.x > b.x + b.w + pad || p.y < b.y - pad || p.y > b.y + b.h + pad) continue
        if (distToShape(p, s, editor.doc) <= r + (s.type === 'draw' ? INK_SIZE / 2 : 0)) {
          g.hits.add(s.id)
          added = true
        }
      }
    }
    g.last = to
    if (added) editor.setErasing(new Set(g.hits))
  }

  // ---- select -----------------------------------------------------------------------------

  const selectionBounds = (): Rect | null => {
    let out: Rect | null = null
    for (const id of editor.selection) {
      const b = editor.getShapePageBounds(id)
      if (!b) continue
      out = out
        ? rectFrom({ x: Math.min(out.x, b.x), y: Math.min(out.y, b.y) }, { x: Math.max(out.x + out.w, b.x + b.w), y: Math.max(out.y + out.h, b.y + b.h) })
        : b
    }
    return out
  }

  const marqueeHits = (r: Rect): string[] =>
    editor
      .shapes()
      .filter((s) => {
        if (!intersects(r, shapeBounds(s, editor.doc))) return false
        if (s.type === 'draw') return s.points.some(([x, y]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return true
      })
      .map((s) => s.id)

  const startMove = (pid: number, page: Point, screen: Point, narrowTo: string | null) => {
    const originals = new Map<string, Shape>()
    for (const id of editor.selection) {
      const s = editor.getShape(id)
      if (s) originals.set(id, s)
    }
    gesture = { kind: 'move', pid, origin: page, screen0: screen, originals, moved: false, narrowTo }
  }

  const moveTo = (g: Extract<Gesture, { kind: 'move' }>, page: Point) => {
    const dx = page.x - g.origin.x
    const dy = page.y - g.origin.y
    const moving = new Set(g.originals.keys())
    // Resolve arrow ends against the document as it was when the drag started.
    const startDoc = new Map(editor.doc)
    for (const [id, s] of g.originals) startDoc.set(id, s)
    const next = [...g.originals.values()].map((s) => translateShape(s, dx, dy, moving, s.type === 'arrow' ? arrowPoints(s, startDoc) : undefined))
    editor.change(next, [], { history: false })
  }

  // ---- text -------------------------------------------------------------------------------

  const textAt = (page: Point): TextShape | undefined => {
    const hit = shapeAt(editor.doc, page, HIT / z(), (s) => s.type !== 'text')
    return hit?.type === 'text' ? hit : undefined
  }

  const newText = (page: Point): TextShape => ({
    id: uid(),
    z: editor.nextZ(),
    type: 'text',
    x: r2(page.x),
    y: r2(page.y - (TEXT_SIZE * TEXT_LINE) / 2),
    w: 0,
    h: 0,
    text: '',
    size: TEXT_SIZE,
  })

  // ---- pointer events ---------------------------------------------------------------------

  const startPinch = () => {
    const [[a, pa], [b, pb]] = touches()
    const mid0 = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
    gesture = { kind: 'pinch', a, b, d0: Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y)), z0: z(), anchor: editor.screenToPage(mid0), mid0, t0: performance.now(), moved: 0 }
  }

  const cancelGesture = () => {
    const g = gesture
    gesture = { kind: 'none' }
    if (g.kind === 'draw') cancelDraw(g)
    if (g.kind === 'arrow' && g.live) editor.change([], [g.shape.id], { history: false })
    if (g.kind === 'erase') editor.setErasing(new Set())
    if (g.kind === 'marquee') editor.setMarquee(null)
    if (g.kind === 'move' && g.moved) editor.change([...g.originals.values()], [], { history: false })
  }

  const onDown = (e: PointerEvent) => {
    if (e.button === 2) return
    // Taps inside the text box belong to the text box (caret, selection, Scribble).
    if ((e.target as Element | null)?.closest?.('.vp-text-input')) return
    if (!pointers.size) rect = stage.getBoundingClientRect()
    const sp = local(e)
    pointers.set(e.pointerId, { type: e.pointerType, x: sp.x, y: sp.y })
    try {
      stage.setPointerCapture(e.pointerId)
    } catch {}
    editor.input({ type: 'pointer', name: 'pointer_down' })
    // A tap while typing only finishes the text.
    const wasTyping = !!editor.editing
    editor.complete()

    if (e.pointerType === 'pen' && !penSeen) {
      penSeen = true
      try {
        localStorage.setItem('vp:pen', '1')
      } catch {}
    }
    // The stylus always wins over a resting palm or a finger that started a pan.
    if (e.pointerType === 'pen' && (gesture.kind === 'pinch' || (gesture.kind === 'pan' && gesture.byTouch))) cancelGesture()

    if (e.pointerType === 'touch') {
      const t = touches()
      if (t.length === 2 && (gesture.kind === 'none' || ('pid' in gesture && pointers.get(gesture.pid)?.type === 'touch'))) {
        cancelGesture()
        startPinch()
        return
      }
      if (t.length > 2) return
    }
    if (gesture.kind !== 'none') return

    const page = editor.screenToPage(sp)
    let tool: ToolId = editor.tool
    if (space || (e.pointerType === 'mouse' && e.button === 1)) tool = 'hand'
    else if (e.pointerType === 'touch' && penSeen && tool !== 'select') tool = 'hand'

    switch (tool) {
      case 'hand':
        gesture = { kind: 'pan', pid: e.pointerId, last: sp, byTouch: e.pointerType === 'touch' }
        stage.dataset.panning = '1'
        return
      case 'draw': {
        const pen = e.pointerType === 'pen'
        const shape: DrawShape = { id: uid(), z: editor.nextZ(), type: 'draw', points: [], ...(pen ? { pen: true } : {}) }
        const points: InkPoint[] = [[page.x, page.y, pressure(e, pen)]]
        gesture = { kind: 'draw', pid: e.pointerId, shape, points, pen, sentAt: performance.now(), sent: false, ahead: [] }
        editor.liveId = shape.id
        host.paintLive(strokePath(points, pen, false))
        // Once per stroke, so whatever waits for drawing to start (the empty-canvas card) hears it;
        // the samples that follow stay silent.
        editor.emit()
        return
      }
      case 'arrow': {
        const id = uid()
        const shape: ArrowShape = { id, z: editor.nextZ(), type: 'arrow', start: arrowEndAt(editor.doc, page, id, HIT / z()), end: { x: page.x, y: page.y } }
        gesture = { kind: 'arrow', pid: e.pointerId, shape, origin: sp, live: false }
        return
      }
      case 'eraser': {
        const g: Extract<Gesture, { kind: 'erase' }> = { kind: 'erase', pid: e.pointerId, hits: new Set(), last: page }
        gesture = g
        eraseAlong(g, page)
        return
      }
      case 'text':
        if (!wasTyping) gesture = { kind: 'tap', pid: e.pointerId, screen0: sp, page, moved: false }
        return
      case 'select': {
        const hit = shapeAt(editor.doc, page, HIT / z())
        if (hit) {
          const already = editor.selection.has(hit.id)
          if (e.shiftKey) {
            const next = new Set(editor.selection)
            already ? next.delete(hit.id) : next.add(hit.id)
            editor.select(next)
            if (already) return
          } else if (!already) editor.select([hit.id])
          startMove(e.pointerId, page, sp, already && !e.shiftKey && editor.selection.size > 1 ? hit.id : null)
          return
        }
        const sb = selectionBounds()
        if (sb && page.x >= sb.x && page.x <= sb.x + sb.w && page.y >= sb.y && page.y <= sb.y + sb.h) {
          startMove(e.pointerId, page, sp, null)
          return
        }
        const base = e.shiftKey ? new Set(editor.selection) : new Set<string>()
        if (!e.shiftKey) editor.select([])
        gesture = { kind: 'marquee', pid: e.pointerId, origin: page, base }
        return
      }
    }
  }

  const onMove = (e: PointerEvent) => {
    const ptr = pointers.get(e.pointerId)
    const sp = local(e)
    if (ptr) {
      ptr.x = sp.x
      ptr.y = sp.y
    }
    const g = gesture
    if (g.kind === 'none' || !ptr) return
    editor.input({ type: 'pointer', name: 'pointer_move' })

    if (g.kind === 'pinch') {
      if (e.pointerId !== g.a && e.pointerId !== g.b) return
      const pa = pointers.get(g.a)
      const pb = pointers.get(g.b)
      if (!pa || !pb) return
      const d = Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y))
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
      const nz = g.z0 * (d / g.d0)
      editor.setCamera({ x: mid.x / nz - g.anchor.x, y: mid.y / nz - g.anchor.y, z: nz })
      g.moved = Math.max(g.moved, Math.hypot(mid.x - g.mid0.x, mid.y - g.mid0.y) + Math.abs(d - g.d0))
      editor.input({ type: 'pinch' })
      return
    }
    if (g.pid !== e.pointerId) return
    const page = editor.screenToPage(sp)

    switch (g.kind) {
      case 'draw':
        return addInk(g, e)
      case 'pan':
        editor.panBy(sp.x - g.last.x, sp.y - g.last.y)
        g.last = sp
        return
      case 'arrow': {
        if (!g.live && Math.hypot(sp.x - g.origin.x, sp.y - g.origin.y) < TAP_SLOP) return
        g.live = true
        const end = arrowEndAt(editor.doc, page, g.shape.id, HIT / z(), g.shape.start.id)
        g.shape = { ...g.shape, end }
        editor.change([g.shape], [], { history: false })
        return
      }
      case 'erase':
        return eraseAlong(g, page)
      case 'marquee': {
        const r = rectFrom(g.origin, page)
        editor.marquee = r
        editor.select([...g.base, ...marqueeHits(r)])
        return
      }
      case 'move':
        if (!g.moved && Math.hypot(sp.x - g.screen0.x, sp.y - g.screen0.y) < TAP_SLOP) return
        g.moved = true
        return moveTo(g, page)
      case 'tap':
        if (Math.hypot(sp.x - g.screen0.x, sp.y - g.screen0.y) > TAP_SLOP) g.moved = true
        return
    }
  }

  const onUp = (e: PointerEvent) => {
    const had = pointers.has(e.pointerId)
    pointers.delete(e.pointerId)
    if (!pointers.size) queueMicrotask(() => !pointers.size && (rect = null))
    if (!had) return
    editor.input({ type: 'pointer', name: 'pointer_up' })
    const g = gesture

    if (g.kind === 'pinch') {
      if (e.pointerId !== g.a && e.pointerId !== g.b) return
      gesture = { kind: 'none' }
      // A quick two-finger tap undoes, as in most drawing apps.
      if (performance.now() - g.t0 < 300 && g.moved < 10) editor.undo()
      return
    }
    if (g.kind === 'none' || g.pid !== e.pointerId) return
    gesture = { kind: 'none' }

    switch (g.kind) {
      case 'draw': {
        if (e.type === 'pointercancel' && !g.pen) return cancelDraw(g)
        return finishDraw(g)
      }
      case 'pan':
        delete stage.dataset.panning
        return
      case 'arrow': {
        if (!g.live) return
        const a = arrowPoints(g.shape, editor.doc)
        if (Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y) * z() < TAP_SLOP * 2) return editor.change([], [g.shape.id], { history: false })
        return editor.change([g.shape], [], { before: new Map([[g.shape.id, null]]) })
      }
      case 'erase':
        editor.setErasing(new Set())
        if (g.hits.size) editor.change([], [...g.hits])
        return
      case 'marquee':
        return editor.setMarquee(null)
      case 'move': {
        if (g.moved) {
          const final = [...g.originals.keys()].map((id) => editor.getShape(id)).filter((s): s is Shape => !!s)
          editor.change(final, [], { before: new Map([...g.originals].map(([id, s]) => [id, s])) })
          return
        }
        if (g.narrowTo) editor.select([g.narrowTo])
        // Double tap on text edits it.
        const [only] = [...editor.selection]
        const s = only && editor.selection.size === 1 ? editor.getShape(only) : undefined
        const now = performance.now()
        if (s?.type === 'text' && lastTap.id === s.id && now - lastTap.at < DOUBLE_TAP_MS) {
          lastTap = { at: 0, id: '' }
          return editor.editText(s)
        }
        lastTap = { at: now, id: s?.id ?? '' }
        return
      }
      case 'tap': {
        if (g.moved || e.type === 'pointercancel') return
        return editor.editText(textAt(g.page) ?? newText(g.page))
      }
    }
  }

  // ---- wheel and trackpad -----------------------------------------------------------------

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const sp = local(e)
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    if (e.ctrlKey || e.metaKey) {
      const dy = Math.max(-60, Math.min(60, e.deltaY * unit))
      editor.zoomAt(sp, z() * Math.exp(-dy * 0.01))
      editor.input({ type: 'pinch' })
      return
    }
    let dx = e.deltaX * unit
    let dy = e.deltaY * unit
    if (e.shiftKey && !dx) [dx, dy] = [dy, 0]
    editor.panBy(-dx, -dy)
  }

  // Safari on a Mac reports trackpad pinches as gesture events, not ctrl+wheel.
  let gestureZ = 1
  const onGestureStart = (e: Event) => {
    e.preventDefault()
    gestureZ = z()
  }
  const onGestureChange = (e: Event) => {
    e.preventDefault()
    if (touches().length) return
    const ge = e as Event & { scale: number; clientX: number; clientY: number }
    editor.zoomAt(local(ge), gestureZ * ge.scale)
    editor.input({ type: 'pinch' })
  }

  // ---- keyboard ---------------------------------------------------------------------------

  const TOOL_KEYS: Record<string, ToolId> = { d: 'draw', p: 'draw', a: 'arrow', t: 'text', e: 'eraser', v: 'select', h: 'hand' }
  const center = () => ({ x: editor.viewport.w / 2, y: editor.viewport.h / 2 })

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return
    editor.input({ type: 'keyboard' })
    const mod = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    if (mod) {
      if (k === 'z') e.shiftKey ? editor.redo() : editor.undo()
      else if (k === 'y') editor.redo()
      else if (k === 'a') {
        editor.setTool('select')
        editor.select(editor.shapes().map((s) => s.id))
      } else if (k === '=' || k === '+') editor.zoomAt(center(), z() * 1.25)
      else if (k === '-') editor.zoomAt(center(), z() / 1.25)
      else if (k === '0') editor.zoomAt(center(), 1)
      else return
      e.preventDefault()
      return
    }
    if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
      space = true
      stage.dataset.space = '1'
      e.preventDefault()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      editor.deleteSelection()
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') return editor.select([])
    if (e.shiftKey && e.code === 'Digit1') return editor.zoomToFit()
    if (!e.shiftKey && !e.altKey && TOOL_KEYS[k]) editor.setTool(TOOL_KEYS[k])
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      space = false
      delete stage.dataset.space
    }
  }

  // ---- images -----------------------------------------------------------------------------

  const addImage = async (file: File, at?: Point) => {
    if (!file.type.startsWith('image/')) return
    try {
      const src = await host.upload(file)
      const size = await imageSize(src)
      const scale = Math.min(1, 640 / Math.max(size.w, size.h))
      const w = r2(size.w * scale)
      const h = r2(size.h * scale)
      const c = at ?? editor.screenToPage(center())
      editor.change([{ id: uid(), z: editor.nextZ(), type: 'image', x: r2(c.x - w / 2), y: r2(c.y - h / 2), w, h, src }])
    } catch (err) {
      host.onError(`Couldn't add the image: ${(err as Error).message}`)
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    if (isTyping(e.target)) return
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    e.preventDefault()
    for (const f of files) void addImage(f)
  }
  const onDragOver = (e: DragEvent) => e.preventDefault()
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const at = editor.screenToPage(local(e))
    for (const f of [...(e.dataTransfer?.files ?? [])]) void addImage(f, at)
  }

  const onContextMenu = (e: Event) => e.preventDefault()
  const onBlur = () => {
    space = false
    delete stage.dataset.space
  }

  // iOS holds a new touch while it decides whether it is a text selection, the magnifier or
  // Scribble, which delays the start of a Pencil stroke and can cancel it midway. While drawing,
  // the canvas handles every touch itself. (Text and select keep the defaults, so tapping into
  // a text still brings up the keyboard.)
  const onTouch = (e: TouchEvent) => {
    if (editor.tool === 'text' || editor.tool === 'select' || editor.editing) return
    if ((e.target as Element | null)?.closest?.('.vp-text-input')) return
    if (e.cancelable) e.preventDefault()
  }
  stage.addEventListener('touchstart', onTouch, { passive: false })
  stage.addEventListener('touchmove', onTouch, { passive: false })
  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
  stage.addEventListener('pointercancel', onUp)
  stage.addEventListener('wheel', onWheel, { passive: false })
  stage.addEventListener('gesturestart', onGestureStart)
  stage.addEventListener('gesturechange', onGestureChange)
  stage.addEventListener('dragover', onDragOver)
  stage.addEventListener('drop', onDrop)
  stage.addEventListener('contextmenu', onContextMenu)
  addEventListener('keydown', onKeyDown)
  addEventListener('keyup', onKeyUp)
  addEventListener('paste', onPaste)
  addEventListener('blur', onBlur)
  return () => {
    stage.removeEventListener('touchstart', onTouch)
    stage.removeEventListener('touchmove', onTouch)
    stage.removeEventListener('pointerdown', onDown)
    stage.removeEventListener('pointermove', onMove)
    stage.removeEventListener('pointerup', onUp)
    stage.removeEventListener('pointercancel', onUp)
    stage.removeEventListener('wheel', onWheel)
    stage.removeEventListener('gesturestart', onGestureStart)
    stage.removeEventListener('gesturechange', onGestureChange)
    stage.removeEventListener('dragover', onDragOver)
    stage.removeEventListener('drop', onDrop)
    stage.removeEventListener('contextmenu', onContextMenu)
    removeEventListener('blur', onBlur)
    removeEventListener('keydown', onKeyDown)
    removeEventListener('keyup', onKeyUp)
    removeEventListener('paste', onPaste)
  }
}
