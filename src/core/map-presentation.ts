import crypto from 'node:crypto'
import { TEXT_LINE, type Shape, type TextShape } from '../shared/canvas.js'
import type { RepoMap, RepoMapEdge } from '../shared/types.js'
import dagre from '@dagrejs/dagre'
import { mapTextWidth, MAP_FLOW_SIZE, MAP_FLOW_LINE } from '../shared/map-font.js'

const id = () => `shape:map${crypto.randomBytes(8).toString('hex')}`
const WIDTH = 240

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
export function drawPresentedMap(map: RepoMap, origin: { x: number; y: number }): { shapes: Shape[]; nodeShapes: Map<string, string[]>; edges: Array<RepoMapEdge & { shapeId: string }> } {
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
  const groups = map.groups!.slice(0, 4)
  const groupId = (node: RepoMap['nodes'][number]) => groups.some(g => g.id === node.group) ? node.group! : groups[0].id
  const role = (n: RepoMap['nodes'][number]) => n.description || n.kind || 'Runtime component'
  const nodeHeight = (n: RepoMap['nodes'][number]) => Math.max(120, 24 + wrapMapText(n.label, WIDTH - 28, 25).split('\n').length * 25 * TEXT_LINE + wrapMapText(role(n), WIDTH - 28, 20).split('\n').length * 20 * TEXT_LINE)
  // The layout reserves actual label rectangles, including parallel/reverse edges.
  // Compound nodes keep deployment zones disjoint without inventing extra boundaries.
  const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true })
    .setGraph({ rankdir: 'LR', nodesep: 65, ranksep: 55, edgesep: 45, marginx: 8, marginy: 8 })
    .setDefaultEdgeLabel(() => ({}))
  for (const group of groups) graph.setNode(`zone:${group.id}`, {})
  for (const node of map.nodes) {
    graph.setNode(node.id, { width: WIDTH, height: nodeHeight(node) + (map.edges.some(e => e.from === node.id && e.to === node.id) ? 220 : 110) })
    graph.setParent(node.id, `zone:${groupId(node)}`)
  }
  const validEdges = map.edges.filter(e => graph.hasNode(e.from) && graph.hasNode(e.to))
  const labels = validEdges.map(edge => wrapMapText(`${edge.label || 'request'} (${edge.mode || 'sync'})`, 220, MAP_FLOW_SIZE))
  validEdges.forEach((edge, i) => { if (edge.from === edge.to) return; graph.setEdge(edge.from, edge.to, {
    width: Math.max(...labels[i].split('\n').map(line => mapTextWidth(line, MAP_FLOW_SIZE))) + 20,
    height: labels[i].split('\n').length * MAP_FLOW_LINE + 18, labelpos: 'c',
  }, String(i)) })
  dagre.layout(graph)
  // Small graphs still need a readable annotation row at the intended iPad viewport.
  const width = Math.max(1500, graph.graph().width!)
  const graphX = (width - graph.graph().width!) / 2
  const title = text(map.title!, 0, 0, width, 32)
  const audience = text(`${map.audience || 'New engineers'} · ${map.scope || 'Runtime components and their main data flows'}`, 0, title.h + 12, width, 19)
  const top = audience.y - origin.y + audience.h + 24
  for (const group of groups) {
    const zone = graph.node(`zone:${group.id}`)
    if (!zone.width || !zone.height) continue
    const x = graphX + zone.x - zone.width / 2, y = top + zone.y - zone.height / 2
    box(x, y, zone.width, zone.height)
    const heading = text(group.label, x + 14, y + 12, zone.width - 28, 22)
    text(group.description, x + 14, y + heading.h + 16, zone.width - 28, 20)
  }
  for (const node of map.nodes) {
    const position = graph.node(node.id)
    const x = graphX + position.x - WIDTH / 2, y = top + position.y - nodeHeight(node) / 2
    const beforeBox = shapes.length
    const shapeId = box(x, y, WIDTH, nodeHeight(node), node.kind)
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
  let footer = top + graph.graph().height! + 26
  const types = ['box = runtime actor/process', ...(map.nodes.some(n => ['database', 'storage', 'cache'].includes(n.kind || '')) ? ['cylinder = stored state'] : []), ...(map.nodes.some(n => n.kind === 'external') ? ['double border = external service'] : [])]
  const modes = [...new Set(map.edges.map(e => e.mode || 'sync'))].map(mode => ({ sync: 'solid (sync) = awaited request/reply', async: 'dashed (async) = event/stream', local: 'dotted (local) = file/IPC' })[mode])
  const legend = text(`Key: frames = trust/deployment zones; ${types.join('; ')}. Arrows: caller → recipient, response included; ${modes.join('; ')}.`, 0, footer, width, 20)
  footer += legend.h + 16
  const noteWidth = (width - 50) / 3
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
