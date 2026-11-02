// Hand-drawn path generators for the agent's pen. Deterministic per seed so a
// mark looks the same on the iPad and the laptop, and doesn't shimmer on render.
import type { Point, Rect } from '@shared/types'

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rng(seed: number) {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n: number) => Math.round(n * 10) / 10

/** Smooth a polyline into a path using quadratic curves through midpoints. */
function smooth(points: Point[], move = true): string {
  if (points.length < 2) return ''
  let d = move ? `M${f(points[0].x)},${f(points[0].y)}` : `L${f(points[0].x)},${f(points[0].y)}`
  if (points.length === 2) return d + ` L${f(points[1].x)},${f(points[1].y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const n = points[i + 1]
    d += ` Q${f(p.x)},${f(p.y)} ${f((p.x + n.x) / 2)},${f((p.y + n.y) / 2)}`
  }
  const last = points[points.length - 1]
  return d + ` L${f(last.x)},${f(last.y)}`
}

/** Points along a wobbly line from a to b. */
function wobble(a: Point, b: Point, r: () => number, amp = 1.6, overshoot = 0): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const nx = -uy
  const ny = ux
  const start = { x: a.x - ux * overshoot * r(), y: a.y - uy * overshoot * r() }
  const end = { x: b.x + ux * overshoot * r(), y: b.y + uy * overshoot * r() }
  const segs = Math.max(2, Math.min(7, Math.round(len / 45)))
  const bow = (r() - 0.5) * Math.min(6, len * 0.025)
  const pts: Point[] = [start]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const along = Math.sin(t * Math.PI) * bow + (r() - 0.5) * amp
    pts.push({ x: start.x + (end.x - start.x) * t + nx * along, y: start.y + (end.y - start.y) * t + ny * along })
  }
  pts.push(end)
  return pts
}

export function roughLine(a: Point, b: Point, seed: number, amp = 1.4): string {
  return smooth(wobble(a, b, rng(seed), amp, 2))
}

/** A box drawn in one continuous stroke, closing with a slight overshoot. */
export function roughRect(rect: Rect, seed: number): string {
  const r = rng(seed)
  const j = () => (r() - 0.5) * 3
  const { x, y, w, h } = rect
  const tl = { x: x + j(), y: y + j() }
  const tr = { x: x + w + j(), y: y + j() }
  const br = { x: x + w + j(), y: y + h + j() }
  const bl = { x: x + j(), y: y + h + j() }
  const pts = [
    ...wobble(tl, tr, r, 1.4),
    ...wobble(tr, br, r, 1.4).slice(1),
    ...wobble(br, bl, r, 1.4).slice(1),
    ...wobble(bl, { x: tl.x + 1.5, y: tl.y + 1 }, r, 1.4).slice(1),
    { x: tl.x + Math.min(18, w * 0.15), y: tl.y + (r() - 0.5) * 2 },
  ]
  // Round the corners a touch, the way a pen turns.
  return smooth(pts)
}

export function roughEllipse(rect: Rect, seed: number): string {
  const r = rng(seed)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const rx = rect.w / 2
  const ry = rect.h / 2
  const start = r() * Math.PI * 2
  const pts: Point[] = []
  const n = 22
  for (let i = 0; i <= n + 2; i++) {
    const a = start + (i / n) * Math.PI * 2
    const k = 1 + (r() - 0.5) * 0.04
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k })
  }
  return smooth(pts)
}

/** Arrow body (curving a little) and head as separate paths so they draw in order. */
export function roughArrow(a: Point, b: Point, seed: number): { body: string; head: string } {
  const r = rng(seed)
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const nx = -uy
  const ny = ux
  const bend = (r() - 0.5) * Math.min(24, len * 0.12)
  const mid = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend }
  const pts: Point[] = []
  const n = Math.max(4, Math.min(10, Math.round(len / 30)))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x
    const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y
    const jitter = i === 0 || i === n ? 0 : (r() - 0.5) * 1.4
    pts.push({ x: x + nx * jitter, y: y + ny * jitter })
  }
  // Head follows the curve's final direction.
  const prev = pts[pts.length - 2]
  const dl = Math.hypot(b.x - prev.x, b.y - prev.y) || 1
  const dx = (b.x - prev.x) / dl
  const dy = (b.y - prev.y) / dl
  const size = Math.min(16, Math.max(10, len * 0.12))
  const spread = 0.48 + (r() - 0.5) * 0.1
  const left = { x: b.x - size * (dx * Math.cos(spread) - dy * Math.sin(spread)), y: b.y - size * (dy * Math.cos(spread) + dx * Math.sin(spread)) }
  const right = { x: b.x - size * (dx * Math.cos(-spread) - dy * Math.sin(-spread)), y: b.y - size * (dy * Math.cos(-spread) + dx * Math.sin(-spread)) }
  const head = `M${f(left.x)},${f(left.y)} L${f(b.x + (r() - 0.5))},${f(b.y + (r() - 0.5))} L${f(right.x)},${f(right.y)}`
  return { body: smooth(pts), head }
}

export function checkMark(at: Point, size: number, seed: number): string {
  const r = rng(seed)
  const a = { x: at.x - size * 0.5, y: at.y }
  const b = { x: at.x - size * 0.12 + (r() - 0.5) * 2, y: at.y + size * 0.4 }
  const c = { x: at.x + size * 0.55, y: at.y - size * 0.5 + (r() - 0.5) * 2 }
  return smooth([a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 1 }, b, { x: (b.x + c.x) / 2 - 1, y: (b.y + c.y) / 2 }, c])
}

/** A single decisive slash through a rect. */
export function strikeThrough(rect: Rect, seed: number): string {
  const r = rng(seed)
  const pad = 6
  const a = { x: rect.x - pad + r() * 4, y: rect.y + rect.h + pad - r() * 4 }
  const b = { x: rect.x + rect.w + pad - r() * 4, y: rect.y - pad + r() * 4 }
  return smooth(wobble(a, b, r, 2.2, 3))
}

export function crossAt(c: Point, size: number, seed: number): string[] {
  return [
    roughLine({ x: c.x - size, y: c.y - size }, { x: c.x + size, y: c.y + size }, seed, 1),
    roughLine({ x: c.x + size, y: c.y - size }, { x: c.x - size, y: c.y + size }, seed + 7, 1),
  ]
}

/** Underline used beneath a rewritten label. */
export function underline(x: number, y: number, w: number, seed: number): string {
  return roughLine({ x, y }, { x: x + w, y: y + (rng(seed)() - 0.5) * 3 }, seed, 1.2)
}
