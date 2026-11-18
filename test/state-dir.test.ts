// `vibeprint serve --state <dir> --embed-origin <origin>`: the canvas beside a repo it only
// reads (how Rudder runs it, so coding agents never see it), shown in another site's frame.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import type { SketchShape } from '../src/shared/types.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-state-'))
const root = path.join(tmp, 'repo')
const state = path.join(tmp, 'state')
fs.mkdirSync(root)
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
git('init', '-q')
git('config', 'user.email', 'test@example.com')
git('config', 'user.name', 'Test')
fs.writeFileSync(path.join(root, 'app.ts'), 'export {}\n')
git('add', 'app.ts')
git('commit', '-qm', 'init')

let d: Daemon
after(async () => {
  await d?.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const shapes: SketchShape[] = [
  { id: 'shape:a', type: 'geo', geo: 'rectangle', bounds: { x: 0, y: 0, w: 160, h: 90 }, text: 'api' },
  { id: 'shape:b', type: 'geo', geo: 'rectangle', bounds: { x: 300, y: 0, w: 160, h: 90 }, text: 'postgres' },
  { id: 'shape:c', type: 'arrow', bounds: { x: 160, y: 40, w: 140, h: 4 }, arrow: { start: { x: 160, y: 45 }, end: { x: 300, y: 45 }, startShapeId: 'shape:a', endShapeId: 'shape:b' } },
]

test('state lives outside the repo: nothing is written into it or committed', async () => {
  d = await startDaemon({ root, state, port: 0, host: '127.0.0.1', quiet: true, claude: { available: false, model: 'none' }, mapper: null, embedOrigins: ['https://rudder.example'] })
  const base = `http://127.0.0.1:${d.port}`
  const post = (p: string, body: unknown) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await post('/api/submit', { shapes })).status, 200)
  const until = Date.now() + 5000
  while (!(await (await fetch(base + '/api/architecture')).json() as any).nodes.length && Date.now() < until) await new Promise((r) => setTimeout(r, 50))
  const arch = (await (await fetch(base + '/api/architecture')).json()) as any
  const apiId = arch.nodes.find((n: any) => n.label === 'api').id
  const marks = (await (await post('/api/marks', { author: 'claude', marks: [{ type: 'add', target: apiId, label: 'Redis', kind: 'cache', connectFrom: [apiId] }] })).json()) as any
  const before = new Date().toISOString()
  await new Promise((r) => setTimeout(r, 5))
  assert.equal((await post(`/api/batches/${marks.batch.id}/decide`, { decision: 'accept' })).status, 200)
  await d.git.commitNow()
  d.core.flush()

  assert.equal(d.core.dir, state)
  assert.ok(fs.existsSync(path.join(state, 'graph.json')))
  assert.ok(fs.existsSync(path.join(state, 'runtime/daemon.json')))
  assert.equal(fs.existsSync(path.join(root, '.vibeprint')), false)
  assert.equal(git('status', '--porcelain'), '')
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')

  // The brief a user sends their coding agent as a message.
  const brief = (await (await fetch(base + '/api/brief')).json()) as { text: string; at: string; components: number }
  assert.equal(brief.components, 3)
  assert.match(brief.text, /- api \(.*planned\)/)
  assert.match(brief.text, /- api → postgres/)
  assert.match(brief.text, /Changes I accepted:\n- .*Redis/)
  const later = (await (await fetch(`${base}/api/brief?since=${encodeURIComponent(brief.at)}`)).json()) as { text: string }
  assert.doesNotMatch(later.text, /Changes I accepted/)
  const since = (await (await fetch(`${base}/api/brief?since=${encodeURIComponent(before)}`)).json()) as { text: string }
  assert.match(since.text, /Changes I accepted since my last message about it:\n- .*Redis/)
})

test('a framed canvas: named origins may embed it, and its token rides on each request', async () => {
  const base = `http://127.0.0.1:${d.port}`
  const page = await fetch(base + '/')
  assert.equal(page.headers.get('content-security-policy'), "frame-ancestors 'self' https://rudder.example")
  // Requests the relay forwards count as remote: the token is required, by header or ?t=.
  const remote = { 'x-forwarded-for': '203.0.113.9' }
  assert.equal((await fetch(base + '/api/state', { headers: remote })).status, 401)
  assert.equal((await fetch(base + '/api/state', { headers: { ...remote, 'x-vibeprint-token': d.token } })).status, 200)
  // A pasted image in a frame (no cookie) loads with ?t=, without the page sign-in redirect.
  fs.mkdirSync(path.join(state, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(state, 'assets', 'pic.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  const img = await fetch(`${base}/files/pic.png?t=${d.token}`, { headers: remote, redirect: 'manual' })
  assert.equal(img.status, 200)
  assert.equal((await fetch(`${base}/files/pic.png`, { headers: remote })).status, 401)
  await d.close()
  assert.equal(fs.existsSync(path.join(state, 'runtime/daemon.json')), false)
  d = undefined as unknown as Daemon
})
