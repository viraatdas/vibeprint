// Vibeprint relay: lets an iPad on any network reach a `vibeprint` running anywhere (a laptop,
// a cloud VM) without being on the same Wi-Fi.
//
// A daemon opens one WebSocket to <scheme>://<domain>/_relay/connect and claims a session id
// with a secret. Browsers reach that session at <scheme>://<id>.<domain>/. Each HTTP request
// (streamed both ways, so server-sent events work) and each WebSocket is carried over the
// daemon's socket as JSON frames, with bodies in base64.
//
// Every session gets its own origin, so a page served by one session can't read another
// session's cookies or call its API. The relay stores nothing; the daemon still checks its
// access token on every request.
//
// Frames, relay -> daemon:
//   {t:'ready', url, license}            session claimed; license = tldraw key for this domain
//   {t:'taken'}                          id belongs to another secret; pick a new id
//   {t:'req', r, m, p, h} {t:'body', r, d} {t:'end', r} {t:'abort', r}
//   {t:'ws', r, p, h} {t:'wsm', r, d, b} {t:'wsc', r, c, x}
// Frames, daemon -> relay:
//   {t:'hello', v, id, secret}
//   {t:'res', r, s, h} {t:'data', r, d} {t:'fin', r} {t:'err', r, e}
//   {t:'wsok', r} {t:'wsm', r, d, b} {t:'wsc', r, c, x}
import http from 'node:http'
import crypto from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'

export const PROTOCOL = 1
const ID_RE = /^[a-z0-9]{8,32}$/
const MAX_BODY = 32 * 1024 * 1024
const MAX_SESSIONS = 2000
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-accept'])

const sha = (s) => crypto.createHash('sha256').update(s).digest()
const sameSecret = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b)
const safeCloseCode = (c) => (Number.isInteger(c) && ((c >= 1000 && c <= 1003) || (c >= 1007 && c <= 1014) || (c >= 3000 && c <= 4999)) ? c : 1011)

function offlinePage(id) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vibeprint</title>
<style>body{font:17px/1.5 -apple-system,system-ui,sans-serif;background:#f3f5f7;color:#1d1d1f;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}main{max-width:26em}h1{font-size:22px;margin:0 0 8px}code{font:15px ui-monospace,Menlo,monospace}</style>
<main><h1>This canvas is offline</h1><p>Start <code>vibeprint</code> in your repo on the computer that runs it, then reload this page. Session <code>${id}</code>.</p></main>`
}

export function createRelay({ domain, scheme = 'https', licenseKey = null, homeUrl = 'https://vibeprint.viraat.dev', log = () => {} } = {}) {
  if (!domain) throw new Error('createRelay: domain is required')
  domain = domain.toLowerCase()
  /** @type {Map<string, Session>} */
  const sessions = new Map()

  class Session {
    constructor(id, secretHash, ws) {
      this.id = id
      this.secretHash = secretHash
      this.ws = ws
      this.next = 1
      this.http = new Map() // r -> { res }
      this.sockets = new Map() // r -> { pending: {req, socket, head} | null, bws: WebSocket | null, queue: [] }
    }
    send(frame) {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame))
    }
    drop() {
      for (const { res } of this.http.values()) {
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' })
          res.end(offlinePage(this.id))
        } else res.destroy()
      }
      this.http.clear()
      for (const s of this.sockets.values()) {
        if (s.bws) s.bws.close(1012, 'vibeprint went offline')
        else if (s.pending) refuseUpgrade(s.pending.socket, 502)
      }
      this.sockets.clear()
    }
  }

  const forwardHeaders = (req, host) => {
    const h = {}
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && !k.startsWith('x-forwarded-') && !k.startsWith('fly-')) h[k] = v
    h.host = host
    h['x-forwarded-for'] = String(req.headers['fly-client-ip'] ?? req.socket.remoteAddress ?? 'unknown')
    h['x-forwarded-proto'] = scheme
    h['x-forwarded-host'] = host
    return h
  }

  const responseHeaders = (h) => {
    const out = {}
    for (const [k, v] of Object.entries(h ?? {})) if (!HOP.has(k.toLowerCase())) out[k] = v
    return out
  }

  function refuseUpgrade(socket, status) {
    try {
      socket.write(`HTTP/1.1 ${status} ${http.STATUS_CODES[status] ?? ''}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`)
    } catch {}
    socket.destroy()
  }

  /** Which session a Host header names: an id, null for a malformed one, or '' for the relay itself. */
  const route = (hostHeader) => {
    const host = String(hostHeader ?? '').toLowerCase()
    if (host.endsWith('.' + domain)) {
      const id = host.slice(0, -domain.length - 1)
      return ID_RE.test(id) ? id : null
    }
    return '' // the apex, the fly.dev name, or a bare IP
  }

  // ---- control sockets (daemons) ----------------------------------------------------
  const control = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 })
  control.on('connection', (ws) => {
    let session = null
    ws.isAlive = true
    ws.on('pong', () => (ws.isAlive = true))
    const hello = setTimeout(() => ws.close(4000, 'no hello'), 10_000)

    ws.on('message', (raw) => {
      let f
      try {
        f = JSON.parse(raw.toString())
      } catch {
        return ws.close(4000, 'bad frame')
      }
      if (!session) {
        clearTimeout(hello)
        if (f.t !== 'hello' || f.v !== PROTOCOL) return ws.close(4000, `expected hello v${PROTOCOL}`)
        if (typeof f.id !== 'string' || !ID_RE.test(f.id) || typeof f.secret !== 'string' || f.secret.length < 16) return ws.close(4000, 'bad hello')
        const secretHash = sha(f.secret)
        const prev = sessions.get(f.id)
        if (prev && !sameSecret(prev.secretHash, secretHash)) {
          ws.send(JSON.stringify({ t: 'taken' }))
          return ws.close(4009, 'id taken')
        }
        if (!prev && sessions.size >= MAX_SESSIONS) return ws.close(4029, 'relay full')
        if (prev) {
          prev.drop()
          prev.ws.terminate()
        }
        session = new Session(f.id, secretHash, ws)
        sessions.set(f.id, session)
        log(`session ${f.id} up (${sessions.size} live)`)
        return session.send({ t: 'ready', url: `${scheme}://${f.id}.${domain}/`, license: licenseKey })
      }
      onDaemonFrame(session, f)
    })

    ws.on('close', () => {
      clearTimeout(hello)
      if (session && sessions.get(session.id) === session) {
        sessions.delete(session.id)
        session.drop()
        log(`session ${session.id} down (${sessions.size} live)`)
      }
    })
    ws.on('error', () => {})
  })

  const pinger = setInterval(() => {
    for (const ws of control.clients) {
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, 20_000)

  function onDaemonFrame(s, f) {
    switch (f.t) {
      case 'res': {
        const p = s.http.get(f.r)
        if (p && !p.res.headersSent) {
          p.res.writeHead(f.s, responseHeaders(f.h))
          p.res.flushHeaders()
        }
        return
      }
      case 'data': {
        const p = s.http.get(f.r)
        if (p) p.res.write(Buffer.from(f.d, 'base64'))
        return
      }
      case 'fin': {
        const p = s.http.get(f.r)
        if (p) {
          s.http.delete(f.r)
          p.res.end()
        }
        return
      }
      case 'err': {
        const p = s.http.get(f.r)
        if (!p) return
        s.http.delete(f.r)
        if (!p.res.headersSent) {
          p.res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
          p.res.end(`vibeprint could not answer: ${f.e ?? 'error'}`)
        } else p.res.destroy()
        return
      }
      case 'wsok': {
        const sock = s.sockets.get(f.r)
        if (!sock?.pending) return
        const { req, socket, head } = sock.pending
        sock.pending = null
        browserWss.handleUpgrade(req, socket, head, (bws) => {
          sock.bws = bws
          for (const q of sock.queue) bws.send(q.b ? Buffer.from(q.d, 'base64') : q.d, { binary: !!q.b })
          sock.queue = []
          bws.on('message', (data, isBinary) => s.send({ t: 'wsm', r: f.r, d: isBinary ? Buffer.from(data).toString('base64') : data.toString(), b: isBinary }))
          bws.on('close', (code, reason) => {
            if (s.sockets.delete(f.r)) s.send({ t: 'wsc', r: f.r, c: code, x: reason.toString() })
          })
          bws.on('error', () => {})
        })
        return
      }
      case 'wsm': {
        const sock = s.sockets.get(f.r)
        if (!sock) return
        if (sock.bws) sock.bws.send(f.b ? Buffer.from(f.d, 'base64') : f.d, { binary: !!f.b })
        else sock.queue.push(f)
        return
      }
      case 'wsc': {
        const sock = s.sockets.get(f.r)
        if (!sock) return
        s.sockets.delete(f.r)
        if (sock.bws) sock.bws.close(safeCloseCode(f.c), String(f.x ?? '').slice(0, 120))
        else if (sock.pending) refuseUpgrade(sock.pending.socket, f.c === 4401 ? 401 : 502)
        return
      }
    }
  }

  // ---- browsers -------------------------------------------------------------------
  const browserWss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024, perMessageDeflate: false })

  const server = http.createServer((req, res) => {
    const id = route(req.headers.host)
    const url = new URL(req.url ?? '/', 'http://relay')
    if (id === '') {
      if (url.pathname === '/_relay/health') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        return res.end(JSON.stringify({ ok: true, v: PROTOCOL, sessions: sessions.size, licensed: !!licenseKey }))
      }
      res.writeHead(302, { location: homeUrl })
      return res.end()
    }
    if (id === null) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('Unknown host')
    }
    const s = sessions.get(id)
    if (!s) {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(offlinePage(id))
    }
    const r = s.next++
    s.http.set(r, { res })
    s.send({ t: 'req', r, m: req.method, p: req.url, h: forwardHeaders(req, String(req.headers.host).toLowerCase()) })
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        s.http.delete(r)
        s.send({ t: 'abort', r })
        res.writeHead(413).end()
        return req.destroy()
      }
      s.send({ t: 'body', r, d: chunk.toString('base64') })
    })
    req.on('end', () => s.http.has(r) && s.send({ t: 'end', r }))
    res.on('close', () => {
      if (s.http.delete(r)) s.send({ t: 'abort', r })
    })
  })

  server.on('upgrade', (req, socket, head) => {
    const id = route(req.headers.host)
    const url = new URL(req.url ?? '/', 'http://relay')
    if (id === '' && url.pathname === '/_relay/connect') {
      return control.handleUpgrade(req, socket, head, (ws) => control.emit('connection', ws, req))
    }
    const s = id ? sessions.get(id) : null
    if (!s) return refuseUpgrade(socket, id ? 502 : 404)
    const r = s.next++
    s.sockets.set(r, { pending: { req, socket, head }, bws: null, queue: [] })
    s.send({ t: 'ws', r, p: req.url, h: forwardHeaders(req, String(req.headers.host).toLowerCase()) })
    const giveUp = setTimeout(() => {
      const sock = s.sockets.get(r)
      if (sock?.pending) {
        s.sockets.delete(r)
        refuseUpgrade(socket, 504)
        s.send({ t: 'wsc', r, c: 1001, x: 'timeout' })
      }
    }, 15_000)
    socket.on('close', () => {
      clearTimeout(giveUp)
      const sock = s.sockets.get(r)
      if (sock?.pending) {
        s.sockets.delete(r)
        s.send({ t: 'wsc', r, c: 1001, x: 'browser left' })
      }
    })
  })

  return {
    server,
    sessions,
    listen: (port, host) => new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port))),
    close: async () => {
      clearInterval(pinger)
      for (const ws of control.clients) ws.terminate()
      for (const s of sessions.values()) s.drop()
      sessions.clear()
      await new Promise((r) => server.close(() => r()))
      server.closeAllConnections?.()
    },
  }
}

// Run directly: node relay/server.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const relay = createRelay({
    domain: process.env.RELAY_DOMAIN ?? 'live.vibeprint.viraat.dev',
    scheme: process.env.RELAY_SCHEME ?? 'https',
    licenseKey: process.env.TLDRAW_LICENSE_KEY || null,
    log: (s) => console.log(new Date().toISOString(), s),
  })
  const port = await relay.listen(Number(process.env.PORT ?? 8080), '::')
  console.log(`vibeprint relay on :${port} for *.${process.env.RELAY_DOMAIN ?? 'live.vibeprint.viraat.dev'}`)
  const stop = () => relay.close().then(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
