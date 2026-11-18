import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { requireEveryField } from '../src/interpret/sketch-read.js'
import { INTERPRETATION_SCHEMA } from '../src/interpret/claude.js'
import type { SketchShape } from '../src/shared/types.js'

const dirs: string[] = []
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-sketch-read-')); dirs.push(dir); return dir }
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
// Two hand-drawn boxes and an arrow: no typed text, so only the picture says what they are.
const shapes: SketchShape[] = [
  { id: 'shape:a', type: 'draw', bounds: { x: 0, y: 0, w: 160, h: 90 }, points: [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 90 }, { x: 0, y: 90 }, { x: 0, y: 0 }] },
  { id: 'shape:b', type: 'draw', bounds: { x: 300, y: 0, w: 160, h: 90 }, points: [{ x: 300, y: 0 }, { x: 460, y: 0 }, { x: 460, y: 90 }, { x: 300, y: 90 }, { x: 300, y: 0 }] },
  { id: 'shape:c', type: 'arrow', bounds: { x: 160, y: 40, w: 140, h: 4 }, arrow: { start: { x: 160, y: 45 }, end: { x: 300, y: 45 }, startShapeId: 'shape:a', endShapeId: 'shape:b' } },
] as SketchShape[]

/** Claude Code that reads the PNG it is pointed at and "reads" the handwriting. */
function fakeClaude(fail = false): { bin: string; seen: string } {
  const dir = tmp()
  const bin = path.join(dir, 'claude')
  const seen = path.join(dir, 'seen.json')
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs=require('fs'),args=process.argv.slice(2),at=f=>args[args.indexOf(f)+1];
const prompt=at('-p'), schema=JSON.parse(at('--json-schema'));
const png=prompt.match(/The PNG of the canvas is at (.+?): read it first/)[1];
fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify({tools:at('--tools'), png:fs.readFileSync(png).subarray(1,4).toString(), interprets:prompt.startsWith('You interpret hand-drawn'), nodeRequired:schema.properties.nodes.items.required}));
if(${fail})process.exit(3);
console.log(JSON.stringify({structured_output:{
  nodes:[{id:'new_1',label:'Checkout',kind:'client',tags:[],shapeIds:['shape:a'],description:null},{id:'new_2',label:'Payments',kind:null,tags:[],shapeIds:['shape:b'],description:null}],
  edges:[{from:'new_1',to:'new_2',label:'charge',shapeIds:['shape:c']}],
  questions:[],answers:[],summary:'Checkout charges through Payments.'
}}))`)
  fs.chmodSync(bin, 0o755)
  return { bin, seen }
}

async function start(bin: string): Promise<Daemon> {
  return startDaemon({ root: tmp(), state: path.join(tmp(), 'state'), port: 0, host: '127.0.0.1', quiet: true, claude: { available: false, model: 'test' }, mapper: { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin } })
}
const submit = (d: Daemon) => fetch(`http://127.0.0.1:${d.port}/api/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shapes, image: PNG }) })
const read = (d: Daemon) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { d.core.off('change', check); reject(new Error('the sketch was not read')) }, 10000)
  const check = () => { if (d.core.interpreter.active || d.core.graph.sketchSeq < 1) return; clearTimeout(timer); d.core.off('change', check); resolve() }
  d.core.on('change', check)
  check()
})

test('without an API key, the agent on the machine reads the sketch, handwriting and all', async () => {
  const { bin, seen } = fakeClaude()
  const d = await start(bin)
  try {
    assert.equal(d.core.interpreter.mode, 'claude-code')
    const res = await submit(d)
    assert.deepEqual(await res.json(), { seq: 1, interpreter: 'claude-code' })
    await read(d)
    assert.deepEqual(JSON.parse(fs.readFileSync(seen, 'utf8')), {
      tools: 'Read,Grep,Glob', png: 'PNG', interprets: true,
      nodeRequired: ['id', 'label', 'kind', 'tags', 'shapeIds', 'description'],
    })
    const arch = d.core.architecture()
    assert.deepEqual(arch.nodes.map((n) => [n.label, n.kind ?? null]).sort(), [['Checkout', 'client'], ['Payments', null]])
    assert.deepEqual(arch.edges.map((e) => e.label), ['charge'])
    assert.equal(d.core.interpreter.lastError, undefined)
  } finally {
    await d.close()
  }
})

test('when that read fails, the heuristic draws the graph and the reason is kept', async () => {
  const d = await start(fakeClaude(true).bin)
  try {
    await submit(d)
    await read(d)
    assert.equal(d.core.architecture().nodes.length, 2)
    assert.match(d.core.interpreter.lastError ?? '', /Claude Code exited 3/)
  } finally {
    await d.close()
  }
})

test('every field is required for Codex; optional ones may be null', () => {
  const strict = requireEveryField(INTERPRETATION_SCHEMA) as any
  const edge = strict.properties.edges.items
  assert.deepEqual(edge.required, ['from', 'to', 'label', 'shapeIds'])
  assert.deepEqual(edge.properties.label, { type: ['string', 'null'] })
  assert.deepEqual(edge.properties.from, { type: 'string' })
  const q = strict.properties.questions.items.properties
  assert.equal(q.at.anyOf[1].type, 'null')
  assert.deepEqual(q.at.anyOf[0].required, ['x', 'y'])
  assert.ok(strict.properties.nodes.items.properties.kind.enum.includes(null))
  assert.deepEqual(strict.required, ['nodes', 'edges', 'questions', 'answers', 'summary'])
})
