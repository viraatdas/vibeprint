import fs from 'node:fs'
import path from 'node:path'
import { TOKEN_HEADER, type DaemonInfo, type MapResult, type WaitResult } from '../shared/api.js'
import type { ArchitectureView, Batch, ChatMessage, Decision, Graph, InterpretationResult, Mark, MarkInput, RepoMap, Sketch, VibeprintState } from '../shared/types.js'
import { FILES, VIBEPRINT_DIR, VibeprintError } from './core.js'

export function readDaemonInfo(root: string): DaemonInfo | null {
  const p = path.join(root, VIBEPRINT_DIR, FILES.daemon)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as DaemonInfo
  } catch {
    return null
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Find a running daemon for this repo, or null. */
export async function findDaemon(root: string, timeoutMs = 800): Promise<DaemonClient | null> {
  const info = readDaemonInfo(root)
  if (!info || !pidAlive(info.pid)) return null
  const client = new DaemonClient(`http://127.0.0.1:${info.port}`, info.token)
  try {
    const health = await client.health(timeoutMs)
    if (path.resolve(health.root) !== path.resolve(root)) return null
    return client
  } catch {
    return null
  }
}

export class DaemonClient {
  constructor(
    readonly baseUrl: string,
    readonly token: string,
  ) {}

  private async req<T>(method: string, route: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(this.baseUrl + route, {
        method,
        headers: { 'content-type': 'application/json', [TOKEN_HEADER]: this.token },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) throw new VibeprintError(data?.error ?? `${method} ${route} failed (${res.status})`, res.status)
      return data as T
    } finally {
      clearTimeout(timer)
    }
  }

  health(timeoutMs?: number) {
    return this.req<{ ok: true; root: string; pid: number; version: string }>('GET', '/api/health', undefined, timeoutMs)
  }
  state() {
    return this.req<VibeprintState>('GET', '/api/state')
  }
  architecture() {
    return this.req<ArchitectureView>('GET', '/api/architecture')
  }
  node(ref: string) {
    return this.req<unknown>('GET', `/api/node?ref=${encodeURIComponent(ref)}`)
  }
  sketch() {
    return this.req<{ sketch: Sketch | null; graph: Graph }>('GET', '/api/sketch')
  }
  async sketchImage(): Promise<Buffer | null> {
    const res = await fetch(this.baseUrl + '/api/sketch.png', { headers: { [TOKEN_HEADER]: this.token } })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }
  map(author: string, map?: RepoMap) {
    return this.req<MapResult>('POST', '/api/map', { author, ...(map ? { map } : {}) }, 120_000)
  }
  interpret(author: string, result: InterpretationResult) {
    return this.req<{ graph: Graph; questions: Mark[] }>('POST', '/api/interpretation', { author, result })
  }
  addMarks(author: string, marks: MarkInput[], opts: { message?: string; finish?: boolean } = {}) {
    return this.req<{ marks: Mark[]; batch?: Batch; progress?: Batch }>('POST', '/api/marks', { author, marks, ...opts })
  }
  finishBatch(author: string, message?: string) {
    return this.req<{ batch: Batch | null }>('POST', '/api/batches/finish', { author, message })
  }
  listMarks(query: { status?: string; author?: string } = {}) {
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
    return this.req<{ marks: Array<Mark & { describe: string }>; batches: Batch[] }>('GET', `/api/marks?${q}`)
  }
  decideMark(id: string, decision: Decision) {
    return this.req<{ mark: Mark }>('POST', `/api/marks/${encodeURIComponent(id)}/decide`, { decision })
  }
  decideBatch(id: string, decision: Decision) {
    return this.req<{ marks: Mark[] }>('POST', `/api/batches/${encodeURIComponent(id)}/decide`, { decision })
  }
  chat(since?: string) {
    return this.req<{ messages: ChatMessage[] }>('GET', `/api/chat${since ? `?since=${encodeURIComponent(since)}` : ''}`)
  }
  postChat(text: string, author: string, role: ChatMessage['role'] = 'agent') {
    return this.req<{ message: ChatMessage }>('POST', '/api/chat', { text, author, role })
  }
  wait(opts: { since?: string; timeoutMs?: number; author?: string } = {}) {
    const t = Math.min(Math.max(opts.timeoutMs ?? 120_000, 1000), 600_000)
    const q = new URLSearchParams({ timeout: String(t), ...(opts.since ? { since: opts.since } : {}), ...(opts.author ? { author: opts.author } : {}) })
    return this.req<WaitResult>('GET', `/api/wait?${q}`, undefined, t + 10_000)
  }
}
