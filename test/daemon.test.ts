import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { findDaemon } from '../src/core/daemon-client.js'
import type { SketchShape, VibeprintState } from '../src/shared/types.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-daemon-'))
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
git('init', '-q')
git('config', 'user.email', 'test@example.com')
git('config', 'user.name', 'Test')
fs.writeFileSync(path.join(root, 'app.ts'), 'export {}\n')
git('add', 'app.ts')
git('commit', '-qm', 'init')

let d: Daemon
const base = () => `http://127.0.0.1:${d.port}`
const get = async <T>(p: string): Promise<T> => (await fetch(base() + p)).json() as Promise<T>
const post = async (p: string, body: unknown) => {
  const r = await fetch(base() + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, body: (await r.json()) as any }
}
const until = async (fn: () => Promise<boolean>, ms = 5000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('timed out')
}

const shapes: SketchShape[] = [
  { id: 'shape:a', type: 'geo', geo: 'rectangle', bounds: { x: 0, y: 0, w: 160, h: 90 }, text: 'api' },
  { id: 'shape:b', type: 'geo', geo: 'rectangle', bounds: { x: 300, y: 0, w: 160, h: 90 }, text: 'postgres' },
  { id: 'shape:c', type: 'arrow', bounds: { x: 160, y: 40, w: 140, h: 4 }, arrow: { start: { x: 160, y: 45 }, end: { x: 300, y: 45 }, startShapeId: 'shape:a', endShapeId: 'shape:b' } },
]

after(async () => {
  await d?.close()
})

test('daemon starts, advertises itself, and serves state', async () => {
  d = await startDaemon({ root, port: 0, host: '0.0.0.0', quiet: true, claude: { available: false, model: 'none' } })
  const health = await get<{ ok: boolean; root: string }>('/api/health')
  assert.equal(health.ok, true)
  assert.equal(fs.realpathSync(health.root), fs.realpathSync(root))
  const client = await findDaemon(root)
  assert.ok(client, 'findDaemon locates the running daemon from .vibeprint/runtime/daemon.json')
  const state = await get<VibeprintState>('/api/state')
  assert.equal(state.graph.nodes.length, 0)
  assert.equal(state.interpreter.mode, 'heuristic')
  // runtime/ is ignored by git
  assert.match(fs.readFileSync(path.join(root, '.vibeprint/.gitignore'), 'utf8'), /runtime\//)
})

test('LAN requests need the token; the ?t= link signs a device in', async (t) => {
  const lan = Object.values(os.networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)
  if (!lan) return t.skip('no LAN interface')
  const url = `http://${lan.address}:${d.port}`
  assert.equal((await fetch(url + '/api/state')).status, 401)
  const signin = await fetch(`${url}/?t=${d.token}`, { redirect: 'manual' })
  assert.equal(signin.status, 302)
  const cookie = signin.headers.get('set-cookie')!.split(';')[0]
  assert.equal((await fetch(url + '/api/state', { headers: { cookie } })).status, 200)
  assert.equal((await fetch(url + '/api/state', { headers: { cookie: 'vp_token=wrong' } })).status, 401)
})

test('submit → interpretation → marks → decisions, with agents able to wait on the user', async () => {
  const image = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
  const sub = await post('/api/submit', { shapes, image })
  assert.equal(sub.status, 200)
  assert.equal(sub.body.seq, 1)
  await until(async () => (await get<VibeprintState>('/api/state')).graph.sketchSeq === 1)
  const arch = await get<any>('/api/architecture')
  assert.deepEqual(arch.nodes.map((n: any) => n.label).sort(), ['api', 'postgres'])
  assert.equal(arch.edges.length, 1)
  assert.ok(fs.existsSync(path.join(root, '.vibeprint/sketch.png')))

  // An agent waits; the user's chat message wakes it.
  const waiting = fetch(base() + '/api/wait?timeout=5000&author=claude').then((r) => r.json() as Promise<any>)
  await new Promise((r) => setTimeout(r, 100))
  await post('/api/chat', { text: 'add a cache in front of postgres' })
  const woke = await waiting
  assert.equal(woke.timedOut, false)
  assert.equal(woke.events[0].type, 'chat')
  assert.equal(woke.events[0].message.text, 'add a cache in front of postgres')

  const apiId = arch.nodes.find((n: any) => n.label === 'api').id
  const m = await post('/api/marks', { author: 'claude', marks: [{ type: 'add', target: apiId, label: 'Redis', kind: 'cache', connectFrom: [apiId] }, { type: 'note', target: 'postgres', text: 'Read replica?', question: true }] })
  assert.equal(m.status, 200)
  assert.equal(m.body.batch.summary, '1 add, 1 question')
  const bad = await post('/api/marks', { author: 'claude', marks: [{ type: 'strike', target: 'nope' }] })
  assert.equal(bad.status, 400)
  assert.match(bad.body.error, /No node or edge matches/)

  // The agent learns the outcome through the same wait.
  const waitDecision = fetch(`${base()}/api/wait?timeout=5000&author=claude&since=${woke.cursor}`).then((r) => r.json() as Promise<any>)
  await new Promise((r) => setTimeout(r, 100))
  const dec = await post(`/api/batches/${m.body.batch.id}/decide`, { decision: 'accept' })
  assert.equal(dec.status, 200)
  const decided = await waitDecision
  assert.equal(decided.events[0].type, 'decision')
  assert.equal(decided.events[0].marks.length, 2)
  const state = await get<VibeprintState>('/api/state')
  assert.ok(state.graph.nodes.some((n) => n.label === 'Redis' && n.origin === 'agent'))
})

test('checkpoints commit only .vibeprint/, leaving the user’s staged work alone', async () => {
  fs.writeFileSync(path.join(root, 'app.ts'), 'export const x = 1\n')
  git('add', 'app.ts')
  await d.git.commitNow()
  const log = git('log', '--format=%s', '-n', '3')
  assert.match(log.split('\n')[0], /^vibeprint: /)
  const files = git('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)
  assert.ok(files.length > 0 && files.every((f) => f.startsWith('.vibeprint/')), files.join(','))
  assert.ok(!files.some((f) => f.includes('runtime/')))
  assert.ok(files.includes('.vibeprint/graph.json') && files.includes('.vibeprint/marks.json'))
  // The user's staged change is still staged, not committed.
  assert.equal(git('diff', '--cached', '--name-only'), 'app.ts')
})

test('closing removes the runtime file so agents fall back to files', async () => {
  await d.close()
  assert.equal(fs.existsSync(path.join(root, '.vibeprint/runtime/daemon.json')), false)
  assert.equal(await findDaemon(root), null)
  // Restarting reloads the saved graph.
  d = await startDaemon({ root, port: 0, quiet: true, commit: false, claude: { available: false, model: 'none' } })
  const state = await get<VibeprintState>('/api/state')
  assert.ok(state.graph.nodes.some((n) => n.label === 'Redis'))
})

test('same-machine requests skip the token only when they are same-origin', async () => {
  const p = `http://127.0.0.1:${d.port}`
  // An MCP server / curl: no Origin, local Host.
  assert.equal((await fetch(p + '/api/state')).status, 200)
  // A page on another site posting to localhost (CSRF) is refused.
  const csrf = await fetch(p + '/api/chat', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, body: JSON.stringify({ text: 'hi' }) })
  assert.equal(csrf.status, 401)
  // A rebinding domain pointing at 127.0.0.1 is refused.
  const http = await import('node:http')
  const status = await new Promise<number>((resolve) => {
    http.get({ host: '127.0.0.1', port: d.port, path: '/api/state', headers: { host: `evil.example:${d.port}` } }, (r) => {
      r.resume()
      resolve(r.statusCode ?? 0)
    })
  })
  assert.equal(status, 401)
  // The canvas itself (same origin) is fine.
  const ok = await fetch(p + '/api/chat', { method: 'POST', headers: { origin: p, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'same origin' }) })
  assert.equal(ok.status, 200)
})
