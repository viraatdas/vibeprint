import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
// @ts-expect-error plain JS module, deployed on its own
import { createRelay } from '../relay/server.mjs'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { connectRelay } from '../src/server/relay.js'

// A relay and a daemon on loopback. Requests go to the relay with the session's Host header,
// exactly as an iPad's would through https://<id>.live.vibeprint.viraat.dev.
const DOMAIN = 'relay.test'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-relay-'))
let relay: { listen(port: number, host: string): Promise<number>; close(): Promise<void>; sessions: Map<string, unknown> }
let relayPort: number
let d: Daemon
let host: string

type Res = { status: number; headers: http.IncomingHttpHeaders; body: Buffer }
const viaRelay = (method: string, p: string, opts: { headers?: Record<string, string>; body?: Buffer | string; host?: string } = {}) =>
  new Promise<Res>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: relayPort, method, path: p, headers: { host: opts.host ?? host, ...opts.headers } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end(opts.body)
  })

let cookie = ''

before(async () => {
  relay = createRelay({ domain: DOMAIN, scheme: 'http', licenseKey: 'relay-license' })
  relayPort = await relay.listen(0, '127.0.0.1')
  d = await startDaemon({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: `http://127.0.0.1:${relayPort}` })
  const url = await d.relay!.waitReady(5000)
  assert.ok(url, 'daemon connected to the relay')
  host = new URL(url!).host
  assert.match(host, new RegExp(`^[a-z0-9]{12}\\.${DOMAIN.replace('.', '\\.')}$`))
})

after(async () => {
  await d?.close()
  await relay?.close()
})

test('relay traffic needs the access token, even though it reaches the daemon from loopback', async () => {
  const r = await viaRelay('GET', '/api/state')
  assert.equal(r.status, 401)
  const viaHeaderTrick = await viaRelay('GET', '/api/state', { headers: { 'x-forwarded-for': '' } })
  assert.equal(viaHeaderTrick.status, 401)
})

test('signing in through the relay sets a cookie for the session host', async () => {
  const r = await viaRelay('GET', `/?t=${d.token}`)
  assert.equal(r.status, 302)
  assert.equal(r.headers.location, '/')
  const set = String(r.headers['set-cookie'])
  assert.match(set, /Path=\//)
  cookie = set.split(';')[0]
  const state = await viaRelay('GET', '/api/state', { headers: { cookie } })
  assert.equal(state.status, 200)
  assert.ok(JSON.parse(state.body.toString()).graph)
})

test('the page config comes through the relay unchanged', async () => {
  const r = await viaRelay('GET', '/api/config', { headers: { cookie } })
  assert.equal(r.status, 200)
  const local = (await (await fetch(`http://127.0.0.1:${d.port}/api/config`)).json()) as Record<string, unknown>
  assert.deepEqual(JSON.parse(r.body.toString()), local)
})

test('binary bodies survive the trip both ways', async () => {
  const bytes = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 7) % 256))
  const put = await viaRelay('PUT', '/files/pic.png', { headers: { cookie, 'content-type': 'image/png' }, body: bytes })
  assert.equal(put.status, 200)
  const got = await viaRelay('GET', '/files/pic.png', { headers: { cookie } })
  assert.equal(got.status, 200)
  assert.ok(got.body.equals(bytes))
})

test('server-sent events stream through the relay', async () => {
  const first = await new Promise<string>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: relayPort, path: '/api/events', headers: { host, cookie } }, (res) => {
      assert.equal(res.statusCode, 200)
      res.on('data', (c: Buffer) => {
        const s = c.toString()
        if (s.includes('event: state')) {
          req.destroy()
          resolve(s)
        }
      })
    })
    req.on('error', (e) => (e.message.includes('aborted') || e.message.includes('socket hang up') ? null : reject(e)))
    req.end()
  })
  assert.match(first, /event: state\ndata: \{/)
  // A chat posted through the relay arrives on the stream's source of truth.
  const chat = await viaRelay('POST', '/api/chat', { headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hello from the iPad', role: 'agent', author: 'test' }) })
  assert.equal(chat.status, 200)
  assert.ok(d.core.getState().chat.some((m) => m.text === 'hello from the iPad'))
})

test('the canvas websocket syncs through the relay, and only with the token', async () => {
  const open = (headers: Record<string, string>) =>
    new Promise<{ ok: boolean; status?: number; ws?: WebSocket; first?: Promise<any> }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${relayPort}/api/canvas`, { headers: { host, ...headers } })
      const first = new Promise((r) => ws.once('message', (m) => r(JSON.parse(m.toString()))))
      ws.on('open', () => resolve({ ok: true, ws, first }))
      ws.on('unexpected-response', (_q, res) => resolve({ ok: false, status: res.statusCode }))
      ws.on('error', () => {})
    })
  const denied = await open({})
  assert.deepEqual([denied.ok, denied.status], [false, 401])
  const ipad = await open({ cookie })
  assert.ok(ipad.ok)
  assert.equal((await ipad.first).t, 'snapshot')
  // A laptop tab on the daemon directly sees the stroke the iPad sends through the relay.
  const laptop = new WebSocket(`ws://127.0.0.1:${d.port}/api/canvas`, { headers: { origin: `http://127.0.0.1:${d.port}` } })
  const seen = new Promise<any>((resolve) => laptop.on('message', (m) => { const msg = JSON.parse(m.toString()); if (msg.t === 'ops') resolve(msg) }))
  await new Promise((r) => laptop.once('message', r))
  const stroke = { id: 'shape:viarelay', z: 1, type: 'draw', points: [[0, 0, 0.5], [40, 10, 0.6]], pen: true }
  const ack = new Promise<any>((resolve) => ipad.ws!.on('message', (m) => { const msg = JSON.parse(m.toString()); if (msg.t === 'ack') resolve(msg) }))
  ipad.ws!.send(JSON.stringify({ t: 'ops', n: 7, put: [stroke] }))
  assert.deepEqual(await ack, { t: 'ack', n: 7 })
  assert.deepEqual((await seen).put, [stroke])
  ipad.ws!.close()
  laptop.close()
})

test('unknown and offline sessions get a clear page, not a hang', async () => {
  const r = await viaRelay('GET', '/', { host: `zzzzzzzzzzzz.${DOMAIN}` })
  assert.equal(r.status, 502)
  assert.match(r.body.toString(), /This canvas is offline/)
  const bad = await viaRelay('GET', '/', { host: `NOT_AN_ID.${DOMAIN}` })
  assert.equal(bad.status, 404)
})

test('a session id held by another secret is never shared: the newcomer picks a new id', async () => {
  const id = host.split('.')[0]
  const file = path.join(root, 'stolen.json')
  fs.writeFileSync(file, JSON.stringify({ relay: `http://127.0.0.1:${relayPort}`, id, secret: 'a-different-secret-entirely' }))
  const other = connectRelay({ relay: `http://127.0.0.1:${relayPort}`, port: d.port, identityFile: file })
  try {
    const url = await other.waitReady(5000)
    assert.ok(url)
    assert.notEqual(new URL(url!).host, host)
    assert.notEqual(JSON.parse(fs.readFileSync(file, 'utf8')).id, id)
    // The original session still answers.
    assert.equal((await viaRelay('GET', '/api/state', { headers: { cookie } })).status, 200)
  } finally {
    other.close()
  }
})

test('the daemon keeps its relay address across restarts', async () => {
  const before = host
  await d.close()
  d = await startDaemon({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: `http://127.0.0.1:${relayPort}` })
  const url = await d.relay!.waitReady(5000)
  assert.equal(new URL(url!).host, before)
  assert.equal((await viaRelay('GET', '/api/state', { headers: { cookie } })).status, 200, 'the same cookie still works')
})
