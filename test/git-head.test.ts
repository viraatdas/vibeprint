import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gitHead } from '../src/core/git-head.js'
import { newerVersion } from '../src/server/daemon.js'

const dirs: string[] = []
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
})
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } })

describe('which checkout vibeprint runs in', () => {
  test('the branch of a repo and of a linked worktree', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-head-'))
    dirs.push(base)
    const repo = path.join(base, 'repo')
    fs.mkdirSync(repo)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'first')
    assert.deepEqual(gitHead(repo), { branch: 'main' })
    const wt = path.join(base, 'feature-wt')
    git(repo, 'worktree', 'add', '-q', '-b', 'feature/map', wt)
    assert.deepEqual(gitHead(wt), { branch: 'feature/map', worktree: true })
    git(repo, 'checkout', '-q', '--detach')
    assert.match(gitHead(repo).branch ?? '', /^[0-9a-f]{7}$/, 'a detached HEAD shows its short commit')
    assert.deepEqual(gitHead(base), {}, 'not a repo: nothing to show')
  })

  test('only a newer plain release counts as an update', () => {
    assert.ok(newerVersion('0.6.0', '0.5.0'))
    assert.ok(newerVersion('1.0.0', '0.9.9'))
    assert.ok(newerVersion('0.5.10', '0.5.9'))
    assert.ok(!newerVersion('0.5.0', '0.5.0'))
    assert.ok(!newerVersion('0.4.9', '0.5.0'))
    assert.ok(!newerVersion('0.7.0-beta.1', '0.6.0'))
  })
})
