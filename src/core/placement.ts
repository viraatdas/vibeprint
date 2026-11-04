import { rectCenter, rectContainsPoint, rectsOverlap } from '../shared/geometry.js'
import { nodeRect, targetOrigin } from '../shared/graph.js'
import type { Graph, Mark, Point, Rect, Size, Sketch } from '../shared/types.js'

const GAP = 48

/** Everything already on the page: the user's ink, graph nodes, placed marks. */
export function obstacles(graph: Graph, sketch: Sketch | null, marks: Mark[]): Rect[] {
  const out: Rect[] = []
  for (const s of sketch?.shapes ?? []) out.push(s.bounds)
  for (const n of graph.nodes) {
    const r = nodeRect(graph, n.id)
    if (r) out.push(r)
  }
  // Edges the agent drew (accepted or proposed) are lines on the page too.
  const segments: Array<[Rect, Rect]> = []
  for (const e of graph.edges) {
    if (e.origin !== 'agent' || e.removed) continue
    const a = nodeRect(graph, e.from)
    const b = nodeRect(graph, e.to)
    if (a && b) segments.push([a, b])
  }
  for (const m of marks) {
    if (m.status !== 'pending' || m.type !== 'add') continue
    for (const e of m.data.edges ?? []) {
      const a = e.from === m.data.nodeId ? markBox(graph, m) : nodeRect(graph, e.from)
      const b = e.to === m.data.nodeId ? markBox(graph, m) : nodeRect(graph, e.to)
      if (a && b) segments.push([a, b])
    }
  }
  for (const [a, b] of segments) out.push(...sampleSegment(a, b))
  for (const m of marks) {
    if (m.status === 'rejected' || !m.data.offset || !m.data.size) continue
    const o = targetOrigin(graph, m.target)
    if (!o) continue
    // Add boxes carry a kind label underneath; notes may get an answer line.
    const extra = m.type === 'add' ? 28 : m.type === 'note' ? 24 : 0
    out.push({ x: o.x + m.data.offset.x, y: o.y + m.data.offset.y, w: m.data.size.w, h: m.data.size.h + extra })
  }
  return out
}

function markBox(graph: Graph, m: Mark): Rect | null {
  const o = targetOrigin(graph, m.target)
  if (!o || !m.data.offset || !m.data.size) return null
  return { x: o.x + m.data.offset.x, y: o.y + m.data.offset.y, w: m.data.size.w, h: m.data.size.h }
}

/** Small boxes along the line between two rects' centers (plus room for a label). */
function sampleSegment(a: Rect, b: Rect): Rect[] {
  const ca = rectCenter(a)
  const cb = rectCenter(b)
  const len = Math.hypot(cb.x - ca.x, cb.y - ca.y)
  const n = Math.max(1, Math.floor(len / 28))
  const out: Rect[] = []
  for (let i = 1; i < n; i++) {
    const t = i / n
    const x = ca.x + (cb.x - ca.x) * t
    const y = ca.y + (cb.y - ca.y) * t
    if (rectContainsPoint(a, { x, y }) || rectContainsPoint(b, { x, y })) continue
    out.push({ x: x - 10, y: y - 10, w: 20, h: 20 })
  }
  const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }
  out.push({ x: mid.x - 10, y: mid.y - 26, w: 70, h: 26 })
  return out
}

/**
 * Find a free spot for a box of `size` next to `anchor`, returned as an offset
 * from the anchor's top-left so the box follows the anchor when it moves.
 */
export function placeNear(anchor: Rect, size: Size, blockers: Rect[], prefer: 'side' | 'margin' = 'side'): Point {
  const { w, h } = size
  const candidates: Point[] = []
  for (let ring = 1; ring <= 4; ring++) {
    const g = GAP * ring
    const right = { x: anchor.x + anchor.w + g, y: anchor.y }
    const rightMid = { x: anchor.x + anchor.w + g, y: anchor.y + (anchor.h - h) / 2 }
    const below = { x: anchor.x, y: anchor.y + anchor.h + g }
    const left = { x: anchor.x - w - g, y: anchor.y }
    const above = { x: anchor.x, y: anchor.y - h - g }
    const rightLow = { x: anchor.x + anchor.w + g, y: anchor.y + h + GAP / 2 }
    const rightHigh = { x: anchor.x + anchor.w + g, y: anchor.y - h - GAP / 2 }
    if (prefer === 'margin') {
      const marginTop = { x: anchor.x + anchor.w + g / 2, y: anchor.y - Math.min(h, 24) }
      candidates.push(marginTop, above, rightLow, left, below)
    } else {
      candidates.push(rightMid, right, below, rightLow, rightHigh, left, above)
    }
  }
  for (const c of candidates) {
    const box = { x: c.x, y: c.y, w, h }
    if (!blockers.some((b) => rectsOverlap(box, b, 14))) {
      return { x: Math.round(c.x - anchor.x), y: Math.round(c.y - anchor.y) }
    }
  }
  return { x: Math.round(anchor.w + GAP), y: 0 }
}

/**
 * A free spot for a big box (a table): the nearest place around `anchor` that hits nothing,
 * preferring the right and below, so a database's tables gather beside it. Returned as an
 * offset from the anchor's top-left.
 */
export function placeAround(anchor: Rect, size: Size, blockers: Rect[]): Point {
  const STEP = 24
  const right = anchor.x + anchor.w
  const bottom = anchor.y + anchor.h
  let best: { x: number; y: number; cost: number } | null = null
  for (let x = anchor.x - size.w - 1600; x <= right + 2400; x += STEP) {
    for (let y = anchor.y - size.h - 600; y <= bottom + 2400; y += STEP) {
      const dx = x >= right ? x - right : x + size.w <= anchor.x ? anchor.x - (x + size.w) : 0
      const dy = y >= bottom ? y - bottom : y + size.h <= anchor.y ? anchor.y - (y + size.h) : 0
      if (!dx && !dy) continue
      let cost = Math.hypot(dx, dy) + Math.abs(y - anchor.y) * 0.15
      if (x + size.w <= anchor.x) cost += 400
      if (y + size.h <= anchor.y) cost += 250
      if (best && cost >= best.cost) continue
      if (blockers.some((b) => rectsOverlap({ x, y, w: size.w, h: size.h }, b, 24))) continue
      best = { x, y, cost }
    }
  }
  return best ? { x: Math.round(best.x - anchor.x), y: Math.round(best.y - anchor.y) } : { x: Math.round(anchor.w + GAP), y: 0 }
}
