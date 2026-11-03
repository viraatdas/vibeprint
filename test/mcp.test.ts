import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { VibeprintCore } from '../src/core/core.js'
import { LocalBackend, resolveBackend } from '../src/mcp/backend.js'
import { authorFromClientName, createMcpServer } from '../src/mcp/server.js'
import { AGENT_RULE, LIMITS, type Batch, type Graph, type Mark, type Sketch, type SketchShape } from '../src/shared/types.js'
import { serializeCanvas, type Shape } from '../src/shared/canvas.js'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const SHAPES: SketchShape[] = [
  { id: 'shape:api', type: 'geo', geo: 'rectangle', bounds: { x: 0, y: 0, w: 200, h: 100 }, text: 'API' },
  { id: 'shape:db', type: 'geo', geo: 'ellipse', bounds: { x: 400, y: 0, w: 160, h: 100 }, text: 'Postgres' },
  { id: 'shape:web', type: 'geo', geo: 'rectangle', bounds: { x: 0, y: 300, w: 200, h: 100 }, text: 'Web app' },
  {
    id: 'shape:a1',
    type: 'arrow',
    bounds: { x: 90, y: 100, w: 20, h: 200 },
    arrow: { start: { x: 100, y: 300 }, end: { x: 100, y: 100 }, startShapeId: 'shape:web', endShapeId: 'shape:api' },
  },
  {
    id: 'shape:a2',
    type: 'arrow',
    bounds: { x: 200, y: 40, w: 200, h: 20 },
    arrow: { start: { x: 200, y: 50 }, end: { x: 400, y: 50 }, startShapeId: 'shape:api', endShapeId: 'shape:db' },
  },
]

let dir: string
let client: Client

const readJson = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(dir, '.vibeprint', name), 'utf8')) as T
const marksOnDisk = () => readJson<{ marks: Mark[]; batches: Batch[] }>('marks.json')
const graphOnDisk = () => readJson<Graph>('graph.json')

async function call(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult
}
const textOf = (res: CallToolResult) =>
  res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')

async function ok(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = await call(name, args)
  assert.ok(!res.isError, `${name} failed: ${textOf(res)}`)
  return textOf(res)
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibeprint-mcp-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  const core = new VibeprintCore(dir)
  core.ensureDir()
  core.recordSubmission(SHAPES, PNG_1X1)
  core.applyInterpretation(
    {
      nodes: [
        { id: 'api', label: 'API', kind: 'service', shapeIds: ['shape:api'] },
        { id: 'db', label: 'Postgres', kind: 'database', shapeIds: ['shape:db'] },
        { id: 'web', label: 'Web app', kind: 'client', shapeIds: ['shape:web'] },
      ],
      edges: [
        { from: 'web', to: 'api', shapeIds: ['shape:a1'] },
        { from: 'api', to: 'db', label: 'reads', shapeIds: ['shape:a2'] },
      ],
      summary: 'A web app over an API and Postgres',
    },
    'test',
  )
  core.flush()

  delete process.env.VIBEPRINT_AUTHOR
  const server = createMcpServer({ root: dir, backend: async () => new LocalBackend(dir) })
  client = new Client({ name: 'claude-code', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
})

after(async () => {
  await client?.close()
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

test('lists the tools and gives instructions with the agent rule', async () => {
  const { tools } = await client.listTools()
  const names = tools.map((t) => t.name).sort()
  assert.deepEqual(
    names,
    [
      'add',
      'annotate',
      'finish_batch',
      'get_architecture',
      'get_node',
      'get_sketch',
      'interpret',
      'list_marks',
      'map_architecture',
      'post_chat',
      'propose',
      'read_chat',
      'rewrite',
      'set_status',
      'strike',
      'wait_for_user',
    ].sort(),
  )
  const add = tools.find((t) => t.name === 'add')!
  assert.ok('connect_from' in (add.inputSchema.properties ?? {}))
  assert.deepEqual(add.inputSchema.required, ['reason'])
  assert.ok(client.getInstructions()?.includes(AGENT_RULE))
})

test('resolveBackend falls back to the files when no daemon runs', async () => {
  assert.equal((await resolveBackend(dir)).mode, 'files')
})

test('author comes from the client name', () => {
  assert.equal(authorFromClientName('claude-code'), 'claude')
  assert.equal(authorFromClientName('codex-mcp-client'), 'codex')
  assert.equal(authorFromClientName('Cursor'), 'cursor')
  assert.equal(authorFromClientName(''), undefined)
})

test('get_architecture returns an outline and the JSON', async () => {
  const res = await call('get_architecture')
  assert.ok(!res.isError)
  const [outline, jsonBlock] = res.content.map((c) => (c.type === 'text' ? c.text : ''))
  assert.match(outline, /n_api · API · service · planned/)
  assert.match(outline, /Postgres/)
  assert.match(outline, /n_api\) → Postgres \(n_postgres\) "reads"/)
  assert.ok(outline.includes(AGENT_RULE))
  const view = JSON.parse(jsonBlock.replace(/^JSON:\n/, ''))
  assert.equal(view.nodes.length, 3)
  assert.equal(view.sketchSeq, 1)
})

test('get_node accepts a label', async () => {
  const detail = JSON.parse(await ok('get_node', { ref: 'api' }))
  assert.equal(detail.node.id, 'n_api')
  assert.equal(detail.outgoing[0].to, 'n_postgres')
})

test('add by label ref proposes a mark and reports the batch', async () => {
  const out = await ok('add', { near: 'API', label: 'Redis cache', kind: 'cache', connect_from: 'API', reason: 'Hot reads hit Postgres too often' })
  assert.match(out, /Proposed m_\w+: add "Redis cache" \(cache\) near API, wired API → "Redis cache"/)
  assert.match(out, /1 add — open \(1\/6\)/)
  assert.match(out, /approval/)
  const { marks } = marksOnDisk()
  const add = marks.find((m) => m.type === 'add')!
  assert.equal(add.author, 'claude')
  assert.equal(add.status, 'pending')
  assert.deepEqual(add.target, { kind: 'node', id: 'n_api' })
  assert.deepEqual(add.data.edges, [{ from: 'n_api', to: add.data.nodeId }])
  // Proposals don't touch the graph.
  assert.equal(graphOnDisk().nodes.length, 3)
})

test('strike and annotate join the open batch', async () => {
  assert.match(await ok('strike', { target: 'Web app', reason: 'The CLI replaces the web app' }), /1 add, 1 strike/)
  const out = await ok('annotate', { target: 'Postgres', text: 'Managed or self-hosted?', question: true })
  assert.match(out, /question on Postgres: Managed or self-hosted\?/)
  assert.match(out, /1 add, 1 strike, 1 question — open \(3\/6\)/)
  const { batches } = marksOnDisk()
  const proposals = batches.filter((b) => b.kind === 'proposal')
  assert.equal(proposals.length, 1)
  assert.equal(proposals[0].markIds.length, 3)
})

test('set_status lands immediately and is auto-accepted', async () => {
  const out = await ok('set_status', { node: 'API', status: 'building', detail: 'scaffolding routes' })
  assert.match(out, /Landed m_\w+: API → building \(scaffolding routes\)/)
  assert.match(out, /auto-accepted/)
  const api = graphOnDisk().nodes.find((n) => n.id === 'n_api')!
  assert.equal(api.status, 'building')
  assert.equal(api.statusDetail, 'scaffolding routes')
  const { marks, batches } = marksOnDisk()
  const status = marks.find((m) => m.type === 'status')!
  assert.equal(status.status, 'accepted')
  assert.equal(batches.find((b) => b.id === status.batchId)?.kind, 'progress')
})

test('propose over the cap is an error and changes nothing', async () => {
  const before = marksOnDisk().marks.length
  const marks = Array.from({ length: LIMITS.marksPerBatch + 1 }, (_, i) => ({ type: 'note', target: 'API', text: `note ${i}` }))
  const res = await call('propose', { marks })
  assert.equal(res.isError, true)
  assert.match(textOf(res), /at most 6 marks/)
  assert.equal(marksOnDisk().marks.length, before)
})

test('an unknown target is an error result, not a thrown error', async () => {
  const res = await call('strike', { target: 'Kafka', reason: 'nope' })
  assert.equal(res.isError, true)
  assert.match(textOf(res), /No node or edge matches "Kafka"/)
  const bad = await call('set_status', { node: 'API', status: 'shipped' })
  assert.equal(bad.isError, true)
})

test('list_marks shows pending proposals, then decisions and answers', async () => {
  let out = await ok('list_marks', {})
  assert.match(out, /Pending \(waiting for the user\) \(3\):/)
  assert.match(out, /add "Redis cache"/)
  assert.match(out, /1 progress updates omitted/)

  // The user accepts the add and answers the question on the iPad (via the core, as the daemon would).
  const core = VibeprintCore.open(dir)
  const add = core.marks.find((m) => m.type === 'add')!
  const strike = core.marks.find((m) => m.type === 'strike')!
  core.decideMark(add.id, 'accept')
  core.decideMark(strike.id, 'reject')
  core.flush()

  out = await ok('list_marks', { mine: true })
  assert.match(out, /from claude/)
  assert.match(out, /Accepted \(part of the architecture now; build it\) \(1\):\n- m_\w+ \[claude · batch b_\w+\] add "Redis cache"/)
  assert.match(out, /Rejected \(don't do these\) \(1\):\n- m_\w+ \[claude · batch b_\w+\] strike Web app/)
  assert.match(await ok('list_marks', { status: 'pending' }), /question on Postgres/)

  assert.ok(graphOnDisk().nodes.some((n) => n.id === 'n_redis_cache' && n.origin === 'agent'))
  assert.match(await ok('get_architecture'), /accepted m_\w+ \(claude\): add "Redis cache"/)
})

test('finish_batch closes the open batch', async () => {
  assert.match(await ok('finish_batch', { message: 'First pass' }), /Batch b_\w+ finished: 1 add, 1 strike, 1 question/)
  assert.match(await ok('finish_batch'), /no open batch/)
  const proposal = marksOnDisk().batches.find((b) => b.kind === 'proposal')!
  assert.ok(proposal.closedAt)
  assert.equal(proposal.message, 'First pass')
})

test('propose lands several marks as one finished batch (snake_case accepted)', async () => {
  const out = await ok('propose', {
    message: 'Background jobs',
    marks: [
      { type: 'add', target: 'API', label: 'Job worker', kind: 'worker', connect_from: ['API'], reason: 'Emails are slow' },
      { type: 'rewrite', target: 'Postgres', label: 'Postgres 16', reason: 'Pin the version' },
      { type: 'status', target: 'Postgres', status: 'done' },
    ],
  })
  assert.match(out, /1 add, 1 rewrite — finished/)
  assert.match(out, /Landed m_\w+: Postgres → done/)
  const { batches, marks } = marksOnDisk()
  const b = batches.find((x) => x.message === 'Background jobs')!
  assert.equal(b.markIds.length, 2)
  assert.ok(b.closedAt)
  const add = marks.find((m) => m.data.label === 'Job worker')!
  assert.deepEqual(add.data.edges, [{ from: 'n_api', to: 'n_job_worker' }])
})

test('chat round-trips', async () => {
  assert.match(await ok('post_chat', { text: 'Starting on the API.' }), /Posted to the canvas chat as claude/)
  const out = await ok('read_chat')
  assert.match(out, /agent:claude — Starting on the API\./)
  const since = out.match(/since: "([^"]+)"/)![1]
  assert.match(await ok('read_chat', { since }), /No new messages/)
})

test('wait_for_user returns immediately without the daemon', async () => {
  const since = new Date(Date.now() - 60 * 60_000).toISOString()
  const out = await ok('wait_for_user', { timeout_seconds: 30, since })
  assert.match(out, /vibeprint serve/)
  assert.match(out, /Decisions:/)
  assert.match(out, /Cursor: /)
})

test('get_sketch flags an uninterpreted sketch, and interpret folds it in', async () => {
  const core = VibeprintCore.open(dir)
  core.recordSubmission([...SHAPES, { id: 'shape:queue', type: 'geo', geo: 'rectangle', bounds: { x: 400, y: 300, w: 160, h: 80 }, text: 'Jobs queue' }], PNG_1X1)

  const res = await call('get_sketch')
  assert.ok(!res.isError, textOf(res))
  const all = textOf(res)
  assert.match(all, /Sketch #2/)
  assert.match(all, /not interpreted yet/)
  assert.match(all, /shape:queue geo\(rectangle\) @400,300 160×80 "Jobs queue"/)
  assert.match(all, /shape:a1 arrow .* from shape:web to shape:api/)
  assert.match(all, /Open questions/)
  const image = res.content.find((c) => c.type === 'image')
  assert.ok(image && image.type === 'image' && image.mimeType === 'image/png')

  assert.match(await ok('get_architecture'), /Sketch #2 .* has not been interpreted yet/)

  const out = await ok('interpret', {
    nodes: [
      { id: 'n_api', label: 'API', kind: 'service', shapeIds: ['shape:api'] },
      { id: 'n_postgres', label: 'Postgres', kind: 'database', shapeIds: ['shape:db'] },
      { id: 'n_web_app', label: 'Web app', kind: 'client', shapeIds: ['shape:web'] },
      { id: 'q', label: 'Jobs queue', kind: 'queue', shape_ids: ['shape:queue'] },
    ],
    edges: [
      { from: 'n_web_app', to: 'n_api', shapeIds: ['shape:a1'] },
      { from: 'n_api', to: 'n_postgres', shapeIds: ['shape:a2'] },
      { from: 'n_api', to: 'q' },
    ],
    questions: [{ target: 'Jobs queue', text: 'SQS or Redis streams?' }],
  })
  assert.match(out, /Interpreted sketch #2/)
  assert.match(out, /n_jobs_queue · Jobs queue · queue/)
  assert.match(out, /Questions posted as margin notes: m_\w+ "SQS or Redis streams\?"/)

  const g = graphOnDisk()
  assert.equal(g.sketchSeq, 2)
  assert.equal(g.nodes.find((n) => n.id === 'n_api')?.status, 'building', 'status survives re-interpretation')
  assert.ok(g.nodes.some((n) => n.id === 'n_redis_cache'), 'accepted agent node survives')
  assert.ok(g.edges.some((e) => e.from === 'n_api' && e.to === 'n_jobs_queue'))
  assert.match(textOf(await call('get_sketch')), /Interpreted \(graph v\d+\)/)
})

test('map_architecture draws the code beside the sketch and marks it built', async () => {
  // The sketched shapes are on the canvas, as they would be after a submit.
  const sketch = readJson<Sketch>('sketch.json')
  const onCanvas = sketch.shapes.map((sh, i) => {
    const { x, y, w, h } = sh.bounds
    return sh.type === 'arrow'
      ? { id: sh.id, z: i, type: 'arrow', start: { ...sh.arrow!.start }, end: { ...sh.arrow!.end } }
      : { id: sh.id, z: i, type: 'draw', closed: true, points: [[x, y, 0.5], [x + w, y, 0.5], [x + w, y + h, 0.5], [x, y + h, 0.5], [x, y + 2, 0.5]] }
  })
  fs.writeFileSync(path.join(dir, '.vibeprint/canvas.json'), serializeCanvas(onCanvas as Shape[]))
  const res = await call('map_architecture', {
    nodes: [
      { id: 'web', label: 'Web app', kind: 'client', path: 'web/' },
      { id: 'api', label: 'API', kind: 'service', path: 'server/' },
      { id: 'jobs', label: 'Email worker', kind: 'worker', path: 'worker/' },
    ],
    edges: [
      { from: 'web', to: 'api', label: 'HTTP' },
      { from: 'api', to: 'jobs', label: 'jobs' },
    ],
  })
  assert.ok(!res.isError, textOf(res))
  assert.match(textOf(res), /Drew 3 components and 2 connections/)
  assert.match(textOf(res), /Email worker/)
  const g = graphOnDisk()
  const worker = g.nodes.find((n) => n.label === 'Email worker')
  assert.ok(worker?.fromCode && worker.status === 'done')
  // The sketched nodes are still there.
  assert.ok(g.nodes.some((n) => n.label === 'Postgres' && !n.fromCode))
  const canvas = readJson<{ shapes: Array<{ id: string }> }>('canvas.json')
  assert.ok(canvas.shapes.length >= 8)
})
