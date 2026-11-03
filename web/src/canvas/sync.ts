import type { ClientMessage, ServerMessage, Shape } from '@shared/canvas'
import type { Editor } from './editor'

interface Pending {
  n: number
  put: Shape[]
  del: string[]
}

const TICK_MS = 25_000
/** No message (not even a tick) for this long means the socket is dead. */
const SILENCE_MS = 70_000

/**
 * Keeps the editor's document in step with the daemon over /api/canvas.
 *
 * Local edits apply at once and are sent as ops; the daemon acks each one and forwards it to
 * the other devices. Until an op is acked, remote changes to the same shapes are ignored: the
 * daemon got them before ours, so ours wins there too. After a reconnect the daemon sends a
 * fresh snapshot and unacked ops are replayed on top of it.
 */
export class CanvasSync {
  private ws: WebSocket | null = null
  private n = 0
  private pending: Pending[] = []
  private pendingIds = new Map<string, number>()
  private closed = false
  private backoff = 500
  private lastMessage = Date.now()
  private retry: ReturnType<typeof setTimeout> | null = null
  private timer: ReturnType<typeof setInterval>
  /** Consecutive failed connects before the first snapshot arrived. */
  failures = 0

  constructor(
    private editor: Editor,
    private url: string,
  ) {
    editor.onLocalChange = (put, del) => this.push(put, del)
    this.connect()
    this.timer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return
      if (Date.now() - this.lastMessage > SILENCE_MS) return this.ws.close()
      this.raw({ t: 'tick' })
    }, TICK_MS)
    addEventListener('online', this.wake)
    document.addEventListener('visibilitychange', this.wake)
  }

  /** Coming back online or to the foreground: reconnect now rather than after the backoff. */
  private wake = () => {
    if (document.visibilityState === 'hidden' || this.closed) return
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return
    if (this.retry) clearTimeout(this.retry)
    this.backoff = 500
    this.connect()
  }

  private raw(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private sendOp(op: Pending) {
    this.raw({ t: 'ops', n: op.n, ...(op.put.length ? { put: op.put } : {}), ...(op.del.length ? { del: op.del } : {}) })
  }

  private push(put: Shape[], del: string[]) {
    const op = { n: ++this.n, put, del }
    this.pending.push(op)
    for (const id of [...put.map((s) => s.id), ...del]) this.pendingIds.set(id, (this.pendingIds.get(id) ?? 0) + 1)
    this.sendOp(op)
  }

  private settle(n: number) {
    const i = this.pending.findIndex((p) => p.n === n)
    if (i < 0) return
    const [op] = this.pending.splice(i, 1)
    for (const id of [...op.put.map((s) => s.id), ...op.del]) {
      const c = (this.pendingIds.get(id) ?? 1) - 1
      if (c > 0) this.pendingIds.set(id, c)
      else this.pendingIds.delete(id)
    }
  }

  private connect() {
    if (this.closed) return
    this.retry = null
    this.editor.setStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onmessage = (e) => {
      this.lastMessage = Date.now()
      let msg: ServerMessage
      try {
        msg = JSON.parse(String(e.data))
      } catch {
        return
      }
      switch (msg.t) {
        case 'snapshot': {
          this.editor.loadSnapshot(msg.shapes)
          for (const op of this.pending) this.editor.applyRemote(op.put, op.del)
          for (const op of this.pending) this.sendOp(op)
          this.failures = 0
          this.backoff = 500
          this.editor.setStatus('live')
          return
        }
        case 'ops': {
          const put = (msg.put ?? []).filter((s) => !this.pendingIds.has(s.id))
          const del = (msg.del ?? []).filter((id) => !this.pendingIds.has(id))
          this.editor.applyRemote(put, del)
          return
        }
        case 'ack':
          return this.settle(msg.n)
        case 'rejected':
          console.warn(`[vibeprint] canvas change rejected: ${msg.error}`)
          this.settle(msg.n)
          // Our copy may have drifted from the daemon's; reload it.
          return ws.close()
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.closed) return
      if (!this.editor.loaded) this.failures++
      this.editor.setStatus(this.editor.loaded ? 'connecting' : 'offline')
      this.retry = setTimeout(() => this.connect(), this.backoff)
      this.backoff = Math.min(this.backoff * 2, 10_000)
    }
  }

  close() {
    this.closed = true
    clearInterval(this.timer)
    if (this.retry) clearTimeout(this.retry)
    removeEventListener('online', this.wake)
    document.removeEventListener('visibilitychange', this.wake)
    this.ws?.close()
    this.ws = null
    if (this.editor.onLocalChange) this.editor.onLocalChange = null
  }
}
