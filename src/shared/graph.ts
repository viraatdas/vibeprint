import { rectCenter, unionRects } from './geometry.js'
import type { Graph, GraphEdge, GraphNode, MarkTarget, Point, Rect } from './types.js'

export function emptyGraph(): Graph {
  return { version: 0, sketchSeq: 0, updatedAt: new Date(0).toISOString(), nodes: [], edges: [] }
}

export function nodeLabel(node: GraphNode): string {
  return node.override?.label ?? node.label
}

export function nodeKind(node: GraphNode): string | undefined {
  return node.override?.kind ?? node.kind
}

export function edgeLabel(edge: GraphEdge): string | undefined {
  return edge.override?.label ?? edge.label
}

/** Live page bounds for a shape id, or undefined if the shape is gone. */
export type BoundsLookup = (shapeId: string) => Rect | undefined

/**
 * Where a node is right now. Ink nodes follow their shapes; agent nodes follow
 * their anchor node. Falls back to the stored region.
 */
export function nodeRect(graph: Graph, nodeId: string, lookup?: BoundsLookup, depth = 0): Rect | null {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  if (node.origin === 'ink' && lookup && node.shapeIds.length) {
    const rects = node.shapeIds.map(lookup).filter((r): r is Rect => !!r)
    const u = unionRects(rects)
    if (u) return u
  }
  if (node.anchor && depth < 6) {
    const a = nodeRect(graph, node.anchor.nodeId, lookup, depth + 1)
    if (a) return { x: a.x + node.anchor.dx, y: a.y + node.anchor.dy, w: node.bounds.w, h: node.bounds.h }
  }
  return node.bounds
}

export function edgeEndpoints(
  graph: Graph,
  edge: GraphEdge,
  lookup?: BoundsLookup,
): { from: Rect; to: Rect } | null {
  const from = nodeRect(graph, edge.from, lookup)
  const to = nodeRect(graph, edge.to, lookup)
  if (!from || !to) return null
  return { from, to }
}

/** A rect that represents an edge (its ink, or the midpoint between its nodes). */
export function edgeRect(graph: Graph, edgeId: string, lookup?: BoundsLookup): Rect | null {
  const edge = graph.edges.find((e) => e.id === edgeId)
  if (!edge) return null
  if (lookup && edge.shapeIds.length) {
    const u = unionRects(edge.shapeIds.map(lookup).filter((r): r is Rect => !!r))
    if (u) return u
  }
  const ends = edgeEndpoints(graph, edge, lookup)
  if (!ends) return null
  const a = rectCenter(ends.from)
  const b = rectCenter(ends.to)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return { x: mid.x - 10, y: mid.y - 10, w: 20, h: 20 }
}

export function targetRect(graph: Graph, target: MarkTarget, lookup?: BoundsLookup): Rect | null {
  if (target.kind === 'point') return { x: target.x, y: target.y, w: 0, h: 0 }
  if (target.kind === 'node') return nodeRect(graph, target.id, lookup)
  return edgeRect(graph, target.id, lookup)
}

export function targetOrigin(graph: Graph, target: MarkTarget, lookup?: BoundsLookup): Point | null {
  const r = targetRect(graph, target, lookup)
  return r ? { x: r.x, y: r.y } : null
}

export function targetName(graph: Graph, target: MarkTarget): string {
  if (target.kind === 'point') return `(${Math.round(target.x)}, ${Math.round(target.y)})`
  if (target.kind === 'node') {
    const n = graph.nodes.find((x) => x.id === target.id)
    return n ? nodeLabel(n) : target.id
  }
  const e = graph.edges.find((x) => x.id === target.id)
  if (!e) return target.id
  const f = graph.nodes.find((n) => n.id === e.from)
  const t = graph.nodes.find((n) => n.id === e.to)
  return `${f ? nodeLabel(f) : e.from} → ${t ? nodeLabel(t) : e.to}`
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Resolve an agent-supplied reference (node id, edge id, node label, or
 * "A -> B" edge shorthand) to a graph element.
 */
export function resolveRef(graph: Graph, ref: string): { kind: 'node' | 'edge'; id: string } | null {
  const r = ref.trim()
  if (!r) return null
  const node = graph.nodes.find((n) => n.id === r)
  if (node) return { kind: 'node', id: node.id }
  const edge = graph.edges.find((e) => e.id === r)
  if (edge) return { kind: 'edge', id: edge.id }
  const byLabel = graph.nodes.filter((n) => !n.removed && (norm(nodeLabel(n)) === norm(r) || norm(n.label) === norm(r)))
  if (byLabel.length >= 1) return { kind: 'node', id: byLabel[0].id }
  const arrow = r.split(/\s*(?:->|→|=>)\s*/)
  if (arrow.length === 2) {
    const a = resolveRef(graph, arrow[0])
    const b = resolveRef(graph, arrow[1])
    if (a?.kind === 'node' && b?.kind === 'node') {
      const e = graph.edges.find((x) => x.from === a.id && x.to === b.id) ?? graph.edges.find((x) => x.from === b.id && x.to === a.id)
      if (e) return { kind: 'edge', id: e.id }
    }
  }
  return null
}

export function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
  return s || 'node'
}

export function uniqueId(prefix: string, base: string, taken: Set<string>): string {
  let id = `${prefix}${base}`
  let i = 2
  while (taken.has(id)) id = `${prefix}${base}_${i++}`
  taken.add(id)
  return id
}
