import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { FILES, VIBEPRINT_DIR, VibeprintCore, VibeprintError } from '../core/core.js'
import { readDaemonInfo } from '../core/daemon-client.js'
import { DEFAULT_PORT, TOKEN_COOKIE, TOKEN_HEADER, type ActivityEvent, type ClientConfig, type DaemonInfo, type WaitResult } from '../shared/api.js'
import { describeMark } from '../shared/marks.js'
import type { InterpretationResult, MarkStatus, SketchShape } from '../shared/types.js'
import { CanvasRoom } from './canvas.js'
import { GitCheckpointer } from './git.js'
import { connectRelay, type RelayClient } from './relay.js'
import { interpretHeuristic } from '../interpret/heuristic.js'
import { chatWithClaude, claudeConfig, interpretWithClaude } from '../interpret/claude.js'

export const AGENT_COLOR = '#2e5bff'
export const INK_COLOR = '#1d1d1f'
const VERSION = '0.3.0'

export interface DaemonOptions {
  root: string
  port?: number
  host?: string
  commit?: boolean
  dev?: boolean
  /** Suppress the banner (tests). */
  quiet?: boolean
  /** Override the Claude client/config (tests). */
  claude?: { available: boolean; model: string }
  /** Hosted relay base URL (e.g. https://live.vibeprint.viraat.dev) so the iPad works on any network. Off when unset. */
  relay?: string | null
}

export interface Daemon {
  port: number
  token: string
  core: VibeprintCore
  canvas: CanvasRoom
  git: GitCheckpointer
  urls: string[]
  /** LAN links (with the access token) for an iPad on the same network. */
  lanUrls: string[]
  /** Tunnel to the hosted relay, when enabled. */
  relay: RelayClient | null
  close(): Promise<void>
}

function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    const pj = path.join(dir, 'package.json')
    if (fs.existsSync(pj)) {
      try {
        if (JSON.parse(fs.readFileSync(pj, 'utf8')).name === 'vibeprint') return dir
      } catch {}
    }
    dir = path.dirname(dir)
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address)
  }
  return out
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
}

function isLoopback(addr: string | undefined): boolean {
  return !!addr && (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1')
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

async function readBody(req: http.IncomingMessage, limit = 40 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new VibeprintError('Request body too large', 413)
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const buf = await readBody(req)
  if (!buf.length) return {} as T
  try {
    return JSON.parse(buf.toString('utf8')) as T
  } catch {
    throw new VibeprintError('Body must be JSON')
  }
}

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(data)
}

export async function startDaemon(opts: DaemonOptions): Promise<Daemon> {
  const root = path.resolve(opts.root)
  const log = (msg: string) => {
    if (!opts.quiet) process.stderr.write(`[vibeprint] ${msg}\n`)
  }

  const existing = readDaemonInfo(root)
  if (existing && existing.pid !== process.pid) {
    let alive = false
    try {
      process.kill(existing.pid, 0)
      alive = true
    } catch {}
    if (alive) {
      try {
        const r = await fetch(`http://127.0.0.1:${existing.port}/api/health`, { headers: { [TOKEN_HEADER]: existing.token }, signal: AbortSignal.timeout(800) })
        if (r.ok) throw new VibeprintError(`vibeprint is already running for this repo (pid ${existing.pid}) at ${existing.urls[0] ?? `http://localhost:${existing.port}`}`, 409)
      } catch (err) {
        if (err instanceof VibeprintError) throw err
      }
    }
  }

  const core = VibeprintCore.open(root, { autosave: true })
  core.ensureDir()
  const claude = opts.claude ?? claudeConfig()
  core.setInterpreter(claude.available ? { mode: 'claude-api', model: claude.model, active: false } : { mode: 'heuristic', active: false })

  // Keep the token across restarts (clean ones too) so the iPad, and its home-screen icon,
  // stay signed in. It lives in runtime/, which is gitignored.
  const tokenFile = core.file(FILES.token)
  let token = ''
  try {
    token = fs.readFileSync(tokenFile, 'utf8').trim()
  } catch {}
  if (!/^[\w-]{16,}$/.test(token)) {
    token = existing?.token ?? crypto.randomBytes(12).toString('base64url')
    fs.writeFileSync(tokenFile, token + '\n', { mode: 0o600 })
  }
  const canvas = new CanvasRoom(core, log)
  const gitCp = new GitCheckpointer(root, VIBEPRINT_DIR, {
    enabled: opts.commit !== false,
    log,
    beforeCommit: () => {
      core.flush()
      canvas.save()
    },
  })
  if (gitCp.enabled && !(await gitCp.isRepo())) {
    gitCp.enabled = false
    log('not a git repo: .vibeprint/ will be written but not committed')
  }
  core.on('checkpoint', (msg) => gitCp.schedule(msg))

  // ---- live state (SSE) --------------------------------------------------
  const streams = new Set<http.ServerResponse>()
  let broadcastTimer: NodeJS.Timeout | null = null
  const broadcast = () => {
    if (broadcastTimer) return
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null
      const data = `event: state\ndata: ${JSON.stringify(core.getState())}\n\n`
      for (const s of streams) s.write(data)
    }, 40)
  }
  core.on('change', broadcast)
  const heartbeat = setInterval(() => {
    for (const s of streams) s.write(': hb\n\n')
  }, 20_000)

  // ---- activity feed for agents waiting on the user ------------------------
  const bootId = crypto.randomBytes(3).toString('hex')
  let activitySeq = 0
  const activity: Array<{ seq: number; event: ActivityEvent; authors?: string[] }> = []
  const waiters = new Set<{ since: number; author?: string; done: (r: WaitResult) => void }>()
  const cursor = () => `${bootId}:${activitySeq}`
  const parseCursor = (c?: string | null): number | null => {
    if (!c) return null
    const [b, n] = c.split(':')
    return b === bootId ? Number(n) || 0 : 0
  }
  const eventsFor = (since: number, author?: string) =>
    activity.filter((a) => a.seq > since && (!author || !a.authors || a.authors.includes(author))).map((a) => a.event)
  const pushActivity = (event: ActivityEvent, authors?: string[]) => {
    activity.push({ seq: ++activitySeq, event, authors })
    if (activity.length > 500) activity.splice(0, activity.length - 500)
    for (const w of [...waiters]) {
      const evs = eventsFor(w.since, w.author)
      if (evs.length) {
        waiters.delete(w)
        w.done({ events: evs, cursor: cursor(), timedOut: false })
      }
    }
  }
  core.on('submit', (s) => pushActivity({ type: 'submit', at: s.createdAt, seq: s.seq, shapeCount: s.shapes.length, note: s.note }))
  core.on('chat', (m) => {
    if (m.role === 'user') pushActivity({ type: 'chat', at: m.createdAt, message: m })
  })
  core.on('decision', (ms) =>
    pushActivity(
      { type: 'decision', at: new Date().toISOString(), marks: ms.map((m) => ({ id: m.id, author: m.author, status: m.status as MarkStatus, describe: describeMark(m, core.graph) })) },
      [...new Set(ms.map((m) => m.author))],
    ),
  )

  // ---- interpretation --------------------------------------------------------
  let running: AbortController | null = null
  const interpret = async (seq: number) => {
    running?.abort()
    const ctrl = new AbortController()
    running = ctrl
    const sketch = core.sketch
    if (!sketch || sketch.seq !== seq) return
    const input = { sketch, image: core.readSketchImage() ?? undefined, previous: core.graph, openQuestions: core.openQuestions() }
    let result: InterpretationResult
    let by = 'vibeprint'
    if (claude.available) {
      core.setInterpreter({ active: true, startedAt: new Date().toISOString(), lastError: undefined })
      try {
        result = await interpretWithClaude(input, { model: claude.model, signal: ctrl.signal })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const msg = (err as Error).message ?? String(err)
        log(`interpretation failed, falling back to heuristic: ${msg}`)
        core.setInterpreter({ lastError: msg })
        result = interpretHeuristic(input)
        by = 'vibeprint'
      }
    } else {
      result = interpretHeuristic(input)
    }
    if (ctrl.signal.aborted || core.sketch?.seq !== seq) return
    running = null
    core.setInterpreter({ active: false })
    core.applyInterpretation(result, by)
  }

  // ---- chat assistant (only with an API key) --------------------------------
  const chatReply = async (text: string) => {
    if (!claude.available) return
    core.setInterpreter({ active: true })
    try {
      const reply = await chatWithClaude(
        { architecture: core.architecture(), history: core.chat.slice(-30), message: text, image: core.readSketchImage() ?? undefined },
        { model: claude.model },
      )
      if (reply.marks.length) {
        try {
          const { batch } = core.addMarks('vibeprint', reply.marks, { message: reply.text.split('\n')[0].slice(0, 140), finish: true })
          if (batch && reply.text.trim()) core.addChat('agent', 'vibeprint', reply.text)
        } catch (err) {
          core.addChat('agent', 'vibeprint', `${reply.text}\n\n(Couldn't place marks: ${(err as Error).message})`)
        }
      } else if (reply.text.trim()) {
        core.addChat('agent', 'vibeprint', reply.text)
      }
    } catch (err) {
      core.addChat('system', 'vibeprint', `Assistant error: ${(err as Error).message}`)
    } finally {
      core.setInterpreter({ active: false })
    }
  }

  // ---- static web app --------------------------------------------------------
  const webDir = path.join(packageRoot(), 'dist', 'web')
  const clientConfig: ClientConfig = {
    project: path.basename(root),
    agentColor: AGENT_COLOR,
    inkColor: INK_COLOR,
  }

  const serveStatic = (res: http.ServerResponse, pathname: string) => {
    if (!fs.existsSync(webDir)) {
      return send(res, 503, 'The web app is not built. Run `npm run build` in the vibeprint package (or use `npm run dev`).')
    }
    let file = path.normalize(path.join(webDir, decodeURIComponent(pathname)))
    if (file !== webDir && !file.startsWith(webDir + path.sep)) return send(res, 403, 'forbidden')
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(webDir, 'index.html')
    const ext = path.extname(file)
    const immutable = pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{6,}\./.test(pathname)
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    fs.createReadStream(file).pipe(res)
  }

  const assetsDir = core.file(FILES.assets)
  let relay: RelayClient | null = null

  // ---- auth -------------------------------------------------------------------
  // Same-machine callers (the laptop browser, MCP servers) skip the token, but
  // only when the Host is a local name and any Origin matches it. That keeps a
  // web page open in the laptop's browser from posting to localhost (CSRF) or
  // reaching it through a rebinding domain.
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]', os.hostname().toLowerCase(), ...lanAddresses()])
  const hostName = (h: string) => h.toLowerCase().replace(/:\d+$/, '')
  const trustedLocal = (req: http.IncomingMessage) => {
    if (!isLoopback(req.socket.remoteAddress) || req.headers['x-forwarded-for']) return false
    const host = req.headers.host ?? ''
    if (!localHosts.has(hostName(host))) return false
    const origin = req.headers.origin
    if (!origin) return true
    try {
      return new URL(origin).host.toLowerCase() === host.toLowerCase()
    } catch {
      return false
    }
  }
  const authorized = (req: http.IncomingMessage, url: URL) => {
    if (trustedLocal(req)) return true
    const presented = (req.headers[TOKEN_HEADER] as string | undefined) ?? parseCookies(req.headers.cookie)[TOKEN_COOKIE] ?? url.searchParams.get('t')
    if (!presented) return false
    const a = Buffer.from(presented)
    const b = Buffer.from(token)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  // ---- routes -----------------------------------------------------------------
  const handle = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://local')
    const p = url.pathname
    const method = req.method ?? 'GET'

    // Signing in: /?t=TOKEN sets a cookie and drops the token from the URL.
    const t = url.searchParams.get('t')
    if (t && method === 'GET' && !p.startsWith('/api/')) {
      if (t === token) {
        url.searchParams.delete('t')
        res.writeHead(302, {
          'set-cookie': `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`,
          location: url.pathname + (url.search ? url.search : ''),
        })
        return res.end()
      }
    }

    const isApi = p.startsWith('/api/') || p.startsWith('/files/')
    if (!isApi) return serveStatic(res, p)
    if (p === '/api/health') return send(res, 200, { ok: true, root, pid: process.pid, version: VERSION })
    if (!authorized(req, url)) return send(res, 401, { error: 'Open the link printed by `vibeprint serve` on this device (it carries an access token).' })

    // Canvas assets (images pasted onto the canvas).
    if (p.startsWith('/files/')) {
      const name = path.basename(decodeURIComponent(p.slice('/files/'.length)))
      if (!/^[\w.-]+$/.test(name)) return send(res, 400, { error: 'bad asset name' })
      const file = path.join(assetsDir, name)
      if (method === 'PUT' || method === 'POST') {
        const buf = await readBody(req, 25 * 1024 * 1024)
        core.writeFileAtomic(path.join(FILES.assets, name), buf)
        return send(res, 200, { src: `/files/${name}` })
      }
      if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' })
      res.writeHead(200, { 'content-type': MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' })
      return fs.createReadStream(file).pipe(res)
    }

    const route = `${method} ${p}`
    let m: RegExpMatchArray | null
    switch (route) {
      case 'GET /api/config':
        return send(res, 200, clientConfig)
      case 'GET /api/state':
        return send(res, 200, core.getState())
      case 'GET /api/events': {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' })
        res.write(`retry: 1500\nevent: state\ndata: ${JSON.stringify(core.getState())}\n\n`)
        streams.add(res)
        req.on('close', () => streams.delete(res))
        return
      }
      case 'GET /api/architecture':
        return send(res, 200, core.architecture())
      case 'GET /api/node':
        return send(res, 200, core.nodeDetail(url.searchParams.get('ref') ?? ''))
      case 'GET /api/sketch':
        return send(res, 200, { sketch: core.sketch, graph: core.graph })
      case 'GET /api/sketch.png': {
        const img = core.readSketchImage()
        if (!img) return send(res, 404, { error: 'no sketch image yet' })
        return send(res, 200, img, { 'content-type': 'image/png' })
      }
      case 'POST /api/submit': {
        const body = await readJson<{ shapes: SketchShape[]; image?: string; note?: string }>(req)
        const image = body.image ? Buffer.from(body.image.replace(/^data:image\/png;base64,/, ''), 'base64') : undefined
        canvas.save()
        const sketch = core.recordSubmission(body.shapes ?? [], image, body.note)
        gitCp.schedule(`vibeprint: submit sketch #${sketch.seq}`)
        void interpret(sketch.seq).catch((err) => {
          core.setInterpreter({ active: false, lastError: String(err?.message ?? err) })
          log(`interpretation crashed: ${err?.stack ?? err}`)
        })
        return send(res, 200, { seq: sketch.seq, interpreter: core.interpreter.mode })
      }
      case 'POST /api/interpretation': {
        const body = await readJson<{ author?: string; result: InterpretationResult }>(req)
        running?.abort()
        running = null
        core.setInterpreter({ active: false })
        const author = (body.author ?? 'agent').toLowerCase()
        core.touchAgent(author)
        const out = core.applyInterpretation(body.result, author)
        return send(res, 200, out)
      }
      case 'POST /api/marks': {
        const body = await readJson<{ author: string; marks: never[]; message?: string; finish?: boolean }>(req)
        return send(res, 200, core.addMarks(body.author, body.marks, { message: body.message, finish: body.finish }))
      }
      case 'GET /api/marks': {
        const status = url.searchParams.get('status')
        const author = url.searchParams.get('author')
        const marks = core.marks
          .filter((x) => (!status || x.status === status) && (!author || x.author === author))
          .map((x) => ({ ...x, describe: describeMark(x, core.graph) }))
        return send(res, 200, { marks, batches: core.batches.filter((b) => !author || b.author === author) })
      }
      case 'POST /api/batches/finish': {
        const body = await readJson<{ author: string; message?: string }>(req)
        return send(res, 200, { batch: core.finishOpenBatch((body.author ?? 'agent').toLowerCase(), body.message) })
      }
      case 'GET /api/chat': {
        const since = url.searchParams.get('since')
        return send(res, 200, { messages: since ? core.chat.filter((c) => c.createdAt > since) : core.chat.slice(-50) })
      }
      case 'POST /api/chat': {
        const body = await readJson<{ text: string; author?: string; role?: 'user' | 'agent' | 'system' }>(req)
        if (!body.text?.trim()) throw new VibeprintError('text is required')
        const role = body.role === 'agent' || body.role === 'system' ? body.role : 'user'
        const author = role === 'user' ? 'you' : (body.author ?? 'agent').toLowerCase()
        if (role !== 'user') core.touchAgent(author)
        const message = core.addChat(role, author, body.text)
        if (role === 'user') void chatReply(body.text)
        return send(res, 200, { message })
      }
      case 'GET /api/wait': {
        const timeout = Math.min(Math.max(Number(url.searchParams.get('timeout')) || 120_000, 1000), 600_000)
        const author = url.searchParams.get('author')?.toLowerCase() || undefined
        if (author) core.touchAgent(author)
        const since = parseCursor(url.searchParams.get('since')) ?? activitySeq
        const ready = eventsFor(since, author)
        if (ready.length) return send(res, 200, { events: ready, cursor: cursor(), timedOut: false } satisfies WaitResult)
        await new Promise<void>((resolve) => {
          const w = {
            since,
            author,
            done: (r: WaitResult) => {
              clearTimeout(timer)
              send(res, 200, r)
              resolve()
            },
          }
          const timer = setTimeout(() => {
            waiters.delete(w)
            send(res, 200, { events: [], cursor: cursor(), timedOut: true } satisfies WaitResult)
            resolve()
          }, timeout)
          req.on('close', () => {
            if (waiters.delete(w)) {
              clearTimeout(timer)
              resolve()
            }
          })
          waiters.add(w)
        })
        return
      }
    }
    if ((m = route.match(/^POST \/api\/marks\/([\w-]+)\/decide$/))) {
      const body = await readJson<{ decision: 'accept' | 'reject' }>(req)
      return send(res, 200, { mark: core.decideMark(m[1], body.decision) })
    }
    if ((m = route.match(/^POST \/api\/batches\/([\w-]+)\/decide$/))) {
      const body = await readJson<{ decision: 'accept' | 'reject' }>(req)
      return send(res, 200, { marks: core.decideBatch(m[1], body.decision) })
    }
    return send(res, 404, { error: `No route ${route}` })
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof VibeprintError ? err.status : 500
      if (status >= 500) log(`error: ${err?.stack ?? err}`)
      if (!res.headersSent) send(res, status, { error: err?.message ?? String(err) })
      else res.end()
    })
  })

  // ---- canvas sync over websockets -----------------------------------------------
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://local')
    if (url.pathname !== '/api/canvas') return socket.destroy()
    if (!authorized(req, url)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      return socket.destroy()
    }
    wss.handleUpgrade(req, socket, head, (ws) => canvas.connect(ws))
  })

  // ---- listen ---------------------------------------------------------------------
  const host = opts.host ?? '0.0.0.0'
  const wanted = opts.port ?? (Number(process.env.VIBEPRINT_PORT) || DEFAULT_PORT)
  const port = await new Promise<number>((resolve, reject) => {
    let tryPort = wanted
    const attempt = () => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && wanted !== 0 && tryPort < wanted + 20) {
          tryPort++
          attempt()
        } else reject(err)
      })
      server.listen(tryPort, host, () => resolve((server.address() as { port: number }).port))
    }
    attempt()
  })

  const lan = host === '0.0.0.0' || host === '::' ? lanAddresses() : host === '127.0.0.1' || host === 'localhost' ? [] : [host]
  const lanUrls = lan.map((a) => `http://${a}:${port}/?t=${token}`)
  const urls = [...lanUrls, `http://localhost:${port}/`]
  const info: DaemonInfo = { pid: process.pid, port, host, token, startedAt: new Date().toISOString(), root, urls }
  const writeInfo = () => {
    info.urls = [...(relay?.url ? [`${relay.url}?t=${token}`] : []), ...urls]
    core.writeFileAtomic(FILES.daemon, JSON.stringify(info, null, 2))
  }
  relay = opts.relay ? connectRelay({ relay: opts.relay, port, identityFile: core.file(FILES.relay), log, onChange: writeInfo }) : null
  writeInfo()

  const close = async () => {
    relay?.close()
    clearInterval(heartbeat)
    for (const w of waiters) w.done({ events: [], cursor: cursor(), timedOut: true })
    for (const s of streams) s.end()
    running?.abort()
    core.flush()
    canvas.close()
    await gitCp.commitNow().catch(() => null)
    wss.close()
    await new Promise<void>((r) => server.close(() => r()))
    server.closeAllConnections?.()
    const cur = readDaemonInfo(root)
    if (cur?.pid === process.pid) fs.rmSync(core.file(FILES.daemon), { force: true })
  }

  return { port, token, core, canvas, git: gitCp, urls, lanUrls, relay, close }
}

export async function runDaemon(opts: DaemonOptions): Promise<void> {
  const d = await startDaemon(opts)
  const claude = opts.claude ?? claudeConfig()
  const out = (s = '') => process.stdout.write(s + '\n')
  out()
  out(`  vibeprint · ${path.basename(d.core.root)}`)
  out()
  const lanUrl = d.lanUrls[0]
  const relayBase = d.relay ? await d.relay.waitReady(5000) : null
  const relayUrl = relayBase ? `${relayBase}?t=${d.token}` : null
  const ipadUrl = relayUrl ?? lanUrl
  if (opts.dev) out(`  dev UI      http://localhost:5173/   (vite, proxies to :${d.port})`)
  out(`  laptop      http://localhost:${d.port}/`)
  if (relayUrl) {
    out(`  iPad        ${relayUrl}   (any network)`)
    if (lanUrl) out(`  same Wi-Fi  ${lanUrl}`)
  } else {
    if (lanUrl) out(`  iPad        ${lanUrl}   (same network)`)
    if (d.relay) out(`  anywhere    relay unreachable (${opts.relay}); retrying in the background`)
  }
  out(`  interpret   ${claude.available ? `Claude API (${claude.model})` : 'heuristic + your coding agent (set ANTHROPIC_API_KEY for handwriting)'}`)
  out(`  state       ${path.join(VIBEPRINT_DIR)}/ ${d.git.enabled ? '(committed at checkpoints)' : '(not committed)'}`)
  out()
  if (ipadUrl) {
    try {
      const qr = (await import('qrcode-terminal')).default
      qr.generate(ipadUrl, { small: true }, (code: string) => out(code.split('\n').map((l) => '  ' + l).join('\n')))
      out('  scan with the iPad camera, then Share → Add to Home Screen for full-screen')
      out()
    } catch {}
  }
  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    out('\n  saving and stopping…')
    await d.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
