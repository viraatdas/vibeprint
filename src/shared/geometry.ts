import type { Point, Rect } from './types.js'

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  )
}

export function rectContainsPoint(r: Rect, p: Point, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad
}

export function rectContainsRect(outer: Rect, inner: Rect, pad = 0): boolean {
  return (
    inner.x >= outer.x - pad &&
    inner.y >= outer.y - pad &&
    inner.x + inner.w <= outer.x + outer.w + pad &&
    inner.y + inner.h <= outer.y + outer.h + pad
  )
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function rectArea(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h)
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 }
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distance from a point to the nearest edge of a rect (0 when inside). */
export function distToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
  return Math.hypot(dx, dy)
}

/** Point where the segment from the rect center toward `toward` leaves the rect. */
export function rectEdgePoint(r: Rect, toward: Point): Point {
  const c = rectCenter(r)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (dx === 0 && dy === 0) return c
  const sx = dx === 0 ? Infinity : r.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : r.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

export function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size === 0 && sb.size === 0) return 0
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  return inter / (sa.size + sb.size - inter)
}

export function round(n: number): number {
  return Math.round(n * 10) / 10
}

export function roundRect(r: Rect): Rect {
  return { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }
}

/**
 * Whether a freehand stroke outlines a closed shape. Pens rarely land exactly on the start:
 * a stroke counts as closed when its end comes back near its start, or when it passes back
 * by its start point late in the stroke (an overshoot). The length check keeps U and C
 * shapes, lines and arrows open.
 */
export function strokeIsClosed(pts: Point[], ratio = 0.15): boolean {
  if (pts.length < 5) return false
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const w = maxX - minX
  const h = maxY - minY
  const diag = Math.hypot(w, h)
  if (diag <= 30) return false
  const near = ratio * diag
  const first = pts[0]
  if (dist(first, pts[pts.length - 1]) < near) return true
  let length = 0
  for (let i = 1; i < pts.length; i++) length += dist(pts[i - 1], pts[i])
  if (length < 1.4 * (w + h)) return false
  // Walk the last third of the stroke: does it come back by the start?
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    walked += dist(pts[i - 1], pts[i])
    if (walked >= length * 0.66 && dist(pts[i], first) < near) return true
  }
  return false
}
