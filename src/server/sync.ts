import fs from 'node:fs'
import { TLSocketRoom, type RoomSnapshot } from '@tldraw/sync-core'
import { createTLSchema, type TLRecord } from '@tldraw/tlschema'
import type { WebSocket } from 'ws'
import { FILES, type VibeprintCore } from '../core/core.js'

/**
 * The user's ink lives in one tldraw sync room per repo. It is persisted to
 * `.vibeprint/canvas.json` as a clean, sorted store snapshot so git diffs show
 * which shapes changed, not sync clocks.
 */
export class CanvasRoom {
  readonly room: TLSocketRoom<TLRecord>
  private saveTimer: NodeJS.Timeout | null = null
  private lastSaved = ''

  constructor(
    private core: VibeprintCore,
    private log: (msg: string) => void = () => {},
  ) {
    const schema = createTLSchema()
    this.room = new TLSocketRoom({
      schema,
      initialSnapshot: this.loadSnapshot(),
      onDataChange: () => this.scheduleSave(),
      log: { warn: (...a: unknown[]) => log(`sync warn: ${a.join(' ')}`), error: (...a: unknown[]) => log(`sync error: ${a.join(' ')}`) },
    })
  }

  private loadSnapshot(): RoomSnapshot | undefined {
    const p = this.core.file(FILES.canvas)
    if (!fs.existsSync(p)) return undefined
    const text = fs.readFileSync(p, 'utf8')
    let data: { schema: RoomSnapshot['schema']; records: Array<{ id: string }> }
    try {
      data = JSON.parse(text)
    } catch (err) {
      throw new Error(`Could not parse .vibeprint/canvas.json (${(err as Error).message}). Resolve merge conflicts or restore it from git.`)
    }
    this.lastSaved = text
    // A clock that is always ahead of (or far from) any clock a client kept
    // from a previous daemon run, so reconnecting tabs do a full resync.
    const base = Date.now()
    return {
      clock: base,
      documentClock: base,
      tombstoneHistoryStartsAtClock: base,
      tombstones: {},
      schema: data.schema,
      documents: data.records.map((state) => ({ state: state as unknown as TLRecord, lastChangedClock: base })),
    }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 800)
  }

  /** Records (shapes, pages, bindings) in the room right now. */
  records(): Array<{ id: string; typeName: string; [k: string]: unknown }> {
    const snap = this.room.getCurrentSnapshot()
    return snap.documents.map((d) => d.state as { id: string; typeName: string })
  }

  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    const snap = this.room.getCurrentSnapshot()
    const records = snap.documents
      .map((d) => d.state)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const text = JSON.stringify({ schema: snap.schema, records }, null, 1) + '\n'
    if (text === this.lastSaved) return
    this.core.writeFileAtomic(FILES.canvas, text)
    this.lastSaved = text
  }

  connect(ws: WebSocket, sessionId: string): void {
    this.room.handleSocketConnect({ sessionId, socket: ws as never })
  }

  close(): void {
    this.save()
    this.room.close()
  }
}
