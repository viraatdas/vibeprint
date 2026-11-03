// Reads the code with a model and returns an accurate architecture map. The quick scan
// (src/core/repo-scan.ts) draws instantly; this redraws it from an actual reading.
//
// Which model: the Claude API when ANTHROPIC_API_KEY is set; otherwise the coding agent the
// user already has (Claude Code, then Codex), run headless and read-only in the repo, on the
// user's own subscription. VIBEPRINT_MAPPER=api|claude|codex|off picks one explicitly.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { RepoMap } from '../shared/types.js'
import { claudeConfig, mapRepoWithClaude, type AnthropicLike } from './claude.js'
import { repoDigest } from '../core/repo-scan.js'

export type MapperKind = 'api' | 'claude-code' | 'codex'

export interface Mapper {
  kind: MapperKind
  /** Shown to the user: "Claude", "Claude Code", "Codex". */
  label: string
  /** Who the map is from, in chat and the graph. */
  author: string
  /** The CLI to run (claude-code, codex). */
  bin?: string
}

const MAP_KINDS = ['client', 'service', 'worker', 'module', 'database', 'cache', 'queue', 'storage', 'search', 'external'] as const

/** Strict enough for OpenAI's structured outputs (Codex) as well as Claude's. */
export const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['nodes', 'edges'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'kind', 'tags', 'path', 'description'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          kind: { type: 'string', enum: [...MAP_KINDS] },
          tags: { type: 'array', items: { type: 'string' } },
          path: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'label'],
        properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } },
      },
    },
  },
} as const

export function mapPrompt(scan: RepoMap, readsFiles: boolean): string {
  return `Draw the architecture of the code in ${readsFiles ? 'this directory' : 'the repository below'} as a whiteboard diagram. The developer will sketch their next changes on top of it, so it has to match the code.

Give 4-10 components at the level a person draws as boxes: apps, services, workers, CLIs and the important modules, plus the databases, queues, storage and third-party APIs the code really talks to. Not individual files or classes, unless the project is small enough that its main files are its parts.
- id: short and unique, e.g. "api".
- label: 1-3 words, what you'd write in the box: "Web app", "API", "Postgres", "Stripe". No parentheses.
- kind: client (anything a person uses directly: web app, mobile app, CLI), service, worker, module, database, cache, queue, storage, search, or external (another company's API).
- tags: up to 2 short tags such as the framework ("Next.js", "FastAPI"), or [].
- path: where its code lives ("apps/web/", "src/server/"), or "" for databases and external systems.
- description: one short line on what it does.
Edges: who calls or depends on whom, from the caller to the callee. Keep the diagram readable: only the main connections, about one per component and never more than 14, not every import. Label an edge in 1-2 words only when the word tells something ("HTTP", "SQL", "jobs", "CDP"); otherwise "". Never "imports" or "calls".
Only include what the code shows.${readsFiles ? ' Read the manifests, README and entry points, and follow the imports where you need to; you do not need to read every file.' : ''}

A quick automatic scan (folder names and imports, no reading) found the map below. Use it as a starting point; fix what it got wrong, and rename, merge, split or drop its components as needed.
${JSON.stringify(scan)}

Reply with the JSON only.`
}

function onPath(bin: string, env: NodeJS.ProcessEnv): string | undefined {
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', ''] : ['']
  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const p = path.join(dir, bin + ext)
      try {
        fs.accessSync(p, fs.constants.X_OK)
        if (fs.statSync(p).isFile()) return p
      } catch {}
    }
  }
  return undefined
}

/** The best way this machine has to read code, or null (the quick scan is all there is). */
export function detectMapper(env: NodeJS.ProcessEnv = process.env): Mapper | null {
  const want = env.VIBEPRINT_MAPPER?.trim().toLowerCase()
  if (want === 'off' || want === 'none') return null
  const api: Mapper | null = claudeConfig(env).available ? { kind: 'api', label: 'Claude', author: 'claude' } : null
  const claudeBin = onPath('claude', env)
  const codexBin = onPath('codex', env)
  const cc: Mapper | null = claudeBin ? { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: claudeBin } : null
  const cx: Mapper | null = codexBin ? { kind: 'codex', label: 'Codex', author: 'codex', bin: codexBin } : null
  if (want === 'api') return api
  if (want === 'claude' || want === 'claude-code') return cc
  if (want === 'codex') return cx
  return api ?? cc ?? cx
}

const CLI_TIMEOUT_MS = 6 * 60_000

function run(bin: string, args: string[], opts: { cwd: string; signal?: AbortSignal; env?: NodeJS.ProcessEnv }): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // A coding agent started from inside another one's shell would think it is nested.
    const env = { ...(opts.env ?? process.env) }
    delete env.CLAUDECODE
    delete env.CLAUDE_CODE_ENTRYPOINT
    const child = spawn(bin, args, { cwd: opts.cwd, env, stdio: ['ignore', 'pipe', 'pipe'], signal: opts.signal, timeout: CLI_TIMEOUT_MS })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

/** The first JSON object in a reply, with or without a code fence around it. */
export function parseMapReply(text: string): RepoMap {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error(`no JSON in the reply: ${t.slice(0, 160)}`)
  const map = JSON.parse(t.slice(start, end + 1)) as RepoMap
  if (!Array.isArray(map.nodes) || !Array.isArray(map.edges)) throw new Error('the reply has no nodes and edges')
  return map
}

const lastLine = (s: string) => s.trim().split('\n').filter(Boolean).at(-1)?.slice(0, 300) ?? ''

/** Ask the model for the map. Throws with a short reason when it can't. */
export async function mapWithModel(
  root: string,
  scan: RepoMap,
  mapper: Mapper,
  opts: { signal?: AbortSignal; model?: string; client?: AnthropicLike; env?: NodeJS.ProcessEnv } = {},
): Promise<RepoMap> {
  if (mapper.kind === 'api') {
    return mapRepoWithClaude(mapPrompt(scan, false) + '\n\n' + repoDigest(root), MAP_SCHEMA, { model: opts.model, signal: opts.signal, client: opts.client })
  }
  if (mapper.kind === 'claude-code') {
    const args = [
      '-p', mapPrompt(scan, true),
      '--output-format', 'json',
      '--json-schema', JSON.stringify(MAP_SCHEMA),
      // Read-only: it can look at the code and nothing else.
      '--tools', 'Read,Grep,Glob',
      '--strict-mcp-config',
      '--no-session-persistence',
    ]
    const r = await run(mapper.bin!, args, { cwd: root, signal: opts.signal, env: opts.env })
    let out: { structured_output?: RepoMap; result?: string; is_error?: boolean } = {}
    try {
      out = JSON.parse(r.stdout)
    } catch {
      throw new Error(`Claude Code exited ${r.code}: ${lastLine(r.stderr) || lastLine(r.stdout) || 'no output'}`)
    }
    if (out.is_error && !out.structured_output) throw new Error(`Claude Code: ${String(out.result ?? 'failed').slice(0, 300)}`)
    if (out.structured_output) return out.structured_output
    return parseMapReply(String(out.result ?? ''))
  }
  // Codex: read-only sandbox, the final message written to a file.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibeprint-map-'))
  try {
    const schemaFile = path.join(dir, 'schema.json')
    const outFile = path.join(dir, 'map.json')
    fs.writeFileSync(schemaFile, JSON.stringify(MAP_SCHEMA))
    const args = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--output-schema', schemaFile, '-o', outFile, mapPrompt(scan, true)]
    const r = await run(mapper.bin!, args, { cwd: root, signal: opts.signal, env: opts.env })
    const text = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : ''
    if (!text.trim()) throw new Error(`Codex exited ${r.code}: ${lastLine(r.stderr) || 'no output'}`)
    return parseMapReply(text)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
