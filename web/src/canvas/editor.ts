import { docBounds, shapeBounds, sortedShapes, type Doc, type Shape, type TextShape } from '@shared/canvas'
import type { Point, Rect } from '@shared/types'

export type ToolId = 'draw' | 'arrow' | 'text' | 'eraser' | 'select' | 'hand'
export type Status = 'connecting' | 'live' | 'offline'

/** Same convention as page bounds everywhere: screen = (page + {x, y}) * z. */
export interface Camera {
  x: number
  y: number
  z: number
}

export type InputInfo = { type: 'pointer'; name: 'pointer_down' | 'pointer_move' | 'pointer_up' } | { type: 'keyboard' } | { type: 'pinch' }

type Change = Map<string, Shape | null>
interface HistoryEntry {
  before: Change
  after: Change
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8
const HISTORY_LIMIT = 200

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
export function uid(prefix = 'shape:'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(21))
  let s = prefix
  for (const b of bytes) s += ALPHABET[b & 63]
  return s
}

/**
 * The canvas state for one device: the shared document (kept in step with the daemon by
 * CanvasSync), plus this device's camera, tool, selection and undo history.
 */
export class Editor {
  private shapesById = new Map<string, Shape>()
  private listeners = new Set<() => void>()
  private inputListeners = new Set<(info: InputInfo) => void>()
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private sorted: Shape[] | null = null
  private animation = 0

  camera: Camera = { x: 0, y: 0, z: 1 }
  tool: ToolId = 'draw'
  selection: ReadonlySet<string> = new Set()
  erasing: ReadonlySet<string> = new Set()
  /** Page-space marquee while box-selecting. */
  marquee: Rect | null = null
  /** Text shape being typed (not in the doc until committed if it is new). */
  editing: TextShape | null = null
  /** The local stroke in progress; the board paints it directly for low latency. */
  liveId: string | null = null
  status: Status = 'connecting'
  loaded = false
  /** Increments on every document change. */
  docVersion = 0
  viewport = { w: 0, h: 0 }

  /** Set by the sync client: receives every local change. */
  onLocalChange: ((put: Shape[], del: string[]) => void) | null = null
  /** Set by the board: commits the text being edited. */
  commitText: (() => void) | null = null
  /** Set by the board: focuses the text box (must run inside the tap that asked for it). */
  focusText: ((shape: TextShape) => void) | null = null

  // ---- subscriptions --------------------------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  emit() {
    for (const l of [...this.listeners]) l()
  }

  onInput(fn: (info: InputInfo) => void) {
    this.inputListeners.add(fn)
    return () => {
      this.inputListeners.delete(fn)
    }
  }

  input(info: InputInfo) {
    for (const l of this.inputListeners) l(info)
  }

  // ---- document -------------------------------------------------------------------------

  get doc(): Doc {
    return this.shapesById
  }

  getShape(id: string): Shape | undefined {
    return this.shapesById.get(id)
  }

  shapes(): Shape[] {
    return (this.sorted ??= sortedShapes(this.shapesById))
  }

  getShapePageBounds(id: string): Rect | undefined {
    const s = this.shapesById.get(id)
    return s ? shapeBounds(s, this.shapesById) : undefined
  }

  isEmpty(): boolean {
    return this.shapesById.size === 0
  }

  nextZ(): number {
    const all = this.shapes()
    return all.length ? Math.floor(all[all.length - 1].z) + 1 : 1
  }

  private write(change: Change) {
    for (const [id, s] of change) {
      if (s) this.shapesById.set(id, s)
      else this.shapesById.delete(id)
    }
    this.sorted = null
    this.docVersion++
    if ([...this.selection].some((id) => !this.shapesById.has(id))) this.selection = new Set([...this.selection].filter((id) => this.shapesById.has(id)))
  }

  private send(change: Change) {
    const put: Shape[] = []
    const del: string[] = []
    for (const [id, s] of change) s ? put.push(s) : del.push(id)
    if (put.length || del.length) this.onLocalChange?.(put, del)
  }

  /**
   * A local edit, synced to every device. Recorded for undo unless `history` is false;
   * `before` overrides the recorded prior state (for gestures previewed live).
   */
  change(put: Shape[], del: string[] = [], opts: { history?: boolean; before?: Map<string, Shape | null> } = {}) {
    const before: Change = new Map()
    const after: Change = new Map()
    for (const s of put) {
      before.set(s.id, opts.before?.has(s.id) ? opts.before.get(s.id)! : (this.shapesById.get(s.id) ?? null))
      after.set(s.id, s)
    }
    for (const id of del) {
      const prior = opts.before?.has(id) ? opts.before.get(id)! : (this.shapesById.get(id) ?? null)
      if (!this.shapesById.has(id) && !prior) continue
      before.set(id, prior)
      after.set(id, null)
    }
    if (!after.size) return
    this.write(after)
    if (opts.history !== false) {
      this.undoStack.push({ before, after })
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
      this.redoStack = []
    }
    this.send(after)
    this.emit()
  }

  canUndo() {
    return this.undoStack.length > 0
  }

  canRedo() {
    return this.redoStack.length > 0
  }

  undo() {
    this.complete()
    const e = this.undoStack.pop()
    if (!e) return
    this.redoStack.push(e)
    this.write(e.before)
    this.send(e.before)
    this.emit()
  }

  redo() {
    this.complete()
    const e = this.redoStack.pop()
    if (!e) return
    this.undoStack.push(e)
    this.write(e.after)
    this.send(e.after)
    this.emit()
  }

  /** Changes from another device (never recorded for undo here). */
  applyRemote(put: Shape[] = [], del: string[] = []) {
    const change: Change = new Map()
    for (const id of del) change.set(id, null)
    for (const s of put) change.set(s.id, s)
    if (!change.size) return
    this.write(change)
    this.emit()
  }

  loadSnapshot(shapes: Shape[]) {
    this.shapesById = new Map(shapes.map((s) => [s.id, s]))
    this.sorted = null
    this.docVersion++
    this.selection = new Set([...this.selection].filter((id) => this.shapesById.has(id)))
    this.loaded = true
    this.emit()
  }

  setStatus(status: Status) {
    if (this.status === status) return
    this.status = status
    this.emit()
  }

  // ---- tools and selection --------------------------------------------------------------

  setTool(tool: ToolId) {
    this.complete()
    this.tool = tool
    if (tool !== 'select') this.selection = new Set()
    this.marquee = null
    this.emit()
  }

  select(ids: Iterable<string>) {
    this.selection = new Set(ids)
    this.emit()
  }

  setErasing(ids: ReadonlySet<string>) {
    this.erasing = ids
    this.emit()
  }

  setMarquee(r: Rect | null) {
    this.marquee = r
    this.emit()
  }

  deleteSelection() {
    if (!this.selection.size) return
    this.change([], [...this.selection])
    this.selection = new Set()
    this.emit()
  }

  /** Start typing into a text shape (new or existing). Call from inside a tap or key handler. */
  editText(shape: TextShape) {
    this.complete()
    this.editing = shape
    this.focusText?.(shape)
    this.emit()
  }

  /** Finish whatever is being typed. */
  complete() {
    if (this.editing) this.commitText?.()
  }

  // ---- camera ---------------------------------------------------------------------------

  setCamera(c: Camera) {
    cancelAnimationFrame(this.animation)
    this.camera = { x: c.x, y: c.y, z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.z)) }
    this.emit()
  }

  screenToPage(p: Point): Point {
    const { x, y, z } = this.camera
    return { x: p.x / z - x, y: p.y / z - y }
  }

  pageToScreen(p: Point): Point {
    const { x, y, z } = this.camera
    return { x: (p.x + x) * z, y: (p.y + y) * z }
  }

  getViewportPageBounds(): Rect {
    const { x, y, z } = this.camera
    return { x: -x, y: -y, w: this.viewport.w / z, h: this.viewport.h / z }
  }

  /** Zoom to `z`, keeping the page point under `screen` where it is. */
  zoomAt(screen: Point, z: number) {
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
    const p = this.screenToPage(screen)
    this.setCamera({ x: screen.x / nz - p.x, y: screen.y / nz - p.y, z: nz })
  }

  panBy(dx: number, dy: number) {
    const { x, y, z } = this.camera
    this.setCamera({ x: x + dx / z, y: y + dy / z, z })
  }

  private animateTo(target: Camera, ms: number) {
    cancelAnimationFrame(this.animation)
    const from = this.camera
    const t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms)
      const k = 1 - (1 - t) ** 3
      this.camera = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, z: from.z + (target.z - from.z) * k }
      this.emit()
      if (t < 1) this.animation = requestAnimationFrame(step)
    }
    this.animation = requestAnimationFrame(step)
  }

  centerOnPoint(p: Point, opts: { animate?: boolean } = {}) {
    const z = this.camera.z
    const target = { x: this.viewport.w / (2 * z) - p.x, y: this.viewport.h / (2 * z) - p.y, z }
    if (opts.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.animateTo(target, 320)
    else this.setCamera(target)
  }

  /** Fit everything on screen, never zooming in past 100%. */
  zoomToFit() {
    const b = docBounds(this.shapesById)
    const { w, h } = this.viewport
    if (!b || !w || !h) return this.setCamera({ x: 0, y: 0, z: 1 })
    const z = Math.min(1, Math.max(MIN_ZOOM, Math.min((w - 160) / Math.max(1, b.w), (h - 160) / Math.max(1, b.h))))
    this.setCamera({ x: w / (2 * z) - (b.x + b.w / 2), y: h / (2 * z) - (b.y + b.h / 2), z })
  }
}
