// Draws a map of the existing code onto the canvas as ordinary ink (boxes, labels, arrows the
// user can move and erase like their own), and records it as the architecture with every
// component marked done, since it is already built.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { docBounds, extractSketch, TEXT_LINE, TEXT_SIZE, type InkPoint, type Shape } from '../shared/canvas.js'
import type { InterpretationResult, RepoMap, RepoMapEdge } from '../shared/types.js'
import { FILES, VibeprintCore, VibeprintError } from './core.js'

/** The last map drawn, so an untouched map can be replaced instead of piling up. */
interface MapRecord {
  shapeIds: string[]
  fingerprint: string
  origin: { x: number; y: number }
}

const BOX_H = 88
const GAP_X = 90
const GAP_Y = 130
const PER_ROW = 5
const MAX_NODES = 24
const r2 = (n: number) => Math.round(n * 100) / 100

const DATA = new Set(['database', 'cache', 'queue', 'storage', 'search'])
const CLIENT = new Set(['client', 'frontend', 'mobile', 'web'])
/** Data stores and other companies' APIs: the bottom row, under whatever uses them. */
const isBottom = (kind?: string) => DATA.has(kind ?? '') || kind === 'external'

/**
 * Rows by dependency depth: callers above what they call, so arrows point down and seldom run
 * along a row. Cycles are broken where a depth-first walk from the clients meets them.
 */
function rankRows(map: RepoMap): string[][] {
  const kind = new Map(map.nodes.map((n) => [n.id, n.kind]))
  const ids = map.nodes.map((n) => n.id)
  const upper = ids.filter((id) => !isBottom(kind.get(id)))
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
  const starts = [...upper].sort((a, b) => Number(!CLIENT.has(kind.get(a) ?? '')) - Number(!CLIENT.has(kind.get(b) ?? '')) || indeg.get(a)! - indeg.get(b)!)
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
  const bottom = [...ids.filter((id) => DATA.has(kind.get(id) ?? '')), ...ids.filter((id) => kind.get(id) === 'external')]
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
  const widest = Math.max(...lines.map((l) => place(l).total))

  const shapes: Shape[] = []
  const boxOf = new Map<string, string>()
  const nodeShapes = new Map<string, string[]>()
  let z = 1
  lines.forEach((line, row) => {
    const { xs, total } = place(line)
    const y = origin.y + row * (BOX_H + GAP_Y)
    line.forEach((id, i) => {
      const n = byId.get(id)!
      const w = width(id)
      const x = origin.x + (widest - total) / 2 + xs[i]
      const box = newId()
      const text = newId()
      const lw = labelWidth(n.label)
      shapes.push({ id: box, z: z++, type: 'draw', points: handBox(x, y, w, BOX_H, n.id), closed: true })
      shapes.push({ id: text, z: z++, type: 'text', x: r2(x + (w - lw) / 2), y: r2(y + (BOX_H - TEXT_SIZE * TEXT_LINE) / 2), w: lw, h: r2(TEXT_SIZE * TEXT_LINE), text: n.label, size: TEXT_SIZE })
      boxOf.set(id, box)
      nodeShapes.set(id, [box, text])
    })
  })
  const edges: Array<RepoMapEdge & { shapeId: string }> = []
  for (const e of map.edges) {
    const a = boxOf.get(e.from)
    const b = boxOf.get(e.to)
    if (!a || !b) continue
    const id = newId()
    const from = shapes.find((s) => s.id === a)!
    const to = shapes.find((s) => s.id === b)!
    const c = (s: Shape) => {
      const pts = s.type === 'draw' ? s.points : []
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      return { x: r2((Math.min(...xs) + Math.max(...xs)) / 2), y: r2((Math.min(...ys) + Math.max(...ys)) / 2) }
    }
    shapes.push({ id, z: z++, type: 'arrow', start: { ...c(from), id: a, nx: 0.5, ny: 0.5 }, end: { ...c(to), id: b, nx: 0.5, ny: 0.5 }, ...(e.label ? { text: e.label.slice(0, 40) } : {}) })
    edges.push({ ...e, shapeId: id })
  }
  return { shapes, nodeShapes, edges }
}

/**
 * Put a map of the code on the canvas and make it the architecture. `canvas` is every shape
 * on the canvas now; the caller applies the returned put/del to its copy of the canvas.
 */
export function mapCode(core: VibeprintCore, canvas: Shape[], input: RepoMap, author: string): MapPlan {
  const map = cleanMap(input)
  let prior: MapRecord | null = null
  try {
    prior = JSON.parse(fs.readFileSync(core.file(FILES.map), 'utf8'))
  } catch {}
  const byId = new Map(canvas.map((s) => [s.id, s]))
  // A map nobody has touched since it was drawn is replaced in place; an edited one stays.
  const priorShapes = prior?.shapeIds.map((id) => byId.get(id)).filter((s): s is Shape => !!s) ?? []
  const untouched = !!prior && priorShapes.length === prior.shapeIds.length && fingerprint(priorShapes) === prior.fingerprint
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
  core.addChat(
    'system',
    'vibeprint',
    `${author === 'vibeprint' ? 'Mapped the code' : `${author} mapped the code`}: ${map.nodes.length} component${map.nodes.length === 1 ? '' : 's'}, ${edges.length} connection${edges.length === 1 ? '' : 's'}${untouched ? ', replacing the previous map' : ''}. Edit it like your own sketch; your agent can check it against the code.`,
  )
  core.checkpoint(`vibeprint: map the code (${author}, sketch #${core.sketch!.seq})`)
  return { put: shapes, del, nodes: map.nodes.length, edges: edges.length, replaced: untouched }
}
