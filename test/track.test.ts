import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { mapCode } from '../src/core/map.js'
import { DIFF_PROMPT_BYTES, promptDiff, trackMarks, type TrackReply } from '../src/interpret/track.js'
import type { ArchitectureView } from '../src/shared/types.js'

const dirs: string[] = []
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-track-test-')); dirs.push(dir); return dir }
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

const DIFF = 'diff --git a/api/index.js b/api/index.js\n+app.get("/items", (req, res) => db.query("select * from items"))\n'

/** Claude Code that checks it was asked read-only, records the prompt, and answers by label. */
function fakeClaude(): { bin: string; prompts: string } {
  const dir = tmp()
  const bin = path.join(dir, 'claude')
  const prompts = path.join(dir, 'prompts.jsonl')
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs=require('fs'),args=process.argv.slice(2),at=f=>args[args.indexOf(f)+1];
const prompt=at('-p');
if(at('--tools')!=='Read,Grep,Glob'||!args.includes('--strict-mcp-config')||!JSON.parse(at('--json-schema')).properties.statuses){console.error('unexpected args');process.exit(2)}
fs.appendFileSync(${JSON.stringify(prompts)}, JSON.stringify(prompt)+'\\n');
const canvas=JSON.parse(prompt.split('component ids are what you reply with):\\n')[1].split('\\n')[0]);
const id=l=>canvas.nodes.find(n=>n.label===l).id;
console.log(JSON.stringify({structured_output:{
  summary:'API is built; the queue is not started.',
  statuses:[{node:id('API'),status:'done',detail:''},{node:id('Queue'),status:'planned',detail:''},{node:'n_ghost',status:'done',detail:''}],
  proposals:[{type:'add',target:'',label:'Items cache',kind:'cache',text:'',connectFrom:[id('API')],connectTo:[],reason:'api/cache.js adds an in-memory cache'}],
  message:'The API grew a cache that is not drawn.'
}}))`)
  fs.chmodSync(bin, 0o755)
  return { bin, prompts }
}

async function fixture(): Promise<{ d: Daemon; prompts: string; root: string }> {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'api'))
  fs.writeFileSync(path.join(root, 'api', 'index.js'), 'export const app = 1\n')
  const { bin, prompts } = fakeClaude()
  const d = await startDaemon({ root, state: path.join(tmp(), 'state'), port: 0, host: '127.0.0.1', quiet: true, claude: { available: false, model: 'test' }, mapper: { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin } })
  const plan = mapCode(d.core, [], { nodes: [{ id: 'api', label: 'API', kind: 'service' }, { id: 'queue', label: 'Queue', kind: 'queue' }], edges: [{ from: 'api', to: 'queue' }] }, 'vibeprint')
  d.canvas.apply(plan.put)
  d.canvas.save(); d.core.flush()
  return { d, prompts, root }
}
const post = async (d: Daemon, body: unknown) => {
  const r = await fetch(`http://127.0.0.1:${d.port}/api/track`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, body: await r.json() as any }
}
const settled = (d: Daemon) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { d.core.off('change', check); reject(new Error('tracking did not finish')) }, 10000)
  const check = () => { if (d.core.mapper.active || !d.core.mapper.finishedAt) return; clearTimeout(timer); d.core.off('change', check); resolve() }
  d.core.on('change', check)
  check()
})

test("an agent's turn sets build status and proposes what the drawing lacks", async () => {
  const { d, prompts, root } = await fixture()
  try {
    const res = await post(d, { author: 'Phone app agent', task: 'Add an items endpoint', diff: DIFF })
    assert.equal(res.status, 202)
    assert.deepEqual(res.body, { reading: 'Claude Code' })
    assert.equal(d.core.mapper.task, 'track')
    assert.equal(d.core.mapper.author, 'Phone app agent')
    await settled(d)
    assert.equal(d.core.mapper.outcome, 'tracked', d.core.mapper.lastError)

    const prompt = JSON.parse(fs.readFileSync(prompts, 'utf8').trim().split('\n')[0])
    assert.match(prompt, /Phone app agent just finished a turn on this task: "Add an items endpoint"/)
    assert.ok(prompt.includes(DIFF), 'the diff is the evidence')

    const arch = d.core.architecture()
    const byLabel = (l: string) => arch.nodes.find((n) => n.label === l)!
    // The map marked both done: API stays (no mark), Queue goes back to planned, and the
    // unknown id is dropped.
    assert.equal(byLabel('API').status, 'done')
    assert.equal(byLabel('Queue').status, 'planned')
    assert.deepEqual(d.core.marks.filter((m) => m.type === 'status').map((m) => m.target), [{ kind: 'node', id: byLabel('Queue').id }])
    assert.equal(arch.pending.length, 1, 'one batch to review')
    assert.equal(arch.pending[0].marks.length, 1)
    assert.match(arch.pending[0].marks[0].describe, /Items cache/)
    assert.match(d.core.chat.at(-1)!.text, /^Checked Phone app agent's changes against the canvas\. API is built; the queue is not started\. One change to review\.$/)
    // The repo is read, never written.
    assert.deepEqual(fs.readdirSync(root), ['api'])
  } finally {
    await d.close()
  }
})

test('Update from code reads the checkout; bad requests and busy readers are refused', async () => {
  const { d, prompts } = await fixture()
  try {
    assert.equal((await post(d, { author: 'x' })).status, 422, 'an author needs a diff')
    assert.equal((await post(d, { diff: DIFF })).status, 422, 'a diff needs an author')
    assert.equal((await post(d, {})).status, 202)
    assert.equal((await post(d, {})).status, 409, 'one reading at a time')
    await settled(d)
    const prompt = JSON.parse(fs.readFileSync(prompts, 'utf8').trim().split('\n')[0])
    assert.match(prompt, /The user asked to update the canvas from the code in this repository/)
    assert.match(prompt, /read files to check what exists/)
    assert.equal(d.core.mapper.author, undefined)
  } finally {
    await d.close()
  }
})

test('nothing to check against an empty canvas', async () => {
  const root = tmp()
  const d = await startDaemon({ root, state: path.join(tmp(), 'state'), port: 0, host: '127.0.0.1', quiet: true, claude: { available: false, model: 'test' }, mapper: { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude().bin } })
  try {
    const res = await post(d, {})
    assert.equal(res.status, 409)
    assert.match(res.body.error, /Nothing is on the canvas/)
  } finally {
    await d.close()
  }
})

test('a long diff is cut at a line, under the argument limit', () => {
  const line = 'é'.repeat(99) + '\n'
  const cut = promptDiff(line.repeat(1000))
  assert.ok(Buffer.byteLength(cut) < DIFF_PROMPT_BYTES + 200)
  assert.match(cut, /\n\.\.\. \(diff cut at 80 KB; read the files for the rest\)\n$/)
  assert.ok(cut.split('\n').slice(0, -2).every((l) => l === 'é'.repeat(99)))
  assert.equal(promptDiff(DIFF), DIFF)
})

test('replies become marks only for known, changed components', () => {
  const arch = {
    nodes: [
      { id: 'a', label: 'A', status: 'building', tags: [], origin: 'ink', connectsTo: [] },
      { id: 'b', label: 'B', status: 'done', tags: [], origin: 'ink', connectsTo: [] },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b' }],
  } as unknown as ArchitectureView
  const reply: TrackReply = {
    summary: '', message: '',
    statuses: [
      { node: 'a', status: 'blocked', detail: 'needs a key' },
      { node: 'a', status: 'done', detail: '' },
      { node: 'b', status: 'done', detail: '' },
      { node: 'zz', status: 'done', detail: '' },
    ],
    proposals: [
      { type: 'strike', target: 'e1', label: '', kind: '', text: '', connectFrom: [], connectTo: [], reason: 'the call was removed' },
      { type: 'rewrite', target: 'zz', label: 'Z', kind: '', text: '', connectFrom: [], connectTo: [], reason: '' },
      { type: 'note', target: 'b', label: '', kind: '', text: 'Is B still needed?', connectFrom: [], connectTo: [], reason: '' },
      { type: 'add', target: '', label: '', kind: '', text: '', connectFrom: [], connectTo: [], reason: '' },
    ],
  }
  assert.deepEqual(trackMarks(arch, reply), {
    statuses: [{ type: 'status', target: 'a', status: 'blocked', detail: 'needs a key' }],
    proposals: [
      { type: 'strike', target: 'e1', reason: 'the call was removed' },
      { type: 'note', text: 'Is B still needed?', question: true, target: 'b' },
    ],
  })
})
