import crypto from 'node:crypto'
import fs from 'node:fs'
import { arrowPoints, docBounds, extractSketch, TEXT_LINE, type Shape, type TextShape } from '../shared/canvas.js'
import type { Batch, Graph, InterpretationResult, Mark } from '../shared/types.js'
import type { CleanupReply } from '../interpret/cleanup.js'
import { drawMap } from './map.js'
import { FILES, VibeprintCore, VibeprintError } from './core.js'

const LATEST = 'runtime/cleanup-latest.json'
export const cleanupFingerprint = (value: unknown): string => crypto.createHash('sha256').update(JSON.stringify(value, (_k, v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v
  return Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
})).digest('hex')
export const canvasFingerprint = (shapes: Shape[]): string => cleanupFingerprint([...shapes].sort((a, b) => a.id.localeCompare(b.id)))
export const architectureFingerprint = (core: VibeprintCore): string => cleanupFingerprint({ graph: core.graph, marks: core.marks, batches: core.batches, sketchSeq: core.sketch?.seq ?? 0 })

function wrap(text: string, columns = 48): string {
  return text.split('\n').map(line => {
    const lines: string[] = []; let at = ''
    for (const word of line.split(/\s+/)) {
      if (at && at.length + word.length + 1 > columns) { lines.push(at); at = '' }
      at += (at ? ' ' : '') + word
    }
    lines.push(at)
    return lines.join('\n')
  }).join('\n')
}

export function cleanupPlan(core: VibeprintCore, before: Shape[], reply: CleanupReply) {
  const ids = new Set(reply.nodes.map(n => n.id))
  if (ids.size !== reply.nodes.length) throw new VibeprintError('The cleanup returned duplicate components. Try again.', 422)
  for (const n of core.graph.nodes.filter(n => !n.removed)) {
    if (!ids.has(n.id)) throw new VibeprintError(`The cleanup omitted ${n.label}. Your canvas is unchanged; try again.`, 422)
  }
  if (core.graph.nodes.some(n => n.removed && ids.has(n.id))) throw new VibeprintError('The cleanup tried to restore a removed component. Your canvas is unchanged.', 422)
  if (reply.edges.some(e => !ids.has(e.from) || !ids.has(e.to))) throw new VibeprintError('The cleanup returned a connection to an unknown component.', 422)
  const originalIds = new Set(before.map(s => s.id))
  const consumed = new Set([...reply.nodes, ...reply.edges, ...reply.notes].flatMap(n => n.sourceShapeIds))
  if ([...consumed].some(id => !originalIds.has(id))) throw new VibeprintError('The cleanup referenced unknown ink. Your canvas is unchanged.', 422)
  // The components are all represented in the revised diagram. Unrecognized notes stay ink.
  for (const n of core.graph.nodes) if (ids.has(n.id)) for (const id of n.shapeIds) consumed.add(id)
  for (const e of core.graph.edges) if (ids.has(e.from) && ids.has(e.to)) for (const id of e.shapeIds) consumed.add(id)
  for (const s of before) if (s.type === 'text' && s.author === 'agent' && s.id.startsWith('shape:cleanup') && ['Reconciled notes', 'Original notes & references'].includes(s.text)) consumed.add(s.id)

  const drawn = drawMap({ nodes: reply.nodes, edges: reply.edges }, { x: 0, y: 0 })
  const put = drawn.shapes
  for (const s of put) s.author = 'agent'
  let z = Math.max(0, ...put.map(s => s.z)) + 1
  const addText = (text: string, x: number, y: number, size = 20): TextShape => {
    const body = wrap(text, Math.floor(520 / (size * .62)))
    const s: TextShape = { id: `shape:cleanup${crypto.randomBytes(8).toString('hex')}`, z: z++, type: 'text', author: 'agent', x, y, w: 520, h: body.split('\n').length * size * TEXT_LINE, size, text: body }
    put.push(s)
    return s
  }
  const diagram = docBounds(new Map(put.map(s => [s.id, s])))!
  const noteX = diagram.x + diagram.w + 160
  let noteY = diagram.y
  const heading = addText('Reconciled notes', noteX, noteY, 28)
  noteY += heading.h + 24
  for (const note of reply.notes) {
    const title = addText(note.title, noteX, noteY, 23)
    const body = addText(note.text, noteX, noteY + title.h + 8)
    noteY = body.y + body.h + 36
  }
  if (!reply.notes.length) addText(reply.summary, noteX, noteY)

  // Keep reference images and every stroke the model could not confidently account for.
  const focusIds = put.map(s => s.id)
  const leftovers = before.filter(s => s.type === 'image' || !consumed.has(s.id))
  if (leftovers.length) {
    const originalDoc = new Map(before.map(s => [s.id, s]))
    const leftoverIds = new Set(leftovers.map(s => s.id))
    const bounds = docBounds(originalDoc)!
    const bottom = Math.max(diagram.y + diagram.h, noteY) + 160
    addText('Original notes & references', 0, bottom, 28)
    const dx = -bounds.x, dy = bottom + 72 - bounds.y
    for (const s of leftovers) {
      if (s.type === 'draw') put.push({ ...s, points: s.points.map(([x, y, p]) => [x + dx, y + dy, p]) })
      else if (s.type === 'arrow') {
        const points = arrowPoints(s, originalDoc)
        const move = (e: typeof s.start, p: { x: number; y: number }) => e.id && !leftoverIds.has(e.id)
          ? { x: p.x + dx, y: p.y + dy }
          : { ...e, x: e.x + dx, y: e.y + dy }
        put.push({ ...s, start: move(s.start, points.a), end: move(s.end, points.b), ...(s.route ? { route: s.route.map(p => ({ x: p.x + dx, y: p.y + dy })) } : {}), ...(s.labelAt ? { labelAt: { x: s.labelAt.x + dx, y: s.labelAt.y + dy } } : {}) })
      } else put.push({ ...s, x: s.x + dx, y: s.y + dy })
    }
  }
  const result: InterpretationResult = {
    summary: reply.summary,
    nodes: reply.nodes.map(n => ({ id: n.id, label: n.label, kind: n.kind, tags: [...n.tags, ...(n.path ? [n.path] : [])].slice(0, 3), description: n.description, shapeIds: drawn.nodeShapes.get(n.id)!, fromCode: n.source === 'code' })),
    edges: drawn.edges.map(e => ({ from: e.from, to: e.to, label: e.label, shapeIds: [e.shapeId] })),
  }
  return { put, del: before.filter(s => !put.some(t => t.id === s.id)).map(s => s.id), result, focusIds }
}

interface Backup {
  id: string
  shapes: Shape[]
  graph: Graph
  marks: Mark[]
  batches: Batch[]
  sketchImage?: string
  afterCanvas?: string
  afterArchitecture?: string
}
const backupFile = (id: string) => `runtime/cleanups/${id}.json`
export function saveCleanupBackup(core: VibeprintCore, shapes: Shape[]): Backup {
  const backup: Backup = { id: crypto.randomUUID(), shapes, graph: structuredClone(core.graph), marks: structuredClone(core.marks), batches: structuredClone(core.batches), sketchImage: core.readSketchImage()?.toString('base64') }
  core.writeFileAtomic(backupFile(backup.id), JSON.stringify(backup))
  return backup
}
export function finishCleanupBackup(core: VibeprintCore, backup: Backup, shapes: Shape[]): void {
  backup.afterCanvas = canvasFingerprint(shapes)
  backup.afterArchitecture = architectureFingerprint(core)
  core.writeFileAtomic(backupFile(backup.id), JSON.stringify(backup))
  core.writeFileAtomic(LATEST, JSON.stringify({ id: backup.id }))
}
export function latestCleanup(core: VibeprintCore): string | undefined {
  try { return JSON.parse(fs.readFileSync(core.file(LATEST), 'utf8')).id } catch { return undefined }
}
export function restoreCleanup(core: VibeprintCore, current: Shape[], id: string): Shape[] {
  if (!/^[\da-f-]{36}$/.test(id) || latestCleanup(core) !== id) throw new VibeprintError('No cleanup to undo.', 404)
  const backup: Backup = JSON.parse(fs.readFileSync(core.file(backupFile(id)), 'utf8'))
  if (canvasFingerprint(current) !== backup.afterCanvas || architectureFingerprint(core) !== backup.afterArchitecture) {
    throw new VibeprintError('The canvas or architecture changed after cleanup. Your newer work is safe; the original is still saved in .vibeprint/runtime/cleanups/.', 409)
  }
  core.recordSubmission(extractSketch(new Map(backup.shapes.map(s => [s.id, s]))), backup.sketchImage ? Buffer.from(backup.sketchImage, 'base64') : undefined, undefined, { source: 'cleanup' })
  core.restoreArchitecture(backup)
  fs.rmSync(core.file(LATEST), { force: true })
  core.addChat('system', 'vibeprint', 'Undid cleanup. Restored the original canvas, architecture and pending suggestions.')
  core.checkpoint('vibeprint: undo cleanup')
  return backup.shapes
}
