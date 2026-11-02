import { jaccard, roundRect, unionRects } from '../shared/geometry.js'
import { slugify, uniqueId } from '../shared/graph.js'
import type { Graph, GraphEdge, GraphNode, InterpretationResult, Rect, Sketch } from '../shared/types.js'

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Fold an interpretation of the latest sketch into the existing graph.
 *
 * Node ids are kept stable across submits (by id, overlapping ink, or label)
 * so statuses, strikes and rewrites survive the user redrawing things. Agent
 * nodes (accepted adds) are kept unless the user drew the same component in
 * their own ink, in which case the ink takes it over.
 */
export function mergeInterpretation(
  prev: Graph,
  result: InterpretationResult,
  sketch: Sketch,
  by: string,
  now = new Date().toISOString(),
): { graph: Graph; idMap: Map<string, string>; dropped: string[] } {
  const shapeBounds = new Map(sketch.shapes.map((s) => [s.id, s.bounds]))
  const prevInk = prev.nodes.filter((n) => n.origin === 'ink')
  const prevAgent = prev.nodes.filter((n) => n.origin === 'agent')
  const claimed = new Set<string>()
  const taken = new Set<string>([...prev.nodes.map((n) => n.id)])
  const idMap = new Map<string, string>()
  const nodes: GraphNode[] = []

  result.nodes.forEach((rn, i) => {
    const tempId = rn.id ?? `#${i}`
    const shapeIds = [...new Set(rn.shapeIds ?? [])].filter((id) => shapeBounds.has(id))
    const label = (rn.label ?? '').trim() || 'untitled'

    let match: GraphNode | undefined
    if (rn.id) match = prevInk.find((n) => n.id === rn.id && !claimed.has(n.id))
    if (!match && shapeIds.length) {
      let best = 0
      for (const n of prevInk) {
        if (claimed.has(n.id)) continue
        const score = jaccard(n.shapeIds, shapeIds)
        if (score > best) {
          best = score
          match = n
        }
      }
      if (best < 0.25) match = undefined
    }
    if (!match) match = prevInk.find((n) => !claimed.has(n.id) && norm(n.label) === norm(label))
    // The user drew a component the agent had added: the ink takes it over.
    if (!match) {
      match = prevAgent.find(
        (n) => !claimed.has(n.id) && (n.id === rn.id || norm(n.override?.label ?? n.label) === norm(label)),
      )
    }

    if (!shapeIds.length && !match) return

    const rects = shapeIds.map((id) => shapeBounds.get(id)).filter((r): r is Rect => !!r)
    const bounds = unionRects(rects) ?? match?.bounds ?? { x: 0, y: 0, w: 0, h: 0 }
    const id = match ? match.id : uniqueId('n_', slugify(label), taken)
    if (match) claimed.add(match.id)
    idMap.set(tempId, id)
    if (rn.id) idMap.set(rn.id, id)

    const tags = dedupe((rn.tags?.length ? rn.tags : rn.kind ? [rn.kind] : []).map((t) => t.trim()).filter(Boolean)).slice(0, 3)
    const node: GraphNode = {
      id,
      label,
      kind: rn.kind || undefined,
      tags,
      shapeIds,
      bounds: roundRect(bounds),
      origin: 'ink',
      status: match?.status ?? 'planned',
      statusDetail: match?.statusDetail,
      removed: match?.removed,
      override: match?.origin === 'ink' ? match.override : undefined,
      description: rn.description ?? match?.description,
    }
    nodes.push(clean(node))
  })

  // Agent nodes that the ink did not take over stay where they were.
  for (const n of prevAgent) {
    if (claimed.has(n.id)) continue
    nodes.push(n)
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const n of nodes) {
    if (n.anchor && !nodeIds.has(n.anchor.nodeId)) {
      // Anchor was erased: pin the node where it last was.
      delete n.anchor
    }
  }

  // Edges
  const prevInkEdges = prev.edges.filter((e) => e.origin === 'ink')
  const claimedEdges = new Set<string>()
  const edgeTaken = new Set(prev.edges.map((e) => e.id))
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  const mapRef = (ref: string) => idMap.get(ref) ?? (nodeIds.has(ref) ? ref : undefined)

  for (const re of result.edges) {
    const from = mapRef(re.from)
    const to = mapRef(re.to)
    if (!from || !to || from === to) continue
    const key = `${from}->${to}`
    if (seen.has(key)) continue
    seen.add(key)
    const shapeIds = [...new Set(re.shapeIds ?? [])].filter((id) => shapeBounds.has(id))
    let match =
      (re.id ? prevInkEdges.find((e) => e.id === re.id && !claimedEdges.has(e.id)) : undefined) ??
      prevInkEdges.find((e) => !claimedEdges.has(e.id) && e.from === from && e.to === to)
    if (!match && shapeIds.length) {
      match = prevInkEdges.find((e) => !claimedEdges.has(e.id) && jaccard(e.shapeIds, shapeIds) >= 0.5)
    }
    const id = match ? match.id : uniqueId('e_', `${from.replace(/^n_/, '')}__${to.replace(/^n_/, '')}`, edgeTaken)
    if (match) claimedEdges.add(match.id)
    edges.push(
      clean({
        id,
        from,
        to,
        label: re.label?.trim() || undefined,
        shapeIds,
        origin: 'ink',
        removed: match?.removed,
        override: match?.override,
      }),
    )
  }
  for (const e of prev.edges) {
    if (e.origin !== 'agent') continue
    const key = `${e.from}->${e.to}`
    if (seen.has(key) || !nodeIds.has(e.from) || !nodeIds.has(e.to)) continue
    seen.add(key)
    edges.push(e)
  }

  const dropped = prev.nodes.filter((n) => !nodeIds.has(n.id)).map((n) => n.id)

  return {
    graph: clean({
      version: prev.version + 1,
      sketchSeq: sketch.seq,
      interpretedBy: by,
      updatedAt: now,
      summary: result.summary?.trim() || prev.summary,
      nodes,
      edges,
    }),
    idMap,
    dropped,
  }
}

function dedupe(xs: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const k = x.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]
  return o
}
