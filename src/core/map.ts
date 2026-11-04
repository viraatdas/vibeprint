// Draws a map of the existing code onto the canvas as ordinary ink (boxes, labels, arrows the
// user can move and erase like their own), and records it as the architecture with every
// component marked done, since it is already built.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { arrowPoints, docBounds, extractSketch, shapeBounds, TEXT_LINE, TEXT_SIZE, type InkPoint, type Shape } from '../shared/canvas.js'
import type { InterpretationResult, RepoMap, RepoMapEdge } from '../shared/types.js'
import { FILES, VibeprintCore, VibeprintError } from './core.js'

/** The last map drawn, so an untouched map can be replaced instead of piling up. */
interface MapRecord {
  shapeIds: string[]
  fingerprint: string
  origin: { x: number; y: number }
}

// Generous gaps: the map is something to sketch on, and the arrows need room to read.
const BOX_H = 88
const GAP_X = 150
const GAP_Y = 180
const PER_ROW = 4
const MAX_NODES = 24
const r2 = (n: number) => Math.round(n * 100) / 100

const DATA = new Set(['database', 'cache', 'queue', 'storage', 'search'])
const CLIENT = new Set(['client', 'frontend', 'mobile', 'web'])

/**
 * Rows by dependency depth: callers above what they call, so arrows point down and seldom run
 * along a row. Cycles are broken where a depth-first walk from the clients meets them.
 */
function rankRows(map: RepoMap): string[][] {
  const kind = new Map(map.nodes.map((n) => [n.id, n.kind]))
  const ids = map.nodes.map((n) => n.id)
  // Something outside that only calls in (a coding agent, a webhook sender) is drawn with the
  // clients at the top; data stores and the outside services the code calls go on the bottom row.
  const caller = (id: string) => map.edges.some((e) => e.from === id) && !map.edges.some((e) => e.to === id)
  const atBottom = (id: string) => DATA.has(kind.get(id) ?? '') || (kind.get(id) === 'external' && !caller(id))
  const top = (id: string) => CLIENT.has(kind.get(id) ?? '') || (kind.get(id) === 'external' && caller(id))
  const upper = ids.filter((id) => !atBottom(id))
  const out = new Map(upper.map((id) => [id, [] as string[]]))
  const indeg = new Map(upper.map((id) => [id, 0]))
  for (const e of map.edges) {
    if (!out.has(e.from) || !out.has(e.to)) continue
    out.get(e.from)!.push(e.to)
    indeg.set(e.to, indeg.get(e.to)! + 1)
  }
  const state = new Map<string, 1 | 2>()
  const dag = new Map(upper.map((id) => [id, [] as string[]]))
  const visit = (id: string) => {
    state.set(id, 1)
    for (const t of out.get(id)!) {
      if (state.get(t) === 1) continue // back edge: part of a cycle
      dag.get(id)!.push(t)
      if (!state.has(t)) visit(t)
    }
    state.set(id, 2)
  }
  const starts = [...upper].sort((a, b) => Number(!top(a)) - Number(!top(b)) || indeg.get(a)! - indeg.get(b)!)
  for (const id of starts) if (!state.has(id)) visit(id)
  // Longest path from the top, over the acyclic edges.
  const rank = new Map<string, number>()
  const depth = (id: string): number => {
    if (rank.has(id)) return rank.get(id)!
    const parents = upper.filter((p) => dag.get(p)!.includes(id))
    const r = parents.length ? Math.max(...parents.map((p) => depth(p) + 1)) : 0
    rank.set(id, r)
    return r
  }
  for (const id of upper) depth(id)
  const linked = new Set(map.edges.flatMap((e) => [e.from, e.to]))
  const maxRank = Math.max(0, ...upper.filter((id) => linked.has(id)).map((id) => rank.get(id)!))
  // A component nothing connects to sits with the clients if it is one, else just below them.
  for (const id of upper) if (!linked.has(id)) rank.set(id, CLIENT.has(kind.get(id) ?? '') ? 0 : Math.min(1, maxRank))
  const rows: string[][] = Array.from({ length: Math.max(0, ...rank.values()) + 1 }, () => [])
  for (const id of upper) rows[rank.get(id)!].push(id)
  const bottom = [...ids.filter((id) => DATA.has(kind.get(id) ?? '')), ...ids.filter((id) => kind.get(id) === 'external' && atBottom(id))]
  return [...rows.filter((r) => r.length), ...(bottom.length ? [bottom] : [])]
}

function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** A rectangle drawn in one pen stroke: slightly uneven, closing just past where it started. */
function handBox(x: number, y: number, w: number, h: number, seed: string): InkPoint[] {
  const rnd = rng(seed)
  const j = (a: number) => (rnd() - 0.5) * 2 * a
  const corners = [
    [x + j(2), y + j(2)],
    [x + w + j(2), y + j(2)],
    [x + w + j(2), y + h + j(2)],
    [x + j(2), y + h + j(2)],
    [x + j(2), y + 4 + j(1)],
  ]
  const pts: InkPoint[] = []
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1]
    const [bx, by] = corners[i]
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 12))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      pts.push([r2(ax + (bx - ax) * t + j(0.6)), r2(ay + (by - ay) * t + j(0.6)), 0.5])
    }
  }
  pts.push([r2(corners[4][0]), r2(corners[4][1]), 0.5])
  return pts
}

/** Drawn as a cylinder, the way a data store is drawn on a whiteboard. */
const CYLINDER = new Set(['database', 'cache', 'storage'])
const CYL_H = BOX_H + 12

/**
 * A cylinder in two strokes: the outline (the back of the lid, the sides and the bottom) and
 * the front of the lid. Arrows attach to the outline.
 */
function handCylinder(x: number, y: number, w: number, h: number, seed: string): { body: InkPoint[]; lip: InkPoint[] } {
  const rnd = rng(seed)
  const j = (a: number) => (rnd() - 0.5) * 2 * a
  const rx = w / 2
  const ry = Math.min(14, h * 0.16)
  const cx = x + rx
  const top = y + ry
  const bottom = y + h - ry
  const pt = (px: number, py: number): InkPoint => [r2(px + j(0.6)), r2(py + j(0.6)), 0.5]
  const arc = (out: InkPoint[], cy: number, from: number, to: number) => {
    const n = 20
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n
      out.push(pt(cx + rx * Math.cos(t), cy + ry * Math.sin(t)))
    }
  }
  const line = (out: InkPoint[], ax: number, ay: number, by: number) => {
    const steps = Math.max(2, Math.ceil(Math.abs(by - ay) / 12))
    for (let i = 1; i < steps; i++) out.push(pt(ax, ay + ((by - ay) * i) / steps))
  }
  const body: InkPoint[] = []
  arc(body, top, Math.PI, 2 * Math.PI) // the back of the lid, left to right
  line(body, x + w, top, bottom)
  arc(body, bottom, 0, Math.PI) // the bottom, right to left
  line(body, x, bottom, top)
  body.push(pt(x, top + 2))
  const lip: InkPoint[] = []
  arc(lip, top, Math.PI, 0)
  return { body, lip }
}

const labelWidth = (text: string, size = TEXT_SIZE) => Math.round(text.length * size * 0.54)
const newId = () => 'shape:map' + crypto.randomBytes(8).toString('base64url').replace(/[^\w-]/g, '')
const fingerprint = (shapes: Shape[]) =>
  crypto.createHash('sha256').update(JSON.stringify([...shapes].sort((a, b) => (a.id < b.id ? -1 : 1)))).digest('hex')

export interface MapPlan {
  put: Shape[]
  del: string[]
  nodes: number
  edges: number
  replaced: boolean
}

/** Validate a map from a coding agent: unique ids, edges between known nodes, sane sizes. */
export function cleanMap(map: RepoMap): RepoMap {
  if (!map || !Array.isArray(map.nodes)) throw new VibeprintError('map needs { nodes: [...], edges: [...] }')
  const seen = new Set<string>()
  const nodes = map.nodes
    .filter((n) => n && typeof n.id === 'string' && typeof n.label === 'string' && n.label.trim() && !seen.has(n.id) && seen.add(n.id))
    .slice(0, MAX_NODES)
    .map((n) => ({ ...n, label: n.label.trim().slice(0, 40), tags: (n.tags ?? []).filter((t) => typeof t === 'string').slice(0, 3) }))
  if (!nodes.length) throw new VibeprintError('The map has no components. Give each node an id and a label.')
  const ids = new Set(nodes.map((n) => n.id))
  const edges = (map.edges ?? []).filter((e) => e && ids.has(e.from) && ids.has(e.to) && e.from !== e.to).slice(0, 60)
  return { nodes, edges }
}

/** Lay the map out in rows (clients, then services, then data) and turn it into shapes. */
function drawMap(map: RepoMap, origin: { x: number; y: number }) {
  const byId = new Map(map.nodes.map((n) => [n.id, n]))
  const lines = rankRows(map).flatMap((r) => Array.from({ length: Math.ceil(r.length / PER_ROW) }, (_, i) => r.slice(i * PER_ROW, (i + 1) * PER_ROW)))

  const width = (id: string) => Math.min(280, Math.max(150, labelWidth(byId.get(id)!.label) + 56))
  const neighbours = new Map(map.nodes.map((n) => [n.id, map.edges.flatMap((e) => (e.from === n.id ? [e.to] : e.to === n.id ? [e.from] : []))]))
  const place = (line: string[]) => {
    let x = 0
    const out = line.map((id) => {
      const at = x
      x += width(id) + GAP_X
      return at
    })
    return { xs: out, total: x - GAP_X }
  }
  // Each line's x centers, relative to the middle of the line.
  const center = new Map<string, number>()
  const settle = (line: string[]) => {
    const { xs, total } = place(line)
    line.forEach((id, i) => center.set(id, xs[i] - total / 2 + width(id) / 2))
  }
  lines.forEach(settle)
  // Sort each line under (then over) what it connects to, so arrows cross less. Components with
  // no neighbours in the reference lines keep their place; externals stay at the end.
  const sweep = (line: string[], ref: Set<string>) => {
    const score = (id: string) => {
      const xs = neighbours.get(id)!.filter((n) => ref.has(n)).map((n) => center.get(n)!)
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : center.get(id)!
    }
    const scored = new Map(line.map((id) => [id, score(id)]))
    const last = (id: string) => Number(byId.get(id)!.kind === 'external')
    line.sort((a, b) => last(a) - last(b) || scored.get(a)! - scored.get(b)!)
    settle(line)
  }
  for (let pass = 0; pass < 3; pass++) {
    const order = pass % 2 ? [...lines.keys()].reverse() : [...lines.keys()]
    order.forEach((li, k) => {
      if (k === 0) return
      const ref = new Set((pass % 2 ? lines.slice(li + 1) : lines.slice(0, li)).flat())
      sweep(lines[li], ref)
    })
  }
  // Then move components within their line wherever that keeps arrows out of other boxes
  // and crossing less, judged on the real geometry.
  // Each line may also slide sideways from the center, so a lone box can step out of the way.
  const shift = lines.map(() => 0)
  const SLIDE = 80
  const rectsOf = (ls: string[][]) => {
    const wide = Math.max(...ls.map((l) => place(l).total))
    const out = new Map<string, { x: number; y: number; w: number; h: number }>()
    ls.forEach((line, row) => {
      const { xs, total } = place(line)
      line.forEach((id, i) => out.set(id, { x: (wide - total) / 2 + shift[row] * SLIDE + xs[i], y: row * (BOX_H + GAP_Y), w: width(id), h: BOX_H }))
    })
    return out
  }
  const cost = (ls: string[][]) => {
    const r = rectsOf(ls)
    const mid = (id: string) => ({ x: r.get(id)!.x + r.get(id)!.w / 2, y: r.get(id)!.y + BOX_H / 2 })
    const segs = map.edges.filter((e) => r.has(e.from) && r.has(e.to)).map((e) => ({ e, a: mid(e.from), b: mid(e.to) }))
    let c = 0
    for (const { e, a, b } of segs) {
      for (const [id, box] of r) if (id !== e.from && id !== e.to && segmentHitsRect(a, b, box, 10)) c += 10
      c += Math.abs(a.x - b.x) / 1000 // shorter arrows break ties
    }
    for (const k of shift) c += Math.abs(k) / 100 // and centered lines
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++) {
        const p = segs[i].e
        const q = segs[j].e
        if (p.from === q.from || p.from === q.to || p.to === q.from || p.to === q.to) continue
        if (segmentsCross(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) c += 1
      }
    return c
  }
  let best = cost(lines)
  for (let round = 0; round < 6 && best > 0; round++) {
    let improved = false
    for (let li = 0; li < lines.length; li++) {
      const keep = shift[li]
      for (let k = -3; k <= 3; k++) {
        if (k === keep) continue
        shift[li] = k
        const c = cost(lines)
        if (c < best - 1e-9) {
          best = c
          improved = true
        } else shift[li] = keep
        if (shift[li] !== keep) break
      }
    }
    for (const line of lines) {
      for (const id of [...line]) {
        if (byId.get(id)!.kind === 'external') continue
        const from = line.indexOf(id)
        for (let to = 0; to < line.length; to++) {
          if (to === from) continue
          const trial = [...line]
          trial.splice(from, 1)
          trial.splice(to, 0, id)
          const saved = [...line]
          line.splice(0, line.length, ...trial)
          const c = cost(lines)
          if (c < best - 1e-9) {
            best = c
            improved = true
            break
          }
          line.splice(0, line.length, ...saved)
        }
      }
    }
    if (!improved) break
  }

  const shapes: Shape[] = []
  const boxOf = new Map<string, string>()
  const nodeShapes = new Map<string, string[]>()
  let z = 1
  const final = rectsOf(lines)
  const left = Math.min(...[...final.values()].map((r) => r.x))
  const at = new Map<string, { x: number; y: number; w: number; h: number }>()
  lines.forEach((line, row) => {
    const y = origin.y + row * (BOX_H + GAP_Y)
    line.forEach((id) => {
      const n = byId.get(id)!
      const w = width(id)
      const x = origin.x + final.get(id)!.x - left
      const box = newId()
      const text = newId()
      const lw = labelWidth(n.label)
      const th = TEXT_SIZE * TEXT_LINE
      const ids = [box, text]
      if (CYLINDER.has(n.kind ?? '')) {
        const { body, lip } = handCylinder(x, y, w, CYL_H, n.id)
        const lid = newId()
        shapes.push({ id: box, z: z++, type: 'draw', points: body, closed: true })
        shapes.push({ id: lid, z: z++, type: 'draw', points: lip })
        // The label sits on the face, under the lid.
        shapes.push({ id: text, z: z++, type: 'text', x: r2(x + (w - lw) / 2), y: r2(y + 28 + (CYL_H - 28 - th) / 2 - 4), w: lw, h: r2(th), text: n.label, size: TEXT_SIZE })
        ids.push(lid)
        at.set(id, { x, y, w, h: CYL_H })
      } else {
        shapes.push({ id: box, z: z++, type: 'draw', points: handBox(x, y, w, BOX_H, n.id), closed: true })
        shapes.push({ id: text, z: z++, type: 'text', x: r2(x + (w - lw) / 2), y: r2(y + (BOX_H - th) / 2), w: lw, h: r2(th), text: n.label, size: TEXT_SIZE })
        at.set(id, { x, y, w, h: BOX_H })
      }
      boxOf.set(id, box)
      nodeShapes.set(id, ids)
    })
  })
  // Arrows meeting the same side of a box spread out along it, in the order of where they
  // come from, instead of all landing on its middle.
  const drawn = map.edges.filter((e) => boxOf.has(e.from) && boxOf.has(e.to))
  const mid = (id: string) => ({ x: at.get(id)!.x + at.get(id)!.w / 2, y: at.get(id)!.y + at.get(id)!.h / 2 })
  const sides = new Map<string, Array<{ key: string; along: number }>>()
  const anchor = new Map<string, { nx: number; ny: number }>()
  drawn.forEach((e, i) => {
    for (const [self, other, key] of [[e.from, e.to, `${i}s`], [e.to, e.from, `${i}e`]] as const) {
      const a = mid(self)
      const b = mid(other)
      const vertical = Math.abs(b.y - a.y) > BOX_H / 2
      const side = vertical ? (b.y < a.y ? 'top' : 'bottom') : b.x < a.x ? 'left' : 'right'
      const list = sides.get(`${self}:${side}`) ?? []
      list.push({ key, along: vertical ? b.x : b.y })
      sides.set(`${self}:${side}`, list)
    }
  })
  for (const [where, list] of sides) {
    const vertical = where.endsWith(':top') || where.endsWith(':bottom')
    list.sort((p, q) => p.along - q.along)
    const step = Math.min(0.2, 0.56 / list.length)
    list.forEach(({ key }, k) => {
      const f = r2(0.5 + (k - (list.length - 1) / 2) * step * (vertical ? 1 : 0.8))
      anchor.set(key, vertical ? { nx: f, ny: 0.5 } : { nx: 0.5, ny: f })
    })
  }
  const edges: Array<RepoMapEdge & { shapeId: string }> = []
  drawn.forEach((e, i) => {
    const id = newId()
    const end = (node: string, key: string) => {
      const r = at.get(node)!
      const { nx, ny } = anchor.get(key) ?? { nx: 0.5, ny: 0.5 }
      return { x: r2(r.x + nx * r.w), y: r2(r.y + ny * r.h), id: boxOf.get(node)!, nx, ny }
    }
    shapes.push({ id, z: z++, type: 'arrow', start: end(e.from, `${i}s`), end: end(e.to, `${i}e`), ...(e.label ? { text: e.label.slice(0, 40) } : {}) })
    edges.push({ ...e, shapeId: id })
  })
  // An edge label sits at the middle of its arrow. Where it would land on a box or another
  // label it stays off the canvas (the architecture keeps it).
  const doc = new Map(shapes.map((s) => [s.id, s]))
  const boxes = shapes.filter((s) => s.type === 'draw').map((s) => shapeBounds(s, doc))
  const placed: Array<{ x: number; y: number; w: number; h: number }> = []
  for (const s of shapes) {
    if (s.type !== 'arrow' || !s.text) continue
    const { a, b } = arrowPoints(s, doc)
    const w = s.text.length * ARROW_LABEL * 0.55 + 10
    const r = { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - 13, w, h: 26 }
    const hit = (o: { x: number; y: number; w: number; h: number }) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h
    if (boxes.some(hit) || placed.some(hit) || Math.hypot(b.x - a.x, b.y - a.y) < w + 30) delete s.text
    else placed.push(r)
  }
  return { shapes, nodeShapes, edges }
}

/** Arrow label size on the canvas (web/src/canvas/ink.ts ARROW_LABEL_SIZE). */
const ARROW_LABEL = 17

function segmentsCross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean {
  const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

/** Whether segment a-b passes through rectangle r grown by `pad` (Liang-Barsky). */
function segmentHitsRect(a: { x: number; y: number }, b: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }, pad: number): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
    return true
  }
  return (
    clip(-dx, a.x - (r.x - pad)) && clip(dx, r.x + r.w + pad - a.x) && clip(-dy, a.y - (r.y - pad)) && clip(dy, r.y + r.h + pad - a.y) && t0 <= t1
  )
}

/**
 * Put a map of the code on the canvas and make it the architecture. `canvas` is every shape
 * on the canvas now; the caller applies the returned put/del to its copy of the canvas.
 */
function readRecord(core: VibeprintCore): MapRecord | null {
  try {
    return JSON.parse(fs.readFileSync(core.file(FILES.map), 'utf8'))
  } catch {
    return null
  }
}

/** Whether the last map drawn is still on the canvas exactly as drawn. */
export function mapState(core: VibeprintCore, canvas: Shape[]): 'none' | 'untouched' | 'edited' {
  const prior = readRecord(core)
  if (!prior) return 'none'
  const byId = new Map(canvas.map((s) => [s.id, s]))
  const shapes = prior.shapeIds.map((id) => byId.get(id)).filter((s): s is Shape => !!s)
  return shapes.length === prior.shapeIds.length && fingerprint(shapes) === prior.fingerprint ? 'untouched' : 'edited'
}

export function mapCode(core: VibeprintCore, canvas: Shape[], input: RepoMap, author: string, opts: { chat?: string } = {}): MapPlan {
  const map = cleanMap(input)
  const prior = readRecord(core)
  const byId = new Map(canvas.map((s) => [s.id, s]))
  // A map nobody has touched since it was drawn is replaced in place; an edited one stays.
  const untouched = mapState(core, canvas) === 'untouched'
  const del = untouched ? prior!.shapeIds : []
  for (const id of del) byId.delete(id)

  const rest = new Map(byId)
  const b = docBounds(rest)
  const origin = untouched ? prior!.origin : b ? { x: r2(b.x + b.w + 200), y: r2(b.y) } : { x: 0, y: 0 }
  const { shapes, nodeShapes, edges } = drawMap(map, origin)
  for (const s of shapes) byId.set(s.id, s)

  // The rest of the graph stays as it is; the map's components join it.
  const keepNodes = core.graph.nodes.filter((n) => n.origin === 'ink' && n.shapeIds.some((id) => rest.has(id)))
  const keptIds = new Set(keepNodes.map((n) => n.id))
  const result: InterpretationResult = {
    nodes: [
      ...keepNodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind, tags: n.tags, shapeIds: n.shapeIds.filter((id) => rest.has(id)), description: n.description, ...(n.fromCode ? { fromCode: true } : {}) })),
      ...map.nodes.map((n) => ({
        id: `map:${n.id}`,
        label: n.label,
        kind: n.kind,
        tags: [...(n.tags ?? []), ...(n.path ? [n.path] : [])].slice(0, 3),
        shapeIds: nodeShapes.get(n.id) ?? [],
        description: n.description ?? (n.path ? `Code: ${n.path}` : undefined),
        fromCode: true,
      })),
    ],
    edges: [
      ...core.graph.edges
        .filter((e) => e.origin === 'ink' && keptIds.has(e.from) && keptIds.has(e.to))
        .map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label, shapeIds: e.shapeIds.filter((id) => rest.has(id)) })),
      ...edges.map((e) => ({ from: `map:${e.from}`, to: `map:${e.to}`, label: e.label, shapeIds: [e.shapeId] })),
    ],
  }

  core.recordSubmission(extractSketch(byId), undefined, undefined, { source: 'map' })
  core.applyInterpretation(result, author, { quiet: true })
  const mapped = new Set(shapes.map((s) => s.id))
  core.markBuilt(core.graph.nodes.filter((n) => n.shapeIds.some((id) => mapped.has(id))).map((n) => n.id))
  const record: MapRecord = { shapeIds: shapes.map((s) => s.id), fingerprint: fingerprint(shapes), origin }
  core.writeFileAtomic(FILES.map, JSON.stringify(record) + '\n')
  const counts = `${map.nodes.length} component${map.nodes.length === 1 ? '' : 's'}, ${edges.length} connection${edges.length === 1 ? '' : 's'}`
  core.addChat(
    'system',
    'vibeprint',
    opts.chat ? `${opts.chat}: ${counts}.` : `${author === 'vibeprint' ? 'Mapped the code' : `${author} mapped the code`}: ${map.nodes.length} component${map.nodes.length === 1 ? '' : 's'}, ${edges.length} connection${edges.length === 1 ? '' : 's'}${untouched ? ', replacing the previous map' : ''}. Edit it like your own sketch; your agent can check it against the code.`,
  )
  core.checkpoint(`vibeprint: map the code (${author}, sketch #${core.sketch!.seq})`)
  return { put: shapes, del, nodes: map.nodes.length, edges: edges.length, replaced: untouched }
}
