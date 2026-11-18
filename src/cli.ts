#!/usr/bin/env node
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const HELP = `vibeprint — draw your architecture, build against it with your coding agent

Usage:
  vibeprint [serve] [--port 4747] [--host 0.0.0.0] [--no-commit] [--no-relay] [--root <repo>]
                  [--state <dir>] [--embed-origin <origin>[,<origin>]]
      Start the canvas daemon for this repo. Open the printed URL on your iPad and laptop.
      The iPad link goes through the hosted relay, so it works on any network; --no-relay keeps it on your LAN.
      --state keeps the canvas in <dir> instead of <repo>/.vibeprint: the repo is only read, never
      written or committed. --embed-origin lets those sites show the canvas in a frame.
  vibeprint init [--root <repo>] [--register]
      Set up .vibeprint/, the agent rule in AGENTS.md, and MCP config for Claude Code / Codex.
  vibeprint mcp [--root <repo>] [--author <name>]
      Run the MCP server over stdio (Claude Code and Codex launch this).

Environment:
  ANTHROPIC_API_KEY        Use Claude directly for the first interpretation pass and the chat panel.
  VIBEPRINT_MODEL          Model for interpretation and chat (default: claude-opus-5-5).
  VIBEPRINT_RELAY          Relay base URL (default https://live.vibeprint.viraat.dev), or "off".
`

export function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string | boolean> } {
  const flags: Record<string, string | boolean> = {}
  let cmd = ''
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2)
      if (k.startsWith('no-')) flags[k.slice(3)] = false
      else if (v !== undefined) flags[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]
      else flags[k] = true
    } else if (a === '-h') flags.help = true
    else if (!cmd) cmd = a
  }
  return { cmd: cmd || 'serve', flags }
}

/** `--embed-origin https://a.example,https://b.example` as origins; anything else is an error. */
export function parseOrigins(flag: string | boolean | undefined): string[] {
  if (flag === undefined || flag === false) return []
  if (flag === true) throw new Error('--embed-origin needs an origin, like https://rudder.exla.ai')
  return flag.split(',').map((raw) => {
    const value = raw.trim()
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new Error(`--embed-origin: "${value}" is not an origin like https://rudder.exla.ai`)
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
      throw new Error(`--embed-origin: "${value}" is not an origin like https://rudder.exla.ai`)
    }
    return url.origin
  })
}

/** The repo this command is about: --root, else the git toplevel, else cwd. */
export function resolveRoot(flag?: string | boolean): string {
  if (typeof flag === 'string') return path.resolve(flag)
  if (process.env.VIBEPRINT_ROOT) return path.resolve(process.env.VIBEPRINT_ROOT)
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return process.cwd()
  }
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2))
  if (flags.help || cmd === 'help') {
    process.stdout.write(HELP)
    return
  }
  const root = resolveRoot(flags.root)
  switch (cmd) {
    case 'serve': {
      const { runDaemon } = await import('./server/daemon.js')
      const { relayEnabled } = await import('./server/relay.js')
      if (flags.state === true) throw new Error('--state needs a directory')
      await runDaemon({
        root,
        port: flags.port ? Number(flags.port) : undefined,
        host: typeof flags.host === 'string' ? flags.host : undefined,
        commit: flags.commit !== false,
        dev: !!flags.dev,
        relay: relayEnabled(flags.relay === true ? undefined : flags.relay),
        ...(typeof flags.state === 'string' ? { state: path.resolve(flags.state) } : {}),
        embedOrigins: parseOrigins(flags['embed-origin']),
      })
      break
    }
    case 'mcp': {
      const { runMcpServer } = await import('./mcp/server.js')
      await runMcpServer({ root, author: typeof flags.author === 'string' ? flags.author : undefined })
      break
    }
    case 'init': {
      const { runInit } = await import('./cli/init.js')
      await runInit({ root, register: !!flags.register })
      break
    }
    default:
      process.stderr.write(`Unknown command "${cmd}".\n\n${HELP}`)
      process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`vibeprint: ${err?.stack ?? err}\n`)
  process.exit(1)
})
