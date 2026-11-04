import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { rectsOverlap, roundRect, unionRects } from '../shared/geometry.js'
import { emptyGraph, nodeKind, nodeLabel, resolveRef, slugify, targetName, targetOrigin, targetRect, uniqueId } from '../shared/graph.js'
import { addBoxSize, describeMark, noteSize, summarizeMarks, TABLE, tableSize } from '../shared/marks.js'
import {
  AGENT_RULE,
  LIMITS,
  NODE_STATUSES,
  type ArchitectureView,
  type Batch,
  type ChatMessage,
  type Decision,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type InterpretationResult,
  type InterpreterInfo,
  MapperInfo,
  type Mark,
  type MarkData,
  type MarkInput,
  type MarkTarget,
  type OpenQuestion,
  type Sketch,
  type SketchShape,
  type VibeprintState,
  type TableSpec,
} from '../shared/types.js'
import { gitHead } from './git-head.js'
import { mergeInterpretation } from './merge.js'
import { obstacles, placeAround, placeNear } from './placement.js'

export class VibeprintError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const VIBEPRINT_DIR = '.vibeprint'

export const FILES = {
  graph: 'graph.json',
  marks: 'marks.json',
  chat: 'chat.json',
  sketch: 'sketch.json',
  sketchPng: 'sketch.png',
  canvas: 'canvas.json',
  runtime: 'runtime',
  daemon: 'runtime/daemon.json',
  relay: 'runtime/relay.json',
  map: 'runtime/map.json',
  token: 'runtime/token',
  assets: 'assets',
} as const

export type ChangeKind = 'graph' | 'marks' | 'chat' | 'sketch' | 'interpreter' | 'agents'

export interface CoreEvents {
  change: [kinds: ChangeKind[]]
  submit: [sketch: Sketch]
  chat: [message: ChatMessage]
  decision: [marks: Mark[]]
  checkpoint: [message: string]
}

const rid = (prefix: string) => `${prefix}${crypto.randomBytes(5).toString('hex')}`
const isoNow = () => new Date().toISOString()

export interface CoreOptions {
  /** Write files on a short debounce after each change (daemon). Otherwise call flush(). */
  autosave?: boolean
}

/**
 * The single owner of Vibeprint state for one repo. The daemon wraps it with
 * HTTP + live sync; the MCP server uses it directly when no daemon is running.
 */
export class VibeprintCore extends EventEmitter<CoreEvents> {
  readonly root: string
  readonly dir: string
  graph: Graph = emptyGraph()
  marks: Mark[] = []
  batches: Batch[] = []
  chat: ChatMessage[] = []
  sketch: Sketch | null = null
  interpreter: InterpreterInfo = { mode: 'heuristic', active: false }
  mapper: MapperInfo = { mode: 'none', active: false }
  update: { latest: string; current: string; command: string } | null = null
  agents: Record<string, string> = {}

  private autosave: boolean
  private dirty = new Set<'graph' | 'marks' | 'chat' | 'sketch'>()
  private saveTimer: NodeJS.Timeout | null = null

  constructor(root: string, opts: CoreOptions = {}) {
    super()
    this.root = path.resolve(root)
    this.dir = path.join(this.root, VIBEPRINT_DIR)
    this.autosave = opts.autosave ?? false
  }

  static open(root: string, opts: CoreOptions = {}): VibeprintCore {
    const core = new VibeprintCore(root, opts)
    core.load()
    return core
  }

  file(name: string): string {
    return path.join(this.dir, name)
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  ensureDir(): void {
    fs.mkdirSync(path.join(this.dir, FILES.runtime), { recursive: true })
    const ignore = path.join(this.dir, '.gitignore')
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '# Vibeprint runtime files (ports, tokens)\nruntime/\n')
  }

  load(): void {
    this.graph = this.readJson(FILES.graph) ?? emptyGraph()
    const m = this.readJson<{ marks: Mark[]; batches: Batch[] }>(FILES.marks)
    this.marks = m?.marks ?? []
    this.batches = m?.batches ?? []
    this.chat = this.readJson<{ messages: ChatMessage[] }>(FILES.chat)?.messages ?? []
    this.sketch = this.readJson<Sketch>(FILES.sketch)
  }

  private readJson<T>(name: string): T | null {
    const p = this.file(name)
    if (!fs.existsSync(p)) return null
    const text = fs.readFileSync(p, 'utf8')
    try {
      return JSON.parse(text) as T
    } catch (err) {
      const hint = text.includes('<<<<<<<') ? ' It has git merge conflict markers; resolve them first.' : ''
      throw new VibeprintError(`Could not parse ${path.relative(this.root, p)}.${hint} (${(err as Error).message})`, 500)
    }
  }

  writeFileAtomic(name: string, data: string | Buffer): void {
    this.ensureDir()
    const p = this.file(name)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    const tmp = `${p}.tmp-${process.pid}-${Date.now()}`
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, p)
  }

  private markDirty(...what: Array<'graph' | 'marks' | 'chat' | 'sketch'>): void {
    for (const w of what) this.dirty.add(w)
    if (!this.autosave) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 250)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.dirty.size) return
    const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n'
    if (this.dirty.has('graph')) this.writeFileAtomic(FILES.graph, json(this.graph))
    if (this.dirty.has('marks')) this.writeFileAtomic(FILES.marks, json({ batches: this.batches, marks: this.marks }))
    if (this.dirty.has('chat')) this.writeFileAtomic(FILES.chat, json({ messages: this.chat }))
    if (this.dirty.has('sketch') && this.sketch) this.writeFileAtomic(FILES.sketch, json(this.sketch))
    this.dirty.clear()
  }

  private changed(...kinds: ChangeKind[]): void {
    this.emit('change', kinds)
  }

  // -------------------------------------------------------------------------
  // Read models
  // -------------------------------------------------------------------------

  getState(): VibeprintState {
    return {
      project: { name: path.basename(this.root), root: this.root, ...gitHead(this.root) },
      graph: this.graph,
      marks: this.marks,
      batches: this.batches,
      chat: this.chat,
      sketch: {
        seq: this.sketch?.seq ?? 0,
        createdAt: this.sketch?.createdAt ?? null,
        shapeCount: this.sketch?.shapes.length ?? 0,
        hasImage: !!this.sketch?.hasImage,
      },
      interpreter: this.interpreter,
      mapper: this.mapper,
      ...(this.update ? { update: this.update } : {}),
      agents: this.agents,
    }
  }

  openQuestions(): OpenQuestion[] {
    const out: OpenQuestion[] = []
    for (const m of this.marks) {
      if (m.type !== 'note' || !m.data.question || m.status !== 'pending') continue
      const o = targetOrigin(this.graph, m.target)
      out.push({
        markId: m.id,
        text: m.data.text ?? '',
        target: m.target,
        at: o ? { x: o.x + (m.data.offset?.x ?? 0), y: o.y + (m.data.offset?.y ?? 0) } : { x: 0, y: 0 },
      })
    }
    return out
  }

  architecture(): ArchitectureView {
    const g = this.graph
    const live = g.nodes.filter((n) => !n.removed)
    const liveIds = new Set(live.map((n) => n.id))
    const edges = g.edges.filter((e) => !e.removed && liveIds.has(e.from) && liveIds.has(e.to))
    const pending = this.batches
      .map((b) => ({ b, ms: b.markIds.map((id) => this.marks.find((m) => m.id === id)).filter((m): m is Mark => !!m && m.status === 'pending') }))
      .filter(({ ms }) => ms.length)
      .map(({ b, ms }) => ({
        batchId: b.id,
        author: b.author,
        summary: summarizeMarks(ms),
        marks: ms.map((m) => ({ id: m.id, type: m.type, describe: describeMark(m, g) })),
      }))
    const decided = this.marks
      // Status updates and tables land on their own; they aren't the user's decisions.
      .filter((m) => m.status !== 'pending' && m.type !== 'status' && m.type !== 'table' && m.decidedAt)
      .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
      .slice(0, 12)
    return {
      project: path.basename(this.root),
      summary: g.summary,
      sketchSeq: g.sketchSeq,
      graphVersion: g.version,
      nodes: live.map((n) => ({
        id: n.id,
        label: nodeLabel(n),
        kind: nodeKind(n),
        status: n.status,
        statusDetail: n.statusDetail,
        origin: n.origin,
        tags: n.tags,
        description: n.description,
        connectsTo: edges.filter((e) => e.from === n.id).map((e) => e.to),
      })),
      edges: edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.override?.label ?? e.label })),
      removed: g.nodes.filter((n) => n.removed).map((n) => ({ id: n.id, label: nodeLabel(n) })),
      pending,
      openQuestions: this.openQuestions().map((q) => ({ markId: q.markId, text: q.text, target: targetName(g, q.target) })),
      recentDecisions: decided.map((m) => ({ markId: m.id, author: m.author, status: m.status, describe: describeMark(m, g), decidedAt: m.decidedAt })),
      rule: AGENT_RULE,
      ...(this.sketch?.source === 'map' && g.interpretedBy === 'vibeprint'
        ? {
            mapNote: this.mapper.active && this.mapper.task !== 'schema'
              ? `This map is a quick scan of folders and imports; ${this.mapper.label} is reading the code and will redraw it in a minute.`
              : 'This map came from a quick scan of folder names and imports, not from reading the code. If it is wrong, read the code and redraw it with map_architecture.',
          }
        : {}),
    }
  }

  nodeDetail(ref: string) {
    const r = resolveRef(this.graph, ref)
    if (!r) throw new VibeprintError(`No node or edge matches "${ref}". Call get_architecture for ids.`, 404)
    if (r.kind === 'edge') {
      const edge = this.graph.edges.find((e) => e.id === r.id)!
      return { edge, marks: this.marksOn(r) }
    }
    const node = this.graph.nodes.find((n) => n.id === r.id)!
    const ink = this.sketch?.shapes.filter((s) => node.shapeIds.includes(s.id)) ?? []
    return {
      node: { ...node, label: nodeLabel(node), kind: nodeKind(node), drawnLabel: node.label },
      incoming: this.graph.edges.filter((e) => e.to === node.id && !e.removed).map((e) => ({ id: e.id, from: e.from, label: e.override?.label ?? e.label })),
      outgoing: this.graph.edges.filter((e) => e.from === node.id && !e.removed).map((e) => ({ id: e.id, to: e.to, label: e.override?.label ?? e.label })),
      ink: ink.map((s) => ({ id: s.id, type: s.type, text: s.text, bounds: s.bounds })),
      marks: this.marksOn(r),
    }
  }

  private marksOn(r: { kind: 'node' | 'edge'; id: string }) {
    return this.marks
      .filter((m) => (m.target.kind === r.kind && 'id' in m.target && m.target.id === r.id) || m.data.edges?.some((e) => e.from === r.id || e.to === r.id))
      .map((m) => ({ id: m.id, type: m.type, status: m.status, author: m.author, describe: describeMark(m, this.graph), reason: m.reason }))
  }

  // -------------------------------------------------------------------------
  // Submit + interpretation
  // -------------------------------------------------------------------------

  recordSubmission(shapes: SketchShape[], image?: Buffer, note?: string, opts: { source?: 'map' } = {}): Sketch {
    if (!Array.isArray(shapes)) throw new VibeprintError('shapes must be an array')
    const sketch: Sketch = {
      seq: (this.sketch?.seq ?? 0) + 1,
      createdAt: isoNow(),
      shapes: shapes.map((s) => ({ ...s, bounds: roundRect(s.bounds) })),
      bounds: unionRects(shapes.map((s) => s.bounds)),
      hasImage: !!image,
      note: note?.trim() || undefined,
      ...(opts.source ? { source: opts.source } : {}),
    }
    if (image) this.writeFileAtomic(FILES.sketchPng, image)
    this.sketch = sketch
    this.markDirty('sketch')
    this.flush()
    if (!opts.source) this.addChat('system', 'vibeprint', `Sketch #${sketch.seq} submitted · ${shapes.length} shape${shapes.length === 1 ? '' : 's'}${sketch.note ? ` · "${sketch.note}"` : ''}`)
    this.changed('sketch')
    this.emit('submit', sketch)
    return sketch
  }

  readSketchImage(): Buffer | null {
    const p = this.file(FILES.sketchPng)
    return fs.existsSync(p) ? fs.readFileSync(p) : null
  }

  applyInterpretation(result: InterpretationResult, by: string, opts: { quiet?: boolean } = {}): { graph: Graph; questions: Mark[] } {
    if (!this.sketch) throw new VibeprintError('Nothing has been submitted yet. Draw on the canvas and hit Submit.', 409)
    if (!result || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
      throw new VibeprintError('interpretation needs { nodes: [...], edges: [...] }')
    }
    const { graph, dropped } = mergeInterpretation(this.graph, result, this.sketch, by)
    this.graph = graph

    // Marks pointing at ink the user erased can no longer land.
    const droppedSet = new Set(dropped)
    const edgeIds = new Set(graph.edges.map((e) => e.id))
    for (const m of this.marks) {
      if (m.status !== 'pending') continue
      const t = m.target
      const gone = (t.kind === 'node' && droppedSet.has(t.id)) || (t.kind === 'edge' && !edgeIds.has(t.id))
      if (gone) {
        m.status = 'rejected'
        m.decidedAt = isoNow()
        m.reason = `${m.reason ? m.reason + ' ' : ''}(target erased)`
      }
    }

    // Answers the user wrote beside earlier questions.
    for (const a of result.answers ?? []) {
      const m = this.marks.find((x) => x.id === a.markId && x.type === 'note')
      if (!m || !a.answer?.trim()) continue
      m.data.answer = a.answer.trim()
      if (m.status === 'pending') {
        m.status = 'accepted'
        m.decidedAt = isoNow()
      }
    }

    const questions: Mark[] = []
    const qs = (result.questions ?? []).slice(0, LIMITS.questionsPerSubmit)
    if (qs.length) {
      const { marks } = this.addMarks(
        by,
        qs.map((q) => ({ type: 'note' as const, question: true, text: q.text, target: q.target, at: q.at ?? (q.target ? undefined : this.sketch?.bounds ? { x: this.sketch.bounds.x + this.sketch.bounds.w + 40, y: this.sketch.bounds.y } : { x: 0, y: 0 }) })),
        { finish: true, skipLimits: true },
      )
      questions.push(...marks)
    }

    this.markDirty('graph', 'marks')
    this.changed('graph', 'marks')
    if (opts.quiet) return { graph, questions }
    const live = graph.nodes.filter((n) => !n.removed)
    const liveEdges = graph.edges.filter((e) => !e.removed).length
    this.addChat(
      'system',
      by,
      `Read sketch #${this.sketch.seq}: ${live.length} node${live.length === 1 ? '' : 's'}, ${liveEdges} edge${liveEdges === 1 ? '' : 's'}${graph.summary && !/^\d/.test(graph.summary) ? ` — ${graph.summary}` : ''}`,
    )
    this.emit('checkpoint', `vibeprint: interpret sketch #${this.sketch.seq} (${by})`)
    return { graph, questions }
  }

  /** Mark components as already built (mapped from the code). Not a mark: nothing to review. */
  markBuilt(nodeIds: string[], detail = 'in the code'): void {
    const ids = new Set(nodeIds)
    for (const n of this.graph.nodes) {
      if (!ids.has(n.id) || n.status === 'done') continue
      n.status = 'done'
      n.statusDetail = detail
    }
    this.graph.version++
    this.graph.updatedAt = isoNow()
    this.markDirty('graph')
    this.changed('graph')
  }

  /** Commit .vibeprint/ at the next checkpoint with this message. */
  checkpoint(message: string): void {
    this.emit('checkpoint', message)
  }

  // -------------------------------------------------------------------------
  // Marks
  // -------------------------------------------------------------------------

  private resolveTarget(ref: string | undefined, at: MarkInput['at'], required: boolean, kinds: Array<'node' | 'edge'> = ['node', 'edge']): MarkTarget {
    if (ref) {
      const r = resolveRef(this.graph, ref)
      if (!r) throw new VibeprintError(`No node or edge matches "${ref}". Call get_architecture to see ids.`)
      if (!kinds.includes(r.kind)) throw new VibeprintError(`"${ref}" is ${r.kind === 'node' ? 'a node' : 'an edge'}; this mark needs ${kinds.join(' or ')}.`)
      const el = r.kind === 'node' ? this.graph.nodes.find((n) => n.id === r.id) : this.graph.edges.find((e) => e.id === r.id)
      if (el?.removed) throw new VibeprintError(`"${ref}" has been struck from the architecture.`)
      return r
    }
    if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) return { kind: 'point', x: at.x, y: at.y }
    if (required) throw new VibeprintError('This mark needs a target (node/edge id or label).')
    const b = this.sketch?.bounds
    return { kind: 'point', x: b ? b.x + b.w + 60 : 0, y: b ? b.y : 0 }
  }

  private resolveNodeRef(ref: string, extra?: { id: string; label: string }): string {
    if (extra && (ref === extra.id || ref.trim().toLowerCase() === extra.label.trim().toLowerCase())) return extra.id
    const r = resolveRef(this.graph, ref)
    if (!r || r.kind !== 'node') throw new VibeprintError(`No node matches "${ref}".`)
    return r.id
  }

  private openBatch(author: string, kind: Batch['kind'], message?: string): Batch {
    const now = Date.now()
    const open = [...this.batches].reverse().find((b) => {
      if (b.author !== author || b.kind !== kind || b.closedAt) return false
      const last = Math.max(...b.markIds.map((id) => Date.parse(this.marks.find((m) => m.id === id)?.createdAt ?? b.createdAt)), Date.parse(b.createdAt))
      return now - last < LIMITS.batchOpenMs
    })
    if (open) {
      if (message) open.message = message
      return open
    }
    const batch: Batch = { id: rid('b_'), author, createdAt: isoNow(), summary: '', markIds: [], kind, message }
    this.batches.push(batch)
    return batch
  }

  /**
   * Create marks from an agent. Proposals are grouped into a batch the user
   * can accept in one tap; status marks are progress reports and land as
   * accepted immediately.
   */
  addMarks(
    author: string,
    inputs: MarkInput[],
    opts: { message?: string; finish?: boolean; skipLimits?: boolean } = {},
  ): { marks: Mark[]; batch?: Batch; progress?: Batch } {
    if (!Array.isArray(inputs) || inputs.length === 0) throw new VibeprintError('No marks given.')
    author = (author || 'agent').trim().toLowerCase()
    this.touchAgent(author)
    // Status updates and tables only report: they skip review and the batch cap.
    const reports = (i: MarkInput) => i.type === 'status' || i.type === 'table'
    const proposals = inputs.filter((i) => !reports(i))
    const statuses = inputs.filter(reports)

    // Validate everything before touching state, so a batch lands whole or not at all.
    const built: Array<{ input: MarkInput; target: MarkTarget; data: MarkData }> = []
    const placedSoFar: Mark[] = []
    // A table shown again (same name, same place) replaces the one already there.
    const replacing = new Set<Mark>()
    const taken = new Set(this.graph.nodes.map((n) => n.id))
    for (const m of this.marks) if (m.data.nodeId) taken.add(m.data.nodeId)

    for (const input of inputs) {
      const type = input.type
      let target: MarkTarget
      const data: MarkData = {}
      switch (type) {
        case 'add': {
          if (input.edge && !input.label) {
            const from = this.resolveNodeRef(input.edge.from)
            const to = this.resolveNodeRef(input.edge.to)
            if (from === to) throw new VibeprintError('An edge needs two different nodes.')
            target = { kind: 'node', id: from }
            data.edges = [{ from, to, label: input.edge.label || input.edgeLabel || undefined }]
            break
          }
          if (!input.label?.trim()) throw new VibeprintError('add needs a label for the new node (or an edge: {from, to}).')
          target = this.resolveTarget(input.target, input.at, false, ['node'])
          const label = input.label.trim()
          const nodeId = uniqueId('n_', slugify(label), taken)
          const self = { id: nodeId, label }
          data.nodeId = nodeId
          data.label = label
          if (input.kind) data.kind = input.kind.trim()
          const edges = [
            ...(input.connectFrom ?? []).map((f) => ({ from: this.resolveNodeRef(f, self), to: nodeId, label: input.edgeLabel })),
            ...(input.connectTo ?? []).map((t) => ({ from: nodeId, to: this.resolveNodeRef(t, self), label: input.edgeLabel })),
          ]
          if (input.edge) {
            edges.push({ from: this.resolveNodeRef(input.edge.from, self), to: this.resolveNodeRef(input.edge.to, self), label: input.edge.label ?? input.edgeLabel })
          }
          if (edges.length) data.edges = edges.map((e) => (e.label ? e : { from: e.from, to: e.to }))
          data.size = addBoxSize(label)
          data.offset = this.place(target, data.size, 'side', placedSoFar)
          break
        }
        case 'strike':
          target = this.resolveTarget(input.target, undefined, true)
          break
        case 'rewrite':
          target = this.resolveTarget(input.target, undefined, true)
          if (!input.label?.trim()) throw new VibeprintError('rewrite needs the corrected label.')
          data.label = input.label.trim()
          if (input.kind) data.kind = input.kind.trim()
          break
        case 'note':
          if (!input.text?.trim()) throw new VibeprintError('note needs text.')
          target = this.resolveTarget(input.target, input.at, false)
          data.text = input.text.trim()
          data.question = !!input.question
          data.size = noteSize(data.text)
          data.offset = this.place(target, data.size, 'margin', placedSoFar)
          break
        case 'table': {
          const table = cleanTable(input.table)
          data.table = table
          const t = this.resolveTarget(input.target, input.at, false, ['node'])
          target = t
          const here = (o: MarkTarget) => (o.kind === 'node' && t.kind === 'node' ? o.id === t.id : o.kind === 'point' && t.kind === 'point')
          for (const m of this.marks) {
            if (m.type === 'table' && m.status === 'accepted' && here(m.target) && m.data.table?.name.toLowerCase() === table.name.toLowerCase()) replacing.add(m)
          }
          data.size = tableSize(table)
          // A table shown again stays where it was, if it still fits there.
          const was = [...replacing].find((m) => m.data.table?.name.toLowerCase() === table.name.toLowerCase())?.data.offset
          data.offset = was && this.fits(target, was, data.size, placedSoFar, replacing) ? was : this.place(target, data.size, 'around', placedSoFar, replacing)
          break
        }
        case 'status':
          target = this.resolveTarget(input.target, undefined, true, ['node'])
          if (!input.status || !NODE_STATUSES.includes(input.status)) {
            throw new VibeprintError(`status must be one of ${NODE_STATUSES.join(', ')}.`)
          }
          data.nodeStatus = input.status
          if (input.detail?.trim()) data.detail = input.detail.trim()
          break
        default:
          throw new VibeprintError(`Unknown mark type "${(input as MarkInput).type}".`)
      }
      built.push({ input, target, data })
      if (data.offset) placedSoFar.push({ type: input.type, target, data, status: 'pending' } as Mark)
    }

    let batch: Batch | undefined
    if (proposals.length) {
      if (!opts.skipLimits) {
        const outstanding = this.marks.filter((m) => m.author === author && m.status === 'pending').length
        if (outstanding + proposals.length > LIMITS.pendingPerAuthor) {
          throw new VibeprintError(
            `${author} already has ${outstanding} marks waiting for review. Wait for the user to accept or reject them (check list_marks) before proposing more.`,
            429,
          )
        }
      }
      batch = this.openBatch(author, 'proposal', opts.message)
      const room = LIMITS.marksPerBatch - batch.markIds.length
      if (!opts.skipLimits && proposals.length > room) {
        if (batch.markIds.length === 0) {
          this.batches = this.batches.filter((b) => b !== batch)
        }
        throw new VibeprintError(
          `A batch holds at most ${LIMITS.marksPerBatch} marks (this one has room for ${room}). Keep only the marks that matter, or finish this batch and wait for review.`,
          429,
        )
      }
    }
    const progress = statuses.length ? this.openBatch(author, 'progress') : undefined

    const created: Mark[] = []
    const now = isoNow()
    for (const m of replacing) {
      m.status = 'rejected'
      m.decidedAt = now
    }
    for (const { input, target, data } of built) {
      const isStatus = reports(input)
      const mark: Mark = {
        id: rid('m_'),
        author,
        batchId: isStatus ? progress!.id : batch!.id,
        type: input.type,
        target,
        status: isStatus ? 'accepted' : 'pending',
        createdAt: now,
        ...(isStatus ? { decidedAt: now } : {}),
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
        data,
      }
      this.marks.push(mark)
      ;(isStatus ? progress! : batch!).markIds.push(mark.id)
      if (isStatus) this.applyAccepted(mark)
      created.push(mark)
    }

    const isNewBatch = batch && batch.markIds.length === built.filter((b) => !reports(b.input)).length
    for (const b of [batch, progress]) {
      if (!b) continue
      b.summary = summarizeMarks(b.markIds.map((id) => this.marks.find((m) => m.id === id)!).filter(Boolean))
      if (b.kind === 'proposal' && (opts.finish || b.markIds.length >= LIMITS.marksPerBatch)) b.closedAt = b.closedAt ?? now
    }
    if (batch && isNewBatch) {
      this.addChat('agent', author, batch.message ?? 'Proposed changes', batch.id)
    } else if (batch && opts.message) {
      batch.message = opts.message
    }
    for (const m of created.filter((x) => x.type === 'status')) {
      this.addChat('system', author, `${author}: ${targetName(this.graph, m.target)} → ${m.data.nodeStatus}${m.data.detail ? ` · ${m.data.detail}` : ''}`)
    }
    const tables = created.filter((x) => x.type === 'table')
    if (tables.length) {
      const names = tables.map((m) => m.data.table!.name)
      this.addChat('agent', author, opts.message ?? `${tables.length === 1 ? 'Here is' : `Here are ${tables.length} tables:`} ${names.join(', ')}${tables.length === 1 ? ', with example rows.' : '. The rows are examples.'}`)
    }
    if (created.some((m) => m.type === 'status')) this.markDirty('graph')
    this.markDirty('marks')
    this.changed('marks', 'graph')
    return { marks: created, batch, progress }
  }

  private fits(target: MarkTarget, offset: { x: number; y: number }, size: { w: number; h: number }, extra: Mark[], skip?: Set<Mark>): boolean {
    const anchor = targetRect(this.graph, target) ?? { x: 0, y: 0, w: 0, h: 0 }
    const box = { x: anchor.x + offset.x, y: anchor.y + offset.y, w: size.w, h: size.h }
    return !obstacles(this.graph, this.sketch, [...this.marks.filter((m) => !skip?.has(m)), ...extra]).some((b) => rectsOverlap(box, b, 14))
  }

  private place(target: MarkTarget, size: { w: number; h: number }, prefer: 'side' | 'margin' | 'around', extra: Mark[], skip?: Set<Mark>): { x: number; y: number } {
    const anchor = targetRect(this.graph, target) ?? { x: 0, y: 0, w: 0, h: 0 }
    const blockers = obstacles(this.graph, this.sketch, [...this.marks.filter((m) => !skip?.has(m)), ...extra])
    if (prefer === 'around') return placeAround(anchor, size, blockers)
    return placeNear(anchor, size, blockers, prefer)
  }

  finishBatch(batchId: string, message?: string): Batch {
    const b = this.batches.find((x) => x.id === batchId)
    if (!b) throw new VibeprintError(`No batch ${batchId}.`, 404)
    b.closedAt = b.closedAt ?? isoNow()
    if (message?.trim()) b.message = message.trim()
    this.markDirty('marks')
    this.changed('marks')
    return b
  }

  /** Close whatever batch this author has open (agents call this when a pass is done). */
  finishOpenBatch(author: string, message?: string): Batch | null {
    const b = [...this.batches].reverse().find((x) => x.author === author && x.kind === 'proposal' && !x.closedAt)
    return b ? this.finishBatch(b.id, message) : null
  }

  decideMark(markId: string, decision: Decision): Mark {
    const m = this.marks.find((x) => x.id === markId)
    if (!m) throw new VibeprintError(`No mark ${markId}.`, 404)
    this.decide([m], decision)
    return m
  }

  decideBatch(batchId: string, decision: Decision): Mark[] {
    const b = this.batches.find((x) => x.id === batchId)
    if (!b) throw new VibeprintError(`No batch ${batchId}.`, 404)
    const ms = b.markIds.map((id) => this.marks.find((m) => m.id === id)).filter((m): m is Mark => !!m && m.status === 'pending')
    this.decide(ms, decision)
    b.closedAt = b.closedAt ?? isoNow()
    return ms
  }

  private decide(ms: Mark[], decision: Decision): void {
    if (decision !== 'accept' && decision !== 'reject') throw new VibeprintError('decision must be accept or reject')
    const now = isoNow()
    const changed: Mark[] = []
    // Adds first, so edges between two new nodes in the same batch resolve.
    const ordered = [...ms].sort((a, b) => (a.type === 'add' ? 0 : 1) - (b.type === 'add' ? 0 : 1))
    for (const m of ordered) {
      // A table lands accepted (it only shows something); rejecting it takes it off the canvas.
      const removable = m.type === 'table' && m.status === 'accepted' && decision === 'reject'
      if (m.status !== 'pending' && !removable) continue
      m.status = decision === 'accept' ? 'accepted' : 'rejected'
      m.decidedAt = now
      if (decision === 'accept') this.applyAccepted(m)
      changed.push(m)
    }
    if (!changed.length) return
    this.markDirty('graph', 'marks')
    for (const batchId of new Set(changed.map((m) => m.batchId))) this.noteDecisions(batchId)
    this.emit('decision', changed)
    this.emit('checkpoint', `vibeprint: ${decision === 'accept' ? 'accept' : 'reject'} ${summarizeMarks(changed)}`)
    this.changed('graph', 'marks')
  }

  /**
   * One running chat line per batch ("Accepted 2 adds, rejected 1 rewrite from
   * claude"), updated in place as the user reviews mark by mark.
   */
  private noteDecisions(batchId: string): void {
    const batch = this.batches.find((b) => b.id === batchId)
    if (!batch) return
    const ms = batch.markIds.map((id) => this.marks.find((m) => m.id === id)).filter((m): m is Mark => !!m)
    const acc = ms.filter((m) => m.status === 'accepted')
    const rej = ms.filter((m) => m.status === 'rejected')
    const parts = [acc.length ? `Accepted ${summarizeMarks(acc)}` : '', rej.length ? `${acc.length ? 'rejected' : 'Rejected'} ${summarizeMarks(rej)}` : ''].filter(Boolean)
    const text = `${parts.join(', ')} from ${batch.author}`
    const last = this.chat[this.chat.length - 1]
    const existing = [...this.chat].reverse().find((c) => c.role === 'system' && c.author === 'you' && c.batchId === batchId)
    if (existing && existing === last) {
      existing.text = text
      this.markDirty('chat')
      this.changed('chat')
    } else {
      const msg = this.addChat('system', 'you', text)
      msg.batchId = batchId
    }
  }

  /** Fold an accepted mark into the graph. The user's ink is never touched. */
  private applyAccepted(m: Mark): void {
    const g = this.graph
    const t = m.target
    const node = t.kind === 'node' ? g.nodes.find((n) => n.id === t.id) : undefined
    const edge = t.kind === 'edge' ? g.edges.find((e) => e.id === t.id) : undefined
    switch (m.type) {
      case 'add': {
        const d = m.data
        if (d.nodeId && !g.nodes.some((n) => n.id === d.nodeId)) {
          const origin = targetOrigin(g, t) ?? { x: 0, y: 0 }
          const off = d.offset ?? { x: 0, y: 0 }
          const size = d.size ?? addBoxSize(d.label ?? '')
          const added: GraphNode = {
            id: d.nodeId,
            label: d.label ?? 'untitled',
            ...(d.kind ? { kind: d.kind } : {}),
            tags: d.kind ? [d.kind] : [],
            shapeIds: [],
            bounds: { x: origin.x + off.x, y: origin.y + off.y, w: size.w, h: size.h },
            origin: 'agent',
            ...(t.kind === 'node' ? { anchor: { nodeId: t.id, dx: off.x, dy: off.y } } : {}),
            status: 'planned',
          }
          g.nodes.push(added)
        }
        const ids = new Set(g.nodes.map((n) => n.id))
        for (const e of d.edges ?? []) {
          if (!ids.has(e.from) || !ids.has(e.to)) continue
          if (g.edges.some((x) => x.from === e.from && x.to === e.to && !x.removed)) continue
          const taken = new Set(g.edges.map((x) => x.id))
          const ge: GraphEdge = {
            id: uniqueId('e_', `${e.from.replace(/^n_/, '')}__${e.to.replace(/^n_/, '')}`, taken),
            from: e.from,
            to: e.to,
            ...(e.label ? { label: e.label } : {}),
            shapeIds: [],
            origin: 'agent',
          }
          g.edges.push(ge)
        }
        break
      }
      case 'strike':
        if (node) node.removed = true
        if (edge) edge.removed = true
        break
      case 'rewrite':
        if (node) node.override = { ...node.override, label: m.data.label, ...(m.data.kind ? { kind: m.data.kind } : {}) }
        if (edge) edge.override = { ...edge.override, label: m.data.label }
        break
      case 'status':
        if (node) {
          node.status = m.data.nodeStatus ?? node.status
          if (m.data.detail) node.statusDetail = m.data.detail
          else delete node.statusDetail
        }
        break
      case 'note':
      case 'table':
        break
    }
    g.version++
    g.updatedAt = isoNow()
  }

  // -------------------------------------------------------------------------
  // Chat + agents
  // -------------------------------------------------------------------------

  addChat(role: ChatMessage['role'], author: string, text: string, batchId?: string): ChatMessage {
    const msg: ChatMessage = { id: rid('c_'), role, author, text: text.trim(), createdAt: isoNow(), ...(batchId ? { batchId } : {}) }
    this.chat.push(msg)
    if (this.chat.length > LIMITS.chatHistory) this.chat = this.chat.slice(-LIMITS.chatHistory)
    this.markDirty('chat')
    this.emit('chat', msg)
    this.changed('chat')
    return msg
  }

  touchAgent(author: string): void {
    this.agents[author] = isoNow()
    this.changed('agents')
  }

  setUpdate(update: { latest: string; current: string; command: string }): void {
    this.update = update
    this.changed('interpreter')
  }

  setMapper(info: Partial<MapperInfo>): void {
    this.mapper = { ...this.mapper, ...info }
    this.changed('interpreter')
  }

  setInterpreter(info: Partial<InterpreterInfo>): void {
    this.interpreter = { ...this.interpreter, ...info }
    this.changed('interpreter')
  }
}

const cell = (v: unknown, max = 80) => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max)

/** Check a table from an agent and trim it to what fits on the canvas. */
export function cleanTable(t: TableSpec | undefined): TableSpec {
  if (!t || typeof t !== 'object') throw new VibeprintError('table needs { name, columns: [{ name, type?, key?, references? }], rows: [[...]] }.')
  const name = cell(t.name, 60)
  if (!name) throw new VibeprintError('table needs a name.')
  const columns = (Array.isArray(t.columns) ? t.columns : [])
    .filter((c) => c && cell(c.name))
    .slice(0, TABLE.maxColumns)
    .map((c) => ({
      name: cell(c.name, 40),
      ...(cell(c.type) ? { type: cell(c.type, 30) } : {}),
      ...(c.key === 'primary' || c.key === 'foreign' ? { key: c.key } : {}),
      ...(cell(c.references) ? { references: cell(c.references, 60) } : {}),
    }))
  if (!columns.length) throw new VibeprintError(`table "${name}" needs at least one column.`)
  const rows = (Array.isArray(t.rows) ? t.rows : [])
    .filter(Array.isArray)
    .slice(0, TABLE.maxRows)
    .map((r) => columns.map((_, i) => cell(r[i])))
  return { name, columns, rows, ...(cell(t.source) ? { source: cell(t.source, 120) } : {}) }
}

