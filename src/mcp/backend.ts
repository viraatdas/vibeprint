// The MCP server talks to Vibeprint state through a Backend: the daemon's HTTP
// API when `vibeprint serve` is running (it owns state and the live canvas),
// otherwise the `.vibeprint/` files directly.
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { ActivityEvent, MapResult, WaitResult } from '../shared/api.js'
import { describeMark } from '../shared/marks.js'
import type { ArchitectureView, Batch, ChatMessage, Graph, InterpretationResult, Mark, MarkInput, MarkStatus, RepoMap, Sketch } from '../shared/types.js'
import { FILES, VibeprintCore, VibeprintError } from '../core/core.js'
import { mapCode } from '../core/map.js'
import { scanRepo } from '../core/repo-scan.js'
import { readCanvasFile, writeCanvasFile } from '../server/canvas.js'
import { DaemonClient, findDaemon } from '../core/daemon-client.js'

export type DescribedMark = Mark & { describe: string }

export interface AddMarksResult {
  marks: DescribedMark[]
  batch?: Batch
  progress?: Batch
}

export interface ListMarksResult {
  marks: DescribedMark[]
  batches: Batch[]
}

export interface BackendWaitResult extends WaitResult {
  /** Set when the backend cannot wait live (files mode). */
  note?: string
}

export interface Backend {
  readonly mode: 'daemon' | 'files'
  architecture(): Promise<ArchitectureView>
  node(ref: string): Promise<unknown>
  sketch(): Promise<{ sketch: Sketch | null; graph: Graph }>
  sketchImage(): Promise<Buffer | null>
  interpret(author: string, result: InterpretationResult): Promise<{ graph: Graph; questions: Mark[] }>
  /** Draw the existing code onto the canvas: `map` from the agent, or scanned when omitted. */
  map(author: string, map?: RepoMap): Promise<MapResult>
  addMarks(author: string, marks: MarkInput[], opts?: { message?: string; finish?: boolean }): Promise<AddMarksResult>
  finishBatch(author: string, message?: string): Promise<{ batch: Batch | null }>
  listMarks(query?: { status?: MarkStatus; author?: string }): Promise<ListMarksResult>
  chat(since?: string): Promise<{ messages: ChatMessage[] }>
  postChat(text: string, author: string): Promise<{ message: ChatMessage }>
  wait(opts?: { since?: string; timeoutMs?: number; author?: string }): Promise<BackendWaitResult>
}

const describeAll = (marks: Mark[], graph: Graph): DescribedMark[] => marks.map((m) => ({ ...m, describe: describeMark(m, graph) }))

// ---------------------------------------------------------------------------
// Daemon
// ---------------------------------------------------------------------------

export class HttpBackend implements Backend {
  readonly mode = 'daemon' as const
  constructor(readonly client: DaemonClient) {}

  architecture() {
    return this.client.architecture()
  }
  node(ref: string) {
    return this.client.node(ref)
  }
  sketch() {
    return this.client.sketch()
  }
  sketchImage() {
    return this.client.sketchImage()
  }
  interpret(author: string, result: InterpretationResult) {
    return this.client.interpret(author, result)
  }
  map(author: string, map?: RepoMap) {
    return this.client.map(author, map)
  }
  async addMarks(author: string, marks: MarkInput[], opts: { message?: string; finish?: boolean } = {}): Promise<AddMarksResult> {
    const res = await this.client.addMarks(author, marks, opts)
    // Describe against the graph as it is now (status marks have already landed).
    const { graph } = await this.client.sketch()
    return { ...res, marks: describeAll(res.marks, graph) }
  }
  finishBatch(author: string, message?: string) {
    return this.client.finishBatch(author, message)
  }
  listMarks(query: { status?: MarkStatus; author?: string } = {}) {
    return this.client.listMarks(query)
  }
  chat(since?: string) {
    return this.client.chat(since)
  }
  postChat(text: string, author: string) {
    return this.client.postChat(text, author, 'agent')
  }
  wait(opts: { since?: string; timeoutMs?: number; author?: string } = {}) {
    return this.client.wait(opts)
  }
}

// ---------------------------------------------------------------------------
// Files (no daemon)
// ---------------------------------------------------------------------------

const LOCK_FILE = `${FILES.runtime}/files.lock`
const LOCK_STALE_MS = 10_000
const LOCK_WAIT_MS = 5_000

/**
 * Works on `.vibeprint/` directly. Files are the source of truth, so state is
 * reloaded before every operation and flushed after every mutation. Mutations
 * take a small lock file so two agents (say Claude Code and Codex) writing at
 * once don't lose each other's marks.
 */
export class LocalBackend implements Backend {
  readonly mode = 'files' as const
  readonly core: VibeprintCore

  constructor(readonly root: string) {
    this.core = new VibeprintCore(root)
  }

  private read<T>(fn: (core: VibeprintCore) => T): Promise<T> {
    return Promise.resolve().then(() => {
      this.core.load()
      return fn(this.core)
    })
  }

  private async write<T>(fn: (core: VibeprintCore) => T): Promise<T> {
    const core = this.core
    core.ensureDir()
    const lock = core.file(LOCK_FILE)
    const deadline = Date.now() + LOCK_WAIT_MS
    for (;;) {
      try {
        fs.writeFileSync(lock, `${process.pid}\n`, { flag: 'wx' })
        break
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        try {
          if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true })
        } catch {
          // Lock vanished between the two calls; just retry.
        }
        if (Date.now() > deadline) {
          throw new VibeprintError(`Another process is writing ${path.relative(this.root, core.dir) || '.vibeprint'}/ right now. Try again in a moment.`, 503)
        }
        await sleep(20)
      }
    }
    try {
      core.load()
      const out = fn(core)
      core.flush()
      return out
    } finally {
      fs.rmSync(lock, { force: true })
    }
  }

  architecture() {
    return this.read((c) => c.architecture())
  }
  node(ref: string) {
    return this.read((c) => c.nodeDetail(ref) as unknown)
  }
  sketch() {
    return this.read((c) => ({ sketch: c.sketch, graph: c.graph }))
  }
  sketchImage() {
    return this.read((c) => (c.sketch?.hasImage ? c.readSketchImage() : null))
  }
  interpret(author: string, result: InterpretationResult) {
    return this.write((c) => c.applyInterpretation(result, author))
  }
  map(author: string, map?: RepoMap) {
    return this.write((c): MapResult => {
      const shapes = new Map(readCanvasFile(c).shapes.map((s) => [s.id, s]))
      const scanned = map ?? scanRepo(this.root)
      if (!scanned.nodes.length) throw new VibeprintError('Found no source code to map. Read the code and pass nodes and edges.')
      const plan = mapCode(c, [...shapes.values()], scanned, author)
      for (const id of plan.del) shapes.delete(id)
      for (const s of plan.put) shapes.set(s.id, s)
      writeCanvasFile(c, shapes.values())
      return { seq: c.sketch!.seq, nodes: plan.nodes, edges: plan.edges, replaced: plan.replaced, shapeIds: plan.put.map((s) => s.id) }
    })
  }
  addMarks(author: string, marks: MarkInput[], opts: { message?: string; finish?: boolean } = {}) {
    return this.write((c) => {
      const res = c.addMarks(author, marks, opts)
      return { ...res, marks: describeAll(res.marks, c.graph) }
    })
  }
  finishBatch(author: string, message?: string) {
    return this.write((c) => ({ batch: c.finishOpenBatch(author, message) }))
  }
  listMarks(query: { status?: MarkStatus; author?: string } = {}) {
    return this.read((c) => {
      const author = query.author?.trim().toLowerCase()
      const marks = c.marks.filter((m) => (!query.status || m.status === query.status) && (!author || m.author === author))
      const batchIds = new Set(marks.map((m) => m.batchId))
      return { marks: describeAll(marks, c.graph), batches: c.batches.filter((b) => batchIds.has(b.id)) }
    })
  }
  chat(since?: string) {
    return this.read((c) => ({ messages: messagesSince(c.chat, since) }))
  }
  postChat(text: string, author: string) {
    if (!text?.trim()) return Promise.reject(new VibeprintError('Chat message is empty.'))
    return this.write((c) => ({ message: c.addChat('agent', author, text) }))
  }

  /**
   * No live waiting without the daemon. Returns at once with whatever already
   * happened after `since` (an ISO time), so polling still works.
   */
  wait(opts: { since?: string; timeoutMs?: number; author?: string } = {}) {
    return this.read((c): BackendWaitResult => {
      const cursor = new Date().toISOString()
      const sinceMs = isoTime(opts.since)
      const events: ActivityEvent[] = []
      if (sinceMs !== null) {
        const after = (iso?: string) => !!iso && Date.parse(iso) > sinceMs
        const author = opts.author?.trim().toLowerCase()
        if (c.sketch && after(c.sketch.createdAt) && c.sketch.source !== 'map') {
          events.push({ type: 'submit', at: c.sketch.createdAt, seq: c.sketch.seq, shapeCount: c.sketch.shapes.length, ...(c.sketch.note ? { note: c.sketch.note } : {}) })
        }
        if (c.sketch && after(c.sketch.createdAt) && c.sketch.source === 'map' && c.graph.interpretedBy !== author) {
          const mapped = c.graph.nodes.filter((n) => n.fromCode && !n.removed)
          events.push({ type: 'map', at: c.sketch.createdAt, seq: c.sketch.seq, author: c.graph.interpretedBy ?? 'vibeprint', nodes: mapped.length, edges: c.graph.edges.length })
        }
        for (const m of c.chat) if (m.role === 'user' && after(m.createdAt)) events.push({ type: 'chat', at: m.createdAt, message: m })
        // A table lands accepted on its own; only the user removing one is their decision.
        const decided = c.marks.filter((m) => m.type !== 'status' && !(m.type === 'table' && m.status === 'accepted') && m.status !== 'pending' && after(m.decidedAt) && (!author || m.author === author))
        if (decided.length) {
          events.push({
            type: 'decision',
            at: decided.map((m) => m.decidedAt!).sort().at(-1)!,
            marks: decided.map((m) => ({ id: m.id, author: m.author, status: m.status, describe: describeMark(m, c.graph) })),
          })
        }
        events.sort((a, b) => a.at.localeCompare(b.at))
      }
      return {
        events,
        cursor,
        timedOut: events.length === 0,
        note:
          'Live waiting needs the Vibeprint daemon, and it is not running. Ask the user to run `vibeprint serve` in this repo (it also serves the iPad canvas). ' +
          'Until then this returns immediately with anything recorded in .vibeprint/ after `since`; poll list_marks / read_chat instead of looping on wait_for_user.',
      }
    })
  }
}

/** Messages after `since`, which may be a message id or an ISO timestamp. */
export function messagesSince(messages: ChatMessage[], since?: string): ChatMessage[] {
  if (!since) return messages
  const idx = messages.findIndex((m) => m.id === since)
  if (idx >= 0) return messages.slice(idx + 1)
  const t = isoTime(since)
  if (t === null) return messages
  return messages.filter((m) => Date.parse(m.createdAt) > t)
}

/** Epoch ms for an ISO-8601 time, else null (so a daemon cursor like "a1b2c3:7" isn't misread as a date). */
function isoTime(s?: string): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(s.trim())) return null
  const t = Date.parse(s.trim())
  return Number.isFinite(t) ? t : null
}

/** The daemon if one is serving this repo, else the files. Cheap; call per tool call. */
export async function resolveBackend(root: string): Promise<Backend> {
  const client = await findDaemon(root)
  return client ? new HttpBackend(client) : new LocalBackend(root)
}
