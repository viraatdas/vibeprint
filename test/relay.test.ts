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

test('the page served through the relay gets the relay\'s tldraw license', async () => {
  const r = await viaRelay('GET', '/api/config', { headers: { cookie } })
  assert.equal(r.status, 200)
  assert.equal(JSON.parse(r.body.toString()).tldrawLicenseKey, 'relay-license')
  // Locally the daemon's own key (none here) still applies.
  const local = (await (await fetch(`http://127.0.0.1:${d.port}/api/config`)).json()) as { tldrawLicenseKey?: string }
  assert.equal(local.tldrawLicenseKey, undefined)
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

test('the canvas websocket connects through the relay, and only with the token', async () => {
  const open = (headers: Record<string, string>) =>
    new Promise<{ ok: boolean; status?: number; ws?: WebSocket }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${relayPort}/api/sync?sessionId=test`, { headers: { host, ...headers } })
      ws.on('open', () => resolve({ ok: true, ws }))
      ws.on('unexpected-response', (_q, res) => resolve({ ok: false, status: res.statusCode }))
      ws.on('error', () => {})
    })
  const denied = await open({})
  assert.deepEqual([denied.ok, denied.status], [false, 401])
  const allowed = await open({ cookie })
  assert.ok(allowed.ok)
  // A connect from a client too old for tldraw's sync server: the message has to reach the
  // server through the relay, and the server's close code has to make it back.
  const closed = new Promise<[number, string]>((resolve) => allowed.ws!.once('close', (c, r) => resolve([c, r.toString()])))
  allowed.ws!.send(JSON.stringify({ type: 'connect', connectRequestId: 'x', lastServerClock: 0, protocolVersion: 1, schema: { schemaVersion: 2, sequences: {} } }))
  assert.deepEqual(await closed, [4099, 'CLIENT_TOO_OLD'])
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
