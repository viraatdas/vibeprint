import type { Point, Rect } from '../shared/types.js'

/** True when a segment enters the rectangle's interior; touching a corner is allowed. */
export function crossesMapRect(a: Point, b: Point, r: Rect): boolean {
  let lo = 0, hi = 1
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.x + .01, r.x + r.w - .01], [a.y, b.y - a.y, r.y + .01, r.y + r.h - .01]]) {
    if (Math.abs(delta) < .0001) { if (start <= min || start >= max) return false; continue }
    const t1 = (min - start) / delta, t2 = (max - start) / delta
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2))
    if (lo >= hi) return false
  }
  return hi > 0 && lo < 1
}

/** Keep Dagre's route unless a boundary caption blocks it; detour around actual ink. */
export function avoidMapCaptions(points: Point[], captions: Rect[], obstacles: Rect[]): Point[] {
  const inside = (p: Point, r: Rect) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h
  const route = points.filter((p, i) => i === 0 || i === points.length - 1 || !obstacles.some(r => inside(p, r)))
  const out: Point[] = [route[0]]
  for (let i = 1; i < route.length; i++) {
    const a = out.at(-1)!, b = route[i]
    if (!obstacles.some(r => crossesMapRect(a, b, r))) { out.push(b); continue }
    const vertices = [a, b, ...obstacles.flatMap(r => [
      { x: r.x - 1, y: r.y - 1 }, { x: r.x + r.w + 1, y: r.y - 1 },
      { x: r.x + r.w + 1, y: r.y + r.h + 1 }, { x: r.x - 1, y: r.y + r.h + 1 },
    ]).filter(p => !obstacles.some(r => inside(p, r)))]
    const distances = vertices.map(() => Infinity), previous = vertices.map(() => -1), visited = new Set<number>()
    distances[0] = 0
    while (visited.size < vertices.length) {
      let nearest = -1
      for (let v = 0; v < vertices.length; v++) if (!visited.has(v) && (nearest < 0 || distances[v] < distances[nearest])) nearest = v
      if (nearest < 0 || !Number.isFinite(distances[nearest]) || nearest === 1) break
      visited.add(nearest)
      for (let v = 0; v < vertices.length; v++) {
        if (visited.has(v) || v === nearest || obstacles.some(r => crossesMapRect(vertices[nearest], vertices[v], r))) continue
        const distance = distances[nearest] + Math.hypot(vertices[v].x - vertices[nearest].x, vertices[v].y - vertices[nearest].y)
        if (distance < distances[v]) { distances[v] = distance; previous[v] = nearest }
      }
    }
    if (previous[1] < 0) { out.push(b); continue }
    const detour = [b]
    for (let v = previous[1]; v > 0; v = previous[v]) detour.unshift(vertices[v])
    out.push(...detour)
  }
  return out
}
