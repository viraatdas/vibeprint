import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanTable, VibeprintCore } from '../src/core/core.js'
import { mapCode } from '../src/core/map.js'
import { schemaDigest, schemaWithModel, type Mapper } from '../src/interpret/code-map.js'
import { startDaemon, type Daemon } from '../src/server/daemon.js'
import { summarizeMarks } from '../src/shared/marks.js'
import type { TableSpec } from '../src/shared/types.js'

const cleanup: string[] = []
after(() => {
  for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true })
})
const tmp = (name: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `vp-${name}-`))
  cleanup.push(d)
  return d
}

const USERS: TableSpec = {
  name: 'users',
  source: 'prisma/schema.prisma',
  columns: [
    { name: 'id', type: 'String', key: 'primary' },
    { name: 'email', type: 'String' },
    { name: 'createdAt', type: 'DateTime' },
  ],
  rows: [
    ['usr_01', 'ada@example.com', '2026-11-04 09:12'],
    ['usr_02', 'linus@example.com', '2026-11-04 10:30'],
  ],
}
const ORDERS: TableSpec = {
  name: 'orders',
  source: 'prisma/schema.prisma',
  columns: [
    { name: 'id', type: 'Int', key: 'primary' },
    { name: 'userId', type: 'String', key: 'foreign', references: 'users.id' },
    { name: 'total', type: 'Decimal' },
  ],
  rows: [['1', 'usr_01', '42.50']],
}

/** A repo with a Prisma schema and a Postgres-backed API, mapped onto the canvas. */
function shopRepo(): string {
  const root = tmp('shop')
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
  write('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '1', '@prisma/client': '5' } }))
  write('prisma/schema.prisma', 'model User {\n  id String @id\n  email String @unique\n  orders Order[]\n}\nmodel Order {\n  id Int @id\n  userId String\n  user User @relation(fields: [userId], references: [id])\n}\n')
  write('prisma/migrations/20260101_init/migration.sql', 'CREATE TABLE "User" ("id" TEXT PRIMARY KEY);')
  write('server/index.ts', "import express from 'express'\n")
  return root
}

function mappedCore(root = tmp('core')) {
  const core = new VibeprintCore(root)
  core.ensureDir()
  mapCode(core, [], {
    nodes: [
      { id: 'api', label: 'API', kind: 'service' },
      { id: 'pg', label: 'Postgres', kind: 'database' },
    ],
    edges: [{ from: 'api', to: 'pg' }],
  }, 'vibeprint')
  return core
}
const pgId = (core: VibeprintCore) => core.graph.nodes.find((n) => n.label === 'Postgres')!.id

describe('tables on the canvas', () => {
  test('a table lands at once beside its database, outside review and its limits', () => {
    const core = mappedCore()
    const many = Array.from({ length: 9 }, (_, i) => ({ type: 'table' as const, target: 'Postgres', table: { ...USERS, name: `t${i}` } }))
    const { marks, batch, progress } = core.addMarks('claude', many)
    assert.equal(batch, undefined, 'no proposal batch to review')
    assert.ok(progress)
    assert.equal(marks.length, 9, 'more than a batch holds: tables are not capped like proposals')
    assert.ok(marks.every((m) => m.status === 'accepted' && m.target.kind === 'node' && m.target.id === pgId(core)))
    assert.equal(summarizeMarks(marks), '9 tables')
    assert.match(core.chat.at(-1)!.text, /Here are 9 tables: t0, t1/)
    // None overlaps another.
    const boxes = marks.map((m) => ({ ...m.data.offset!, ...m.data.size! }))
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `tables ${i} and ${j} overlap`)
      }
  })

  test('showing a table again replaces it in place, and the user can remove one', () => {
    const core = mappedCore()
    const [first] = core.addMarks('claude', [{ type: 'table', target: 'Postgres', table: USERS }]).marks
    const [again] = core.addMarks('codex', [{ type: 'table', target: 'Postgres', table: { ...USERS, rows: [['usr_09', 'grace@example.com', '2026-11-05 08:00']] } }]).marks
    assert.equal(core.marks.find((m) => m.id === first.id)!.status, 'rejected', 'the old one is gone')
    assert.deepEqual(again.data.offset, first.data.offset, 'the new one takes its place')
    core.decideMark(again.id, 'reject')
    assert.equal(core.marks.find((m) => m.id === again.id)!.status, 'rejected')
    assert.equal(core.graph.nodes.length, 2, 'tables never change the architecture')
  })

  test('a table from an agent is checked and trimmed to fit', () => {
    assert.throws(() => cleanTable({ name: '', columns: [], rows: [] }), /needs a name/)
    assert.throws(() => cleanTable({ name: 'x', columns: [], rows: [] }), /at least one column/)
    const t = cleanTable({
      name: '  events ',
      columns: [{ name: 'id', key: 'primary' }, { name: 'kind', key: 'nonsense' as never }, { name: '' }],
      rows: [['1', 'click', 'extra'], ['2'], ...Array.from({ length: 20 }, () => ['x', 'y'])],
    })
    assert.equal(t.name, 'events')
    assert.deepEqual(t.columns, [{ name: 'id', key: 'primary' }, { name: 'kind' }])
    assert.deepEqual(t.rows[0], ['1', 'click'], 'one value per column')
    assert.deepEqual(t.rows[1], ['2', ''], 'short rows are padded')
    assert.equal(t.rows.length, 8)
  })
})

/** A stand-in for `claude -p`: read-only tools, the schema prompt, and the two tables. */
function fakeClaude(opts: { tables?: TableSpec[]; delayMs?: number } = {}): string {
  const dir = tmp('bin')
  const bin = path.join(dir, 'claude')
  const reply = {
    note: '2 tables from prisma/schema.prisma',
    tables: (opts.tables ?? [USERS, ORDERS]).map((t) => ({
      name: t.name,
      source: t.source ?? '',
      columns: t.columns.map((c) => ({ name: c.name, type: c.type ?? '', key: c.key ?? '', references: c.references ?? '' })),
      rows: t.rows,
    })),
  }
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const args = process.argv.slice(2)
const at = (f) => args[args.indexOf(f) + 1]
if (at('--tools') !== 'Read,Grep,Glob' || !at('-p').includes('database schema') || !JSON.parse(at('--json-schema')).properties.tables) {
  console.error('unexpected args: ' + args.join(' ')); process.exit(2)
}
setTimeout(() => console.log(JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: ${JSON.stringify(reply)} })), ${opts.delayMs ?? 0})
`,
  )
  fs.chmodSync(bin, 0o755)
  return bin
}

describe('reading the schema from the code', () => {
  test('the API gets the schema files; the reply becomes tables', async () => {
    const root = shopRepo()
    const digest = schemaDigest(root)
    assert.match(digest, /--- prisma\/schema\.prisma ---/)
    assert.match(digest, /--- prisma\/migrations\/20260101_init\/migration\.sql ---/)
    assert.doesNotMatch(digest, /server\/index\.ts/, 'only files that define the schema')
    let prompt = ''
    const client = {
      beta: {
        messages: {
          create: async (body: any) => {
            prompt = body.messages[0].content[0].text
            const tables = [{ name: 'users', source: 'prisma/schema.prisma', columns: [{ name: 'id', type: 'String', key: 'primary', references: '' }], rows: [['usr_01']] }]
            return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ note: 'one table', tables }) }] } as any
          },
        },
      },
    }
    const res = await schemaWithModel(root, { label: 'Postgres', kind: 'database' }, { kind: 'api', label: 'Claude', author: 'claude' }, { client })
    assert.match(prompt, /for "Postgres" \(database\)/)
    assert.match(prompt, /model User/)
    assert.deepEqual(res, { note: 'one table', tables: [{ name: 'users', source: 'prisma/schema.prisma', columns: [{ name: 'id', type: 'String', key: 'primary' }], rows: [['usr_01']] }] })
  })
})

describe('the Tables button and "show me the schema"', () => {
  const start = (root: string, mapper: Mapper | null) =>
    startDaemon({ root, port: 0, host: '127.0.0.1', quiet: true, commit: false, claude: { available: false, model: 'none' }, relay: null, mapper })
  const url = (d: Daemon) => `http://127.0.0.1:${d.port}`
  const post = async (d: Daemon, p: string, body: unknown) => {
    const r = await fetch(url(d) + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: r.status, body: (await r.json()) as any }
  }
  const state = async (d: Daemon) => (await (await fetch(url(d) + '/api/state')).json()) as any
  const settled = async (d: Daemon) => {
    for (let i = 0; i < 200; i++) {
      const s = await state(d)
      if (!s.mapper.active) return s
      await new Promise((r) => setTimeout(r, 25))
    }
    throw new Error('the reading never finished')
  }
  const map = (d: Daemon) =>
    post(d, '/api/map', {
      map: { nodes: [{ id: 'api', label: 'API', kind: 'service' }, { id: 'pg', label: 'Postgres', kind: 'database' }], edges: [{ from: 'api', to: 'pg' }] },
    })

  test('Tables reads the schema with the agent on the machine and draws it beside the database', async () => {
    const d = await start(shopRepo(), { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude({ delayMs: 100 }) })
    try {
      await map(d)
      const pg = (await state(d)).graph.nodes.find((n: any) => n.label === 'Postgres').id
      const res = await post(d, '/api/schema', { target: pg })
      assert.equal(res.status, 200)
      assert.deepEqual(res.body, { reading: 'Claude Code', target: pg })
      const during = await state(d)
      assert.equal(during.mapper.task, 'schema')
      assert.equal((await post(d, '/api/schema', { target: pg })).status, 409, 'one reading at a time')
      const s = await settled(d)
      assert.equal(s.mapper.outcome, 'tables')
      assert.equal(s.mapper.count, 2)
      const tables = s.marks.filter((m: any) => m.type === 'table' && m.status === 'accepted')
      assert.deepEqual(tables.map((m: any) => m.data.table.name), ['users', 'orders'])
      assert.ok(tables.every((m: any) => m.target.id === pg && m.author === 'claude'))
      assert.deepEqual(tables[1].data.table.columns[1], { name: 'userId', type: 'String', key: 'foreign', references: 'users.id' })
      assert.equal(s.chat.at(-1).text, '2 tables from prisma/schema.prisma')
      // Again: the same two tables replace the first two.
      await post(d, '/api/schema', { target: pg })
      const s2 = await settled(d)
      assert.equal(s2.marks.filter((m: any) => m.type === 'table' && m.status === 'accepted').length, 2)
    } finally {
      await d.close()
    }
  })

  test('asking in the chat starts the same reading, for the database it names', async () => {
    const d = await start(shopRepo(), { kind: 'claude-code', label: 'Claude Code', author: 'claude', bin: fakeClaude() })
    try {
      await map(d)
      await post(d, '/api/chat', { text: 'what does the API look like?' })
      assert.equal((await state(d)).mapper.active, false, 'not every question is about the schema')
      await post(d, '/api/chat', { text: 'show me the schema of postgres' })
      const s = await settled(d)
      assert.equal(s.mapper.outcome, 'tables')
      const pg = s.graph.nodes.find((n: any) => n.label === 'Postgres').id
      assert.ok(s.marks.filter((m: any) => m.type === 'table').every((m: any) => m.target.id === pg))
    } finally {
      await d.close()
    }
  })

  test('without anything to read the code, Tables says how to get the schema', async () => {
    const d = await start(shopRepo(), null)
    try {
      await map(d)
      const res = await post(d, '/api/schema', {})
      assert.equal(res.status, 422)
      assert.match(res.body.error, /install Claude Code or Codex/)
      assert.match(res.body.error, /show me the schema/)
    } finally {
      await d.close()
    }
  })
})
