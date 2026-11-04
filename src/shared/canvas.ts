// Vibeprint's own canvas document. Plain JSON shapes in page space, shared by the web app
// (which draws and edits them) and the daemon (which syncs and saves them to
// .vibeprint/canvas.json). Page units match what agents see in sketch bounds.
import { strokeIsClosed, unionRects } from './geometry.js'
import type { Point, Rect, SketchShape } from './types.js'

/** Bumped when the wire protocol between the canvas and the daemon changes. */
export const CANVAS_PROTOCOL = 1
export const CANVAS_FORMAT = 'vibeprint-canvas'
export const INK_COLOR = '#2e5bff'
export const AGENT_COLOR = '#d94040'

/** [x, y, pressure] in page space. */
export type InkPoint = [number, number, number]

interface ShapeBase {
  /** "shape:<id>". Graph nodes bind to these, so they never change. */
  id: string
  /** Stacking order; higher draws on top. */
  z: number
  /** Generated ink keeps its attribution when moved, edited, saved or exported. */
  author?: 'user' | 'agent'
  /** Typeset map text; handwritten ink remains the default. */
  font?: 'hand' | 'sans'
}

export interface DrawShape extends ShapeBase {
  type: 'draw'
  points: InkPoint[]
  /** Drawn with a stylus, so the pressure is real. */
  pen?: boolean
  /** Marked closed explicitly (shapes migrated from a closed outline). */
  closed?: boolean
}

/** One end of an arrow: a free point, or a point bound to a shape. */
export interface ArrowEnd {
  x: number
  y: number
  /** Bound shape. The end then sits at (nx, ny) inside that shape's bounds and follows it. */
  id?: string
  nx?: number
  ny?: number
}

export interface ArrowShape extends ShapeBase {
  type: 'arrow'
  start: ArrowEnd
  end: ArrowEnd
  text?: string
  /** Optional page-space bends for generated, obstacle-avoiding connectors. */
  route?: Point[]
  mode?: 'sync' | 'async' | 'local'
  labelAt?: Point
}

export interface TextShape extends ShapeBase {
  type: 'text'
  x: number
  y: number
  /** Measured size of the laid-out text. */
  w: number
  h: number
  text: string
  /** Font size in page units. */
  size?: number
}

export interface ImageShape extends ShapeBase {
  type: 'image'
  x: number
  y: number
  w: number
  h: number
  /** Served by the daemon, e.g. /files/abc.png. */
  src: string
}

export type Shape = DrawShape | ArrowShape | TextShape | ImageShape
export type ShapeType = Shape['type']
export type Doc = ReadonlyMap<string, Shape>

// ---- wire protocol (WebSocket /api/canvas) ----------------------------------------------

export type ClientMessage =
  /** Puts replace whole shapes; dels remove them. `n` is echoed back in the ack. */
  | { t: 'ops'; n: number; put?: Shape[]; del?: string[] }
  | { t: 'tick' }

export type ServerMessage =
  | { t: 'snapshot'; v: number; shapes: Shape[] }
  | { t: 'ops'; put?: Shape[]; del?: string[] }
  | { t: 'ack'; n: number }
  | { t: 'rejected'; n: number; error: string }
  | { t: 'tick' }

// ---- constants --------------------------------------------------------------------------

export const TEXT_SIZE = 24
export const TEXT_LINE = 1.35
/** Pen width in page units (perfect-freehand size). */
export const INK_SIZE = 6

// ---- geometry ---------------------------------------------------------------------------

const boundsCache = new WeakMap<Shape, Rect>()

function pointsBounds(points: InkPoint[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Page bounds of a shape. Arrows depend on the shapes they are bound to, so they need the doc. */
export function shapeBounds(shape: Shape, doc: Doc): Rect {
  if (shape.type === 'arrow') {
    const pts = arrowRoute(shape, doc)
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  const hit = boundsCache.get(shape)
  if (hit) return hit
  const r = shape.type === 'draw' ? pointsBounds(shape.points) : { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
  boundsCache.set(shape, r)
  return r
}

/** Where a bound arrow end attaches inside its target, before clipping to the outline. */
function anchorPoint(end: ArrowEnd, doc: Doc): { p: Point; target?: Shape } {
  const target = end.id ? doc.get(end.id) : undefined
  if (!target || target.type === 'arrow') return { p: { x: end.x, y: end.y } }
  const r = shapeBounds(target, doc)
  return { p: { x: r.x + (end.nx ?? 0.5) * r.w, y: r.y + (end.ny ?? 0.5) * r.h }, target }
}

/** Intersection parameter t (0..1 along a→b) of segment a→b with segment c→d, or null. */
function segmentHit(a: Point, b: Point, c: Point, d: Point): number | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

function outline(shape: Shape, doc: Doc): Point[] {
  if (shape.type === 'draw' && shape.points.length > 2) {
    const pts = shape.points.map(([x, y]) => ({ x, y }))
    // Close the loop so an arrow can meet any side of a hand-drawn box.
    pts.push(pts[0])
    return pts
  }
  const r = shapeBounds(shape, doc)
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
    { x: r.x, y: r.y },
  ]
}

/** Where the segment from `from` toward `anchor` first meets the target's outline. */
function clipToOutline(from: Point, anchor: Point, target: Shape, doc: Doc): Point {
  const ring = outline(target, doc)
  let best: number | null = null
  for (let i = 1; i < ring.length; i++) {
    const t = segmentHit(from, anchor, ring[i - 1], ring[i])
    if (t !== null && t > 0.001 && (best === null || t < best)) best = t
  }
  if (best === null) return anchor
  return { x: from.x + (anchor.x - from.x) * best, y: from.y + (anchor.y - from.y) * best }
}

const ARROW_GAP = 6

/** Rendered endpoints of an arrow: bound ends follow their shapes and stop at the outline. */
export function arrowPoints(shape: ArrowShape, doc: Doc): { a: Point; b: Point } {
  const s = anchorPoint(shape.start, doc)
  const e = anchorPoint(shape.end, doc)
  let a = s.p
  let b = e.p
  if (s.target) a = clipToOutline(shape.route?.[0] ?? e.p, s.p, s.target, doc)
  if (e.target) b = clipToOutline(shape.route?.at(-1) ?? s.p, e.p, e.target, doc)
  if (shape.route?.length) return { a, b }
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len > ARROW_GAP * 4) {
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len
    if (s.target) a = { x: a.x + ux * ARROW_GAP, y: a.y + uy * ARROW_GAP }
    if (e.target) b = { x: b.x - ux * ARROW_GAP, y: b.y - uy * ARROW_GAP }
  }
  return { a, b }
}

export function arrowRoute(shape: ArrowShape, doc: Doc): Point[] {
  const { a, b } = arrowPoints(shape, doc)
  return [a, ...(shape.route ?? []), b]
}

/** Labels sit on the longest run of a routed arrow, away from box centers. */
export function arrowLabelPoint(points: Point[]): Point {
  let best = 0, at = 1
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (length > best) { best = length; at = i }
  }
  return { x: (points[at - 1].x + points[at].x) / 2, y: (points[at - 1].y + points[at].y) / 2 }
}

/** Shapes in stacking order. */
export function sortedShapes(doc: Doc): Shape[] {
  return [...doc.values()].sort((p, q) => p.z - q.z || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
}

export function docBounds(doc: Doc): Rect | null {
  return unionRects([...doc.values()].map((s) => shapeBounds(s, doc)))
}

// ---- hit testing ------------------------------------------------------------------------

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Distance from a page point to the visible ink of a shape (0 inside text and images). */
export function distToShape(p: Point, shape: Shape, doc: Doc): number {
  switch (shape.type) {
    case 'draw': {
      const pts = shape.points
      if (pts.length === 1) return Math.hypot(p.x - pts[0][0], p.y - pts[0][1])
      let best = Infinity
      for (let i = 1; i < pts.length; i++) {
        const d = distToSegment(p, { x: pts[i - 1][0], y: pts[i - 1][1] }, { x: pts[i][0], y: pts[i][1] })
        if (d < best) best = d
      }
      return best
    }
    case 'arrow': {
      const points = arrowRoute(shape, doc)
      return Math.min(...points.slice(1).map((b, i) => distToSegment(p, points[i], b)))
    }
    default: {
      const r = shapeBounds(shape, doc)
      const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
      const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
      return Math.hypot(dx, dy)
    }
  }
}

/** Topmost shape whose ink is within `tolerance` of a point. */
export function shapeAt(doc: Doc, p: Point, tolerance: number, skip?: (s: Shape) => boolean): Shape | undefined {
  const shapes = sortedShapes(doc)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    if (skip?.(s)) continue
    if (distToShape(p, s, doc) <= tolerance) return s
  }
  return undefined
}

/**
 * The shape an arrow end dropped at `p` should bind to: the smallest outlined shape that
 * contains the point (so an arrow into a box inside a bigger box binds to the inner one),
 * falling back to text or a stroke right under the point.
 */
export function bindTarget(doc: Doc, p: Point, exclude: string, tolerance: number): Shape | undefined {
  let best: Shape | undefined
  let bestArea = Infinity
  for (const s of doc.values()) {
    if (s.id === exclude || s.type === 'arrow' || s.type === 'text') continue
    const r = shapeBounds(s, doc)
    if (p.x < r.x - tolerance || p.x > r.x + r.w + tolerance || p.y < r.y - tolerance || p.y > r.y + r.h + tolerance) continue
    // An open scribble only counts where the pen actually was.
    if (s.type === 'draw' && !isClosedStroke(s) && distToShape(p, s, doc) > tolerance) continue
    const area = Math.max(1, r.w * r.h)
    if (area < bestArea) {
      best = s
      bestArea = area
    }
  }
  return best ?? shapeAt(doc, p, tolerance, (s) => s.id === exclude || s.type === 'arrow')
}

export function isClosedStroke(s: DrawShape): boolean {
  return !!s.closed || strokeIsClosed(s.points.map(([x, y]) => ({ x, y })))
}

/** Bind an arrow end at page point `p`: a normalized anchor inside the target, or a free point. */
export function arrowEndAt(doc: Doc, p: Point, arrowId: string, tolerance: number, otherEndId?: string): ArrowEnd {
  const target = bindTarget(doc, p, arrowId, tolerance)
  if (!target || target.id === otherEndId) return { x: p.x, y: p.y }
  // Center anchors keep arrows between boxes tidy, the way people draw them.
  return { x: p.x, y: p.y, id: target.id, nx: 0.5, ny: 0.5 }
}

// ---- sketch extraction (what the interpreter reads on submit) ---------------------------

const r1 = (n: number) => Math.round(n * 10) / 10

/** Reduce a polyline to at most `max` points, keeping the ends. */
function decimate(points: Point[], max = 48): Point[] {
  if (points.length <= max) return points
  const out: Point[] = []
  const step = (points.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)])
  return out
}

export function extractSketch(doc: Doc): SketchShape[] {
  const out: SketchShape[] = []
  for (const shape of sortedShapes(doc)) {
    const b = shapeBounds(shape, doc)
    const s: SketchShape = { id: shape.id, type: shape.type, bounds: { x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h) } }
    if (shape.type === 'text' && shape.text.trim()) s.text = shape.text.trim()
    if (shape.type === 'draw') {
      const pts = shape.points.map(([x, y]) => ({ x: r1(x), y: r1(y) }))
      s.points = decimate(pts)
      s.closed = isClosedStroke(shape)
    }
    if (shape.type === 'arrow') {
      const { a, b: end } = arrowPoints(shape, doc)
      const bound = (e: ArrowEnd) => (e.id && doc.has(e.id) ? e.id : undefined)
      const startShapeId = bound(shape.start)
      const endShapeId = bound(shape.end)
      s.arrow = {
        start: { x: r1(a.x), y: r1(a.y) },
        end: { x: r1(end.x), y: r1(end.y) },
        ...(startShapeId ? { startShapeId } : {}),
        ...(endShapeId ? { endShapeId } : {}),
      }
      if (shape.text?.trim()) s.text = shape.text.trim()
    }
    out.push(s)
  }
  return out
}

// ---- file format ------------------------------------------------------------------------

/** canvas.json: valid JSON with one shape per line, sorted by id, so git diffs show which shapes changed. */
export function serializeCanvas(shapes: Iterable<Shape>): string {
  const list = [...shapes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const head = `{"format":"${CANVAS_FORMAT}","version":1,"shapes":[`
  if (!list.length) return head + ']}\n'
  return head + '\n' + list.map((s) => JSON.stringify(s)).join(',\n') + '\n]}\n'
}
