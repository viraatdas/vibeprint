import crypto from 'node:crypto'
import { arrowRoute, docBounds, TEXT_LINE, type Shape, type TextShape } from '../shared/canvas.js'
import type { Rect, RepoMap, RepoMapEdge } from '../shared/types.js'
import { avoidMapCaptions } from './map-routing.js'
import { drawWorkflow } from './map-workflow.js'
import { drawContext } from './map-context.js'
import dagre from '@dagrejs/dagre'
import { mapTextWidth, MAP_FLOW_SIZE, MAP_FLOW_LINE } from '../shared/map-font.js'

const id = () => `shape:map${crypto.randomBytes(8).toString('hex')}`
const WIDTH = 300

/** Use the same face as the browser/export, with a small rasterization allowance. */
export function wrapMapText(text: string, width: number, size: number): string {
  const measure = (value: string) => mapTextWidth(value, size) * 1.02
  return text.split('\n').flatMap(line => {
    const lines: string[] = []; let current = ''
    for (let word of line.split(/\s+/)) {
      if (current && measure(current + ' ' + word) > width) { lines.push(current); current = '' }
      while (measure(word) > width && word.length > 1) {
        let take = 1
        while (take < word.length && measure(word.slice(0, take + 1)) <= width) take++
        lines.push(word.slice(0, take)); word = word.slice(take)
      }
      current += (current ? ' ' : '') + word
    }
    return [...lines, current]
  }).join('\n')
}

/** Presentation remains ordinary editable ink; graph bindings include only actual units. */
export function drawPresentedMap(map: RepoMap, origin: { x: number; y: number }): { shapes: Shape[]; nodeShapes: Map<string, string[]>; edges: Array<RepoMapEdge & { shapeId: string; shapeIds?: string[] }> } {
  const views = map.views?.slice(0, 8)
  // Reject incomplete plans rather than silently hiding actors or relationships.
  const valid = views?.length && views.every(v => v.nodeIds.length && v.nodeIds.every(id => map.nodes.some(n => n.id === id)) && v.edgeIndices.every(i => Number.isInteger(i) && map.edges[i] && v.nodeIds.includes(map.edges[i].from) && v.nodeIds.includes(map.edges[i].to)))
    && map.nodes.every(n => views.some(v => v.nodeIds.includes(n.id))) && map.edges.every((_, i) => views.some(v => v.edgeIndices.includes(i)))
  if (!valid) return drawSingleMap(map, origin)
  const shapes: Shape[] = [], nodeShapes = new Map<string, string[]>(), edgeShapes = new Map<number, string[]>()
  let x = origin.x
  for (const [index, view] of views!.entries()) {
    const nodes = view.nodeIds.map(id => map.nodes.find(n => n.id === id)!)
    const indices = [...new Set(view.edgeIndices)]
    const presented = { ...map, views: undefined, title: view.title, scope: view.scope,
      nodes, edges: indices.map((i, j) => ({ ...map.edges[i], label: view.edgeLabels?.[j] || map.edges[i].label })), groups: map.groups?.filter(g => nodes.some(n => n.group === g.id)),
      notes: view.notes ?? [...new Set(view.noteIndices)].map(i => map.notes?.[i]).filter((n): n is NonNullable<typeof n> => !!n),
      omissions: ['Other workflows: use the Diagram view selector', ...(map.omissions || [])],
    }
    const result = view.kind === 'overview' ? drawContext(presented, { x, y: origin.y }, wrapMapText) : drawWorkflow(presented, { x, y: origin.y }, wrapMapText)
    const bookmark = { id: result.shapes[0].id, title: view.title }
    const details = { notes: presented.notes || [], owner: map.owner || 'Unassigned', verification: map.verification, modes: [...new Set(presented.edges.map(e => e.mode || 'sync'))] }
    for (const [i, shape] of result.shapes.entries()) { shape.mapView = i === 0 ? { ...bookmark, details } : bookmark; shape.z = shapes.length + 1; shapes.push(shape) }
    for (const [node, ids] of result.nodeShapes) nodeShapes.set(node, [...(nodeShapes.get(node) || []), ...ids])
    result.edges.forEach((edge, i) => edgeShapes.set(indices[i], [...(edgeShapes.get(indices[i]) || []), edge.shapeId]))
    const bounds = docBounds(new Map(result.shapes.map(s => [s.id, s])))!
    x = bounds.x + bounds.w + Math.max(1800, bounds.h)
  }
  const edges = map.edges.map((edge, i) => ({ ...edge, shapeId: edgeShapes.get(i)![0], shapeIds: edgeShapes.get(i)! }))
  return { shapes, nodeShapes, edges }
}

function drawSingleMap(map: RepoMap, origin: { x: number; y: number }, focused = false): { shapes: Shape[]; nodeShapes: Map<string, string[]>; edges: Array<RepoMapEdge & { shapeId: string }> } {
  const shapes: Shape[] = [], nodeShapes = new Map<string, string[]>()
  const edges: Array<RepoMapEdge & { shapeId: string }> = []
  let z = 1
  const text = (body: string, x: number, y: number, w: number, size: number): TextShape => {
    const wrapped = wrapMapText(body, w, size)
    const s: TextShape = { id: id(), type: 'text', author: 'agent', font: 'sans', z: z++, x: x + origin.x, y: y + origin.y, w, h: wrapped.split('\n').length * size * TEXT_LINE, size, text: wrapped }
    shapes.push(s); return s
  }
  const box = (x: number, y: number, w: number, h: number, kind?: string) => {
    const shapeId = id()
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
    const points: Array<[number, number, number]> = []
    for (let i = 1; i < corners.length; i++) {
      const [ax, ay] = corners[i - 1], [bx, by] = corners[i]
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 10)
      for (let j = 0; j < steps; j++) points.push([ax + (bx - ax) * j / steps + origin.x, ay + (by - ay) * j / steps + origin.y, .5])
    }
    points.push([x + origin.x, y + origin.y, .5])
    if (['database', 'storage', 'cache'].includes(kind || '')) {
      points.length = 0
      const ry = 10, cx = x + w / 2
      const arc = (cy: number, start: number, end: number) => {
        for (let i = 0; i <= 32; i++) { const t = start + (end - start) * i / 32; points.push([cx + w / 2 * Math.cos(t) + origin.x, cy + ry * Math.sin(t) + origin.y, .5]) }
      }
      const line = (px: number, ay: number, by: number) => { for (let py = ay; py < by; py += 8) points.push([px + origin.x, py + origin.y, .5]) }
      arc(y + ry, Math.PI, Math.PI * 2); line(x + w, y + ry, y + h - ry); arc(y + h - ry, 0, Math.PI)
      for (let py = y + h - ry; py > y + ry; py -= 8) points.push([x + origin.x, py + origin.y, .5])
      arc(y + ry, Math.PI, 0)
    }
    shapes.push({ id: shapeId, type: 'draw', author: 'agent', z: z++, closed: true, points })
    if (kind === 'external') box(x + 5, y + 5, w - 10, h - 10)
    return shapeId
  }
  const groups = map.groups!.filter((g, i) => i === 0 || map.nodes.some(n => n.group === g.id))
  const groupId = (node: RepoMap['nodes'][number]) => groups.some(g => g.id === node.group) ? node.group! : groups[0].id
  const role = (n: RepoMap['nodes'][number]) => n.description || n.kind || 'Runtime component'
  const nodeHeight = (n: RepoMap['nodes'][number]) => Math.max(120, 24 + wrapMapText(n.label, WIDTH - 28, 25).split('\n').length * 25 * TEXT_LINE + wrapMapText(role(n), WIDTH - 28, 20).split('\n').length * 20 * TEXT_LINE)
  // The layout reserves actual label rectangles, including parallel/reverse edges.
  // Compound nodes keep deployment zones disjoint without inventing extra boundaries.
  const ids = new Set(map.nodes.map(n => n.id))
  const validEdges = map.edges.filter(e => ids.has(e.from) && ids.has(e.to))
  const labels = validEdges.map(edge => wrapMapText(`${edge.label || 'request'} (${edge.mode || 'sync'})`, 220, MAP_FLOW_SIZE))
  const layout = (rankdir: 'LR' | 'TB') => {
    const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true })
      .setGraph({ rankdir, nodesep: 65, ranksep: 55, edgesep: 45, marginx: 8, marginy: 8 })
      .setDefaultEdgeLabel(() => ({}))
    for (const group of groups) graph.setNode(`zone:${group.id}`, {})
    for (const node of map.nodes) {
      graph.setNode(node.id, { width: WIDTH, height: nodeHeight(node) + (map.edges.some(e => e.from === node.id && e.to === node.id) ? 220 : 110) })
      graph.setParent(node.id, `zone:${groupId(node)}`)
    }
    validEdges.forEach((edge, i) => { if (edge.from === edge.to) return; graph.setEdge(edge.from, edge.to, {
      width: Math.max(...labels[i].split('\n').map(line => mapTextWidth(line, MAP_FLOW_SIZE))) + 20,
      height: labels[i].split('\n').length * MAP_FLOW_LINE + 18, labelpos: 'c',
    }, String(i)) })
    dagre.layout(graph)
    // Wrapped boundary captions need their own space above the first actor.
    let expanded = false
    for (const group of groups) {
      const zone = graph.node(`zone:${group.id}`), members = map.nodes.filter(n => groupId(n) === group.id)
      if (!members.length) continue
      const lines = (value: string, size: number) => wrapMapText(value, zone.width - 28, size).split('\n').length * size * TEXT_LINE
      const header = 12 + lines(group.label, 22) + 4 + lines(group.description, 20) + 16
      const available = Math.min(...members.map(n => graph.node(n.id).y - nodeHeight(n) / 2)) - (zone.y - zone.height / 2)
      if (available >= header) continue
      for (const member of members) graph.node(member.id).height += 2 * (header - available)
      expanded = true
    }
    if (expanded) {
      for (const group of groups) graph.setNode(`zone:${group.id}`, {})
      dagre.layout(graph)
    }
    return graph
  }
  const candidates = focused ? [layout('LR'), layout('TB')] : [layout('LR')]
  const cost = (g: typeof candidates[number]) => Math.max(Math.max(1500, g.graph().width!) / 1098, (g.graph().height! + 600) / 674)
  const graph = candidates.reduce((best, next) => cost(next) < cost(best) ? next : best)
  // Small graphs still need a readable annotation row at the intended iPad viewport.
  const width = Math.max(1500, graph.graph().width!)
  const graphX = (width - graph.graph().width!) / 2
  const title = text(map.title!, 0, 0, width, 32)
  const audience = text(`${map.audience || 'New engineers'} · ${map.scope || 'Runtime components and their main data flows'}`, 0, title.h + 12, width, 19)
  const top = audience.y - origin.y + audience.h + 24
  const captions: Rect[] = [], frames = new Map<string, Rect>(), actors = new Map<string, Rect>()
  for (const group of groups) {
    const zone = graph.node(`zone:${group.id}`)
    if (!zone.width || !zone.height) continue
    const x = graphX + zone.x - zone.width / 2, y = top + zone.y - zone.height / 2
    frames.set(group.id, { x: x + origin.x, y: y + origin.y, w: zone.width, h: zone.height })
    box(x, y, zone.width, zone.height)
    const heading = text(group.label, x + 14, y + 12, zone.width - 28, 22)
    const description = text(group.description, x + 14, y + heading.h + 16, zone.width - 28, 20)
    captions.push({ x: heading.x - 6, y: heading.y - 6, w: heading.w + 12, h: description.y + description.h - heading.y + 12 })
  }
  for (const node of map.nodes) {
    const position = graph.node(node.id)
    const x = graphX + position.x - WIDTH / 2, y = top + position.y - nodeHeight(node) / 2
    const beforeBox = shapes.length
    const shapeId = box(x, y, WIDTH, nodeHeight(node), node.kind)
    actors.set(shapeId, { x: x + origin.x - 6, y: y + origin.y - 6, w: WIDTH + 12, h: nodeHeight(node) + 12 })
    const boxIds = shapes.slice(beforeBox).map(s => s.id)
    const label = text(node.label, x + 14, y + 12, WIDTH - 28, 25)
    const description = text(role(node), x + 14, y + 16 + label.h, WIDTH - 28, 20)
    nodeShapes.set(node.id, [...boxIds, label.id, description.id])
    position.shapeId = shapeId; position.actualY = y + nodeHeight(node) / 2
  }
  validEdges.forEach((edge, i) => {
    const a = graph.node(edge.from), b = graph.node(edge.to)
    // Dagre's compound self-edge points can leave the containing zone. Reserve
    // space with the node, then draw an explicit U between two bottom ports.
    const self = edge.from === edge.to
    const bottom = a.actualY + nodeHeight(map.nodes.find(n => n.id === edge.from)!) / 2
    const layout = self ? { points: [null, { x: a.x - 60, y: bottom - top + 75 }, { x: a.x + 60, y: bottom - top + 75 }, null], x: a.x, y: bottom - top + 75 } : graph.edge(edge.from, edge.to, String(i))
    const shapeId = id()
    shapes.push({ id: shapeId, type: 'arrow', author: 'agent', font: 'sans', z: z++,
      start: { id: a.shapeId, x: graphX + a.x + origin.x, y: a.actualY + origin.y, nx: self ? .25 : .5, ny: self ? 1 : .5 },
      end: { id: b.shapeId, x: graphX + b.x + origin.x, y: b.actualY + origin.y, nx: self ? .75 : .5, ny: self ? 1 : .5 },
      route: layout.points.slice(1, -1).map((p: { x: number; y: number }) => ({ x: graphX + p.x + origin.x, y: p.y + top + origin.y })),
      labelAt: { x: graphX + layout.x + origin.x, y: layout.y + top + origin.y }, mode: edge.mode || 'sync', text: labels[i] })
    edges.push({ ...edge, shapeId })
  })
  const doc = new Map(shapes.map(s => [s.id, s]))
  for (const [i, edge] of edges.entries()) {
    const arrow = doc.get(edge.shapeId)!
    if (arrow.type !== 'arrow') continue
    const padding = 4 + i * 2
    const padded = (r: Rect) => ({ x: r.x - padding, y: r.y - padding, w: r.w + 2 * padding, h: r.h + 2 * padding })
    const endpoints = new Set(map.nodes.filter(n => n.id === edge.from || n.id === edge.to).map(groupId))
    const obstacles = [...captions.map(padded), ...[...frames].filter(([group]) => !endpoints.has(group)).map(([, r]) => padded(r)), ...[...actors].filter(([id]) => id !== arrow.start.id && id !== arrow.end.id).map(([, rect]) => rect)]
    const original = arrowRoute(arrow, doc)
    const routed = avoidMapCaptions(original, captions, obstacles)
    // Preserve the visible attachment ports: re-clipping toward a new detour
    // must not pull the endpoint back through the caption we just avoided.
    for (const [end, point] of [[arrow.start, original[0]], [arrow.end, original.at(-1)!]] as const) {
      const rect = end.id ? actors.get(end.id) : undefined
      if (rect) { end.nx = (point.x - rect.x - 6) / (rect.w - 12); end.ny = (point.y - rect.y - 6) / (rect.h - 12) }
    }
    arrow.route = routed.slice(1, -1)
  }
  let footer = top + graph.graph().height! + 26
  const types = ['box = runtime actor/process', ...(map.nodes.some(n => ['database', 'storage', 'cache'].includes(n.kind || '')) ? ['cylinder = stored state'] : []), ...(map.nodes.some(n => n.kind === 'external') ? ['double border = external service'] : [])]
  const modes = [...new Set(map.edges.map(e => e.mode || 'sync'))].map(mode => ({ sync: 'solid (sync) = awaited request/reply', async: 'dashed (async) = event/stream', local: 'dotted (local) = file/IPC' })[mode])
  const stages = map.edges.some(e => /^[A-Z]\d/.test(e.label || '')) ? ' A/B/C = workflows; equal step numbers = alternatives; unnumbered calls are independent.' : ''
  const legend = text(`Key: frames = trust/deployment zones; ${types.join('; ')}. Arrows: caller → recipient, response included; ${modes.join('; ')}.${stages}`, 0, footer, width, 20)
  footer += legend.h + 16
  const noteCount = Math.max(1, Math.min(3, map.notes?.length || 0))
  const noteWidth = Math.min(900, (width - 25 * (noteCount - 1)) / noteCount)
  let notesHeight = 0
  for (const [i, note] of (map.notes || []).slice(0, 3).entries()) {
    const heading = text(note.title, i * (noteWidth + 25), footer, noteWidth, 21)
    const body = text(note.text, i * (noteWidth + 25), footer + heading.h + 6, noteWidth, 21)
    const source = text(`Source: ${note.source}`, i * (noteWidth + 25), footer + heading.h + body.h + 12, noteWidth, 20)
    notesHeight = Math.max(notesHeight, heading.h + body.h + source.h + 20)
  }
  footer += notesHeight + 10
  const omissions = text(`Outside this view: ${(map.omissions || ['Detailed code internals']).join('; ')}.`, 0, footer, width, 20)
  const v = map.verification
  text(`Source review ${v?.at.slice(0, 10) || 'date not recorded'} · revision ${v?.revision || 'unknown'}${v?.dirty ? ' + local edits' : ''} · Owner: ${map.owner || 'Unassigned'} · Live runtime NOT verified`, 0, footer + omissions.h + 12, width, 20)
  return { shapes, nodeShapes, edges }
}
