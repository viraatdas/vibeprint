import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
test('daemon and MCP advertise the published package version', () => {
  const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  for (const file of ['../src/server/daemon.ts', '../src/mcp/server.ts']) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(source.includes(`const VERSION = '${version}'`), file)
  }
})
