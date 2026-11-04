import type { InkPoint } from '../shared/canvas.js'

/** Editable outlines: stores use cylinders; all other runtime actors use boxes. */
export function mapBoxPoints(x: number, y: number, w: number, h: number, kind?: string): InkPoint[] {
  const points: InkPoint[] = []
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10))
    for (let i = 0; i <= count; i++) points.push([ax + (bx - ax) * i / count, ay + (by - ay) * i / count, .5])
  }
  if (['database', 'storage', 'cache'].includes(kind || '')) {
    const radius = 10, cx = x + w / 2
    const arc = (cy: number, start: number, end: number) => {
      for (let i = 0; i <= 40; i++) {
        const angle = start + (end - start) * i / 40
        points.push([cx + w / 2 * Math.cos(angle), cy + radius * Math.sin(angle), .5])
      }
    }
    arc(y + radius, Math.PI, Math.PI * 2)
    line(x + w, y + radius, x + w, y + h - radius)
    arc(y + h - radius, 0, Math.PI)
    line(x, y + h - radius, x, y + radius)
    arc(y + radius, Math.PI, 0)
  } else {
    line(x, y, x + w, y)
    line(x + w, y, x + w, y + h)
    line(x + w, y + h, x, y + h)
    line(x, y + h, x, y)
  }
  return points
}
