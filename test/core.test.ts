import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VibeprintCore, VibeprintError } from '../src/core/core.js'
import { mergeInterpretation } from '../src/core/merge.js'
import { emptyGraph } from '../src/shared/graph.js'
import { summarizeMarks } from '../src/shared/marks.js'
import type { InterpretationResult, SketchShape } from '../src/shared/types.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vp-core-'))

const box = (id: string, x: number, y: number): SketchShape => ({ id, type: 'geo', geo: 'rectangle', bounds: { x, y, w: 160, h: 90 } })
const shapes: SketchShape[] = [
  { ...box('shape:web', 0, 0), text: 'web' },
  { ...box('shape:api', 300, 0), text: 'api' },
  { ...box('shape:db', 300, 250), text: 'postgres' },
  { id: 'shape:a1', type: 'arrow', bounds: { x: 160, y: 40, w: 140, h: 4 }, arrow: { start: { x: 160, y: 45 }, end: { x: 300, y: 45 }, startShapeId: 'shape:web', endShapeId: 'shape:api' } },
  { id: 'shape:a2', type: 'arrow', bounds: { x: 380, y: 90, w: 4, h: 160 }, arrow: { start: { x: 380, y: 90 }, end: { x: 380, y: 250 }, startShapeId: 'shape:api', endShapeId: 'shape:db' } },
]
const reading: InterpretationResult = {
  nodes: [
    { id: 'web', label: 'Web', kind: 'client', shapeIds: ['shape:web'] },
    { id: 'api', label: 'API', kind: 'service', shapeIds: ['shape:api'] },
    { id: 'db', label: 'Postgres', kind: 'database', tags: ['Postgres'], shapeIds: ['shape:db'] },
  ],
  edges: [
    { from: 'web', to: 'api', shapeIds: ['shape:a1'] },
    { from: 'api', to: 'db', shapeIds: ['shape:a2'] },
  ],
}

function seeded() {
  const core = new VibeprintCore(tmp())
  core.recordSubmission(shapes)
  core.applyInterpretation(reading, 'test')
  core.flush()
  return core
}

test('interpretation builds a graph bound to ink, with stable ids across submits', () => {
  const core = seeded()
  const ids = core.graph.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['n_web', 'n_api', 'n_postgres'])
  assert.deepEqual(core.graph.nodes[2].shapeIds, ['shape:db'])
  assert.equal(core.graph.edges.length, 2)

  // Status survives a redraw where the interpreter invents new temp ids.
  core.addMarks('codex', [{ type: 'status', target: 'API', status: 'done' }])
  core.recordSubmission([...shapes, box('shape:q', 600, 0)])
  core.applyInterpretation(
    {
      nodes: [
        { id: 'x1', label: 'Web', shapeIds: ['shape:web'] },
        { id: 'x2', label: 'API server', shapeIds: ['shape:api'] },
        { id: 'x3', label: 'Postgres', shapeIds: ['shape:db'] },
        { id: 'x4', label: 'Queue', kind: 'queue', shapeIds: ['shape:q'] },
      ],
      edges: [{ from: 'x2', to: 'x4' }],
    },
    'test',
  )
  const api = core.graph.nodes.find((n) => n.id === 'n_api')!
  assert.equal(api.label, 'API server')
  assert.equal(api.status, 'done')
  assert.ok(core.graph.nodes.find((n) => n.id === 'n_queue'))
  assert.deepEqual(core.graph.edges.map((e) => `${e.from}->${e.to}`), ['n_api->n_queue'])
})

test('proposals batch up, stay pending, and only change the graph when accepted', () => {
  const core = seeded()
  const { marks, batch } = core.addMarks('claude', [
    { type: 'add', target: 'n_api', label: 'Redis', kind: 'cache', connectFrom: ['API'] },
    { type: 'strike', target: 'Web' },
    { type: 'note', target: 'n_postgres', text: 'One DB per tenant?', question: true },
  ])
  assert.equal(marks.length, 3)
  assert.equal(batch?.summary, '1 add, 1 strike, 1 question')
  assert.ok(marks.every((m) => m.status === 'pending'))
  assert.equal(core.graph.nodes.length, 3)
  // Placement keeps the new box off the user's ink.
  const add = marks[0]
  assert.ok(add.data.offset && add.data.size)

  core.decideBatch(batch!.id, 'accept')
  const redis = core.graph.nodes.find((n) => n.label === 'Redis')!
  assert.equal(redis.origin, 'agent')
  assert.equal(redis.anchor?.nodeId, 'n_api')
  assert.ok(core.graph.edges.some((e) => e.from === 'n_api' && e.to === redis.id && e.origin === 'agent'))
  assert.equal(core.graph.nodes.find((n) => n.id === 'n_web')!.removed, true)
  // A struck node is gone from what agents build against.
  assert.ok(!core.architecture().nodes.some((n) => n.id === 'n_web'))
  assert.ok(core.architecture().removed.some((n) => n.id === 'n_web'))
  // One running chat line for the batch.
  const lines = core.chat.filter((c) => c.role === 'system' && c.author === 'you')
  assert.equal(lines.length, 1)
  assert.match(lines[0].text, /^Accepted 1 add, 1 strike, 1 question from claude$/)
})

test('rejecting leaves the graph alone; rewrite overrides the label but keeps the ink label', () => {
  const core = seeded()
  const r = core.addMarks('claude', [{ type: 'rewrite', target: 'n_api', label: 'API gateway' }])
  core.decideMark(r.marks[0].id, 'reject')
  assert.equal(core.graph.nodes.find((n) => n.id === 'n_api')!.override, undefined)
  const r2 = core.addMarks('claude', [{ type: 'rewrite', target: 'n_api', label: 'API gateway' }])
  core.decideMark(r2.marks[0].id, 'accept')
  const api = core.graph.nodes.find((n) => n.id === 'n_api')!
  assert.equal(api.label, 'API')
  assert.equal(api.override?.label, 'API gateway')
  assert.equal(core.architecture().nodes.find((n) => n.id === 'n_api')!.label, 'API gateway')
})

test('status marks are progress reports: auto-accepted, outside the batch cap', () => {
  const core = seeded()
  const { marks, progress, batch } = core.addMarks('codex', [{ type: 'status', target: 'Postgres', status: 'building', detail: 'migrations' }])
  assert.equal(batch, undefined)
  assert.equal(progress?.kind, 'progress')
  assert.equal(marks[0].status, 'accepted')
  assert.equal(core.graph.nodes.find((n) => n.id === 'n_postgres')!.status, 'building')
  assert.throws(() => core.addMarks('codex', [{ type: 'status', target: 'n_api', status: 'shipped' as never }]), VibeprintError)
})

test('quiet by default: batches cap at 6 marks and authors at 12 outstanding', () => {
  const core = seeded()
  const notes = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'note' as const, target: 'n_api', text: `note ${i}` }))
  assert.throws(() => core.addMarks('claude', notes(7)), /at most 6/)
  core.addMarks('claude', notes(6))
  core.addMarks('claude', notes(6))
  assert.throws(() => core.addMarks('claude', notes(1)), /waiting for review/)
  // Another agent is unaffected.
  assert.equal(core.addMarks('codex', notes(1)).marks.length, 1)
})

test('bad targets are explained, not silently dropped', () => {
  const core = seeded()
  assert.throws(() => core.addMarks('claude', [{ type: 'strike', target: 'billing' }]), /No node or edge matches "billing"/)
  assert.throws(() => core.addMarks('claude', [{ type: 'rewrite', target: 'n_api' }]), /corrected label/)
  // Nothing half-applied.
  assert.equal(core.marks.length, 0)
  // Edge refs by "A -> B" work.
  const { marks } = core.addMarks('claude', [{ type: 'strike', target: 'Web -> API' }])
  assert.equal(marks[0].target.kind, 'edge')
})

test('pending marks on ink the user erased are dropped on the next read', () => {
  const core = seeded()
  const { marks } = core.addMarks('claude', [{ type: 'note', target: 'n_web', text: 'Is this SSR?' }])
  core.recordSubmission(shapes.filter((s) => s.id !== 'shape:web'))
  core.applyInterpretation({ nodes: reading.nodes.slice(1), edges: reading.edges.slice(1) }, 'test')
  assert.equal(core.marks.find((m) => m.id === marks[0].id)!.status, 'rejected')
})

test('answers to questions resolve them', () => {
  const core = seeded()
  const { marks } = core.addMarks('claude', [{ type: 'note', target: 'n_postgres', text: 'Which region?', question: true }])
  assert.equal(core.openQuestions().length, 1)
  core.recordSubmission(shapes)
  core.applyInterpretation({ ...reading, answers: [{ markId: marks[0].id, answer: 'us-east-1' }] }, 'test')
  const m = core.marks.find((x) => x.id === marks[0].id)!
  assert.equal(m.status, 'accepted')
  assert.equal(m.data.answer, 'us-east-1')
  assert.equal(core.openQuestions().length, 0)
})

test('state round-trips through .vibeprint/ files', () => {
  const core = seeded()
  core.addMarks('claude', [{ type: 'add', target: 'n_api', label: 'Worker' }])
  core.flush()
  const files = fs.readdirSync(core.dir).sort()
  assert.deepEqual(files, ['.gitignore', 'chat.json', 'graph.json', 'marks.json', 'runtime', 'sketch.json'])
  const again = VibeprintCore.open(core.root)
  assert.deepEqual(again.graph, core.graph)
  assert.deepEqual(again.marks, core.marks)
  assert.equal(again.sketch?.seq, 1)
})

test('a merge-conflicted state file fails loudly instead of being overwritten', () => {
  const core = seeded()
  fs.writeFileSync(core.file('graph.json'), '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> other\n')
  assert.throws(() => VibeprintCore.open(core.root), /merge conflict markers/)
})

test('merge: user drawing a component the agent added takes it over', () => {
  const core = seeded()
  const { batch } = core.addMarks('claude', [{ type: 'add', target: 'n_api', label: 'Redis' }])
  core.decideBatch(batch!.id, 'accept')
  core.addMarks('codex', [{ type: 'status', target: 'Redis', status: 'done' }])
  const { graph } = mergeInterpretation(core.graph, { nodes: [...reading.nodes, { label: 'redis', shapeIds: ['shape:r'] }], edges: [] }, { ...core.sketch!, shapes: [...shapes, box('shape:r', 600, 0)] }, 'test')
  const redis = graph.nodes.filter((n) => n.label.toLowerCase() === 'redis')
  assert.equal(redis.length, 1)
  assert.equal(redis[0].origin, 'ink')
  assert.equal(redis[0].status, 'done')
})

test('summaries read like the spec', () => {
  assert.equal(summarizeMarks([{ type: 'add', data: {} }, { type: 'add', data: {} }, { type: 'add', data: {} }, { type: 'strike', data: {} }, { type: 'note', data: { question: true } }]), '3 adds, 1 strike, 1 question')
  assert.equal(emptyGraph().nodes.length, 0)
})
