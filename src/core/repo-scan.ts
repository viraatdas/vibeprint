// A first-draft map of the code that is already in the repo, without any model: components
// come from the directory tree and package manifests, connections from imports between them,
// and databases and third-party services from the packages each component imports. A coding
// agent refines it afterwards (map_architecture or marks); this is the instant starting point.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { RepoMap, RepoMapEdge, RepoMapNode } from '../shared/types.js'

const CODE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|py|go|rs|rb|java|kt|swift|cs|php|exs?|vue|svelte|scala|dart)$/i
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor', '.next', '.nuxt', '.svelte-kit', '.vibeprint', '__pycache__',
  '.venv', 'venv', 'env', 'target', 'test', 'tests', '__tests__', 'spec', 'specs', 'fixtures', '__fixtures__', 'examples', 'example',
  'docs', 'doc', 'scripts', '.github', 'e2e', 'bench', 'benchmarks', 'migrations', 'public', 'static', 'assets', 'fonts', 'mocks', '__mocks__',
  'stories', '.storybook', 'tmp', 'temp',
])
/** Plumbing that every component imports; drawn, it only adds noise. */
const PLUMBING = new Set(['shared', 'common', 'utils', 'util', 'helpers', 'types', 'typings', 'constants', 'config', 'configs', 'interfaces', 'models'])
/** Directories that only group the real components. */
const WRAPPERS = new Set(['src', 'lib', 'packages', 'apps', 'services', 'internal', 'pkg', 'cmd', 'modules', 'source', 'crates', 'libs', 'projects'])
const MANIFESTS = ['package.json', 'pyproject.toml', 'setup.py', 'go.mod', 'Cargo.toml', 'Gemfile', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json', 'mix.exs']
const APP_MARKERS = /^(vite|next|nuxt|svelte|astro|remix|webpack)\.config\.\w+$|^(index\.html|angular\.json|Dockerfile|fly\.toml|wrangler\.toml|serverless\.ya?ml|app\.yaml|Procfile)$/
const TARGET = 8
const MAX_NODES = 14
const MAX_FILES = 40_000
const MAX_READ = 4_000

/** Packages that mean the code talks to a database, a queue, storage or another company's API. */
const SYSTEMS: Array<{ test: RegExp; label: string; kind: string }> = [
  { test: /^(pg|postgres|pg-promise|@neondatabase\/serverless|@vercel\/postgres|psycopg2?|asyncpg|github\.com\/(lib\/pq|jackc\/pgx))$/, label: 'Postgres', kind: 'database' },
  { test: /^(mysql2?|pymysql|mysqlclient|github\.com\/go-sql-driver\/mysql)$/, label: 'MySQL', kind: 'database' },
  { test: /^(mongodb|mongoose|pymongo|motor)$/, label: 'MongoDB', kind: 'database' },
  { test: /^(sqlite3?|better-sqlite3|bun:sqlite|node:sqlite|@libsql\/client)$/, label: 'SQLite', kind: 'database' },
  { test: /^(@prisma\/client)$/, label: 'Database', kind: 'database' },
  { test: /^(redis|ioredis|@upstash\/redis|github\.com\/redis\/go-redis.*)$/, label: 'Redis', kind: 'cache' },
  { test: /^(bullmq|bull|bee-queue)$/, label: 'Job queue', kind: 'queue' },
  { test: /^(kafkajs|confluent_kafka|kafka|@confluentinc\/.*)$/, label: 'Kafka', kind: 'queue' },
  { test: /^(amqplib|pika)$/, label: 'RabbitMQ', kind: 'queue' },
  { test: /^(@aws-sdk\/client-sqs)$/, label: 'SQS', kind: 'queue' },
  { test: /^(@aws-sdk\/client-s3|boto3)$/, label: 'S3', kind: 'storage' },
  { test: /^(@google-cloud\/storage)$/, label: 'Cloud Storage', kind: 'storage' },
  { test: /^(@vercel\/blob)$/, label: 'Blob storage', kind: 'storage' },
  { test: /^(@elastic\/elasticsearch|elasticsearch)$/, label: 'Elasticsearch', kind: 'search' },
  { test: /^(algoliasearch)$/, label: 'Algolia', kind: 'search' },
  { test: /^(@pinecone-database\/pinecone|pinecone)$/, label: 'Pinecone', kind: 'database' },
  { test: /^(@supabase\/supabase-js|supabase)$/, label: 'Supabase', kind: 'external' },
  { test: /^(firebase|firebase-admin|firebase_admin)$/, label: 'Firebase', kind: 'external' },
  { test: /^(stripe)$/, label: 'Stripe', kind: 'external' },
  { test: /^(@anthropic-ai\/sdk|anthropic)$/, label: 'Claude API', kind: 'external' },
  { test: /^(openai)$/, label: 'OpenAI API', kind: 'external' },
  { test: /^(@google\/genai|@google\/generative-ai|google\.generativeai)$/, label: 'Gemini API', kind: 'external' },
  { test: /^(twilio)$/, label: 'Twilio', kind: 'external' },
  { test: /^(resend|@sendgrid\/mail|nodemailer|postmark|sendgrid)$/, label: 'Email', kind: 'external' },
  { test: /^(@clerk\/.*)$/, label: 'Clerk', kind: 'external' },
  { test: /^(@auth0\/.*|auth0)$/, label: 'Auth0', kind: 'external' },
]
const FRONTEND = /^(react|react-dom|vue|svelte|solid-js|preact|@angular\/core|next|nuxt|@remix-run\/react|astro)(\/|$)/
const HTTP_SERVER = /^(node:http|http|node:https|https|express|fastify|koa|hono|@hono\/.*|@nestjs\/core|restify|flask|fastapi|django|aiohttp|starlette|net\/http|github\.com\/gin-gonic\/gin|github\.com\/labstack\/echo.*|actix-web|axum)$/
const CLI = /^(commander|yargs|cac|meow|citty|clipanion|oclif|@oclif\/core|click|typer|argparse|github\.com\/spf13\/cobra)$/
const FRAMEWORK_TAGS: Array<[RegExp, string]> = [
  [/^next(\/|$)/, 'Next.js'], [/^react(-dom)?(\/|$)/, 'React'], [/^vue(\/|$)/, 'Vue'], [/^svelte(\/|$)/, 'Svelte'], [/^@angular\/core$/, 'Angular'],
  [/^express$/, 'Express'], [/^fastify$/, 'Fastify'], [/^hono$/, 'Hono'], [/^@nestjs\/core$/, 'NestJS'], [/^koa$/, 'Koa'],
  [/^flask$/, 'Flask'], [/^fastapi$/, 'FastAPI'], [/^django$/, 'Django'], [/^github\.com\/gin-gonic\/gin$/, 'Gin'],
  [/^@modelcontextprotocol\/sdk(\/|$)/, 'MCP'], [/^(ws|socket\.io)$/, 'WebSocket'],
]

interface Dir {
  path: string // '' is the repo root
  name: string
  children: Map<string, Dir>
  files: string[] // direct files (all, not just code)
  code: number // code files in the subtree
}

function listFiles(root: string): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    return out.split('\0').filter(Boolean).slice(0, MAX_FILES)
  } catch {
    const files: string[] = []
    const walk = (rel: string) => {
      if (files.length >= MAX_FILES) return
      for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (e.name.startsWith('.') && e.name !== '.') continue
        const p = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(p)
        } else files.push(p)
      }
    }
    walk('')
    return files
  }
}

function buildTree(files: string[]): Dir {
  const root: Dir = { path: '', name: '', children: new Map(), files: [], code: 0 }
  for (const f of files) {
    const parts = f.split('/')
    if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p.toLowerCase()) || p.startsWith('.'))) continue
    const isCode = CODE.test(f) && !/\.(test|spec|stories|d)\.\w+$/.test(f) && !/(^|\/)[\w.-]+\.config\.\w+$/.test(f)
    let d = root
    if (isCode) d.code++
    for (const part of parts.slice(0, -1)) {
      let next = d.children.get(part)
      if (!next) {
        next = { path: d.path ? `${d.path}/${part}` : part, name: part, children: new Map(), files: [], code: 0 }
        d.children.set(part, next)
      }
      d = next
      if (isCode) d.code++
    }
    d.files.push(parts[parts.length - 1])
  }
  return root
}

const directCode = (d: Dir) => d.files.filter((f) => CODE.test(f) && !/\.(test|spec|stories|d)\.\w+$/.test(f) && !/\.config\.\w+$/.test(f))
const isAtomic = (d: Dir) => d.path !== '' && d.files.some((f) => MANIFESTS.includes(f) || APP_MARKERS.test(f))
const codeChildren = (d: Dir) => [...d.children.values()].filter((c) => c.code > 0 && !PLUMBING.has(c.name.toLowerCase()))

/** A unit of the map: a directory subtree, or only the files directly in a directory. */
interface Unit {
  id: string
  dir: Dir
  /** Only the dir's own files, not its subdirectories (they became units of their own). */
  shallow: boolean
  label: string
  /** Files that belong here though they sit outside the dir (src/cli.ts beside src/cli/). */
  extra: string[]
  /** The unit is exactly `extra`: one file of a small flat package. */
  only?: boolean
}

const SPECIAL: Record<string, string> = { ios: 'iOS', macos: 'macOS', ipados: 'iPadOS', github: 'GitHub', graphql: 'GraphQL', oauth: 'OAuth' }
const ACRONYMS = new Set(['api', 'mcp', 'cli', 'ui', 'db', 'sdk', 'http', 'grpc', 'llm', 'ai', 'ml', 'ws', 'cdn', 'sql', 'auth'])
/** "auth-service" → "Auth service", "mcp" → "MCP", "web" → "Web". */
function prettyLabel(name: string): string {
  const words = name.replace(/\.\w+$/, '').split(/[-_\s.]+/).filter(Boolean)
  if (!words.length) return 'App'
  return words
    .map((w, i) => {
      const l = w.toLowerCase()
      if (SPECIAL[l]) return SPECIAL[l]
      if (ACRONYMS.has(l)) return l === 'auth' ? (i ? 'auth' : 'Auth') : w.toUpperCase()
      return i ? l : l[0].toUpperCase() + l.slice(1)
    })
    .join(' ')
}

const ROOT_APP = /^(vite|next|nuxt|svelte|astro|remix)\.config\.\w+$|^index\.html$/
/** Small modules every file imports; as boxes they only add noise. */
const PLUMBING_FILE = /^(types?|errors?|paths?|config|constants?|utils?|helpers?|index|main|logger|log|env)$/

function chooseUnits(root: Dir, repoName: string): Unit[] {
  type F = { dir: Dir; shallow: boolean; fixed: boolean }
  let frontier: F[] = [{ dir: root, shallow: false, fixed: false }]
  // An app at the root (Next.js, Vite...) is one component, whatever folders it is split into;
  // only folders that ship on their own (their own manifest) are separate.
  const rootApp = root.files.some((f) => ROOT_APP.test(f))
  if (rootApp) {
    frontier = [
      { dir: root, shallow: false, fixed: true },
      ...[...root.children.values()].filter((c) => c.code > 0 && isAtomic(c)).map((dir) => ({ dir, shallow: false, fixed: false })),
    ]
  }
  const expandable = (f: F) => !f.shallow && !f.fixed && (!isAtomic(f.dir) || frontier.length === 1) && codeChildren(f.dir).length > 0
  for (let guard = 0; guard < 50; guard++) {
    const options = frontier.filter(expandable)
    if (!options.length) break
    const wrapper = options.find((f) => f.dir.path === '' || WRAPPERS.has(f.dir.name.toLowerCase()) || frontier.length === 1)
    if (!wrapper && frontier.length >= TARGET) break
    const pick = wrapper ?? options.sort((a, b) => b.dir.code - a.dir.code)[0]
    const kids: F[] = codeChildren(pick.dir).map((dir) => ({ dir, shallow: false, fixed: false }))
    if (directCode(pick.dir).length && pick.dir.path !== '') kids.push({ dir: pick.dir, shallow: true, fixed: true })
    const next = frontier.flatMap((f) => (f === pick ? kids : [f]))
    if (!wrapper && next.length > MAX_NODES) {
      pick.fixed = true
      continue
    }
    frontier = next
  }
  const units = frontier
    .filter((f) => (f.shallow ? directCode(f.dir).length : f.dir.code) > 0)
    .sort((a, b) => b.dir.code - a.dir.code)
    .slice(0, MAX_NODES)
  const out: Unit[] = units.map((f) => {
    const own = directCode(f.dir)
    const name = f.shallow && own.length === 1 ? own[0] : f.dir.path === '' ? (rootApp ? 'web app' : repoName) : WRAPPERS.has(f.dir.name.toLowerCase()) ? repoName : f.dir.name
    return { id: (f.shallow ? `${f.dir.path}/*` : f.dir.path) || '.', dir: f.dir, shallow: f.shallow, label: prettyLabel(name), extra: [] }
  })
  // A small flat package (one folder of files) is better drawn file by file than as one box.
  if (out.length < 3) {
    const flat = out.filter((u) => !u.only && codeChildren(u.dir).length === 0).sort((a, b) => directCode(b.dir).length - directCode(a.dir).length)[0]
    const own = flat ? directCode(flat.dir).filter((f) => !PLUMBING_FILE.test(f.replace(/\.\w+$/, '').toLowerCase())) : []
    if (flat && own.length >= 3) {
      out.splice(out.indexOf(flat), 1)
      for (const f of own.slice(0, MAX_NODES - out.length)) {
        const file = flat.dir.path ? `${flat.dir.path}/${f}` : f
        out.push({ id: file, dir: flat.dir, shallow: true, label: prettyLabel(f), extra: [file], only: true })
      }
    }
  }
  // A lone file next to a folder of the same name is the same component (src/cli.ts + src/cli/).
  return out.filter((u) => {
    if (!u.shallow || u.only) return true
    const own = directCode(u.dir)
    if (own.length !== 1) return true
    const stem = own[0].replace(/\.\w+$/, '')
    const twin = out.find((o) => !o.shallow && o.dir.name === stem && path.posix.dirname(o.dir.path || '.') === (u.dir.path || '.'))
    if (!twin) return true
    twin.extra.push(u.dir.path ? `${u.dir.path}/${own[0]}` : own[0])
    return false
  })
}

function unitFiles(u: Unit): string[] {
  if (u.only) return u.extra
  const out: string[] = []
  const walk = (d: Dir, deep: boolean) => {
    for (const f of d.files) if (CODE.test(f)) out.push(d.path ? `${d.path}/${f}` : f)
    if (deep) for (const c of d.children.values()) if (!SKIP_DIRS.has(c.name.toLowerCase())) walk(c, true)
  }
  walk(u.dir, !u.shallow)
  return [...out, ...u.extra]
}

function importsOf(text: string, file: string): string[] {
  const out: string[] = []
  const add = (re: RegExp) => {
    for (const m of text.matchAll(re)) out.push(m[1])
  }
  if (/\.(py)$/.test(file)) {
    add(/^\s*from\s+([.\w]+)\s+import\b/gm)
    add(/^\s*import\s+([\w.]+)/gm)
  } else if (/\.go$/.test(file)) {
    add(/^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm)
    for (const block of text.matchAll(/import\s*\(([\s\S]*?)\)/g)) for (const m of block[1].matchAll(/"([^"]+)"/g)) out.push(m[1])
  } else {
    add(/(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g)
    add(/\bimport\s*['"]([^'"]+)['"]/g)
    add(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)
    add(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)
  }
  return out
}

/** "@scope/pkg/sub" → "@scope/pkg", "lodash/fp" → "lodash", python "a.b" → "a". */
function packageName(spec: string, py: boolean): string {
  if (py) return spec.split('.')[0]
  if (spec.startsWith('github.com/')) return spec
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/')
  return spec.split('/')[0]
}

export function scanRepo(root: string): RepoMap {
  const files = listFiles(root)
  const tree = buildTree(files)
  let repoName = path.basename(path.resolve(root))
  try {
    const name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name
    if (typeof name === 'string' && name.trim()) repoName = name.replace(/^@[^/]+\//, '')
  } catch {}
  const units = chooseUnits(tree, repoName)
  if (!units.length) return { nodes: [], edges: [] }

  // Workspace packages by name, and the Go module path, for resolving non-relative imports.
  const pkgDirs = new Map<string, string>()
  let goModule = ''
  for (const f of files) {
    const base = path.posix.basename(f)
    if (base !== 'package.json' && base !== 'go.mod') continue
    if (f.split('/').some((p) => SKIP_DIRS.has(p))) continue
    try {
      const text = fs.readFileSync(path.join(root, f), 'utf8')
      if (base === 'package.json') {
        const name = JSON.parse(text).name
        if (typeof name === 'string') pkgDirs.set(name, path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f))
      } else if (!goModule) goModule = text.match(/^module\s+(\S+)/m)?.[1] ?? ''
    } catch {}
  }

  const stem = (f: string) => f.replace(/\.\w+$/, '')
  const unitOf = (file: string): Unit | undefined => {
    const owner = units.find((u) => u.extra.some((x) => x === file || stem(x) === stem(file)))
    if (owner) return owner
    let best: Unit | undefined
    for (const u of units) {
      if (u.only) continue
      const p = u.dir.path
      const inside = u.shallow ? path.posix.dirname(file) === (p || '.') : p === '' || file === p || file.startsWith(p + '/')
      if (inside && (!best || p.length > best.dir.path.length)) best = u
    }
    return best
  }

  const nodes: RepoMapNode[] = []
  const edgeCount = new Map<string, number>()
  const systems = new Map<string, RepoMapNode>()
  const systemEdges = new Set<string>()
  const httpServers = new Set<string>()
  const fileSet = new Set(files)
  /** The nearest directory with a manifest: which deployable a component belongs to. */
  const packageOf = (u: Unit) => {
    const parts = u.dir.path ? u.dir.path.split('/') : []
    for (let i = parts.length; i > 0; i--) {
      const dir = parts.slice(0, i).join('/')
      if (MANIFESTS.some((m) => fileSet.has(`${dir}/${m}`))) return dir
    }
    return ''
  }
  const pkgOfUnit = new Map(units.map((u) => [u.id, packageOf(u)]))
  let read = 0

  for (const u of units) {
    const specs = new Map<string, number>()
    // A unit's files, minus those that belong to a more specific unit inside it.
    const fileList = unitFiles(u).filter((f) => unitOf(f) === u)
    for (const f of fileList) {
      if (read >= MAX_READ) break
      let text: string
      try {
        const st = fs.statSync(path.join(root, f))
        if (st.size > 400_000) continue
        text = fs.readFileSync(path.join(root, f), 'utf8')
      } catch {
        continue
      }
      read++
      const py = f.endsWith('.py')
      for (const spec of importsOf(text, f)) {
        // Relative imports point at another unit.
        let target: string | null = null
        if (spec.startsWith('.') && !py) target = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec))
        else if (py && spec.startsWith('.')) {
          const ups = spec.match(/^\.+/)![0].length
          const rest = spec.slice(ups).replace(/\./g, '/')
          target = path.posix.normalize(path.posix.join(path.posix.dirname(f), ...Array(ups - 1).fill('..'), rest))
        } else if (goModule && spec.startsWith(goModule + '/')) target = spec.slice(goModule.length + 1)
        else {
          const name = packageName(spec, py)
          if (pkgDirs.has(name) && pkgDirs.get(name) !== '') target = pkgDirs.get(name)! + '/'
          else if (py && tree.children.has(name)) target = name + '/'
          else specs.set(name, (specs.get(name) ?? 0) + 1)
        }
        if (target !== null) {
          const to = unitOf(target.endsWith('/') ? target + 'x.ts' : target) ?? unitOf(target + '/index.ts')
          if (to && to !== u) edgeCount.set(`${u.id}\n${to.id}`, (edgeCount.get(`${u.id}\n${to.id}`) ?? 0) + 1)
        }
      }
    }
    // Manifest dependencies count too (a package may use a client library only through config).
    const manifest = u.dir.files.includes('package.json') ? (() => {
      try {
        const pj = JSON.parse(fs.readFileSync(path.join(root, u.dir.path, 'package.json'), 'utf8'))
        return Object.keys({ ...pj.dependencies })
      } catch {
        return []
      }
    })() : []
    const names = new Set([...specs.keys(), ...manifest])

    const hasFile = (re: RegExp) => u.dir.files.some((f) => re.test(f)) || [...u.dir.children.values()].some((c) => c.files.some((f) => re.test(f)))
    const tags: string[] = []
    for (const [re, tag] of FRAMEWORK_TAGS) if ([...names].some((n) => re.test(n)) && !tags.includes(tag)) tags.push(tag)
    if (hasFile(/^vite\.config\.\w+$/)) tags.push('Vite')
    if (u.dir.files.includes('fly.toml')) tags.push('Fly.io')
    else if (u.dir.files.includes('Dockerfile')) tags.push('Docker')
    if (u.dir.files.includes('wrangler.toml')) tags.push('Cloudflare Workers')
    const lower = u.label.toLowerCase()
    const frontend = [...names].some((n) => FRONTEND.test(n)) || hasFile(/^index\.html$/) || /^(web|frontend|client|ui|www|dashboard)$/.test(lower)
    const server = [...names].some((n) => HTTP_SERVER.test(n)) || /^(server|api|backend)$/.test(lower)
    const cli = [...names].some((n) => CLI.test(n)) || /^(cli|cmd)$/.test(lower)
    const kind = frontend ? 'client' : /worker|jobs?|queue|cron/.test(lower) ? 'worker' : server ? 'service' : cli ? 'client' : 'module'
    if (cli && !frontend && !tags.includes('CLI')) tags.unshift('CLI')
    if (server && !frontend) httpServers.add(u.id)
    const where = u.only ? u.extra[0] : u.shallow ? (u.dir.path ? `${u.dir.path}/${directCode(u.dir)[0] ?? ''}` : '') : u.dir.path ? `${u.dir.path}/` : ''
    nodes.push({ id: u.id, label: u.label, kind, tags: tags.slice(0, 3), ...(where ? { path: where } : {}) })

    for (const name of names) {
      const sys = SYSTEMS.find((s) => s.test.test(name))
      if (!sys) continue
      const id = `ext:${sys.label}`
      if (!systems.has(id)) systems.set(id, { id, label: sys.label, kind: sys.kind, tags: [] })
      systemEdges.add(`${u.id}\n${id}`)
    }
  }

  const edges: RepoMapEdge[] = []
  // Busiest connections first; at most four out of any one component.
  const out = new Map<string, number>()
  for (const [key] of [...edgeCount].sort((a, b) => b[1] - a[1])) {
    const [from, to] = key.split('\n')
    if ((out.get(from) ?? 0) >= 4) continue
    out.set(from, (out.get(from) ?? 0) + 1)
    edges.push({ from, to })
  }
  for (const key of systemEdges) {
    const [from, to] = key.split('\n')
    edges.push({ from, to })
  }
  // A frontend reaches the backend over the network, which imports don't show. Prefer the
  // servers that ship with it (same package); a separate deployable only when there is no other.
  for (const c of nodes.filter((n) => n.kind === 'client' && !n.tags?.includes('CLI'))) {
    const same = [...httpServers].filter((s) => pkgOfUnit.get(s) === pkgOfUnit.get(c.id))
    for (const s of (same.length ? same : httpServers.size === 1 ? [...httpServers] : []).slice(0, 2)) {
      if (!edges.some((e) => e.from === c.id && e.to === s)) edges.push({ from: c.id, to: s, label: 'HTTP' })
    }
  }
  return { nodes: [...nodes, ...systems.values()], edges }
}

const DIGEST_MANIFESTS = /^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle(\.kts)?|composer\.json|mix\.exs|Dockerfile|docker-compose\.ya?ml|compose\.ya?ml|fly\.toml|vercel\.json|netlify\.toml|wrangler\.toml|Procfile|serverless\.ya?ml|app\.yaml)$/
const ENTRY = /^(index|main|server|app|cli|worker|api|mod|lib|__main__|manage)\.\w+$/
const DIGEST_MAX = 120_000

/**
 * What a model needs to map the repo without opening files itself: the folder tree with code
 * counts, the manifests and deploy configs, the README, and the top of each entry point.
 */
export function repoDigest(root: string): string {
  const files = listFiles(root)
  const tree = buildTree(files)
  const out: string[] = []
  let size = 0
  const add = (s: string) => {
    if (size + s.length > DIGEST_MAX) return false
    out.push(s)
    size += s.length
    return true
  }
  const read = (f: string, max: number) => {
    try {
      const text = fs.readFileSync(path.join(root, f), 'utf8')
      return text.length > max ? text.slice(0, max) + '\n…' : text
    } catch {
      return null
    }
  }
  const lines: string[] = []
  const walk = (d: Dir, depth: number) => {
    for (const c of [...d.children.values()].sort((a, b) => b.code - a.code)) {
      if (lines.length >= 250) return
      lines.push(`${'  '.repeat(depth)}${c.name}/ (${c.code} code files)`)
      if (depth < 3) walk(c, depth + 1)
    }
  }
  walk(tree, 0)
  add(`Folders:\n${lines.join('\n')}\nTop-level files: ${tree.files.slice(0, 60).join(', ')}`)
  const readme = files.find((f) => /^readme(\.\w+)?$/i.test(f))
  if (readme) add(`\n--- ${readme} ---\n${read(readme, 6000) ?? ''}`)
  const kept = (f: string) => !f.split('/').slice(0, -1).some((p) => SKIP_DIRS.has(p.toLowerCase()) || p.startsWith('.'))
  for (const f of files.filter((f) => kept(f) && DIGEST_MANIFESTS.test(path.posix.basename(f))).slice(0, 40)) {
    let text = read(f, 4000)
    if (text && path.posix.basename(f) === 'package.json') {
      try {
        const pj = JSON.parse(text)
        text = JSON.stringify({ name: pj.name, bin: pj.bin, main: pj.main, scripts: pj.scripts, dependencies: Object.keys(pj.dependencies ?? {}), workspaces: pj.workspaces }, null, 1)
      } catch {}
    }
    if (text && !add(`\n--- ${f} ---\n${text}`)) break
  }
  const entries = files.filter((f) => kept(f) && CODE.test(f) && ENTRY.test(path.posix.basename(f)) && f.split('/').length <= 4)
  for (const f of entries.sort((a, b) => a.split('/').length - b.split('/').length).slice(0, 24)) {
    const text = read(f, 3500)
    if (text && !add(`\n--- ${f} (start) ---\n${text}`)) break
  }
  return out.join('\n')
}
