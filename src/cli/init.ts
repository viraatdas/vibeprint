// `vibeprint init`: set up a repo so coding agents follow the drawn architecture.
// Idempotent; safe to run again after upgrading.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { AGENT_RULE } from '../shared/types.js'
import { VibeprintCore } from '../core/core.js'

export const SECTION_START = '<!-- vibeprint:start -->'
export const SECTION_END = '<!-- vibeprint:end -->'
export const CLAUDE_IMPORT = '@AGENTS.md'

export interface McpCommand {
  command: string
  args: string[]
  /** How it was resolved. */
  via: 'path' | 'dist' | 'tsx' | 'npx'
}

/** npx runs packages from a temporary cache (…/_npx/<hash>/…) that agents can't rely on later. */
const isNpxCache = (p: string | null | undefined) => !!p && /[\\/]_npx[\\/]/.test(p)

export type FileChange = 'created' | 'updated' | 'unchanged'

export interface InitResult {
  agentsMd: FileChange
  claudeMd: FileChange
  mcpJson: FileChange | 'skipped'
  command: McpCommand
  codexCommand: string
  codex?: { ok: boolean; output: string }
}

/** The AGENTS.md section, markers included. */
export function agentsSection(): string {
  return `${SECTION_START}
## Vibeprint architecture

${AGENT_RULE}

The user draws this project's architecture on the Vibeprint canvas (\`vibeprint serve\`, state in \`.vibeprint/\`). Work with it through the \`vibeprint\` MCP server:

1. **Before work:** call \`get_architecture\` (and \`get_node\` for detail). Build what it describes.
2. **As work lands:** call \`set_status\` on the node (\`building\`, \`done\`, or \`blocked\` with a detail). Progress updates land immediately.
3. **Structural changes** (a new component or connection, removing or renaming one): propose them as marks with \`add\`, \`strike\`, \`rewrite\` or \`annotate\`, or several at once with \`propose\`; then \`finish_batch\` and wait for the user's decision with \`list_marks\` or \`wait_for_user\`. Build only what is accepted.
4. **Never deviate silently.** If the code and the drawing disagree, say so with a mark or \`post_chat\`. Don't edit \`.vibeprint/\` files by hand.
${SECTION_END}`
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Insert or refresh the marked section. Replaces the first well-formed section,
 * drops any duplicates or stray markers, and appends when there is none.
 */
export function upsertSection(existing: string | null, section: string = agentsSection()): string {
  const src = (existing ?? '').replace(/\r\n/g, '\n')
  const block = new RegExp(`${escapeRe(SECTION_START)}[\\s\\S]*?${escapeRe(SECTION_END)}\\n?`, 'g')
  let replaced = false
  let out = src.replace(block, () => {
    if (replaced) return ''
    replaced = true
    return `${section}\n`
  })
  if (!replaced) {
    // Stray markers from a hand edit would confuse the next run.
    out = out
      .split('\n')
      .filter((l) => l.trim() !== SECTION_START && l.trim() !== SECTION_END)
      .join('\n')
    const body = out.replace(/\s+$/, '')
    out = body ? `${body}\n\n${section}\n` : `${section}\n`
  }
  return out.replace(/\n{3,}/g, '\n\n')
}

/** CLAUDE.md content that imports AGENTS.md (Claude Code reads CLAUDE.md, Codex reads AGENTS.md). */
export function ensureClaudeImport(existing: string | null): string {
  if (existing === null || !existing.trim()) return `${CLAUDE_IMPORT}\n`
  const has = existing.split(/\r?\n/).some((l) => ['@AGENTS.md', '@./AGENTS.md'].includes(l.trim()))
  if (has) return existing
  return `${existing.replace(/\s+$/, '')}\n\n${CLAUDE_IMPORT}\n`
}

/**
 * Merge `mcpServers.vibeprint` into an existing `.mcp.json` without touching
 * other servers. Throws on unparseable JSON so a hand-edited file is never clobbered.
 */
export function mergeMcpJson(existing: string | null, entry: { command: string; args: string[] }): string {
  let config: Record<string, unknown> = {}
  if (existing?.trim()) {
    const parsed = JSON.parse(existing) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('.mcp.json is not a JSON object')
    config = parsed as Record<string, unknown>
  }
  const servers = config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers) ? (config.mcpServers as Record<string, unknown>) : {}
  const prev = servers.vibeprint && typeof servers.vibeprint === 'object' ? (servers.vibeprint as Record<string, unknown>) : {}
  // Refresh command + args; keep env vars the user added to our entry (e.g. VIBEPRINT_AUTHOR).
  config.mcpServers = { ...servers, vibeprint: { command: entry.command, args: entry.args, ...(prev.env ? { env: prev.env } : {}) } }
  return JSON.stringify(config, null, 2) + '\n'
}

/** Absolute path of an executable on PATH, or null. */
export function which(cmd: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').concat('') : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext)
      try {
        if (fs.statSync(p).isFile()) {
          if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK)
          return p
        }
      } catch {
        // not here
      }
    }
  }
  return null
}

/** The vibeprint package root (walks up from this module to a package.json named "vibeprint"). */
export function findPackageRoot(fromUrl: string = import.meta.url): string | null {
  let dir = path.dirname(fileURLToPath(fromUrl))
  for (;;) {
    const pj = path.join(dir, 'package.json')
    try {
      if (JSON.parse(fs.readFileSync(pj, 'utf8')).name === 'vibeprint') return dir
    } catch {
      // keep walking
    }
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

/**
 * How agents should launch the MCP server: `vibeprint` on PATH, else this
 * package's built dist/cli.js, else the TypeScript source through tsx. When
 * init itself runs through `npx vibeprint init`, agents launch it through npx too.
 */
export function resolveMcpCommand(opts: { which?: (cmd: string) => string | null; packageRoot?: string | null } = {}): McpCommand {
  const find = opts.which ?? ((c: string) => which(c))
  const pkg = opts.packageRoot === undefined ? findPackageRoot() : opts.packageRoot
  const onPath = find('vibeprint')
  if (isNpxCache(pkg) || isNpxCache(onPath)) return { command: 'npx', args: ['-y', 'vibeprint', 'mcp'], via: 'npx' }
  if (onPath) return { command: 'vibeprint', args: ['mcp'], via: 'path' }
  if (pkg) {
    const dist = path.join(pkg, 'dist', 'cli.js')
    if (fs.existsSync(dist)) return { command: 'node', args: [dist, 'mcp'], via: 'dist' }
    const src = path.join(pkg, 'src', 'cli.ts')
    if (fs.existsSync(src)) return { command: 'npx', args: ['tsx', src, 'mcp'], via: 'tsx' }
  }
  // Nothing better found; assume a global install will appear.
  return { command: 'vibeprint', args: ['mcp'], via: 'path' }
}

export function codexAddArgs(cmd: { command: string; args: string[] }): string[] {
  return ['mcp', 'add', 'vibeprint', '--', cmd.command, ...cmd.args]
}

const shellQuote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)

function writeIfChanged(file: string, next: string, prev: string | null): FileChange {
  if (prev === next) return 'unchanged'
  fs.writeFileSync(file, next)
  return prev === null ? 'created' : 'updated'
}

const readOrNull = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)

export async function runInit(opts: { root: string; register?: boolean; log?: (s: string) => void; command?: McpCommand }): Promise<InitResult> {
  const log = opts.log ?? ((s: string) => process.stdout.write(s + '\n'))
  const root = path.resolve(opts.root)
  const rel = (f: string) => path.relative(root, f) || '.'
  log(`vibeprint init · ${root}`)

  new VibeprintCore(root).ensureDir()
  log(`  ✓ .vibeprint/ ready`)

  const agentsFile = path.join(root, 'AGENTS.md')
  const agentsPrev = readOrNull(agentsFile)
  const agentsMd = writeIfChanged(agentsFile, upsertSection(agentsPrev), agentsPrev)
  log(`  ✓ ${rel(agentsFile)}: ${agentsMd === 'created' ? 'created with the Vibeprint section' : agentsMd === 'updated' ? 'Vibeprint section written' : 'Vibeprint section up to date'}`)

  const claudeFile = path.join(root, 'CLAUDE.md')
  const claudePrev = readOrNull(claudeFile)
  const claudeMd = writeIfChanged(claudeFile, ensureClaudeImport(claudePrev), claudePrev)
  log(`  ✓ ${rel(claudeFile)}: ${claudeMd === 'created' ? `created with ${CLAUDE_IMPORT}` : claudeMd === 'updated' ? `added ${CLAUDE_IMPORT}` : `already imports ${CLAUDE_IMPORT}`}`)

  const command = opts.command ?? resolveMcpCommand()
  const printable = [command.command, ...command.args].map(shellQuote).join(' ')
  const mcpFile = path.join(root, '.mcp.json')
  const mcpPrev = readOrNull(mcpFile)
  let mcpJson: InitResult['mcpJson']
  try {
    mcpJson = writeIfChanged(mcpFile, mergeMcpJson(mcpPrev, command), mcpPrev)
    log(`  ✓ ${rel(mcpFile)}: vibeprint → ${printable} (Claude Code, project scope${mcpJson === 'unchanged' ? ', up to date' : ''})`)
  } catch (err) {
    mcpJson = 'skipped'
    log(`  ✗ ${rel(mcpFile)}: could not parse it (${(err as Error).message}); left it alone. Add this under "mcpServers":`)
    log(`      "vibeprint": ${JSON.stringify({ command: command.command, args: command.args })}`)
  }
  if (command.via === 'npx') {
    log(`    (launched through npx; \`npm i -g vibeprint\` and run init again for a faster start.)`)
  } else if (command.via !== 'path') {
    log(`    (vibeprint is not on PATH, so this points at ${command.via === 'dist' ? 'the built CLI' : 'the TypeScript source via tsx'}; after \`npm i -g vibeprint\`, run init again for a portable entry.)`)
  }

  const codexArgs = codexAddArgs(command)
  const codexCommand = ['codex', ...codexArgs].map(shellQuote).join(' ')
  let codex: InitResult['codex']
  if (opts.register) {
    if (!which('codex')) {
      codex = { ok: false, output: 'codex not found on PATH' }
      log(`  ✗ Codex: \`codex\` is not on PATH; register later with:\n      ${codexCommand}`)
    } else {
      const res = spawnSync('codex', codexArgs, { cwd: root, encoding: 'utf8', timeout: 30_000 })
      const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim() || (res.error?.message ?? '')
      codex = { ok: res.status === 0 && !res.error, output }
      if (codex.ok) log(`  ✓ Codex: registered (${codexCommand})`)
      else log(`  ✗ Codex: \`${codexCommand}\` failed${output ? `:\n      ${output.split('\n').join('\n      ')}` : ''}`)
    }
  } else {
    log(`\nCodex: register the MCP server once with\n    ${codexCommand}\n  (or run \`vibeprint init --register\`)`)
  }

  log(`\nNext: run \`vibeprint serve\`, open the printed URL on your iPad, draw the architecture and tap Submit. Then ask your agent to build it.`)
  return { agentsMd, claudeMd, mcpJson, command, codexCommand, ...(codex ? { codex } : {}) }
}
