import { getStroke } from 'perfect-freehand'
import { INK_SIZE, type DrawShape, type InkPoint } from '@shared/canvas'
import type { Point } from '@shared/types'

// Pen strokes are filled outlines from perfect-freehand: a stylus gives real pressure, a
// finger or mouse gets pressure simulated from speed.

function options(pen: boolean, last: boolean) {
  return {
    size: INK_SIZE,
    // A Pencil's samples are already smooth: little streamlining keeps the ink at the tip.
    thinning: pen ? 0.5 : 0.5,
    smoothing: 0.5,
    streamline: pen ? 0.22 : 0.45,
    simulatePressure: !pen,
    last,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
  }
}

const f = (n: number) => Math.round(n * 100) / 100

/** A closed SVG path through an outline, smoothed with quadratic curves between midpoints. */
export function outlinePath(outline: number[][]): string {
  const n = outline.length
  if (!n) return ''
  if (n < 3) {
    const [x, y] = outline[0]
    return `M${f(x - 1)},${f(y)}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0Z`
  }
  let d = `M${f(outline[0][0])},${f(outline[0][1])}Q`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % n]
    d += `${f(x0)},${f(y0)} ${f((x0 + x1) / 2)},${f((y0 + y1) / 2)} `
  }
  return d + 'Z'
}

export function strokePath(points: InkPoint[], pen: boolean, last: boolean): string {
  return outlinePath(getStroke(points, options(pen, last)))
}

const cache = new WeakMap<DrawShape, string>()

export function drawShapePath(s: DrawShape): string {
  let d = cache.get(s)
  if (d === undefined) {
    d = strokePath(s.points, !!s.pen, true)
    cache.set(s, d)
  }
  return d
}

/** Shaft and head of an arrow from a to b, as two open paths. */
export function arrowPaths(a: Point, b: Point, bends: Point[] = []): { shaft: string; head: string } {
  const previous = bends.at(-1) ?? a
  const dx = b.x - previous.x, dy = b.y - previous.y
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const shaft = `M${f(a.x)},${f(a.y)}` + [...bends, b].map(p => `L${f(p.x)},${f(p.y)}`).join('')
  if (len < 1) return { shaft, head: '' }
  const finalLength = Math.hypot(dx, dy) || len
  const ux = dx / finalLength
  const uy = dy / finalLength
  const size = Math.min(18, Math.max(8, len * 0.35))
  const spread = 0.48
  const cos = Math.cos(spread)
  const sin = Math.sin(spread)
  const left = { x: b.x - size * (ux * cos - uy * sin), y: b.y - size * (uy * cos + ux * sin) }
  const right = { x: b.x - size * (ux * cos + uy * sin), y: b.y - size * (uy * cos - ux * sin) }
  return { shaft, head: `M${f(left.x)},${f(left.y)}L${f(b.x)},${f(b.y)}L${f(right.x)},${f(right.y)}` }
}

export const ARROW_WIDTH = 3.2
export const ARROW_LABEL_SIZE = 17
