import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { detectMapper, mapWithModel, parseMapReply, type Mapper } from '../src/interpret/code-map.js'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import type { RepoMap } from '../src/shared/types.js'

const cleanup: string[] = []
after(() => {
  for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true })
})
const tmp = (name: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `vp-${name}-`))
  cleanup.push(d)
  return d
}

/** What the model "reads" from the code: better names and the real connections. */
const READ: RepoMap = {
  nodes: [
    { id: 'shop', label: 'Shop web app', kind: 'client', tags: ['React'], path: 'web/', description: 'Storefront' },
    { id: 'api', label: 'Orders API', kind: 'service', tags: ['Express'], path: 'server/', description: 'Orders and payments' },
    { id: 'mail', label: 'Email worker', kind: 'worker', tags: [], path: 'worker/', description: 'Sends receipts' },
    { id: 'pg', label: 'Postgres', kind: 'database', tags: [], path: '', description: 'Orders' },
  ],
  edges: [
    { from: 'shop', to: 'api', label: 'HTTP' },
    { from: 'api', to: 'pg', label: 'SQL' },
    { from: 'api', to: 'mail', label: 'jobs' },
  ],
}

function repo(): string {
  const root = tmp('repo')
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
  write('README.md', '# Shop\nA storefront with an orders API.')
  write('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '1', pg: '1', react: '1' } }))
  write('web/index.html', '<div></div>')
  write('web/src/main.tsx', "import React from 'react'\n")
  write('server/index.ts', "import express from 'express'\nimport { Pool } from 'pg'\n")
  write('worker/run.ts', "import '../server/index'\n")
  return root
}

/**
 * A stand-in for the `claude` CLI: checks it was asked for read-only tools and a schema,
 * optionally waits, then prints what `claude -p --output-format json` prints.
 */
function fakeClaude(opts: { delayMs?: number; fail?: boolean; expectedModel?: string; failAudit?: boolean } = {}): string {
  const dir = tmp('bin')
  const bin = path.join(dir, 'claude')
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const args = process.argv.slice(2)
const at = (f) => args[args.indexOf(f) + 1]
if (${JSON.stringify(opts.expectedModel)} && at('--model') !== ${JSON.stringify(opts.expectedModel)}) {console.error('wrong model');process.exit(2)}
if (at('--tools') !== 'Read,Grep,Glob' || !args.includes('--json-schema') || !at('-p').includes('automatic scan')) {
  console.error('unexpected args: ' + args.join(' ')); process.exit(2)
}
setTimeout(() => {
  if (${!!opts.failAudit} && at('-p').includes('SOURCE AUDIT:')) { console.error('Audit unavailable'); process.exit(1) }
  if (${!!opts.fail}) { console.error('Not logged in. Run claude login.'); process.exit(1) }
  console.log(JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: ${JSON.stringify(READ)} }))
}, ${opts.delayMs ?? 0})
`,
  )
  fs.chmodSync(bin, 0o755)
  return bin
}

function fakeCodex(): string {
  const dir = tmp('bin')
  const bin = path.join(dir, 'codex')
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const args = process.argv.slice(2)
const at = (f) => args[args.indexOf(f) + 1]
if (args[0] !== 'exec' || at('--sandbox') !== 'read-only' || !require('fs').existsSync(at('--output-schema'))) { console.error('bad args'); process.exit(2) }
require('fs').writeFileSync(at('-o'), '\`\`\`json\\n' + ${JSON.stringify(JSON.stringify(READ))} + '\\n\`\`\`')
`,
  )
  fs.chmodSync(bin, 0o755)
  return bin
}

describe('choosing what reads the code', () => {
  test('API key first, then Claude Code, then Codex; VIBEPRINT_MAPPER overrides; off turns it off', () => {
    const claudeDir = path.dirname(fakeClaude())
    const codexDir = path.dirname(fakeCodex())
    const PATH = [claudeDir, codexDir].join(path.delimiter)
    assert.equal(detectMapper({ PATH, ANTHROPIC_API_KEY: 'sk-x' })?.kind, 'api')
    assert.equal(detectMapper({ PATH })?.kind, 'claude-code')
    assert.equal(detectMapper({ PATH: codexDir })?.kind, 'codex')
    assert.equal(detectMapper({ PATH, VIBEPRINT_MAPPER: 'codex' })?.kind, 'codex')
    assert.equal(detectMapper({ PATH, VIBEPRINT_MAPPER: 'off' }), null)
    assert.equal(detectMapper({ PATH: '' }), null)
  })

  test('replies with fences or prose around the JSON still parse', () => {
    assert.deepEqual(parseMapReply('Here it is:\n```json\n' + JSON.stringify(READ) + '\n```'), READ)
    assert.throws(() => parseMapReply('I could not find any code.'), /no JSON/)
  })
})

describe('reading the code', () => {
  test('Claude Code runs read-only in the repo and its map comes back', async () => {
    const mapper: Mapper = { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude() }
    const { verification, ...map } = await mapWithModel(repo(), { nodes: [], edges: [] }, mapper)
    assert.deepEqual(map, READ)
    assert.equal(verification?.revision, 'unknown')
    assert.equal(verification?.dirty, false)
    assert.ok(Number.isFinite(Date.parse(verification!.at)))
  })

  test('explicit Claude model reaches both generation and source audit, with query traces', async () => {
    const mapper: Mapper = { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ expectedModel: 'claude-opus-5-5' }) }
    const queries: Array<{ prompt: string; what: string }> = []
    await mapWithModel(repo(), { nodes: [], edges: [] }, mapper, { model: 'claude-opus-5-5', trace: q => queries.push(q) })
    assert.equal(queries.length, 2)
    assert.equal(queries[0].what, 'map')
    assert.equal(queries[1].what, 'map source audit')
    assert.match(queries[1].prompt, /SOURCE AUDIT/)
    assert.match(queries[1].prompt, /Draft:/)
  })

  test('Codex runs in a read-only sandbox and its last message is the map', async () => {
    const mapper: Mapper = { kind: 'codex', label: 'Codex', author: 'codex', bin: fakeCodex() }
    const { verification, ...map } = await mapWithModel(repo(), { nodes: [], edges: [] }, mapper)
    assert.deepEqual(map, READ)
    assert.equal(verification?.revision, 'unknown')
    assert.equal(verification?.dirty, false)
    assert.ok(Number.isFinite(Date.parse(verification!.at)))
  })

  test('the Claude API gets the scan and a digest of the code', async () => {
    let prompt = ''
    const client = {
      beta: {
        messages: {
          create: async (body: any) => {
            prompt = body.messages[0].content[0].text
            return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(READ) }] } as any
          },
        },
      },
    }
    const map = await mapWithModel(repo(), { nodes: [{ id: 'web', label: 'Web' }], edges: [] }, { kind: 'api', label: 'Claude', author: 'claude' }, { client })
    const { verification, ...content } = map
    assert.deepEqual(content, READ)
    assert.equal(verification?.revision, 'unknown')
    assert.match(prompt, /"label":"Web"/, 'the quick scan is the starting point')
    assert.match(prompt, /A storefront with an orders API/, 'the README is in the digest')
    assert.match(prompt, /--- server\/index\.ts \(start\) ---/, 'entry points are in the digest')
    assert.match(prompt, /"dependencies": \[/, 'manifests are summarized')
  })
})

describe('Map this repo with a model on the machine', () => {
  const start = (root: string, mapper: Mapper) =>
    startDaemon({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: null, mapper })
  const api = (d: Daemon) => `http://127.0.0.1:${d.port}`
  const state = async (d: Daemon) => (await (await fetch(api(d) + '/api/state')).json()) as any
  const settled = async (d: Daemon) => {
    for (let i = 0; i < 200; i++) {
      const s = await state(d)
      if (!s.mapper.active) return s
      await new Promise((r) => setTimeout(r, 25))
    }
    throw new Error('the reading never finished')
  }
  const map = async (d: Daemon) => (await (await fetch(api(d) + '/api/map', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json()) as any

  test('draws the quick map at once, then redraws it in place from the reading', async () => {
    const d = await start(repo(), { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ delayMs: 150 }) })
    try {
      const res = await map(d)
      assert.equal(res.reading, 'Claude Code')
      assert.ok(res.nodes > 0, 'the quick map is drawn right away')
      const during = await state(d)
      assert.equal(during.mapper.active, true)
      assert.equal(during.mapper.mode, 'claude-code')
      const s = await settled(d)
      assert.equal(s.mapper.outcome, 'redrawn')
      assert.deepEqual(s.graph.nodes.map((n: any) => n.label).sort(), ['Email worker', 'Orders API', 'Postgres', 'Shop web app'])
      assert.ok(s.graph.nodes.every((n: any) => n.status === 'done' && n.fromCode))
      assert.equal(s.graph.interpretedBy, 'claude')
      assert.match(s.chat.at(-1).text, /Claude Code read the code and redrew the map: 4 components, 3 connections/)
      // The quick map's shapes are gone; only the redrawn map is on the canvas.
      const ids = new Set(d.canvas.list().map((x) => x.id))
      assert.ok(res.shapeIds.every((id: string) => !ids.has(id)))
      assert.equal(d.canvas.list().filter((x) => x.type === 'draw' && x.closed).length, 4)
    } finally {
      await d.close()
    }
  })

  test('an edit made while the code is being read is never overwritten', async () => {
    const d = await start(repo(), { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ delayMs: 400 }) })
    try {
      const res = await map(d)
      const ws = new WebSocket(`ws://127.0.0.1:${d.port}/api/canvas`)
      await new Promise((r) => ws.once('message', r))
      const box = d.canvas.list().find((x) => x.type === 'draw' && res.shapeIds.includes(x.id))!
      if (box.type !== 'draw') throw new Error('no box')
      ws.send(JSON.stringify({ t: 'ops', n: 1, put: [{ ...box, points: box.points.map(([x, y, p]) => [x + 40, y, p]) }] }))
      await new Promise((r) => ws.once('message', r))
      const s = await settled(d)
      assert.equal(s.mapper.outcome, 'kept')
      assert.ok(!s.graph.nodes.some((n: any) => n.label === 'Orders API'))
      assert.ok(res.shapeIds.every((id: string) => d.canvas.list().some((x) => x.id === id)), 'the quick map is still there')
      ws.close()
    } finally {
      await d.close()
    }
  })

  test('when the reading fails, the quick map stays and the user is told why', async () => {
    const d = await start(repo(), { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ fail: true }) })
    try {
      const res = await map(d)
      const s = await settled(d)
      assert.equal(s.mapper.outcome, 'failed')
      assert.match(s.mapper.lastError, /Not logged in/)
      assert.match(s.chat.at(-1).text, /Couldn't read the code with Claude Code/)
      assert.equal(s.graph.nodes.length, res.nodes)
    } finally {
      await d.close()
    }
  })
})

 test('a failed source audit retains the code-read draft with a visible warning', async () => {
  const root = repo()
  const map = await mapWithModel(root, { nodes: [], edges: [] }, { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ failAudit: true }) })
  assert.deepEqual(map.nodes, READ.nodes)
  assert.deepEqual(map.edges, READ.edges)
  assert.match(map.scope!, /Source audit incomplete/)
  assert.ok(map.verification?.at)
})
