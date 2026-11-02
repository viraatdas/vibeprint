import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  SECTION_END,
  SECTION_START,
  agentsSection,
  codexAddArgs,
  ensureClaudeImport,
  mergeMcpJson,
  resolveMcpCommand,
  runInit,
  upsertSection,
} from '../src/cli/init.js'
import { AGENT_RULE } from '../src/shared/types.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vibeprint-init-'))
const count = (s: string, needle: string) => s.split(needle).length - 1

test('runInit is idempotent and keeps existing content', async () => {
  const dir = tmp()
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Project\n\nSome rules.\n')
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Claude notes\n')
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'other-server', args: ['--x'] } } }, null, 2))

    const logs: string[] = []
    const first = await runInit({ root: dir, log: (s) => logs.push(s) })
    assert.equal(first.agentsMd, 'updated')
    assert.equal(first.claudeMd, 'updated')
    assert.equal(first.mcpJson, 'updated')

    const second = await runInit({ root: dir, log: (s) => logs.push(s) })
    assert.equal(second.agentsMd, 'unchanged')
    assert.equal(second.claudeMd, 'unchanged')
    assert.equal(second.mcpJson, 'unchanged')

    const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')
    assert.equal(count(agents, SECTION_START), 1)
    assert.equal(count(agents, SECTION_END), 1)
    assert.ok(agents.includes(AGENT_RULE))
    assert.ok(agents.startsWith('# Project\n\nSome rules.\n'))
    for (const tool of ['get_architecture', 'set_status', 'list_marks', 'wait_for_user']) assert.ok(agents.includes(tool))

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')
    assert.equal(claude.split('\n').filter((l) => l.trim() === '@AGENTS.md').length, 1)
    assert.ok(claude.startsWith('# Claude notes'))

    const mcp = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'))
    assert.deepEqual(mcp.mcpServers.other, { command: 'other-server', args: ['--x'] })
    const cmd = resolveMcpCommand()
    assert.deepEqual(mcp.mcpServers.vibeprint, { command: cmd.command, args: cmd.args })

    assert.ok(fs.existsSync(path.join(dir, '.vibeprint', '.gitignore')))
    const out = logs.join('\n')
    assert.ok(out.includes(`codex mcp add vibeprint -- ${cmd.command}`), out)
    assert.equal(second.codexCommand, ['codex', ...codexAddArgs(cmd)].join(' '))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('runInit creates files in an empty repo and leaves a broken .mcp.json alone', async () => {
  const dir = tmp()
  try {
    fs.writeFileSync(path.join(dir, '.mcp.json'), '{ "mcpServers": { oops ')
    const res = await runInit({ root: dir, log: () => {}, command: { command: 'vibeprint', args: ['mcp'], via: 'path' } })
    assert.equal(res.agentsMd, 'created')
    assert.equal(res.claudeMd, 'created')
    assert.equal(res.mcpJson, 'skipped')
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n')
    assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), agentsSection() + '\n')
    assert.equal(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'), '{ "mcpServers": { oops ')
    assert.equal(res.codexCommand, 'codex mcp add vibeprint -- vibeprint mcp')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('upsertSection refreshes an outdated section and drops duplicates', () => {
  const old = `# Repo\n\n${SECTION_START}\nold text\n${SECTION_END}\n\nMore.\n\n${SECTION_START}\ndupe\n${SECTION_END}\n`
  const next = upsertSection(old)
  assert.equal(count(next, SECTION_START), 1)
  assert.ok(!next.includes('old text') && !next.includes('dupe'))
  assert.ok(next.includes(AGENT_RULE))
  assert.ok(next.startsWith('# Repo\n\n'))
  assert.ok(next.includes('More.'))
  assert.equal(upsertSection(next), next)
  // A stray start marker (hand edit) doesn't produce a second section.
  const stray = upsertSection(`# Repo\n${SECTION_START}\nhalf\n`)
  assert.equal(count(stray, SECTION_START), 1)
  assert.equal(count(stray, SECTION_END), 1)
})

test('ensureClaudeImport', () => {
  assert.equal(ensureClaudeImport(null), '@AGENTS.md\n')
  assert.equal(ensureClaudeImport('# Notes'), '# Notes\n\n@AGENTS.md\n')
  assert.equal(ensureClaudeImport('# Notes\n@AGENTS.md\n'), '# Notes\n@AGENTS.md\n')
})

test('mergeMcpJson keeps other servers and env, refreshes the command', () => {
  const prev = JSON.stringify({ other: 1, mcpServers: { a: { command: 'a' }, vibeprint: { command: 'old', args: [], env: { VIBEPRINT_AUTHOR: 'me' } } } })
  const merged = JSON.parse(mergeMcpJson(prev, { command: 'vibeprint', args: ['mcp'] }))
  assert.deepEqual(merged, {
    other: 1,
    mcpServers: { a: { command: 'a' }, vibeprint: { command: 'vibeprint', args: ['mcp'], env: { VIBEPRINT_AUTHOR: 'me' } } },
  })
  assert.deepEqual(JSON.parse(mergeMcpJson(null, { command: 'x', args: [] })), { mcpServers: { vibeprint: { command: 'x', args: [] } } })
  assert.throws(() => mergeMcpJson('[1]', { command: 'x', args: [] }))
  assert.throws(() => mergeMcpJson('{nope', { command: 'x', args: [] }))
})

test('resolveMcpCommand prefers PATH, then dist, then tsx', () => {
  const pkg = tmp()
  try {
    assert.deepEqual(resolveMcpCommand({ which: () => '/usr/bin/vibeprint', packageRoot: pkg }), { command: 'vibeprint', args: ['mcp'], via: 'path' })
    fs.mkdirSync(path.join(pkg, 'src'))
    fs.writeFileSync(path.join(pkg, 'src', 'cli.ts'), '')
    assert.deepEqual(resolveMcpCommand({ which: () => null, packageRoot: pkg }), {
      command: 'npx',
      args: ['tsx', path.join(pkg, 'src', 'cli.ts'), 'mcp'],
      via: 'tsx',
    })
    fs.mkdirSync(path.join(pkg, 'dist'))
    fs.writeFileSync(path.join(pkg, 'dist', 'cli.js'), '')
    assert.deepEqual(resolveMcpCommand({ which: () => null, packageRoot: pkg }), {
      command: 'node',
      args: [path.join(pkg, 'dist', 'cli.js'), 'mcp'],
      via: 'dist',
    })
    assert.deepEqual(codexAddArgs({ command: 'node', args: ['/x/cli.js', 'mcp'] }), ['mcp', 'add', 'vibeprint', '--', 'node', '/x/cli.js', 'mcp'])
    // `npx vibeprint init` runs from npx's temporary cache (and puts it on PATH): point agents at npx, not the cache.
    const npxPkg = '/home/u/.npm/_npx/0a1b2c/node_modules/vibeprint'
    const viaNpx = { command: 'npx', args: ['-y', 'vibeprint', 'mcp'], via: 'npx' }
    assert.deepEqual(resolveMcpCommand({ which: () => '/home/u/.npm/_npx/0a1b2c/node_modules/.bin/vibeprint', packageRoot: npxPkg }), viaNpx)
    assert.deepEqual(resolveMcpCommand({ which: () => null, packageRoot: npxPkg }), viaNpx)
  } finally {
    fs.rmSync(pkg, { recursive: true, force: true })
  }
})
