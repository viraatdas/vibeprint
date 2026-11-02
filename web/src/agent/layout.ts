// Turns graph + marks into page-space geometry, using the live position of the
// user's shapes so every mark follows its target when it is dragged.
import { expandRect, rectCenter, rectEdgePoint, unionRects } from '@shared/geometry'
import { edgeLabel, nodeLabel, nodeRect, targetRect, type BoundsLookup } from '@shared/graph'
import { wrapText } from '@shared/marks'
import type { Graph, GraphNode, Mark, Point, Rect, VibeprintState } from '@shared/types'

export type Part =
  | { t: 'box'; rect: Rect; dashed: boolean; fill?: boolean }
  | { t: 'arrow'; a: Point; b: Point; dashed: boolean }
  | { t: 'text'; x: number; y: number; text: string; size: number; anchor?: 'start' | 'middle' }
  | { t: 'strike'; rect: Rect }
  | { t: 'cross'; c: Point }
  | { t: 'underline'; x: number; y: number; w: number }
  | { t: 'note'; rect: Rect; lines: string[]; question: boolean; answer?: string }
  | { t: 'leader'; a: Point; b: Point }

export interface MarkGeom {
  mark: Mark
  parts: Part[]
  /** Where the tap target sits (page space). */
  badge: Point
  bounds: Rect
}

export interface NodeGeom {
  node: GraphNode
  rect: Rect
}

export interface Layout {
  nodes: NodeGeom[]
  agentEdges: Array<{ id: string; a: Point; b: Point; removed: boolean; label?: string }>
  marks: MarkGeom[]
  /** Shape ids to dim because their node/edge was struck. */
  dimmed: string[]
}

function connect(a: Rect, b: Rect): { a: Point; b: Point } {
  const pa = rectEdgePoint(expandRect(a, 6), rectCenter(b))
  const pb = rectEdgePoint(expandRect(b, 8), rectCenter(a))
  return { a: pa, b: pb }
}

function textWidth(text: string, size: number) {
  return text.length * size * 0.52
}

export function computeLayout(vp: VibeprintState, lookup: BoundsLookup): Layout {
  const g: Graph = vp.graph
  const nodes: NodeGeom[] = []
  const dimmed: string[] = []
  for (const n of g.nodes) {
    const rect = nodeRect(g, n.id, lookup)
    if (rect) nodes.push({ node: n, rect })
    if (n.removed) dimmed.push(...n.shapeIds)
  }
  const rectOf = new Map(nodes.map((x) => [x.node.id, x.rect]))

  const agentEdges: Layout['agentEdges'] = []
  for (const e of g.edges) {
    if (e.removed) dimmed.push(...e.shapeIds)
    if (e.origin !== 'agent') continue
    const ra = rectOf.get(e.from)
    const rb = rectOf.get(e.to)
    if (!ra || !rb) continue
    const { a, b } = connect(ra, rb)
    agentEdges.push({ id: e.id, a, b, removed: !!e.removed, label: edgeLabel(e) })
  }

  const marks: MarkGeom[] = []
  for (const m of vp.marks) {
    if (m.status === 'rejected' || m.type === 'status') continue
    // Accepted adds are drawn from the graph (they are agent nodes now).
    if (m.type === 'add' && m.status === 'accepted') continue
    const geom = markGeometry(m, g, lookup, rectOf)
    if (geom) marks.push(geom)
  }
  return { nodes, agentEdges, marks, dimmed }
}

function markGeometry(m: Mark, g: Graph, lookup: BoundsLookup, rectOf: Map<string, Rect>): MarkGeom | null {
  const pending = m.status === 'pending'
  const anchor = targetRect(g, m.target, lookup)
  if (!anchor) return null
  const parts: Part[] = []
  const d = m.data

  switch (m.type) {
    case 'add': {
      let box: Rect | null = null
      if (d.nodeId && d.offset && d.size) {
        box = { x: anchor.x + d.offset.x, y: anchor.y + d.offset.y, w: d.size.w, h: d.size.h }
        parts.push({ t: 'box', rect: box, dashed: pending })
        parts.push({ t: 'text', x: box.x + box.w / 2, y: box.y + box.h / 2 + 7, text: d.label ?? '', size: 20, anchor: 'middle' })
        if (d.kind) parts.push({ t: 'text', x: box.x + 4, y: box.y + box.h + 18, text: d.kind, size: 14 })
      }
      const rectFor = (id: string) => (id === d.nodeId ? box : rectOf.get(id) ?? null)
      for (const e of d.edges ?? []) {
        const ra = rectFor(e.from)
        const rb = rectFor(e.to)
        if (!ra || !rb) continue
        const { a, b } = connect(ra, rb)
        parts.push({ t: 'arrow', a, b, dashed: pending })
        if (e.label) parts.push({ t: 'text', x: (a.x + b.x) / 2 + 6, y: (a.y + b.y) / 2 - 8, text: e.label, size: 15 })
      }
      const bounds = unionRects(parts.flatMap(partRect)) ?? anchor
      return { mark: m, parts, badge: box ? { x: box.x + box.w, y: box.y } : { x: bounds.x + bounds.w, y: bounds.y }, bounds }
    }
    case 'strike': {
      if (m.target.kind === 'edge') {
        const c = rectCenter(anchor)
        parts.push({ t: 'cross', c })
        return { mark: m, parts, badge: { x: c.x + 16, y: c.y - 16 }, bounds: expandRect({ x: c.x, y: c.y, w: 0, h: 0 }, 14) }
      }
      parts.push({ t: 'strike', rect: anchor })
      return { mark: m, parts, badge: { x: anchor.x + anchor.w + 6, y: anchor.y - 6 }, bounds: expandRect(anchor, 8) }
    }
    case 'rewrite': {
      const label = d.label ?? ''
      const w = textWidth(label, 20)
      const x = anchor.x
      const y = anchor.y - 14
      parts.push({ t: 'text', x, y, text: label, size: 20 })
      parts.push({ t: 'underline', x: x - 2, y: y + 6, w: w + 4 })
      const bounds = { x, y: y - 22, w, h: 30 }
      return { mark: m, parts, badge: { x: x + w + 10, y: y - 18 }, bounds }
    }
    case 'note': {
      if (!d.offset || !d.size) return null
      const rect = { x: anchor.x + d.offset.x, y: anchor.y + d.offset.y, w: d.size.w, h: d.size.h }
      if (m.target.kind !== 'point') {
        const { a, b } = connect(rect, anchor)
        parts.push({ t: 'leader', a, b })
      }
      parts.push({ t: 'note', rect, lines: wrapText(d.text ?? ''), question: !!d.question, answer: d.answer })
      return { mark: m, parts, badge: { x: rect.x + rect.w, y: rect.y }, bounds: rect }
    }
  }
  return null
}

function partRect(p: Part): Rect[] {
  switch (p.t) {
    case 'box':
    case 'strike':
    case 'note':
      return [p.rect]
    case 'arrow':
    case 'leader':
      return [{ x: Math.min(p.a.x, p.b.x), y: Math.min(p.a.y, p.b.y), w: Math.abs(p.a.x - p.b.x), h: Math.abs(p.a.y - p.b.y) }]
    case 'text':
      return [{ x: p.anchor === 'middle' ? p.x - textWidth(p.text, p.size) / 2 : p.x, y: p.y - p.size, w: textWidth(p.text, p.size), h: p.size }]
    case 'cross':
      return [{ x: p.c.x - 12, y: p.c.y - 12, w: 24, h: 24 }]
    case 'underline':
      return [{ x: p.x, y: p.y, w: p.w, h: 2 }]
  }
}

export { nodeLabel }
