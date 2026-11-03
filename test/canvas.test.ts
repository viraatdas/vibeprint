import { test, after, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { arrowPoints, bindTarget, extractSketch, serializeCanvas, type Doc, type Shape } from '../src/shared/canvas.js'
import { decodeTldrawPath, importTldraw } from '../src/server/tldraw-import.js'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { interpretHeuristic } from '../src/interpret/heuristic.js'
import { emptyGraph } from '../src/shared/graph.js'
import { unionRects } from '../src/shared/geometry.js'
import type { SketchShape } from '../src/shared/types.js'

const box = (id: string, x: number, y: number, w: number, h: number): Shape => ({
  id,
  z: 1,
  type: 'draw',
  points: [[x, y, 0.5], [x + w, y, 0.5], [x + w, y + h, 0.5], [x, y + h, 0.5], [x, y + 2, 0.5]],
})
const docOf = (...shapes: Shape[]): Doc => new Map(shapes.map((s) => [s.id, s]))
const read = (shapes: SketchShape[]) =>
  interpretHeuristic({
    sketch: { seq: 1, createdAt: '2026-11-03T00:00:00.000Z', shapes, bounds: unionRects(shapes.map((s) => s.bounds)), hasImage: false },
    previous: emptyGraph(),
    openQuestions: [],
  })

describe('canvas geometry', () => {
  test('a bound arrow follows its shapes and stops at their outlines', () => {
    const a = box('shape:a', 0, 0, 100, 60)
    const b = box('shape:b', 300, 0, 100, 60)
    const arrow: Shape = { id: 'shape:ar', z: 2, type: 'arrow', start: { x: 50, y: 30, id: 'shape:a', nx: 0.5, ny: 0.5 }, end: { x: 350, y: 30, id: 'shape:b', nx: 0.5, ny: 0.5 } }
    const { a: p, b: q } = arrowPoints(arrow, docOf(a, b, arrow))
    // Meets the right side of a and the left side of b, with a small gap.
    assert.ok(p.x > 100 && p.x < 110, `start x ${p.x}`)
    assert.ok(q.x < 300 && q.x > 290, `end x ${q.x}`)
    // Moving b drags the arrow's end with it.
    const moved = box('shape:b', 300, 300, 100, 60)
    const after = arrowPoints(arrow, docOf(a, moved, arrow))
    assert.ok(after.b.y > 280, `end y ${after.b.y}`)
  })

  test('arrow ends bind to the innermost box under them', () => {
    const outer = box('shape:outer', 0, 0, 600, 400)
    const inner = box('shape:inner', 100, 100, 120, 80)
    assert.equal(bindTarget(docOf(outer, inner), { x: 150, y: 130 }, 'shape:x', 8)?.id, 'shape:inner')
    assert.equal(bindTarget(docOf(outer, inner), { x: 400, y: 300 }, 'shape:x', 8)?.id, 'shape:outer')
    assert.equal(bindTarget(docOf(outer, inner), { x: 900, y: 900 }, 'shape:x', 8), undefined)
  })

  test('extraction gives the interpreter closed boxes, text and bound arrows', () => {
    const a = box('shape:a', 0, 0, 160, 90)
    const b = box('shape:b', 300, 0, 160, 90)
    const ta: Shape = { id: 'shape:ta', z: 3, type: 'text', x: 40, y: 30, w: 40, h: 32, text: 'api ' }
    const tb: Shape = { id: 'shape:tb', z: 3, type: 'text', x: 330, y: 30, w: 100, h: 32, text: 'postgres' }
    const ar: Shape = { id: 'shape:ar', z: 4, type: 'arrow', start: { x: 80, y: 45, id: 'shape:a', nx: 0.5, ny: 0.5 }, end: { x: 380, y: 45, id: 'shape:b', nx: 0.5, ny: 0.5 } }
    const sketch = extractSketch(docOf(a, b, ta, tb, ar))
    const byId = Object.fromEntries(sketch.map((s) => [s.id, s]))
    assert.equal(byId['shape:a'].closed, true)
    assert.equal(byId['shape:ta'].text, 'api')
    assert.deepEqual([byId['shape:ar'].arrow?.startShapeId, byId['shape:ar'].arrow?.endShapeId], ['shape:a', 'shape:b'])
    const reading = read(sketch)
    const labels = reading.nodes.map((n) => n.label?.toLowerCase())
    assert.ok(labels.includes('api') && labels.includes('postgres'), labels.join())
    assert.equal(reading.edges.length, 1)
  })

  test('canvas.json is one shape per line, sorted, so git diffs stay readable', () => {
    const text = serializeCanvas([box('shape:b', 0, 0, 10, 10), box('shape:a', 5, 5, 10, 10)])
    const lines = text.trim().split('\n')
    assert.match(lines[0], /^\{"format":"vibeprint-canvas","version":1,"shapes":\[$/)
    assert.match(lines[1], /^\{"id":"shape:a"/)
    assert.match(lines[2], /^\{"id":"shape:b"/)
    assert.equal(lines[3], ']}')
    assert.equal(JSON.parse(text).shapes.length, 2)
    assert.equal(serializeCanvas([]), '{"format":"vibeprint-canvas","version":1,"shapes":[]}\n')
  })
})

describe('reading 0.1/0.2 canvases (tldraw format)', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/tldraw-canvas.json'), 'utf8'))
  const expected = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/tldraw-canvas.expected.json'), 'utf8'))

  test('packed stroke paths decode to the same points tldraw read', () => {
    for (const [id, want] of Object.entries<any>(expected)) {
      const rec = fixture.records.find((r: any) => r.id === id)
      const pts = rec.props.segments.flatMap((s: any) => decodeTldrawPath(s.path, s.dim ?? 3))
      const r2 = (n: number) => Math.round(n * 100) / 100
      assert.equal(pts.length, want.count, id)
      assert.deepEqual([r2(pts[0].x), r2(pts[0].y), r2(pts[0].z)], want.first, id)
      assert.deepEqual([r2(pts.at(-1).x), r2(pts.at(-1).y), r2(pts.at(-1).z)], want.last, id)
      const mid = pts[pts.length >> 1]
      assert.deepEqual([r2(mid.x), r2(mid.y)], want.mid, id)
    }
  })

  test('every shape keeps its id, strokes land in page space, and arrows stay bound', () => {
    const shapes = importTldraw(fixture.records)
    const byId = new Map(shapes.map((s) => [s.id, s]))
    const mouseBox = byId.get('shape:W92x-uCNNLW9tJ6-LIW6e')
    const penBox = byId.get('shape:UNkERk1T3VSgnMdjMXEyT')
    assert.equal(mouseBox?.type, 'draw')
    assert.equal(penBox?.type, 'draw')
    if (penBox?.type !== 'draw' || mouseBox?.type !== 'draw') return
    assert.equal(penBox.pen, true)
    assert.equal(penBox.closed, true)
    // The pen stroke started at its shape origin (700, 200) with pressure 0.38.
    assert.deepEqual(penBox.points[0], [700, 200, 0.38])
    const arrow = byId.get('shape:jCyOiB9NBa6Zn1N7zPr67')
    assert.equal(arrow?.type, 'arrow')
    if (arrow?.type !== 'arrow') return
    assert.equal(arrow.start.id, mouseBox.id)
    assert.equal(arrow.end.id, penBox.id)
    const texts = shapes.filter((s) => s.type === 'text').map((s) => (s.type === 'text' ? s.text : ''))
    assert.deepEqual(texts.sort(), ['api', 'postgres', 'queue'])
    // The geo rectangle becomes a closed outline with its label beside it.
    const geo = byId.get('shape:qgOcQbJhBCUAF8eCEZQX0')
    assert.equal(geo?.type === 'draw' && geo.closed, true)
    assert.ok(byId.get('shape:qgOcQbJhBCUAF8eCEZQX0-label'))
    // Read as a sketch, it is still api -> postgres, plus a queue.
    const reading = read(extractSketch(byId))
    const label = (id: string | undefined) => reading.nodes.find((n) => n.id === id)?.label?.toLowerCase()
    assert.deepEqual(reading.edges.map((e) => `${label(e.from)}->${label(e.to)}`), ['api->postgres'])
  })
})

describe('canvas sync through the daemon', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-canvas-'))
  let d: Daemon
  const opts = () => ({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: null })
  type Client = { ws: WebSocket; next: (t: string) => Promise<any>; send: (m: unknown) => void }
  const connect = (): Promise<Client> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${d.port}/api/canvas`)
      const inbox: any[] = []
      const waiters: Array<{ t: string; resolve: (m: any) => void }> = []
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString())
        const i = waiters.findIndex((w) => w.t === msg.t)
        if (i >= 0) waiters.splice(i, 1)[0].resolve(msg)
        else inbox.push(msg)
      })
      const next = (t: string) => {
        const i = inbox.findIndex((m) => m.t === t)
        if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0])
        return new Promise((r) => waiters.push({ t, resolve: r }))
      }
      ws.on('open', () => resolve({ ws, next, send: (m) => ws.send(JSON.stringify(m)) }))
      ws.on('error', reject)
    })

  before(async () => {
    fs.mkdirSync(path.join(root, '.vibeprint'), { recursive: true })
    fs.copyFileSync(path.join(import.meta.dirname, 'fixtures/tldraw-canvas.json'), path.join(root, '.vibeprint/canvas.json'))
    d = await startDaemon(opts())
  })
  after(async () => {
    await d?.close()
  })

  test('an old tldraw canvas.json is converted on start and rewritten in the new format', async () => {
    const saved = JSON.parse(fs.readFileSync(path.join(root, '.vibeprint/canvas.json'), 'utf8'))
    assert.equal(saved.format, 'vibeprint-canvas')
    assert.ok(saved.shapes.some((s: any) => s.id === 'shape:jCyOiB9NBa6Zn1N7zPr67' && s.type === 'arrow'))
    const c = await connect()
    const snap = await c.next('snapshot')
    assert.equal(snap.v, 1)
    assert.equal(snap.shapes.length, saved.shapes.length)
    c.ws.close()
  })

  test('a change from one device is acked and reaches the others', async () => {
    const ipad = await connect()
    const laptop = await connect()
    await Promise.all([ipad.next('snapshot'), laptop.next('snapshot')])
    const stroke = box('shape:new-stroke', 900, 100, 80, 40)
    ipad.send({ t: 'ops', n: 1, put: [stroke] })
    assert.deepEqual(await ipad.next('ack'), { t: 'ack', n: 1 })
    assert.deepEqual((await laptop.next('ops')).put, [stroke])
    laptop.send({ t: 'ops', n: 1, del: ['shape:new-stroke'] })
    await laptop.next('ack')
    assert.deepEqual((await ipad.next('ops')).del, ['shape:new-stroke'])
    ipad.ws.close()
    laptop.ws.close()
  })

  test('malformed shapes are rejected and never reach the file', async () => {
    const c = await connect()
    await c.next('snapshot')
    c.send({ t: 'ops', n: 5, put: [{ id: 'shape:bad', z: 1, type: 'draw', points: [] }] })
    const r = await c.next('rejected')
    assert.equal(r.n, 5)
    c.send({ t: 'ops', n: 6, put: [{ id: 'not-a-shape-id', z: 1, type: 'text', x: 0, y: 0, w: 1, h: 1, text: 'x' }] })
    assert.equal((await c.next('rejected')).n, 6)
    c.send({ t: 'ops', n: 7, put: [{ id: 'shape:img', z: 1, type: 'image', x: 0, y: 0, w: 1, h: 1, src: 'https://evil.example/x.png' }] })
    assert.equal((await c.next('rejected')).n, 7)
    c.ws.close()
    d.canvas.save()
    const text = fs.readFileSync(path.join(root, '.vibeprint/canvas.json'), 'utf8')
    assert.ok(!text.includes('shape:bad') && !text.includes('evil.example'))
  })

  test('the canvas survives a daemon restart', async () => {
    const c = await connect()
    await c.next('snapshot')
    const note: Shape = { id: 'shape:keep-me', z: 9, type: 'text', x: 10, y: 600, w: 80, h: 32, text: 'redis?' }
    c.send({ t: 'ops', n: 1, put: [note] })
    await c.next('ack')
    c.ws.close()
    await d.close()
    d = await startDaemon(opts())
    const again = await connect()
    const snap = await again.next('snapshot')
    assert.deepEqual(snap.shapes.find((s: Shape) => s.id === 'shape:keep-me'), note)
    again.ws.close()
  })
})
