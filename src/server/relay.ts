import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import WebSocket from 'ws'
import { TOKEN_HEADER } from '../shared/api.js'

// The tunnel to the hosted relay (relay/server.mjs, protocol described there). It keeps one
// WebSocket open to the relay and replays every request the relay carries against the local
// daemon, so an iPad on any network can reach this machine at https://<id>.<relay domain>/.
//
// Requests arrive from loopback, so every one is stamped with x-forwarded-for: the daemon then
// treats it as remote and requires the access token, exactly like a request from the LAN.

export const DEFAULT_RELAY = 'https://live.vibeprint.viraat.dev'
const PROTOCOL = 1

export interface RelayClient {
  /** Public base URL once the relay has accepted us (https://<id>.<domain>/), else null. */
  readonly url: string | null
  /** Host the relay serves us on, for matching incoming requests. */
  readonly host: string | null
  readonly connected: boolean
  /** Resolves with the URL on the first successful connect, or null after `timeoutMs`. */
  waitReady(timeoutMs: number): Promise<string | null>
  close(): void
}

interface Identity {
  relay: string
  id: string
  secret: string
}

type Frame = Record<string, any> & { t: string }

const newIdentity = (relay: string): Identity => ({
  relay,
  // 12 base36 characters: a DNS label, and hard to guess.
  id: Array.from(crypto.randomBytes(12), (b) => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join(''),
  secret: crypto.randomBytes(24).toString('base64url'),
})

function loadIdentity(file: string, relay: string): Identity {
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Identity
    if (saved.relay === relay && /^[a-z0-9]{8,32}$/.test(saved.id) && saved.secret?.length >= 16) return saved
  } catch {}
  return saveIdentity(file, newIdentity(relay))
}

function saveIdentity(file: string, ident: Identity): Identity {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(ident, null, 2), { mode: 0o600 })
  return ident
}

export function relayEnabled(value: string | boolean | undefined): string | null {
  if (value === false) return null
  const v = typeof value === 'string' ? value : process.env.VIBEPRINT_RELAY
  if (v === undefined || v === '' || v === 'on' || v === 'true' || v === '1') return DEFAULT_RELAY
  if (/^(off|false|0|no)$/i.test(v)) return null
  return v.replace(/\/+$/, '')
}

export function connectRelay(opts: { relay: string; port: number; identityFile: string; log?: (s: string) => void; onChange?: () => void }): RelayClient {
  const log = opts.log ?? (() => {})
  let ident = loadIdentity(opts.identityFile, opts.relay)
  let ws: WebSocket | null = null
  let url: string | null = null
  let closed = false
  let backoff = 1000
  let retry: NodeJS.Timeout | null = null
  const readyWaiters = new Set<(u: string | null) => void>()
  const requests = new Map<number, http.ClientRequest>()
  const sockets = new Map<number, WebSocket>()

  const send = (f: Frame) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(f))
  }

  /** Headers for a replayed request: always marked as forwarded, never hop-by-hop. */
  const localHeaders = (h: Record<string, string | string[]>) => {
    const out: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(h ?? {})) {
      if (!['connection', 'keep-alive', 'upgrade', 'transfer-encoding', 'te', 'trailer'].includes(k.toLowerCase())) out[k] = v
    }
    out['x-forwarded-for'] = (h?.['x-forwarded-for'] as string) || 'relay'
    return out
  }

  const dropAll = () => {
    for (const r of requests.values()) r.destroy()
    requests.clear()
    for (const s of sockets.values()) s.terminate()
    sockets.clear()
  }

  const onFrame = (f: Frame) => {
    switch (f.t) {
      case 'ready':
        url = String(f.url)
        backoff = 1000
        log(`relay: ${url}`)
        for (const w of readyWaiters) w(url)
        readyWaiters.clear()
        opts.onChange?.()
        return
      case 'taken':
        // Someone else holds this id (or the relay forgot us and another daemon got it first).
        ident = saveIdentity(opts.identityFile, newIdentity(opts.relay))
        backoff = 0
        return
      case 'req': {
        const req = http.request({ host: '127.0.0.1', port: opts.port, method: f.m, path: f.p, headers: localHeaders(f.h) }, (res) => {
          send({ t: 'res', r: f.r, s: res.statusCode ?? 502, h: res.headers })
          res.on('data', (chunk: Buffer) => send({ t: 'data', r: f.r, d: chunk.toString('base64') }))
          res.on('end', () => {
            requests.delete(f.r)
            send({ t: 'fin', r: f.r })
          })
          res.on('error', () => {
            requests.delete(f.r)
            send({ t: 'err', r: f.r, e: 'response interrupted' })
          })
        })
        req.on('error', (err) => {
          if (requests.delete(f.r)) send({ t: 'err', r: f.r, e: err.message })
        })
        requests.set(f.r, req)
        return
      }
      case 'body':
        requests.get(f.r)?.write(Buffer.from(f.d, 'base64'))
        return
      case 'end':
        requests.get(f.r)?.end()
        return
      case 'abort': {
        const req = requests.get(f.r)
        requests.delete(f.r)
        req?.destroy()
        return
      }
      case 'ws': {
        const h = localHeaders(f.h)
        const pick: Record<string, string> = {}
        for (const k of ['cookie', 'origin', 'user-agent', 'host', TOKEN_HEADER, 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host']) if (h[k]) pick[k] = String(h[k])
        const local = new WebSocket(`ws://127.0.0.1:${opts.port}${f.p}`, { headers: pick, perMessageDeflate: false })
        sockets.set(f.r, local)
        let opened = false
        local.on('open', () => {
          opened = true
          send({ t: 'wsok', r: f.r })
        })
        local.on('message', (data: Buffer, isBinary: boolean) => send({ t: 'wsm', r: f.r, d: isBinary ? Buffer.from(data).toString('base64') : data.toString(), b: isBinary }))
        local.on('unexpected-response', (_req, res) => {
          sockets.delete(f.r)
          send({ t: 'wsc', r: f.r, c: res.statusCode === 401 ? 4401 : 1011, x: `HTTP ${res.statusCode}` })
          local.terminate()
        })
        local.on('close', (code: number, reason: Buffer) => {
          if (sockets.delete(f.r)) send({ t: 'wsc', r: f.r, c: opened ? code : 1011, x: reason.toString() })
        })
        local.on('error', () => {})
        return
      }
      case 'wsm': {
        const local = sockets.get(f.r)
        if (local?.readyState === WebSocket.OPEN) local.send(f.b ? Buffer.from(f.d, 'base64') : f.d, { binary: !!f.b })
        return
      }
      case 'wsc': {
        const local = sockets.get(f.r)
        sockets.delete(f.r)
        if (local) local.readyState === WebSocket.OPEN ? local.close(1000) : local.terminate()
        return
      }
    }
  }

  const connect = () => {
    if (closed) return
    const target = `${opts.relay.replace(/^http/, 'ws')}/_relay/connect`
    const sock = new WebSocket(target, { perMessageDeflate: false, handshakeTimeout: 10_000 })
    ws = sock
    sock.on('open', () => sock.send(JSON.stringify({ t: 'hello', v: PROTOCOL, id: ident.id, secret: ident.secret })))
    sock.on('message', (raw: Buffer) => {
      try {
        onFrame(JSON.parse(raw.toString()))
      } catch (err) {
        log(`relay: bad frame (${(err as Error).message})`)
      }
    })
    sock.on('close', (code: number, reason: Buffer) => {
      if (ws !== sock) return
      ws = null
      const wasUp = url !== null
      url = null
      dropAll()
      if (wasUp) {
        log(`relay: disconnected (${code}${reason.length ? ` ${reason}` : ''}), reconnecting`)
        opts.onChange?.()
      }
      if (closed) return
      retry = setTimeout(connect, backoff)
      backoff = Math.min(Math.max(backoff * 2, 1000), 30_000)
    })
    sock.on('error', () => {})
  }
  connect()

  return {
    get url() {
      return url
    },
    get host() {
      return url ? new URL(url).host.toLowerCase() : null
    },
    get connected() {
      return url !== null
    },
    waitReady(timeoutMs) {
      if (url) return Promise.resolve(url)
      return new Promise((resolve) => {
        const done = (u: string | null) => {
          clearTimeout(timer)
          readyWaiters.delete(done)
          resolve(u)
        }
        const timer = setTimeout(() => done(null), timeoutMs)
        readyWaiters.add(done)
      })
    },
    close() {
      closed = true
      if (retry) clearTimeout(retry)
      dropAll()
      ws?.close(1000, 'vibeprint stopped')
      ws = null
      url = null
    },
  }
}
