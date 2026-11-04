import fs from 'node:fs'
import type { WebSocket } from 'ws'
import { z } from 'zod'
import { CANVAS_FORMAT, CANVAS_PROTOCOL, serializeCanvas, type ServerMessage, type Shape } from '../shared/canvas.js'
import { FILES, type VibeprintCore } from '../core/core.js'
import { importTldraw } from './tldraw-import.js'

// The user's ink: one shared document per repo, kept in memory, synced to every open canvas
// over a WebSocket and saved to .vibeprint/canvas.json. The daemon is the single source of
// truth. Clients send whole-shape puts and deletes; the last write to reach the daemon wins.

const num = z.number().finite()
const shapeId = z.string().regex(/^shape:[\w-]{1,80}$/)
const end = z.object({ x: num, y: num, id: shapeId.optional(), nx: num.optional(), ny: num.optional() })
const base = { id: shapeId, z: num, author: z.enum(['user', 'agent']).optional(), font: z.enum(['hand', 'sans']).optional(), mapAnnotation: z.boolean().optional(), mapRole: z.enum(['boundary', 'lifeline']).optional(), mapView: z.object({ id: z.string().max(100), title: z.string().max(120), details: z.object({ notes: z.array(z.object({ title: z.string(), text: z.string(), source: z.string() })).max(3), owner: z.string(), verification: z.object({ at: z.string(), revision: z.string(), dirty: z.boolean() }).optional(), modes: z.array(z.string()) }).optional() }).optional() }
export const shapeSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('draw'), points: z.array(z.tuple([num, num, num])).min(1).max(20_000), pen: z.boolean().optional(), closed: z.boolean().optional() }),
  z.object({ ...base, type: z.literal('arrow'), start: end, end, text: z.string().max(2_000).optional(), route: z.array(z.object({ x: num, y: num })).max(256).optional(), mode: z.enum(['sync', 'async', 'local']).optional(), labelAt: z.object({ x: num, y: num }).optional() }),
  z.object({ ...base, type: z.literal('text'), x: num, y: num, w: num.min(0), h: num.min(0), text: z.string().max(20_000), size: num.positive().max(1_000).optional() }),
  z.object({ ...base, type: z.literal('image'), x: num, y: num, w: num.positive(), h: num.positive(), src: z.string().regex(/^\/files\/[\w.-]{1,128}$/) }),
])
const opsSchema = z.object({
  t: z.literal('ops'),
  n: z.number().int(),
  put: z.array(shapeSchema).max(5_000).optional(),
  del: z.array(z.string().max(100)).max(50_000).optional(),
})

const MAX_SHAPES = 50_000

/**
 * Read .vibeprint/canvas.json. A canvas written by 0.1/0.2 (tldraw) comes back converted,
 * keeping every shape id; the caller saves it in the new format.
 */
export function readCanvasFile(core: VibeprintCore, log: (msg: string) => void = () => {}): { shapes: Shape[]; text: string; converted: boolean } {
  const p = core.file(FILES.canvas)
  if (!fs.existsSync(p)) return { shapes: [], text: '', converted: false }
  const text = fs.readFileSync(p, 'utf8')
  let data: { format?: string; shapes?: unknown[]; records?: Array<Record<string, unknown>> }
  try {
    data = JSON.parse(text)
  } catch (err) {
    throw new Error(`Could not parse .vibeprint/canvas.json (${(err as Error).message}). Resolve merge conflicts or restore it from git.`)
  }
  const shapes: Shape[] = []
  if (data.format === CANVAS_FORMAT && Array.isArray(data.shapes)) {
    for (const raw of data.shapes) {
      const parsed = shapeSchema.safeParse(raw)
      if (parsed.success) shapes.push(parsed.data as Shape)
      else log(`canvas: skipped an unreadable shape in canvas.json (${parsed.error.issues[0]?.message})`)
    }
    // Older maps were ordinary ink. Recover attribution from their graph bindings without
    // recoloring any freehand additions the user drew alongside the map.
    const mappedNodes = core.graph.nodes.filter((n) => n.fromCode)
    const mappedIds = new Set(mappedNodes.map((n) => n.id))
    const generated = new Set([
      ...mappedNodes.flatMap((n) => n.shapeIds),
      ...core.graph.edges.filter((e) => mappedIds.has(e.from) && mappedIds.has(e.to)).flatMap((e) => e.shapeIds),
    ])
    let converted = false
    for (const s of shapes) if (!s.author && generated.has(s.id)) {
      s.author = 'agent'
      converted = true
    }
    return { shapes, text, converted }
  }
  if (Array.isArray(data.records)) {
    for (const s of importTldraw(data.records)) {
      const parsed = shapeSchema.safeParse(s)
      if (parsed.success) shapes.push(parsed.data as Shape)
    }
    return { shapes, text, converted: true }
  }
  throw new Error('.vibeprint/canvas.json is not a Vibeprint canvas. Restore it from git.')
}

/** Write canvas.json for a change made without the daemon (the MCP server on its own). */
export function writeCanvasFile(core: VibeprintCore, shapes: Iterable<Shape>): void {
  core.writeFileAtomic(FILES.canvas, serializeCanvas(shapes))
}
const TICK_MS = 25_000

export class CanvasRoom {
  private shapes = new Map<string, Shape>()
  private clients = new Set<WebSocket>()
  private saveTimer: NodeJS.Timeout | null = null
  private lastSaved = ''
  private ticker: NodeJS.Timeout

  constructor(
    private core: VibeprintCore,
    private log: (msg: string) => void = () => {},
  ) {
    this.load()
    // Application-level keepalive: it crosses the relay, where WebSocket pings don't.
    this.ticker = setInterval(() => this.broadcast({ t: 'tick' }), TICK_MS)
    this.ticker.unref()
  }

  private load() {
    const file = readCanvasFile(this.core, this.log)
    for (const shape of file.shapes) this.shapes.set(shape.id, shape)
    if (file.converted) {
      this.log(`canvas: upgraded saved canvas (${this.shapes.size} shapes)`)
      this.save()
    } else this.lastSaved = file.text
  }

  /** Every shape on the canvas right now. */
  list(): Shape[] {
    return [...this.shapes.values()]
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }

  private broadcast(msg: ServerMessage, except?: WebSocket) {
    const text = JSON.stringify(msg)
    for (const c of this.clients) if (c !== except && c.readyState === c.OPEN) c.send(text)
  }

  connect(ws: WebSocket): void {
    this.clients.add(ws)
    this.send(ws, { t: 'snapshot', v: CANVAS_PROTOCOL, shapes: this.list() })
    ws.on('message', (raw) => this.receive(ws, raw.toString()))
    ws.on('close', () => this.clients.delete(ws))
    ws.on('error', () => this.clients.delete(ws))
  }

  private receive(ws: WebSocket, raw: string) {
    let msg: { t?: string; n?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.t !== 'ops') return
    const parsed = opsSchema.safeParse(msg)
    if (!parsed.success) {
      const n = typeof msg.n === 'number' ? msg.n : -1
      const issue = parsed.error.issues[0]
      return this.send(ws, { t: 'rejected', n, error: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'invalid'}` })
    }
    const { n, put = [], del = [] } = parsed.data
    if (this.shapes.size + put.length > MAX_SHAPES) return this.send(ws, { t: 'rejected', n, error: 'The canvas is full.' })
    for (const id of del) this.shapes.delete(id)
    for (const s of put) this.shapes.set(s.id, s as Shape)
    this.send(ws, { t: 'ack', n })
    this.broadcast({ t: 'ops', ...(put.length ? { put: put as Shape[] } : {}), ...(del.length ? { del } : {}) }, ws)
    this.scheduleSave()
  }

  /** A change made by the daemon itself (mapping the code): every open canvas gets it. */
  apply(put: Shape[], del: string[] = []): void {
    const checked = put.map((s) => shapeSchema.parse(s) as Shape)
    if (this.shapes.size + checked.length > MAX_SHAPES) throw new Error('The canvas is full.')
    for (const id of del) this.shapes.delete(id)
    for (const s of checked) this.shapes.set(s.id, s)
    this.broadcast({ t: 'ops', ...(checked.length ? { put: checked } : {}), ...(del.length ? { del } : {}) })
    this.save()
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 800)
  }

  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    const text = serializeCanvas(this.shapes.values())
    if (text === this.lastSaved) return
    // An empty canvas that was never saved stays absent.
    if (!this.lastSaved && !this.shapes.size) return
    this.core.writeFileAtomic(FILES.canvas, text)
    this.lastSaved = text
  }

  close(): void {
    clearInterval(this.ticker)
    this.save()
    for (const c of this.clients) c.close(1001, 'vibeprint stopped')
    this.clients.clear()
  }
}
