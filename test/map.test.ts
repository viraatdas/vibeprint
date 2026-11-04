import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { scanRepo } from '../src/core/repo-scan.js'
import { mapCode } from '../src/core/map.js'
import { VibeprintCore } from '../src/core/core.js'
import { arrowPoints, extractSketch, shapeBounds, type Shape } from '../src/shared/canvas.js'
import { interpretHeuristic } from '../src/interpret/heuristic.js'
import { startDaemon } from '../src/server/daemon.js'
import { LocalBackend } from '../src/mcp/backend.js'
import type { RepoMap } from '../src/shared/types.js'

const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `vp-${name}-`))
const cleanup: string[] = []
after(() => {
  for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true })
})

/** A small repo: a Vite web app, an Express API on Postgres, a worker on a Redis queue. */
function fixtureRepo(): string {
  const root = tmp('repo')
  cleanup.push(root)
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
  write('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '1', pg: '1', react: '1', bullmq: '1', ioredis: '1' } }))
  write('web/index.html', '<div id="root"></div>')
  write('web/vite.config.ts', 'export default {}')
  write('web/src/main.tsx', "import React from 'react'\nimport { Cart } from './cart'\nfetch('/api/cart')\n")
  write('web/src/cart.tsx', "import type { Item } from '../../shared/types'\nexport const Cart = 1\n")
  write('server/index.ts', "import express from 'express'\nimport { db } from './db'\nimport { enqueue } from '../worker/queue'\n")
  write('server/db.ts', "import { Pool } from 'pg'\nexport const db = new Pool()\n")
  write('worker/queue.ts', "import { Queue } from 'bullmq'\nimport Redis from 'ioredis'\nexport const enqueue = 1\n")
  write('worker/run.ts', "import { enqueue } from './queue'\nimport { db } from '../server/db'\n")
  write('shared/types.ts', 'export type Item = { id: string }\n')
  write('test/server.test.ts', "import '../server/index'\n")
  return root
}

describe('scanning a repo', () => {
  test('finds the components, the systems they use, and how they connect', () => {
    const map = scanRepo(fixtureRepo())
    const byLabel = new Map(map.nodes.map((n) => [n.label, n]))
    assert.deepEqual([...byLabel.keys()].sort(), ['Job queue', 'Postgres', 'Redis', 'Server', 'Web', 'Worker'])
    assert.equal(byLabel.get('Web')?.kind, 'client')
    assert.ok(byLabel.get('Web')?.tags?.includes('Vite'))
    assert.equal(byLabel.get('Server')?.kind, 'service')
    assert.equal(byLabel.get('Worker')?.kind, 'worker')
    assert.equal(byLabel.get('Postgres')?.kind, 'database')
    const label = (id: string) => map.nodes.find((n) => n.id === id)!.label
    const edges = map.edges.map((e) => `${label(e.from)}->${label(e.to)}${e.label ? ` ${e.label}` : ''}`).sort()
    assert.deepEqual(edges, ['Server->Postgres', 'Server->Worker', 'Web->Server HTTP', 'Worker->Job queue', 'Worker->Redis', 'Worker->Server'].sort())
  })

  test('a repo with no code maps to nothing', () => {
    const root = tmp('empty')
    cleanup.push(root)
    fs.writeFileSync(path.join(root, 'README.md'), '# hi')
    assert.deepEqual(scanRepo(root), { nodes: [], edges: [] })
  })
})

const MAP: RepoMap = {
  nodes: [
    { id: 'web', label: 'Web app', kind: 'client', tags: ['Next.js'], path: 'apps/web/' },
    { id: 'api', label: 'API', kind: 'service', path: 'apps/api/' },
    { id: 'db', label: 'Postgres', kind: 'database' },
    { id: 'stripe', label: 'Stripe', kind: 'external' },
  ],
  edges: [
    { from: 'web', to: 'api', label: 'HTTP' },
    { from: 'api', to: 'db' },
    { from: 'api', to: 'stripe' },
    { from: 'api', to: 'nowhere' },
  ],
}

function freshCore() {
  const root = tmp('core')
  cleanup.push(root)
  const core = new VibeprintCore(root)
  core.ensureDir()
  return core
}
const apply = (canvas: Map<string, Shape>, plan: { put: Shape[]; del: string[] }) => {
  for (const id of plan.del) canvas.delete(id)
  for (const s of plan.put) canvas.set(s.id, s)
}

describe('drawing a map', () => {
  test('draws boxes, labels and attached arrows, and records them as built', () => {
    const core = freshCore()
    const canvas = new Map<string, Shape>()
    const plan = mapCode(core, [], MAP, 'vibeprint')
    apply(canvas, plan)
    assert.equal(plan.nodes, 4)
    assert.equal(plan.edges, 3, 'the edge to an unknown node is dropped')
    assert.equal(plan.put.filter((s) => s.type === 'draw' && s.closed).length, 4, 'one outline per component')
    assert.equal(plan.put.filter((s) => s.type === 'draw' && !s.closed).length, 1, 'the database is a cylinder, its lid a second stroke')
    assert.equal(plan.put.filter((s) => s.type === 'text').length, 4)
    const arrows = plan.put.filter((s) => s.type === 'arrow')
    assert.equal(arrows.length, 3)
    for (const a of arrows) {
      assert.ok(a.type === 'arrow' && a.start.id && a.end.id && canvas.has(a.start.id) && canvas.has(a.end.id), 'both ends are bound to boxes')
    }
    assert.ok(arrows.some((a) => a.type === 'arrow' && a.text === 'HTTP'))
    // Clients above services above data.
    const boxOf = (label: string) => {
      const text = plan.put.find((s) => s.type === 'text' && s.text === label)!
      const tb = shapeBounds(text, canvas)
      return plan.put.find((s) => s.type === 'draw' && (() => {
        const b = shapeBounds(s, canvas)
        return tb.x >= b.x && tb.x + tb.w <= b.x + b.w && tb.y >= b.y && tb.y + tb.h <= b.y + b.h
      })())!
    }
    const y = (label: string) => shapeBounds(boxOf(label), canvas).y
    assert.ok(y('Web app') < y('API') && y('API') < y('Postgres'))
    assert.ok(Math.abs(y('Postgres') - y('Stripe')) < 5, 'third-party services share the bottom row with the data')
    // Arrows stop at the box outlines.
    const webApi = arrows.find((a) => a.type === 'arrow' && a.text === 'HTTP')!
    const { a, b } = arrowPoints(webApi as Extract<Shape, { type: 'arrow' }>, canvas)
    assert.ok(a.y > shapeBounds(boxOf('Web app'), canvas).y + 80 && b.y < y('API'))

    const g = core.graph
    assert.equal(g.nodes.length, 4)
    assert.ok(g.nodes.every((n) => n.fromCode && n.status === 'done' && n.origin === 'ink'))
    assert.deepEqual(g.nodes.find((n) => n.label === 'Web app')?.tags, ['Next.js', 'apps/web/'])
    assert.equal(g.edges.length, 3)
    assert.equal(core.sketch?.source, 'map')
    // One chat line, not three.
    assert.equal(core.chat.length, 1)
    assert.match(core.chat[0].text, /Mapped the code: 4 components, 3 connections/)

    // The heuristic reading of the same ink agrees with the map (so a later submit keeps it).
    const reading = interpretHeuristic({ sketch: core.sketch!, previous: core.graph, openQuestions: [] })
    assert.deepEqual(reading.nodes.map((n) => n.label).sort(), ['API', 'Postgres', 'Stripe', 'Web app'])
    assert.equal(reading.edges.length, 3)
  })

  test('an outside caller sits with the clients, and arrows into one side of a box spread out', () => {
    const core = freshCore()
    const canvas = new Map<string, Shape>()
    const map: RepoMap = {
      nodes: [
        { id: 'web', label: 'Web app', kind: 'client' },
        { id: 'cli', label: 'CLI', kind: 'client' },
        { id: 'agent', label: 'Coding agent', kind: 'external' },
        { id: 'api', label: 'API', kind: 'service' },
        { id: 'db', label: 'Postgres', kind: 'database' },
        { id: 'claude', label: 'Claude API', kind: 'external' },
      ],
      edges: [
        { from: 'web', to: 'api' },
        { from: 'cli', to: 'api' },
        { from: 'agent', to: 'api' },
        { from: 'api', to: 'db' },
        { from: 'api', to: 'claude' },
      ],
    }
    const plan = mapCode(core, [], map, 'vibeprint')
    apply(canvas, plan)
    const outline = (label: string) => {
      const t = plan.put.find((s) => s.type === 'text' && s.text === label)!
      const tb = shapeBounds(t, canvas)
      return plan.put.find((s) => s.type === 'draw' && s.closed && (() => {
        const b = shapeBounds(s, canvas)
        return tb.x >= b.x && tb.x + tb.w <= b.x + b.w && tb.y >= b.y && tb.y + tb.h <= b.y + b.h
      })())!
    }
    const y = (label: string) => shapeBounds(outline(label), canvas).y
    assert.ok(Math.abs(y('Coding agent') - y('Web app')) < 5, 'the agent only calls in, so it is drawn at the top')
    assert.ok(y('Claude API') > y('API'), 'a service the code calls stays at the bottom')
    // Three arrows come into the top of the API: each lands somewhere else on it.
    const api = outline('API').id
    const ins = plan.put.filter((s) => s.type === 'arrow' && s.end.id === api) as Array<Extract<Shape, { type: 'arrow' }>>
    assert.equal(ins.length, 3)
    const lands = ins.map((s) => Math.round(arrowPoints(s, canvas).b.x))
    assert.equal(new Set(lands).size, 3, `distinct landing points: ${lands}`)
    assert.ok(Math.max(...lands) - Math.min(...lands) > 30)
  })

  test('mapping again replaces an untouched map in place and keeps node ids', () => {
    const core = freshCore()
    const canvas = new Map<string, Shape>()
    const first = mapCode(core, [], MAP, 'vibeprint')
    apply(canvas, first)
    const ids = core.graph.nodes.map((n) => n.id).sort()
    const second = mapCode(core, [...canvas.values()], MAP, 'claude')
    assert.equal(second.replaced, true)
    assert.deepEqual(second.del.sort(), first.put.map((s) => s.id).sort())
    apply(canvas, second)
    assert.equal(canvas.size, first.put.length)
    assert.deepEqual(core.graph.nodes.map((n) => n.id).sort(), ids)
    assert.ok(core.graph.nodes.every((n) => n.status === 'done'))
  })

  test('an edited map stays, and the new one goes beside it', () => {
    const core = freshCore()
    const canvas = new Map<string, Shape>()
    apply(canvas, mapCode(core, [], MAP, 'vibeprint'))
    const box = [...canvas.values()].find((s) => s.type === 'draw')!
    if (box.type === 'draw') canvas.set(box.id, { ...box, points: box.points.map(([x, y, p]) => [x + 30, y, p]) })
    const right = Math.max(...[...canvas.values()].map((s) => { const b = shapeBounds(s, canvas); return b.x + b.w }))
    const plan = mapCode(core, [...canvas.values()], MAP, 'vibeprint')
    assert.equal(plan.replaced, false)
    assert.deepEqual(plan.del, [])
    const left = Math.min(...plan.put.filter((s) => s.type === 'draw').map((s) => shapeBounds(s, canvas).x))
    assert.ok(left > right + 150, 'drawn to the right of everything')
  })

  test("the user's own sketch stays in the architecture next to the map", () => {
    const core = freshCore()
    const own: Shape[] = [
      { id: 'shape:mine', z: 1, type: 'draw', closed: true, points: [[0, 0, 0.5], [200, 0, 0.5], [200, 100, 0.5], [0, 100, 0.5], [0, 4, 0.5]] },
      { id: 'shape:mine-label', z: 2, type: 'text', x: 40, y: 30, w: 100, h: 32, text: 'Search' },
    ]
    const doc = new Map(own.map((s) => [s.id, s]))
    core.recordSubmission(extractSketch(doc))
    core.applyInterpretation(interpretHeuristic({ sketch: core.sketch!, previous: core.graph, openQuestions: [] }), 'vibeprint')
    const plan = mapCode(core, own, MAP, 'vibeprint')
    const left = Math.min(...plan.put.filter((s) => s.type === 'draw').map((s) => shapeBounds(s, doc).x))
    assert.ok(left > 350, 'the map goes to the right of the sketch')
    const search = core.graph.nodes.find((n) => n.label === 'Search')
    assert.ok(search && !search.fromCode && search.status === 'planned')
    assert.equal(core.graph.nodes.length, 5)
  })

  test('sketching on top of the map and submitting keeps the map built and adds planned work', () => {
    const core = freshCore()
    const canvas = new Map<string, Shape>()
    apply(canvas, mapCode(core, [], MAP, 'vibeprint'))
    const apiBox = [...canvas.values()].find((s) => s.type === 'draw' && core.graph.nodes.find((n) => n.label === 'API')!.shapeIds.includes(s.id))!
    const ab = shapeBounds(apiBox, canvas)
    const x = ab.x + ab.w + 400
    const mine: Shape[] = [
      { id: 'shape:search', z: 90, type: 'draw', closed: true, points: [[x, ab.y, 0.5], [x + 200, ab.y, 0.5], [x + 200, ab.y + 90, 0.5], [x, ab.y + 90, 0.5], [x, ab.y + 4, 0.5]] },
      { id: 'shape:search-label', z: 91, type: 'text', x: x + 50, y: ab.y + 28, w: 100, h: 32, text: 'Search' },
      { id: 'shape:to-search', z: 92, type: 'arrow', start: { x: ab.x + ab.w / 2, y: ab.y + ab.h / 2, id: apiBox.id, nx: 0.5, ny: 0.5 }, end: { x: x + 100, y: ab.y + 45, id: 'shape:search', nx: 0.5, ny: 0.5 } },
    ]
    for (const s of mine) canvas.set(s.id, s)
    const before = new Map(core.graph.nodes.map((n) => [n.label, n.id]))
    core.recordSubmission(extractSketch(canvas))
    core.applyInterpretation(interpretHeuristic({ sketch: core.sketch!, previous: core.graph, openQuestions: [] }), 'vibeprint')
    const g = core.graph
    for (const [label, id] of before) {
      const n = g.nodes.find((x) => x.id === id)
      assert.ok(n && n.label === label && n.status === 'done' && n.fromCode, `${label} is still the mapped, built node`)
    }
    assert.deepEqual(g.nodes.find((n) => n.label === 'Web app')?.tags, ['Next.js', 'apps/web/'], 'tags from the code survive the heuristic reading')
    const search = g.nodes.find((n) => n.label === 'Search')
    assert.ok(search && search.status === 'planned' && !search.fromCode)
    assert.ok(g.edges.some((e) => e.from === before.get('API') && e.to === search.id))
  })

  test('rejects a map with no usable components', () => {
    assert.throws(() => mapCode(freshCore(), [], { nodes: [{ id: 'x', label: '  ' }], edges: [] }, 'claude'), /no components/)
  })
})

describe('mapping through the daemon and the files', () => {
  test('POST /api/map scans the repo and every open canvas gets the drawing', async () => {
    const root = fixtureRepo()
    const d = await startDaemon({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: null, mapper: null })
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${d.port}/api/canvas`)
      const messages: any[] = []
      await new Promise<void>((resolve, reject) => {
        ws.on('message', (raw) => {
          messages.push(JSON.parse(raw.toString()))
          if (messages.length === 1) resolve()
        })
        ws.on('error', reject)
      })
      const waiting = fetch(`http://127.0.0.1:${d.port}/api/wait?timeout=5000&author=claude`).then((r) => r.json() as Promise<any>)
      const res = await fetch(`http://127.0.0.1:${d.port}/api/map`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      assert.equal(res.status, 200)
      const body = (await res.json()) as { nodes: number; edges: number; shapeIds: string[] }
      assert.equal(body.nodes, 6)
      const wait = await waiting
      assert.equal(wait.events[0].type, 'map')
      assert.equal(wait.events[0].nodes, 6)
      for (let i = 0; i < 50 && !messages.some((m) => m.t === 'ops'); i++) await new Promise((r) => setTimeout(r, 20))
      const ops = messages.find((m) => m.t === 'ops')
      assert.deepEqual(ops.put.map((s: Shape) => s.id).sort(), [...body.shapeIds].sort())
      const saved = JSON.parse(fs.readFileSync(path.join(root, '.vibeprint/canvas.json'), 'utf8'))
      assert.equal(saved.shapes.length, body.shapeIds.length)
      const state = (await (await fetch(`http://127.0.0.1:${d.port}/api/state`)).json()) as any
      assert.equal(state.graph.nodes.filter((n: any) => n.status === 'done').length, 6)
      ws.close()
    } finally {
      await d.close()
    }
  })

  test('without the daemon, the map is written into canvas.json', async () => {
    const root = fixtureRepo()
    const b = new LocalBackend(root)
    const res = await b.map('codex', MAP)
    assert.equal(res.nodes, 4)
    const saved = JSON.parse(fs.readFileSync(path.join(root, '.vibeprint/canvas.json'), 'utf8'))
    assert.equal(saved.format, 'vibeprint-canvas')
    assert.equal(saved.shapes.length, res.shapeIds.length)
    const arch = await b.architecture()
    assert.deepEqual(arch.nodes.map((n) => n.label).sort(), ['API', 'Postgres', 'Stripe', 'Web app'])
    // Other agents hear about it; the one that drew it does not.
    const since = new Date(Date.now() - 60_000).toISOString()
    assert.equal((await b.wait({ since, author: 'claude' })).events[0]?.type, 'map')
    assert.equal((await b.wait({ since, author: 'codex' })).events.length, 0)
  })
})
