import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { mapCode } from '../src/core/map.js'
import { canvasFingerprint, cleanupPlan } from '../src/core/cleanup.js'
import { VibeprintCore } from '../src/core/core.js'
import { cleanupWithModel, type CleanupReply } from '../src/interpret/cleanup.js'
import type { AnthropicLike } from '../src/interpret/claude.js'
import type { Shape } from '../src/shared/canvas.js'

const dirs: string[] = []
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-cleanup-test-')); dirs.push(dir); return dir }
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const question: Shape = { id: 'shape:question', z: 100, type: 'text', x: 900, y: 0, w: 250, h: 40, text: 'What is Scout?', author: 'user' }
const scribble: Shape = { id: 'shape:unclear', z: 101, type: 'draw', points: [[600, 500, .4], [700, 550, .6]], author: 'user' }

const reply = (id = 'scout'): CleanupReply => ({
  summary: 'Explained Scout and retained the question.',
  nodes: [{ id, label: 'Scout CLI', kind: 'client', tags: [], path: 'scout.ts', description: 'Local finder.', source: 'code', sourceShapeIds: [] }],
  edges: [], notes: [{ title: 'What is Scout?', text: 'Scout runs local finders and imports their results.', sourceShapeIds: ['shape:question'] }],
})

function fakeClaude(delay = 0): string {
  const bin = path.join(tmp(), 'claude')
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs=require('fs'),args=process.argv.slice(2),at=f=>args[args.indexOf(f)+1];
const prompt=at('-p');
const image=prompt.match(/canvas image at (.+?) with/)[1];
if(at('--tools')!=='Read,Grep,Glob'||!fs.existsSync(image)||!prompt.includes('recent chat'))process.exit(2);
const g=JSON.parse(fs.readFileSync('.vibeprint/graph.json','utf8'));
setTimeout(()=>console.log(JSON.stringify({structured_output:{
 summary:'Explained Scout from the code and reconciled the notes.',
 nodes:[...g.nodes.filter(n=>!n.removed).map(n=>({id:n.id,label:n.label,kind:n.kind||'module',tags:[],path:'scout.ts',description:'Local finder.',source:'code',sourceShapeIds:n.shapeIds})),{id:'proposal',label:'New screen',kind:'client',tags:[],path:'',description:'Requested, not built.',source:'proposal',sourceShapeIds:[]}],
 edges:g.edges.filter(e=>!e.removed).map(e=>({from:e.from,to:e.to,label:e.label||'',sourceShapeIds:e.shapeIds})),
 notes:[{title:'What is Scout?',text:'Scout runs local finders and imports their results.',sourceShapeIds:['shape:question']}]
}})),${delay});`)
  fs.chmodSync(bin, 0o755)
  return bin
}
async function fixture(delay = 0): Promise<Daemon> {
  const root = tmp()
  fs.writeFileSync(path.join(root, 'scout.ts'), 'export function scout() { return "local finders" }')
  const d = await startDaemon({ root, port: 0, host: '127.0.0.1', commit: false, quiet: true, claude: { available: false, model: 'test' }, mapper: { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude(delay) } })
  const plan = mapCode(d.core, [], { nodes: [{ id: 'scout', label: 'Scout CLI', kind: 'client' }], edges: [] }, 'vibeprint')
  d.canvas.apply([...plan.put, question, scribble])
  d.canvas.save(); d.core.flush()
  return d
}
const post = async (d: Daemon, route: string, body: unknown) => {
  const r = await fetch(`http://127.0.0.1:${d.port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, body: await r.json() as any }
}
const finished = (d: Daemon) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { d.core.off('change', check); reject(new Error('cleanup did not finish')) }, 10000)
  const check = () => { if (d.core.cleanup.active || !d.core.cleanup.finishedAt) return; clearTimeout(timer); d.core.off('change', check); resolve() }
  d.core.on('change', check)
})

test('AI cleanup gets the image, notes, chat and source evidence through the structured API', async () => {
  const root = tmp()
  fs.writeFileSync(path.join(root, 'README.md'), '# Scout\nLocal finder.')
  const core = new VibeprintCore(root)
  const client: AnthropicLike = { beta: { messages: { create: async (body: any) => {
    assert.equal(body.messages[0].content[0].type, 'image')
    assert.equal(body.messages[0].content[0].source.data, PNG.toString('base64'))
    const prompt = body.messages[0].content[1].text
    assert.ok(prompt.includes('What is Scout?') && prompt.includes('Include the screens') && prompt.includes('Local finder.'))
    assert.ok(prompt.includes('Pending agent suggestions are not approved'))
    return { content: [{ type: 'text', text: JSON.stringify(reply()) }] } as any
  } } } }
  const result = await cleanupWithModel(root, { shapes: [question], architecture: core.architecture(), chat: [{ id: 'c1', createdAt: new Date().toISOString(), role: 'user', author: 'user', text: 'Include the screens' }], image: PNG }, { kind: 'api', label: 'Claude', author: 'claude' }, { client })
  assert.equal(result.notes[0].title, 'What is Scout?')
})

test('cleanup refuses a model result that drops a component or references invented ink', async () => {
  const d = await fixture()
  try {
    assert.throws(() => cleanupPlan(d.core, d.canvas.list(), reply('wrong-id')), /omitted Scout/)
    const correct = reply(d.core.graph.nodes[0].id)
    correct.notes[0].sourceShapeIds = ['shape:invented']
    assert.throws(() => cleanupPlan(d.core, d.canvas.list(), correct), /unknown ink/)
  } finally { await d.close() }
})

test('the real cleanup endpoint reconciles notes, preserves unclear ink/status/pending marks, and undo survives restart', async () => {
  let d = await fixture(40)
  const root = d.core.root
  try {
    const node = d.core.graph.nodes[0]
    d.core.addMarks('claude', [{ type: 'note', target: node.id, text: 'Need a decision', question: true }], { finish: true })
    d.core.flush()
    const before = d.canvas.list(), beforeMarks = structuredClone(d.core.marks)
    const wait = finished(d)
    const res = await post(d, '/api/cleanup', { source: before, image: PNG.toString('base64') })
    assert.equal(res.status, 202)
    await wait
    assert.equal(d.core.cleanup.outcome, 'cleaned', d.core.cleanup.lastError)
    assert.ok(d.canvas.list().some(s => s.type === 'text' && s.text.includes('Scout runs local')))
    assert.ok(!d.canvas.list().some(s => s.id === question.id), 'the transcribed question is replaced')
    assert.ok(d.canvas.list().some(s => s.id === scribble.id && s.author === 'user'), 'unrecognized handwriting is kept')
    assert.equal(d.core.graph.nodes.find(n => n.id === node.id)?.status, 'done')
    assert.equal(d.core.graph.nodes.find(n => n.label === 'New screen')?.status, 'planned')
    assert.deepEqual(d.core.marks, beforeMarks)
    const undoId = d.core.cleanup.undoId!
    const after = canvasFingerprint(d.canvas.list())
    await d.close()
    d = await startDaemon({ root, port: 0, host: '127.0.0.1', commit: false, quiet: true, mapper: null, claude: { available: false, model: 'test' } })
    assert.equal(canvasFingerprint(d.canvas.list()), after)
    assert.equal(d.core.cleanup.undoId, undoId)
    const undo = await post(d, '/api/cleanup/undo', { id: undoId })
    assert.equal(undo.status, 200)
    assert.equal(canvasFingerprint(d.canvas.list()), canvasFingerprint(before))
    assert.deepEqual(d.core.marks, beforeMarks)
    assert.equal(d.core.graph.nodes.length, 1)
    assert.equal(d.core.graph.nodes[0].id, node.id)
  } finally { await d.close() }
})

test('an edit during cleanup wins, concurrent cleanup is refused, and failures leave the canvas intact', async () => {
  const d = await fixture(200)
  try {
    const before = d.canvas.list()
    const wait = finished(d)
    assert.equal((await post(d, '/api/cleanup', { source: before, image: PNG.toString('base64') })).status, 202)
    assert.equal((await post(d, '/api/cleanup', { source: before, image: PNG.toString('base64') })).status, 409)
    d.canvas.apply([{ ...question, text: 'Newer edit' }])
    await wait
    assert.equal(d.core.cleanup.outcome, 'kept')
    assert.equal(d.canvas.list().find(s => s.id === question.id)?.type, 'text')
    assert.ok(d.canvas.list().some(s => s.type === 'text' && s.text === 'Newer edit'))
    assert.equal((await post(d, '/api/cleanup', { source: before, image: PNG.toString('base64') })).status, 409)
  } finally { await d.close() }
})

test('undo never overwrites newer work, and missing AI gives an actionable error', async () => {
  const d = await fixture()
  try {
    const wait = finished(d)
    await post(d, '/api/cleanup', { source: d.canvas.list(), image: PNG.toString('base64') })
    await wait
    d.canvas.apply([{ ...question, text: 'Added after cleanup' }])
    assert.equal((await post(d, '/api/cleanup/undo', { id: d.core.cleanup.undoId })).status, 409)
    assert.ok(d.canvas.list().some(s => s.id === question.id))
  } finally { await d.close() }
  const noAI = await startDaemon({ root: tmp(), port: 0, host: '127.0.0.1', commit: false, quiet: true, mapper: null, claude: { available: false, model: 'test' } })
  try {
    const res = await post(noAI, '/api/cleanup', { source: [question], image: PNG.toString('base64') })
    assert.equal(res.status, 422)
    assert.match(res.body.error, /Install Claude Code or Codex/)
  } finally { await noAI.close() }
})

test('new submissions and chat during cleanup keep the original canvas', async () => {
  for (const change of ['submission', 'chat']) {
    const d = await fixture(120)
    try {
      const before = d.canvas.list(), wait = finished(d)
      assert.equal((await post(d, '/api/cleanup', { source: before, image: PNG.toString('base64') })).status, 202)
      if (change === 'submission') d.core.recordSubmission([], undefined, 'A newer question')
      else d.core.addChat('user', 'user', 'Keep this screen separate')
      await wait
      assert.equal(d.core.cleanup.outcome, 'kept')
      assert.equal(canvasFingerprint(d.canvas.list()), canvasFingerprint(before))
    } finally { await d.close() }
  }
})
